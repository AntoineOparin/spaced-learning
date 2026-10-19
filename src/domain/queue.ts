/**
 * Study queue selection — a pure function of the current cards and session state, re-run after
 * every answer (no precomputed list to get stale).
 *
 * Priority:
 *  1. Learning/relearning cards that are due now (short steps must be honoured).
 *  2. Reviews due before the end of the study day, lowest retrievability first (most at risk),
 *     interleaved: prefer a card whose topic differs from the previous card's topic.
 *     New cards are spread evenly between reviews.
 *  3. New cards from active topics, in curriculum order, within each course's daily allowance.
 *  4. Learning cards due within the learn-ahead window, when nothing else is left.
 * Siblings (other cards of an item answered today) are buried until tomorrow.
 */
import { MINUTE } from './day';
import { type Card, CardState } from './types';

const LEARN_AHEAD_MS = 20 * MINUTE;

export interface QueueInput {
  now: number;
  /** End of the current study day (exclusive). */
  dayEnd: number;
  /** Alive cards in scope; suspended cards are filtered here. */
  cards: readonly Card[];
  isTopicActive: (topicId: string) => boolean;
  /** Curriculum rank of a new card (lower = earlier). */
  newRank: (card: Card) => number;
  /** Remaining new-card allowance today for a course. */
  newRemaining: (courseId: string) => number;
  answeredToday: { itemIds: ReadonlySet<string>; cardIds: ReadonlySet<string> };
  retrievability: (card: Card) => number;
  lastTopicId?: string | null;
  reviewsSinceNew: number;
  /** Session seed for deterministic tie-breaking among similarly-at-risk cards. */
  seed: number;
}

export type QueueKind = 'learning' | 'review' | 'new';

export interface QueuePick {
  card: Card;
  kind: QueueKind;
}

export interface QueueSnapshot {
  /** Learning cards due now, earliest first. */
  learningDue: Card[];
  /** Learning cards due later today, earliest first. */
  learningLater: Card[];
  /** Due reviews in priority order. */
  reviews: Card[];
  /** Introducible new cards in curriculum order (already capped by daily allowances). */
  news: Card[];
}

function hash(s: string): number {
  // FNV-1a, 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Retrievability bucket width: cards within ~2 percentage points are treated as ties. */
const R_BUCKET = 50;

function isLearning(card: Card): boolean {
  return card.state === CardState.Learning || card.state === CardState.Relearning;
}

/**
 * Buckets the cards in scope. With `ordered: false` (enough for counts) the review and new-card
 * lists come back unsorted: their lengths don't depend on order, and skipping the ordering saves
 * a retrievability computation per review and the curriculum ranking.
 */
export function classify(input: QueueInput, { ordered = true } = {}): QueueSnapshot {
  const { now, dayEnd, answeredToday } = input;
  const learningDue: Card[] = [];
  const learningLater: Card[] = [];
  const reviewCandidates: Card[] = [];
  const newCandidates: Card[] = [];

  for (const card of input.cards) {
    if (card.suspended || card.deletedAt !== undefined) continue;
    if (isLearning(card)) {
      if (card.due <= now) learningDue.push(card);
      else if (card.due < dayEnd) learningLater.push(card);
      continue;
    }
    const buried = answeredToday.itemIds.has(card.itemId) && !answeredToday.cardIds.has(card.id);
    if (buried) continue;
    if (card.state === CardState.Review) {
      if (card.due < dayEnd) reviewCandidates.push(card);
    } else if (card.state === CardState.New && input.isTopicActive(card.topicId)) {
      newCandidates.push(card);
    }
  }

  learningDue.sort((a, b) => a.due - b.due);
  learningLater.sort((a, b) => a.due - b.due);

  let reviews = reviewCandidates;
  if (ordered) {
    const keyed = reviewCandidates.map((card) => ({
      card,
      bucket: Math.floor(input.retrievability(card) * R_BUCKET),
      tie: hash(`${input.seed}:${card.id}`),
    }));
    keyed.sort((a, b) => a.bucket - b.bucket || a.tie - b.tie);
    reviews = keyed.map((k) => k.card);

    const rank = new Map(newCandidates.map((c) => [c.id, input.newRank(c)] as const));
    newCandidates.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }
  const used = new Map<string, number>();
  const news: Card[] = [];
  // Siblings of an item must not both be introduced today: keep only the first card per item.
  const seenItems = new Set<string>();
  for (const card of newCandidates) {
    if (seenItems.has(card.itemId)) continue;
    const taken = used.get(card.courseId) ?? 0;
    if (taken >= input.newRemaining(card.courseId)) continue;
    used.set(card.courseId, taken + 1);
    seenItems.add(card.itemId);
    news.push(card);
  }

  return { learningDue, learningLater, reviews, news };
}

function pickReview(reviews: Card[], lastTopicId: string | null | undefined): Card | undefined {
  if (lastTopicId) {
    const other = reviews.find((c) => c.topicId !== lastTopicId);
    if (other) return other;
  }
  return reviews[0];
}

export function pickNext(input: QueueInput): QueuePick | null {
  const snap = classify(input);

  const learning = snap.learningDue[0];
  if (learning) return { card: learning, kind: 'learning' };

  const reviewsLeft = snap.reviews.length;
  const newLeft = snap.news.length;
  // Spread new cards evenly: introduce one after every ≈ reviewsLeft / newLeft reviews.
  const wantNew = newLeft > 0 && input.reviewsSinceNew * newLeft >= reviewsLeft;

  if (wantNew) {
    const card = snap.news[0];
    if (card) return { card, kind: 'new' };
  }
  const review = pickReview(snap.reviews, input.lastTopicId);
  if (review) return { card: review, kind: 'review' };
  const fresh = snap.news[0];
  if (fresh) return { card: fresh, kind: 'new' };

  const soon = snap.learningLater[0];
  if (soon && soon.due <= input.now + LEARN_AHEAD_MS) return { card: soon, kind: 'learning' };
  return null;
}

export interface QueueCounts {
  learning: number;
  review: number;
  new: number;
  /** Earliest due time of a learning card beyond the learn-ahead window (for "come back at"). */
  nextLearningDue: number | null;
}

export function queueCounts(input: QueueInput): QueueCounts {
  const snap = classify(input, { ordered: false });
  return {
    learning: snap.learningDue.length + snap.learningLater.length,
    review: snap.reviews.length,
    new: snap.news.length,
    nextLearningDue: snap.learningLater[0]?.due ?? null,
  };
}
