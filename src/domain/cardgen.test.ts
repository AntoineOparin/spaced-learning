import { describe, expect, it } from 'vitest';
import { makeCard, makeItem, T0 } from '../test/factories';
import { cardKeysForItem, clozeOrdinalFromKey, reconcileCards } from './cardgen';

describe('cardKeysForItem', () => {
  it('generates forward (and reverse) keys for basic items', () => {
    expect(cardKeysForItem(makeItem())).toEqual(['fwd']);
    expect(cardKeysForItem(makeItem({ options: { reverse: true } }))).toEqual(['fwd', 'rev']);
  });

  it('generates one key per cloze ordinal', () => {
    const item = makeItem({
      type: 'cloze',
      fields: { prompt: '{{c2::a}} {{c1::b}} {{c2::c}}', answer: '' },
    });
    expect(cardKeysForItem(item)).toEqual(['c1', 'c2']);
    expect(clozeOrdinalFromKey('c12')).toBe(12);
    expect(clozeOrdinalFromKey('fwd')).toBeNull();
  });
});

describe('reconcileCards', () => {
  it('creates cards for a new item', () => {
    const item = makeItem({ options: { reverse: true } });
    const { create, update } = reconcileCards(item, [], T0);
    expect(create.map((c) => c.key)).toEqual(['fwd', 'rev']);
    expect(create.every((c) => c.itemId === item.id && c.state === 0 && c.dirty === 1)).toBe(true);
    expect(update).toEqual([]);
  });

  it('keeps existing cards (and their scheduling) untouched when keys still exist', () => {
    const item = makeItem();
    const fwd = makeCard({ itemId: item.id, key: 'fwd', topicId: item.topicId, state: 2 });
    const { create, update } = reconcileCards(item, [fwd], T0 + 1);
    expect(create).toEqual([]);
    expect(update).toEqual([]);
  });

  it('tombstones removed clozes and revives them when re-added', () => {
    const base = { type: 'cloze' as const, topicId: 'topic-x', courseId: 'course-x' };
    const item = makeItem({ ...base, fields: { prompt: '{{c1::a}} {{c2::b}}', answer: '' } });
    const c1 = makeCard({ itemId: item.id, key: 'c1', fsrs: { reps: 4 } });
    const c2 = makeCard({ itemId: item.id, key: 'c2', fsrs: { reps: 7 } });

    const edited = { ...item, fields: { prompt: '{{c1::a}} b', answer: '' } };
    const removed = reconcileCards(edited, [c1, c2], T0 + 1);
    expect(removed.create).toEqual([]);
    expect(removed.update).toHaveLength(1);
    expect(removed.update[0]).toMatchObject({ id: c2.id, deletedAt: T0 + 1, dirty: 1 });

    const tombstoned = removed.update[0];
    if (!tombstoned) throw new Error('expected an update');
    const readded = reconcileCards(item, [c1, tombstoned], T0 + 2);
    expect(readded.create).toEqual([]);
    expect(readded.update).toHaveLength(1);
    expect(readded.update[0]?.deletedAt).toBeUndefined();
    expect(readded.update[0]?.fsrs.reps).toBe(7); // history preserved
  });

  it('toggling reverse off tombstones the reverse card', () => {
    const item = makeItem({ options: { reverse: true } });
    const fwd = makeCard({ itemId: item.id, key: 'fwd' });
    const rev = makeCard({ itemId: item.id, key: 'rev' });
    const { update } = reconcileCards({ ...item, options: {} }, [fwd, rev], T0);
    expect(update.map((c) => [c.key, c.deletedAt])).toEqual([['rev', T0]]);
  });

  it('moves cards with their item to another topic', () => {
    const item = makeItem({ topicId: 'topic-new' });
    const fwd = makeCard({ itemId: item.id, key: 'fwd', topicId: 'topic-old' });
    const { update } = reconcileCards(item, [fwd], T0);
    expect(update[0]).toMatchObject({ topicId: 'topic-new', dirty: 1, updatedAt: T0 });
  });

  it('tombstones all cards of a deleted item and ignores already-dead cards', () => {
    const item = makeItem({ deletedAt: T0 });
    const live = makeCard({ itemId: item.id, key: 'fwd' });
    const dead = makeCard({ itemId: item.id, key: 'rev', deletedAt: T0 - 1, topicId: 'other' });
    const { create, update } = reconcileCards(item, [live, dead], T0);
    expect(create).toEqual([]);
    expect(update.map((c) => c.id)).toEqual([live.id]);
  });
});
