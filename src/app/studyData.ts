/**
 * Loads everything the queue needs and builds `QueueInput`s. Shared by the dashboard and the
 * study session so the counts shown on the dashboard always match what a session will serve.
 */
import type { AppDB } from '../db/db';
import { endOfStudyDay, startOfStudyDay } from '../domain/day';
import type { QueueInput } from '../domain/queue';
import { type Scheduler, schedulerForCourse } from '../domain/scheduler';
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
    async () => ({
      settings,
      courses: alive(await db.courses.toArray()),
      topics: alive(await db.topics.toArray()),
      items: alive(await db.items.toArray()),
      cards: alive(await db.cards.toArray()),
      todayLogs: alive(await db.reviewLogs.where('review').aboveOrEqual(dayStart).toArray()),
    }),
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

  return {
    now,
    dayEnd: endOfStudyDay(now, settings.dayStartHour),
    cards: scopeCards(data, scope),
    isTopicActive: (topicId) => active.has(topicId),
    newRank: buildNewRank(data.courses, data.topics, data.items),
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
