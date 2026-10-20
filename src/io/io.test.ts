import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from '../db/db';
import { SYNC_CURSOR_KEY } from '../db/metaKeys';
import { Repo } from '../db/repo';
import { T0 } from '../test/factories';
import { exportBackup, summarizeBackup } from './backup';
import { installContentPack } from './contentPack';
import { backupSchema, type ContentPack, contentPackSchema, parseJson } from './schema';

let db: AppDB;
let repo: Repo;
let now = T0;
let n = 0;

beforeEach(() => {
  db = new AppDB(`io-test-${++n}`);
  now = T0;
  repo = new Repo(db, () => now);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

async function seed() {
  const course = await repo.createCourse({ name: 'Calc 2', description: 'Integrals' });
  const topic = await repo.createTopic({ courseId: course.id, parentId: null, name: 'Parts' });
  const item = await repo.saveItem({
    topicId: topic.id,
    type: 'cloze',
    fields: {
      prompt: '$\\int u\\,dv = {{c1::uv}} - \\int v\\,du$',
      answer: '',
      explanation: 'Product rule',
    },
    tags: ['formula'],
  });
  const card = await db.cards.where('itemId').equals(item.id).first();
  if (!card) throw new Error('missing card');
  // 'drawn' is the newest answer mode; backups must round-trip it.
  await repo.recordReview({ cardId: card.id, rating: 3, durationMs: 3000, mode: 'drawn' });
  await repo.updateSettings({ newPerDay: 12 });
  await repo.deleteItem(
    (
      await repo.saveItem({
        topicId: topic.id,
        type: 'basic',
        fields: { prompt: 'x', answer: 'y' },
      })
    ).id,
  );
}

describe('backup export / restore', () => {
  it('round-trips losslessly through JSON (apart from the restore stamp)', async () => {
    await seed();
    const backup = await exportBackup(repo, T0 + 10);
    const parsed = parseJson(JSON.stringify(backup), backupSchema);
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    expect(parsed.data).toEqual(backup);

    await repo.setMeta(SYNC_CURSOR_KEY, 42);
    const other = new AppDB(`io-test-restore-${n}`);
    const otherRepo = new Repo(other, () => T0 + 20);
    await otherRepo.restoreSnapshot(parsed.data);
    const roundTrip = await exportBackup(otherRepo, T0 + 10);
    const unstamp = (b: typeof backup) =>
      Object.fromEntries(
        Object.entries(b).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.map(({ updatedAt: _u, dirty: _d, ...rest }) => rest) : v,
        ]),
      );
    expect(unstamp(roundTrip)).toEqual(unstamp(backup));
    expect(
      (await other.cards.toArray()).every((c) => c.dirty === 1 && c.updatedAt === T0 + 20),
    ).toBe(true);
    other.close();
    await other.delete();
  });

  it('restore replaces existing data and resets the sync cursor', async () => {
    await seed();
    const backup = await exportBackup(repo, T0);
    await repo.createCourse({ name: 'Created after backup' });
    await repo.setMeta(SYNC_CURSOR_KEY, 99);
    now = T0 + 1;
    await repo.restoreSnapshot(backup);
    expect((await db.courses.toArray()).map((c) => c.name)).toEqual(['Calc 2']);
    expect(await repo.getMeta(SYNC_CURSOR_KEY)).toBeUndefined();
  });

  it('summarizes alive records', async () => {
    await seed();
    expect(summarizeBackup(await exportBackup(repo, T0))).toEqual({
      exportedAt: T0,
      courses: 1,
      items: 1,
      cards: 1,
      reviews: 1,
    });
  });

  it('rejects invalid files with readable errors and writes nothing', async () => {
    expect(parseJson('not json', backupSchema)).toMatchObject({ ok: false });
    const bad = parseJson(
      JSON.stringify({ format: 'spaced-learning-backup', version: 1 }),
      backupSchema,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/exportedAt/);

    await seed();
    const backup = await exportBackup(repo, T0);
    // A record that violates a constraint aborts the whole restore.
    const corrupt = { ...backup, cards: [...backup.cards, ...backup.cards] }; // duplicate primary key
    const target = new AppDB(`io-test-corrupt-${n}`);
    const targetRepo = new Repo(target, () => now);
    await targetRepo.createCourse({ name: 'Existing' });
    await expect(targetRepo.restoreSnapshot(corrupt)).rejects.toThrow();
    expect((await target.courses.toArray()).map((c) => c.name)).toEqual(['Existing']);
    target.close();
    await target.delete();
  });
});

