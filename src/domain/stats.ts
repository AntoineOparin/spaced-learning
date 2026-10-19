/** Dashboard metrics. Pure functions over cards and review logs. */
import { studyDaysBetween } from './day';
import { alive, type Card, CardState, Rating, type ReviewLog } from './types';

const MATURE_DAYS = 21;

/**
 * Number of (non-new, unsuspended) cards due per study day for the next `days` days.
 * Index 0 is today and includes everything overdue.
 */
export function forecast(
  cards: readonly Card[],
  now: number,
  dayStartHour: number,
  days: number,
): number[] {
  const out = new Array<number>(days).fill(0);
  for (const card of alive(cards)) {
    if (card.suspended || card.state === CardState.New) continue;
    const offset = Math.max(0, studyDaysBetween(now, card.due, dayStartHour));
    if (offset < days) out[offset] = (out[offset] ?? 0) + 1;
  }
  return out;
}

export interface DaySummary {
  reviewed: number;
  newIntroduced: number;
  again: number;
  timeMs: number;
}

export function daySummary(logs: readonly ReviewLog[], dayStart: number): DaySummary {
  const summary: DaySummary = { reviewed: 0, newIntroduced: 0, again: 0, timeMs: 0 };
  for (const log of alive(logs)) {
    if (log.review < dayStart) continue;
    summary.reviewed++;
    if (log.state === CardState.New) summary.newIntroduced++;
    if (log.rating === Rating.Again) summary.again++;
    summary.timeMs += log.durationMs;
  }
  return summary;
}

export interface Retention {
  passed: number;
  total: number;
  /** null when there are no qualifying reviews. */
  rate: number | null;
}

/**
 * "True retention": the pass rate of reviews of cards in the Review state (learning steps and
 * first exposures excluded) since `since`. Compare with the desired retention.
 */
export function trueRetention(logs: readonly ReviewLog[], since: number): Retention {
  let passed = 0;
  let total = 0;
  for (const log of alive(logs)) {
    if (log.review < since || log.state !== CardState.Review) continue;
    total++;
    if (log.rating !== Rating.Again) passed++;
  }
  return { passed, total, rate: total ? passed / total : null };
}

export interface Maturity {
  new: number;
  learning: number;
  young: number;
  mature: number;
  suspended: number;
}

export function maturity(cards: readonly Card[]): Maturity {
  const m: Maturity = { new: 0, learning: 0, young: 0, mature: 0, suspended: 0 };
  for (const card of alive(cards)) {
    if (card.suspended) m.suspended++;
    else if (card.state === CardState.New) m.new++;
    else if (card.state === CardState.Review) {
      if (card.fsrs.scheduled_days >= MATURE_DAYS) m.mature++;
      else m.young++;
    } else m.learning++;
  }
  return m;
}

export function isLeech(card: Card, threshold: number): boolean {
  return card.fsrs.lapses >= threshold;
}

export function leeches(cards: readonly Card[], threshold: number): Card[] {
  return alive(cards)
    .filter((c) => isLeech(c, threshold))
    .sort((a, b) => b.fsrs.lapses - a.fsrs.lapses);
}

export interface TopicDifficulty {
  topicId: string;
  reviews: number;
  lapses: number;
  lapseRate: number;
}

/**
 * Topics ranked by lapse rate of Review-state reviews since `since`.
 * Topics with fewer than `minReviews` reviews are excluded (too little evidence).
 */
export function weakestTopics(
  logs: readonly ReviewLog[],
  since: number,
  minReviews = 5,
): TopicDifficulty[] {
  const byTopic = new Map<string, { reviews: number; lapses: number }>();
  for (const log of alive(logs)) {
    if (log.review < since || log.state !== CardState.Review) continue;
    const entry = byTopic.get(log.topicId) ?? { reviews: 0, lapses: 0 };
    entry.reviews++;
    if (log.rating === Rating.Again) entry.lapses++;
    byTopic.set(log.topicId, entry);
  }
  return [...byTopic.entries()]
    .filter(([, e]) => e.reviews >= minReviews && e.lapses > 0)
    .map(([topicId, e]) => ({ topicId, ...e, lapseRate: e.lapses / e.reviews }))
    .sort((a, b) => b.lapseRate - a.lapseRate);
}

export interface Streak {
  /** Consecutive study days with at least one review, ending today or yesterday. */
  days: number;
  /** Whether today already counts. If not, the streak is alive until today ends. */
  today: boolean;
}

/**
 * The current study streak from review timestamps (pass only non-deleted reviews). A streak
 * survives until a whole study day passes without a review, so it isn't "broken" in the
 * morning before you've had a chance to study.
 */
export function studyStreak(
  reviewTimes: Iterable<number>,
  now: number,
  dayStartHour: number,
): Streak {
  const daysAgo = new Set<number>();
  for (const t of reviewTimes) {
    const d = studyDaysBetween(t, now, dayStartHour);
    if (d >= 0) daysAgo.add(d);
  }
  const today = daysAgo.has(0);
  let days = 0;
  for (let d = today ? 0 : 1; daysAgo.has(d); d++) days++;
  return { days, today };
}
