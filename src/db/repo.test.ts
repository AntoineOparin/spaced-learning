import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DAY, T0 } from '../test/factories';
import { AppDB } from './db';
import { Repo } from './repo';

let db: AppDB;
let now = T0;
let repo: Repo;
let n = 0;

beforeEach(async () => {
  db = new AppDB(`repo-test-${++n}`);
  now = T0;
  repo = new Repo(db, () => now);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

async function setup() {
  const course = await repo.createCourse({ name: ' Calculus 2 ' });
  const topic = await repo.createTopic({ courseId: course.id, parentId: null, name: 'Series' });
  return { course, topic };
}

describe('settings and meta', () => {
  it('returns defaults until changed, then persists a dirty record', async () => {
    expect((await repo.getSettings()).desiredRetention).toBe(0.9);
    expect(await db.settings.count()).toBe(0);
    now = T0 + 1;
    const s = await repo.updateSettings({ newPerDay: 20 });
    expect(s).toMatchObject({ newPerDay: 20, desiredRetention: 0.9, updatedAt: T0 + 1, dirty: 1 });
    await repo.setMeta('theme', 'dark');
    expect(await repo.getMeta('theme')).toBe('dark');
  });
});

describe('courses and topics', () => {
  it('creates records stamped for sync', async () => {
    const { course, topic } = await setup();
    expect(course).toMatchObject({ name: 'Calculus 2', order: 0, dirty: 1, updatedAt: T0 });
    expect(topic).toMatchObject({ courseId: course.id, parentId: null, active: true, order: 0 });
  });

  it('rejects subtopics nested deeper than one level', async () => {
    const { course, topic } = await setup();
    const sub = await repo.createTopic({ courseId: course.id, parentId: topic.id, name: 'Tests' });
    await expect(
      repo.createTopic({ courseId: course.id, parentId: sub.id, name: 'Too deep' }),
    ).rejects.toThrow(/cannot have subtopics/);
  });

  it('reorders siblings', async () => {
    const { course, topic } = await setup();
    const second = await repo.createTopic({ courseId: course.id, parentId: null, name: 'B' });
    await repo.moveTopic(second.id, -1);
    const sorted = (await db.topics.toArray()).sort((a, b) => a.order - b.order);
    expect(sorted.map((t) => t.id)).toEqual([second.id, topic.id]);
  });

  it('activates/deactivates a topic subtree', async () => {
    const { course, topic } = await setup();
    const sub = await repo.createTopic({ courseId: course.id, parentId: topic.id, name: 'Tests' });
    await repo.setTopicActive(topic.id, false);
    expect((await db.topics.get(sub.id))?.active).toBe(false);
  });

  it('clears an override when patched with undefined', async () => {
    const { course } = await setup();
    await repo.updateCourse(course.id, { desiredRetention: 0.95 });
    expect((await db.courses.get(course.id))?.desiredRetention).toBe(0.95);
    await repo.updateCourse(course.id, { desiredRetention: undefined });
    expect((await db.courses.get(course.id))?.desiredRetention).toBeUndefined();
  });
});

describe('items and cards', () => {
  it('creates an item with its cards', async () => {
    const { course, topic } = await setup();
    const item = await repo.saveItem({
      topicId: topic.id,
      type: 'basic',
      fields: { prompt: 'Q', answer: 'A' },
      options: { reverse: true },
    });
    expect(item).toMatchObject({ courseId: course.id, order: 0, dirty: 1 });
    const cards = await db.cards.where('itemId').equals(item.id).toArray();
    expect(cards.map((c) => c.key).sort()).toEqual(['fwd', 'rev']);
  });

  it('preserves card scheduling across edits and tombstones removed clozes', async () => {
    const { topic } = await setup();
    const item = await repo.saveItem({
      topicId: topic.id,
      type: 'cloze',
      fields: { prompt: '{{c1::a}} {{c2::b}}', answer: '' },
    });
    const c1 = (await db.cards.where('itemId').equals(item.id).toArray()).find(
      (c) => c.key === 'c1',
    );
    if (!c1) throw new Error('missing c1');
    await repo.recordReview({ cardId: c1.id, rating: 3, durationMs: 1000, mode: 'reveal' });
    const reviewed = await db.cards.get(c1.id);

    now = T0 + DAY;
    await repo.saveItem({ ...item, fields: { prompt: '{{c1::a}} b', answer: '' } });
    const after = await db.cards.where('itemId').equals(item.id).toArray();
    expect(after.find((c) => c.key === 'c1')?.fsrs).toEqual(reviewed?.fsrs);
    expect(after.find((c) => c.key === 'c2')?.deletedAt).toBe(T0 + DAY);
  });

  it('refuses to save over a deleted item (an edit would be lost in the tombstone)', async () => {
    const { topic } = await setup();
    const item = await repo.saveItem({
      topicId: topic.id,
      type: 'basic',
      fields: { prompt: 'Q', answer: 'A' },
    });
    await repo.deleteItem(item.id);
    await expect(repo.saveItem({ ...item, fields: { prompt: 'Q2', answer: 'A' } })).rejects.toThrow(
      'This item was deleted',
    );
    expect((await db.items.get(item.id))?.fields.prompt).toBe('Q');
  });

  it('moving an item to another course topic moves its cards', async () => {
    const { topic } = await setup();
    const other = await repo.createCourse({ name: 'Discrete' });
    const otherTopic = await repo.createTopic({
      courseId: other.id,
      parentId: null,
      name: 'Logic',
    });
    const item = await repo.saveItem({
      topicId: topic.id,
      type: 'basic',
      fields: { prompt: 'Q', answer: 'A' },
    });
    await repo.saveItem({ ...item, topicId: otherTopic.id });
    const card = await db.cards.where('itemId').equals(item.id).first();
    expect(card).toMatchObject({ courseId: other.id, topicId: otherTopic.id });
    expect((await db.items.get(item.id))?.courseId).toBe(other.id);
  });

  it('deleting a topic tombstones its subtree, items and cards but keeps review logs', async () => {
    const { course, topic } = await setup();
    const sub = await repo.createTopic({ courseId: course.id, parentId: topic.id, name: 'Sub' });
    const item = await repo.saveItem({
      topicId: sub.id,
      type: 'basic',
      fields: { prompt: 'Q', answer: 'A' },
    });
    const card = await db.cards.where('itemId').equals(item.id).first();
    if (!card) throw new Error('missing card');
    await repo.recordReview({ cardId: card.id, rating: 3, durationMs: 1, mode: 'reveal' });

    now = T0 + 5;
    await repo.deleteTopic(topic.id);
    expect((await db.topics.get(sub.id))?.deletedAt).toBe(T0 + 5);
    expect((await db.items.get(item.id))?.deletedAt).toBe(T0 + 5);
    expect((await db.cards.get(card.id))?.deletedAt).toBe(T0 + 5);
    expect((await db.reviewLogs.toArray()).every((l) => l.deletedAt === undefined)).toBe(true);
  });

  it('deleting a course cascades', async () => {
    const { course, topic } = await setup();
    await repo.saveItem({ topicId: topic.id, type: 'basic', fields: { prompt: 'Q', answer: 'A' } });
    await repo.deleteCourse(course.id);
    const alive = async (t: 'topics' | 'items' | 'cards') =>
      (await db[t].toArray()).filter((r) => r.deletedAt === undefined).length;
    expect(await alive('topics')).toBe(0);
    expect(await alive('items')).toBe(0);
    expect(await alive('cards')).toBe(0);
  });

  it('suspends cards', async () => {
    const { topic } = await setup();
    const item = await repo.saveItem({
      topicId: topic.id,
      type: 'basic',
      fields: { prompt: 'Q', answer: 'A' },
    });
    const card = await db.cards.where('itemId').equals(item.id).first();
    if (!card) throw new Error('missing card');
    await repo.setSuspended([card.id], true);
    expect((await db.cards.get(card.id))?.suspended).toBe(true);
  });
});

describe('reviews', () => {
  it('records a review atomically and undo restores the exact previous card', async () => {
    const { topic } = await setup();
    const item = await repo.saveItem({
      topicId: topic.id,
      type: 'basic',
      fields: { prompt: 'Q', answer: 'A' },
    });
    const before = await db.cards.where('itemId').equals(item.id).first();
    if (!before) throw new Error('missing card');

    now = T0 + 1000;
    const result = await repo.recordReview({
      cardId: before.id,
      rating: 3,
      durationMs: 4200.4,
      mode: 'typed',
    });
    expect(result.card.fsrs.reps).toBe(1);
    expect(result.log).toMatchObject({
      cardId: before.id,
      itemId: item.id,
      topicId: topic.id,
      rating: 3,
      state: 0,
      review: T0 + 1000,
      durationMs: 4200,
      mode: 'typed',
      dirty: 1,
    });

    now = T0 + 2000;
    await repo.undoReview(result);
    const restored = await db.cards.get(before.id);
    expect(restored?.fsrs).toEqual(before.fsrs);
    expect(restored).toMatchObject({ due: before.due, state: before.state, updatedAt: T0 + 2000 });
    expect((await db.reviewLogs.get(result.log.id))?.deletedAt).toBe(T0 + 2000);
  });

  it('uses the per-course desired retention', async () => {
    const { course, topic } = await setup();
    const item = await repo.saveItem({
      topicId: topic.id,
      type: 'basic',
      fields: { prompt: 'Q', answer: 'A' },
    });
    const card = await db.cards.where('itemId').equals(item.id).first();
    if (!card) throw new Error('missing card');
    await repo.updateSettings({ enableFuzz: false });
    const easy = await repo.recordReview({
      cardId: card.id,
      rating: 4,
      durationMs: 1,
      mode: 'reveal',
    });

    const reviewAt = easy.card.due;
    const lax = await repo.recordReview({
      cardId: card.id,
      rating: 3,
      durationMs: 1,
      mode: 'reveal',
      now: reviewAt,
    });
    await repo.undoReview(lax);
    await repo.updateCourse(course.id, { desiredRetention: 0.97 });
    const strict = await repo.recordReview({
      cardId: card.id,
      rating: 3,
      durationMs: 1,
      mode: 'reveal',
      now: reviewAt,
    });
    expect(strict.card.due).toBeLessThan(lax.card.due);
  });
});
