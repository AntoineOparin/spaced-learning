/**
 * End-to-end sync: two simulated devices (separate IndexedDBs) syncing through the real Worker
 * SQL (node:sqlite). Covers the Phase 3 acceptance criteria.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from '../../src/db/db.ts';
import { Repo } from '../../src/db/repo.ts';
import { countDirty, type SyncTransport, syncOnce } from '../../src/sync/client.ts';
import { parsePushBody, pullRecords, pushRecords, type SqlDb } from '../sync.ts';
import { createTestDb } from './sqlite.ts';

/** Round-trips through JSON like the real HTTP API. */
function transportFor(server: SqlDb): SyncTransport {
  return {
    async push(records) {
      await pushRecords(server, parsePushBody(JSON.parse(JSON.stringify({ records }))));
    },
    async pull(since, limit) {
      return JSON.parse(JSON.stringify(await pullRecords(server, since, limit)));
    },
  };
}

let n = 0;
const open: AppDB[] = [];

function device(server: SqlDb, start = 1_000) {
  const db = new AppDB(`sync-e2e-${++n}`);
  open.push(db);
  const clock = { now: start };
  const repo = new Repo(db, () => clock.now);
  const transport = transportFor(server);
  return { db, repo, clock, sync: () => syncOnce(db, transport, () => clock.now) };
}

afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

async function seed(repo: Repo) {
  const course = await repo.createCourse({ name: 'Calc 2' });
  const topic = await repo.createTopic({ courseId: course.id, parentId: null, name: 'Series' });
  const item = await repo.saveItem({
    topicId: topic.id,
    type: 'basic',
    fields: { prompt: 'Geometric series sum?', answer: '$\\frac{a}{1-r}$' },
  });
  const card = await repo.db.cards.where('itemId').equals(item.id).first();
  if (!card) throw new Error('missing card');
  return { course, topic, item, card };
}

async function snapshot(db: AppDB) {
  const strip = <T extends { dirty: 0 | 1 }>(rows: T[]) =>
    rows
      .map(({ dirty: _d, ...r }) => r)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    courses: strip(await db.courses.toArray()),
    topics: strip(await db.topics.toArray()),
    items: strip(await db.items.toArray()),
    cards: strip(await db.cards.toArray()),
    reviewLogs: strip(await db.reviewLogs.toArray()),
    settings: strip(await db.settings.toArray()),
  };
}

