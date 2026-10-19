import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MIN, makeCard, makeReviewCard, T0 } from '../test/factories';
import { classify, pickNext, type QueueInput, queueCounts } from './queue';
import type { Card } from './types';

const NOW = T0;
const DAY_END = T0 + 16 * HOUR; // 4am next day

function input(cards: Card[], over: Partial<QueueInput> = {}): QueueInput {
  const rank = new Map(cards.map((c, i) => [c.id, i]));
  return {
    now: NOW,
    dayEnd: DAY_END,
    cards,
    isTopicActive: () => true,
    newRank: (c) => rank.get(c.id) ?? 0,
    newRemaining: () => 10,
    answeredToday: { itemIds: new Set(), cardIds: new Set() },
    // Lower stability → lower retrievability at NOW (all due at the same time).
    retrievability: (c) => Math.min(0.99, c.fsrs.stability / 100),
    reviewsSinceNew: 0,
    seed: 42,
    ...over,
  };
}

describe('pickNext', () => {
  it('returns null for an empty queue', () => {
    expect(pickNext(input([]))).toBeNull();
  });

  it('serves due learning cards before anything else', () => {
    const review = makeReviewCard(NOW - DAY, 5);
    const learning = makeCard({ state: 1, due: NOW - MIN });
    const fresh = makeCard();
    expect(pickNext(input([review, fresh, learning]))).toEqual({
      card: learning,
      kind: 'learning',
    });
  });

  it('orders reviews by lowest retrievability first', () => {
    const safe = makeReviewCard(NOW - HOUR, 80, { topicId: 'a' });
    const atRisk = makeReviewCard(NOW - HOUR, 20, { topicId: 'b' });
    expect(pickNext(input([safe, atRisk]))?.card).toBe(atRisk);
  });

  it('includes reviews due later today but not tomorrow', () => {
    const tonight = makeReviewCard(NOW + 10 * HOUR, 30);
    const tomorrow = makeReviewCard(DAY_END + HOUR, 30);
    const snap = classify(input([tonight, tomorrow]));
    expect(snap.reviews).toEqual([tonight]);
  });

  it('interleaves topics: avoids repeating the previous topic when possible', () => {
    const a1 = makeReviewCard(NOW, 10, { topicId: 'a' });
    const a2 = makeReviewCard(NOW, 30, { topicId: 'a' });
    const b1 = makeReviewCard(NOW, 60, { topicId: 'b' });
    expect(pickNext(input([a1, a2, b1], { lastTopicId: 'a' }))?.card).toBe(b1);
    // Falls back to the same topic when it's the only one left.
    expect(pickNext(input([a1, a2], { lastTopicId: 'a' }))?.card).toBe(a1);
  });

  it('is deterministic for a given seed and varies tie order across seeds', () => {
    const cards = Array.from({ length: 12 }, () => makeReviewCard(NOW, 50));
    const order = (seed: number) => classify(input(cards, { seed })).reviews.map((c) => c.id);
    expect(order(1)).toEqual(order(1));
    expect(order(1)).not.toEqual(order(2));
  });

  it('spreads new cards evenly among reviews', () => {
    const reviews = Array.from({ length: 8 }, (_, i) =>
      makeReviewCard(NOW, 10 + i, { topicId: `t${i}` }),
    );
    const news = [makeCard(), makeCard()];
    const all = [...reviews, ...news];
    // 8 reviews / 2 new → a new card after every 4 reviews.
    expect(pickNext(input(all, { reviewsSinceNew: 0 }))?.kind).toBe('review');
    expect(pickNext(input(all, { reviewsSinceNew: 3 }))?.kind).toBe('review');
    expect(pickNext(input(all, { reviewsSinceNew: 4 }))?.kind).toBe('new');
    // With no reviews left, new cards flow continuously.
    expect(pickNext(input(news, { reviewsSinceNew: 0 }))?.kind).toBe('new');
  });

  it('introduces new cards in curriculum order, only from active topics, within the allowance', () => {
    const inactive = makeCard({ topicId: 'off' });
    const first = makeCard({ topicId: 'on' });
    const second = makeCard({ topicId: 'on' });
    const third = makeCard({ topicId: 'on', courseId: 'other' });
    const snap = classify(
      input([inactive, second, first, third], {
        isTopicActive: (t) => t === 'on',
        newRank: (c) => (c === first ? 0 : c === second ? 1 : 2),
        newRemaining: (courseId) => (courseId === 'course-x' ? 1 : 5),
      }),
    );
    expect(snap.news).toEqual([first, third]);
  });

  it('introduces at most one new card per item per day', () => {
    const fwd = makeCard({ itemId: 'item-1', key: 'fwd' });
    const rev = makeCard({ itemId: 'item-1', key: 'rev' });
    expect(classify(input([fwd, rev])).news).toEqual([fwd]);
  });

  it('buries siblings of items answered today, but never the answered card itself', () => {
    const answered = makeCard({ itemId: 'item-1', key: 'fwd', state: 3, due: NOW - MIN });
    const sibling = makeReviewCard(NOW, 10, { itemId: 'item-1', key: 'rev' });
    const newSibling = makeCard({ itemId: 'item-1', key: 'c2' });
    const answeredToday = { itemIds: new Set(['item-1']), cardIds: new Set([answered.id]) };
    const snap = classify(input([answered, sibling, newSibling], { answeredToday }));
    expect(snap.learningDue).toEqual([answered]);
    expect(snap.reviews).toEqual([]);
    expect(snap.news).toEqual([]);
  });

  it('skips suspended and deleted cards', () => {
    const suspended = makeReviewCard(NOW, 10, { suspended: true });
    const deleted = makeReviewCard(NOW, 10, { deletedAt: NOW });
    expect(pickNext(input([suspended, deleted]))).toBeNull();
  });

  it('learns ahead only when nothing else is left', () => {
    const soon = makeCard({ state: 1, due: NOW + 5 * MIN });
    const later = makeCard({ state: 1, due: NOW + 2 * HOUR });
    const review = makeReviewCard(NOW, 10);
    expect(pickNext(input([soon, review]))?.card).toBe(review);
    expect(pickNext(input([soon]))).toEqual({ card: soon, kind: 'learning' });
    expect(pickNext(input([later]))).toBeNull();
  });
});

describe('queueCounts', () => {
  it('counts what a session would show now: learning within learn-ahead, reviews, new', () => {
    const cards = [
      makeCard({ state: 1, due: NOW - MIN }),
      makeCard({ state: 1, due: NOW + 15 * MIN }),
      makeCard({ state: 3, due: NOW + 2 * HOUR }),
      makeReviewCard(NOW - DAY, 10),
      makeReviewCard(NOW + 2 * DAY, 10),
      makeCard(),
      makeCard(),
    ];
    expect(queueCounts(input(cards, { newRemaining: () => 1 }))).toEqual({
      learning: 2,
      review: 1,
      new: 1,
      nextLearningDue: NOW + 2 * HOUR,
    });
  });
});
