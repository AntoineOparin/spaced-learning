/**
 * Read-side queries. Pages read through these (or the hooks in `hooks.ts`) rather than touching
 * Dexie tables directly; writes go through `Repo`.
 *
 * `loadStudyData` + `buildQueueInput` are shared by the dashboard and the study session so the
 * counts shown on the dashboard always match what a session will serve.
 */
import { DAY, endOfStudyDay, startOfStudyDay } from '../domain/day';
import type { QueueInput } from '../domain/queue';
import { type Scheduler, schedulerForCourse } from '../domain/scheduler';
import { type Streak, studyStreak } from '../domain/stats';
import { buildNewRank, effectiveActiveTopicIds, subtreeIds } from '../domain/topics';
import {
  alive,
  type Card,
  CardState,
  type Course,
  type Item,
  type ReviewLog,
  type Settings,
  type Topic,
} from '../domain/types';
import type { AppDB } from './db';

export interface StudyData {
  settings: Settings;
  courses: Course[];
  topics: Topic[];
  items: Item[];
  cards: Card[];
  /** Alive review logs since the start of the current study day. */
  todayLogs: ReviewLog[];
}

export interface Scope {
  courseId?: string;
  topicId?: string;
}

export interface SessionState {
  reviewsSinceNew: number;
  lastTopicId: string | null;
  seed: number;
}

export async function loadStudyData(
  db: AppDB,
  settings: Settings,
  now: number,
): Promise<StudyData> {
  const dayStart = startOfStudyDay(now, settings.dayStartHour);
  return db.transaction(
    'r',
    [db.courses, db.topics, db.items, db.cards, db.reviewLogs],
    async () => {
      // Independent reads, issued together so IndexedDB can pipeline them.
      const [courses, topics, items, cards, todayLogs] = await Promise.all([
        db.courses.toArray(),
        db.topics.toArray(),
        db.items.toArray(),
        db.cards.toArray(),
        db.reviewLogs.where('review').aboveOrEqual(dayStart).toArray(),
      ]);
      return {
        settings,
        courses: alive(courses),
        topics: alive(topics),
        items: alive(items),
        cards: alive(cards),
        todayLogs: alive(todayLogs),
      };
    },
  );
}

/** Cards in scope: archived courses are excluded unless explicitly selected. */
export function scopeCards(data: StudyData, scope: Scope): Card[] {
  if (scope.topicId) {
    const ids = subtreeIds(data.topics, scope.topicId);
    return data.cards.filter((c) => ids.has(c.topicId));
  }
  if (scope.courseId) return data.cards.filter((c) => c.courseId === scope.courseId);
  const archived = new Set(data.courses.filter((c) => c.archived).map((c) => c.id));
  return data.cards.filter((c) => !archived.has(c.courseId));
}

export function newIntroducedToday(logs: readonly ReviewLog[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (log.state === CardState.New) counts.set(log.courseId, (counts.get(log.courseId) ?? 0) + 1);
  }
  return counts;
}

export function buildQueueInput(
  data: StudyData,
  scope: Scope,
  session: SessionState,
  now: number,
): QueueInput {
  const { settings } = data;
  const courseById = new Map(data.courses.map((c) => [c.id, c]));
  const active = effectiveActiveTopicIds(data.topics);
  const introduced = newIntroducedToday(data.todayLogs);
  const schedulers = new Map<string, Scheduler>();
  const schedulerFor = (courseId: string) => {
    let s = schedulers.get(courseId);
    if (!s) {
      s = schedulerForCourse(settings, courseById.get(courseId));
      schedulers.set(courseId, s);
    }
    return s;
  };

  // The curriculum ranking sorts every item, and only ordered queues need it: build it lazily.
  let rank: ((card: Card) => number) | undefined;

  return {
    now,
    dayEnd: endOfStudyDay(now, settings.dayStartHour),
    cards: scopeCards(data, scope),
    isTopicActive: (topicId) => active.has(topicId),
    newRank: (card) => {
      rank ??= buildNewRank(data.courses, data.topics, data.items);
      return rank(card);
    },
    newRemaining: (courseId) => {
      const limit = courseById.get(courseId)?.newPerDay ?? settings.newPerDay;
      return Math.max(0, limit - (introduced.get(courseId) ?? 0));
    },
    answeredToday: {
      itemIds: new Set(data.todayLogs.map((l) => l.itemId)),
      cardIds: new Set(data.todayLogs.map((l) => l.cardId)),
    },
    retrievability: (card) => schedulerFor(card.courseId).retrievability(card.fsrs, now),
    lastTopicId: session.lastTopicId,
    reviewsSinceNew: session.reviewsSinceNew,
    seed: session.seed,
  };
}

export const IDLE_SESSION: SessionState = { reviewsSinceNew: 0, lastTopicId: null, seed: 1 };

export interface LibraryData {
  courses: Course[];
  topics: Topic[];
  items: Item[];
  cards: Card[];
}

/** Everything the library shows: alive records, courses in display order. */
export async function loadLibraryData(db: AppDB): Promise<LibraryData> {
  const [courses, topics, items, cards] = await Promise.all([
    db.courses.toArray(),
    db.topics.toArray(),
    db.items.toArray(),
    db.cards.toArray(),
  ]);
  return {
    courses: alive(courses).sort((a, b) => a.order - b.order),
    topics: alive(topics),
    items: alive(items),
    cards: alive(cards),
  };
}

export interface DashboardData {
  data: StudyData;
  /** Alive review logs from the last 30 days. */
  recentLogs: ReviewLog[];
  streak: Streak;
  now: number;
}

const RECENT_DAYS = 30;

export async function loadDashboardData(
  db: AppDB,
  settings: Settings,
  now: number,
): Promise<DashboardData> {
  const data = await loadStudyData(db, settings, now);
  const recentLogs = alive(
    await db.reviewLogs
      .where('review')
      .aboveOrEqual(now - RECENT_DAYS * DAY)
      .toArray(),
  );
  let streak = studyStreak(
    recentLogs.map((l) => l.review),
    now,
    settings.dayStartHour,
  );
  if (streak.days >= RECENT_DAYS - 1) {
    // Long streaks outrun the window: read just the review index keys. Undone reviews are
    // counted here, which only matters on a day whose every review was undone.
    const times = await db.reviewLogs
      .where('review')
      .aboveOrEqual(now - 3 * 365 * DAY)
      .keys();
    streak = studyStreak(times as number[], now, settings.dayStartHour);
  }
  return { data, recentLogs, streak, now };
}

/** An item and its alive cards, or null when the item is missing or deleted. */
export async function loadItemWithCards(
  db: AppDB,
  itemId: string,
): Promise<{ item: Item; cards: Card[] } | null> {
  const [item, cards] = await Promise.all([
    db.items.get(itemId),
    db.cards.where('itemId').equals(itemId).toArray(),
  ]);
  return item && item.deletedAt === undefined ? { item, cards: alive(cards) } : null;
}