describe('two-device sync', () => {
  it('a new device receives everything and ends up identical', async () => {
    const server = createTestDb();
    const laptop = device(server);
    const { card } = await seed(laptop.repo);
    await laptop.repo.recordReview({
      cardId: card.id,
      rating: 3,
      durationMs: 2000,
      mode: 'reveal',
    });
    await laptop.repo.updateSettings({ newPerDay: 25 });
    await laptop.sync();
    expect(await countDirty(laptop.db)).toBe(0);

    const phone = device(server);
    const result = await phone.sync();
    expect(result.pulled).toBeGreaterThan(0);
    expect(await snapshot(phone.db)).toEqual(await snapshot(laptop.db));
    expect(await countDirty(phone.db)).toBe(0);
    expect((await phone.repo.getSettings()).newPerDay).toBe(25);
  });

  it('offline reviews on the phone reach the laptop after reconnecting', async () => {
    const server = createTestDb();
    const laptop = device(server);
    const { card } = await seed(laptop.repo);
    await laptop.sync();
    const phone = device(server);
    await phone.sync();

    // Phone studies while offline (no sync), later reconnects.
    phone.clock.now = 50_000;
    const review = await phone.repo.recordReview({
      cardId: card.id,
      rating: 4,
      durationMs: 1500,
      mode: 'reveal',
    });
    await phone.sync();
    await laptop.sync();

    expect(await laptop.db.reviewLogs.get(review.log.id)).toMatchObject({ rating: 4, dirty: 0 });
    expect((await laptop.db.cards.get(card.id))?.fsrs).toEqual(review.card.fsrs);
  });

  it('merges edits to different items made on both devices', async () => {
    const server = createTestDb();
    const laptop = device(server);
    const { topic } = await seed(laptop.repo);
    await laptop.sync();
    const phone = device(server);
    await phone.sync();

    laptop.clock.now = 10_000;
    const a = await laptop.repo.saveItem({
      topicId: topic.id,
      type: 'basic',
      fields: { prompt: 'A', answer: 'a' },
    });
    phone.clock.now = 11_000;
    const b = await phone.repo.saveItem({
      topicId: topic.id,
      type: 'basic',
      fields: { prompt: 'B', answer: 'b' },
    });

    await laptop.sync();
    await phone.sync();
    await laptop.sync();

    for (const d of [laptop, phone]) {
      expect((await d.db.items.get(a.id))?.fields.prompt).toBe('A');
      expect((await d.db.items.get(b.id))?.fields.prompt).toBe('B');
    }
    expect(await snapshot(laptop.db)).toEqual(await snapshot(phone.db));
  });

  it('when the same item is edited on both devices, the later edit wins everywhere', async () => {
    const server = createTestDb();
    const laptop = device(server);
    const { item } = await seed(laptop.repo);
    await laptop.sync();
    const phone = device(server);
    await phone.sync();

    phone.clock.now = 20_000; // later edit…
    await phone.repo.saveItem({ ...item, fields: { prompt: 'phone version', answer: 'x' } });
    laptop.clock.now = 15_000; // …earlier edit, but synced last
    await laptop.repo.saveItem({ ...item, fields: { prompt: 'laptop version', answer: 'y' } });

    await phone.sync();
    await laptop.sync(); // pulls the newer phone edit, discarding its own older one
    await phone.sync();

    for (const d of [laptop, phone]) {
      expect((await d.db.items.get(item.id))?.fields.prompt).toBe('phone version');
    }
    expect(await countDirty(laptop.db)).toBe(0);
  });

  it('propagates deletions (tombstones) including cascaded cards', async () => {
    const server = createTestDb();
    const laptop = device(server);
    const { item, card } = await seed(laptop.repo);
    await laptop.sync();
    const phone = device(server);
    await phone.sync();

    laptop.clock.now = 30_000;
    await laptop.repo.deleteItem(item.id);
    await laptop.sync();
    await phone.sync();

    expect((await phone.db.items.get(item.id))?.deletedAt).toBe(30_000);
    expect((await phone.db.cards.get(card.id))?.deletedAt).toBe(30_000);
  });

  it('reinstalling the app (empty local database) restores everything from the server', async () => {
    const server = createTestDb();
    const phone = device(server);
    const { card } = await seed(phone.repo);
    await phone.repo.recordReview({ cardId: card.id, rating: 3, durationMs: 1000, mode: 'typed' });
    await phone.sync();
    const before = await snapshot(phone.db);

    const reinstalled = device(server);
    await reinstalled.sync();
    expect(await snapshot(reinstalled.db)).toEqual(before);
  });

  it('keeps records dirty when a push fails, and retries next time', async () => {
    const server = createTestDb();
    const laptop = device(server);
    await seed(laptop.repo);
    const failing: SyncTransport = {
      push: async () => {
        throw new Error('network down');
      },
      pull: transportFor(server).pull,
    };
    await expect(syncOnce(laptop.db, failing)).rejects.toThrow('network down');
    const dirty = await countDirty(laptop.db);
    expect(dirty).toBeGreaterThan(0);

    const result = await laptop.sync();
    expect(result.pushed).toBe(dirty);
    expect(await countDirty(laptop.db)).toBe(0);
  });

  it('a record changed while its push is in flight stays dirty', async () => {
    const server = createTestDb();
    const laptop = device(server);
    const { course } = await seed(laptop.repo);
    const real = transportFor(server);
    const racing: SyncTransport = {
      pull: real.pull,
      push: async (records) => {
        await real.push(records);
        laptop.clock.now = 99_000;
        await laptop.repo.updateCourse(course.id, { name: 'Renamed mid-sync' });
      },
    };
    await syncOnce(laptop.db, racing);
    expect((await laptop.db.courses.get(course.id))?.dirty).toBe(1);
    await laptop.sync();
    const phone = device(server);
    await phone.sync();
    expect((await phone.db.courses.get(course.id))?.name).toBe('Renamed mid-sync');
  });

  it('undoing a review propagates (the log becomes a tombstone)', async () => {
    const server = createTestDb();
    const laptop = device(server);
    const { card } = await seed(laptop.repo);
    const result = await laptop.repo.recordReview({
      cardId: card.id,
      rating: 1,
      durationMs: 1000,
      mode: 'reveal',
    });
    await laptop.sync();
    const phone = device(server);
    await phone.sync();

    laptop.clock.now = 5_000;
    await laptop.repo.undoReview(result);
    await laptop.sync();
    await phone.sync();
    expect((await phone.db.reviewLogs.get(result.log.id))?.deletedAt).toBe(5_000);
    expect((await phone.db.cards.get(card.id))?.fsrs).toEqual(card.fsrs);
  });
});