const pack: ContentPack = {
  format: 'spaced-learning-content',
  version: 1,
  deck: { id: 'demo', version: 1, title: 'Demo' },
  courses: [{ key: 'calc', name: 'Calculus' }],
  topics: [
    { key: 'trig', courseKey: 'calc', parentKey: null, name: 'Trig' },
    { key: 'trig-double', courseKey: 'calc', parentKey: 'trig', name: 'Double angle' },
    { key: 'series', courseKey: 'calc', parentKey: null, name: 'Series' },
  ],
  items: [
    {
      key: 'sin2x',
      topicKey: 'trig-double',
      type: 'cloze',
      prompt: '$\\sin 2x = {{c1::2\\sin x\\cos x}}$',
      answer: '',
    },
    {
      key: 'geo',
      topicKey: 'series',
      type: 'basic',
      prompt: 'Geometric series sum?',
      answer: '$\\frac{a}{1-r}$',
      reverse: true,
      tags: ['formula'],
    },
  ],
};

describe('content packs', () => {
  it('validates structure and references', () => {
    expect(contentPackSchema.safeParse(pack).success).toBe(true);
    const broken = { ...pack, items: [{ ...pack.items[0], topicKey: 'nope' }, pack.items[0]] };
    const result = parseJson(JSON.stringify(broken), contentPackSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join('\n')).toMatch(/unknown topic "nope"/);
      expect(result.errors.join('\n')).toMatch(/duplicate item key "sin2x"/);
    }
  });

  it('installs courses, topics (with activation) and items with cards', async () => {
    const summary = await installContentPack(repo, pack, { activeTopicKeys: new Set(['trig']) });
    expect(summary).toMatchObject({
      coursesCreated: 1,
      topicsCreated: 3,
      itemsCreated: 2,
      itemsSkipped: 0,
    });
    const topics = await db.topics.toArray();
    const active = Object.fromEntries(topics.map((t) => [t.name, t.active]));
    expect(active).toEqual({ Trig: true, 'Double angle': true, Series: false });
    const sub = topics.find((t) => t.name === 'Double angle');
    expect(sub?.parentId).toBe(topics.find((t) => t.name === 'Trig')?.id);
    expect(await db.cards.count()).toBe(3); // cloze c1 + fwd + rev
    const geo = (await db.items.toArray()).find((i) => i.origin?.key === 'geo');
    expect(geo).toMatchObject({
      tags: ['formula'],
      options: { reverse: true },
      origin: { deck: 'demo', version: 1 },
    });
  });

  it('re-installing is idempotent and does not resurrect deleted items', async () => {
    await installContentPack(repo, pack);
    const geo = (await db.items.toArray()).find((i) => i.origin?.key === 'geo');
    if (!geo) throw new Error('missing');
    await repo.deleteItem(geo.id);
    const again = await installContentPack(repo, pack);
    expect(again).toMatchObject({
      coursesCreated: 0,
      topicsCreated: 0,
      itemsCreated: 0,
      itemsSkipped: 2,
    });
    expect(await db.courses.count()).toBe(1);
  });

  it('is atomic: a failure installs nothing', async () => {
    const bad = {
      ...pack,
      items: [
        ...pack.items,
        { key: 'x', topicKey: 'missing', type: 'basic' as const, prompt: 'q', answer: 'a' },
      ],
    };
    await expect(installContentPack(repo, bad)).rejects.toThrow(/Unknown topic/);
    expect(await db.courses.count()).toBe(0);
    expect(await db.items.count()).toBe(0);
  });
});
