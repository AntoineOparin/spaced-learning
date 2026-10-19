/** Test-only factories for domain entities. */
import { newFsrsCard } from '../domain/scheduler';
import type { Card, Course, Item, ReviewLog, StoredFsrsCard, Topic } from '../domain/types';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

export const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime(); // 1 Oct 2026, 12:00 local
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function makeCourse(over: Partial<Course> = {}): Course {
  return {
    id: nextId('course'),
    name: 'Course',
    order: 0,
    createdAt: T0,
    updatedAt: T0,
    dirty: 0,
    ...over,
  };
}

export function makeTopic(over: Partial<Topic> = {}): Topic {
  return {
    id: nextId('topic'),
    courseId: 'course-x',
    parentId: null,
    name: 'Topic',
    order: 0,
    active: true,
    createdAt: T0,
    updatedAt: T0,
    dirty: 0,
    ...over,
  };
}

export function makeItem(over: Partial<Item> = {}): Item {
  return {
    id: nextId('item'),
    courseId: 'course-x',
    topicId: 'topic-x',
    type: 'basic',
    fields: { prompt: 'Q', answer: 'A' },
    options: {},
    tags: [],
    order: 0,
    createdAt: T0,
    updatedAt: T0,
    dirty: 0,
    ...over,
  };
}

export function makeCard(
  over: Omit<Partial<Card>, 'fsrs'> & { fsrs?: Partial<StoredFsrsCard> } = {},
): Card {
  const fsrs: StoredFsrsCard = { ...newFsrsCard(T0), ...over.fsrs };
  const card: Card = {
    id: nextId('card'),
    itemId: nextId('item'),
    courseId: 'course-x',
    topicId: 'topic-x',
    key: 'fwd',
    suspended: false,
    updatedAt: T0,
    dirty: 0,
    ...over,
    fsrs,
    due: over.due ?? fsrs.due,
    state: over.state ?? fsrs.state,
  };
  card.fsrs = { ...card.fsrs, due: card.due, state: card.state };
  return card;
}

/** A Review-state card with the given due date and stability (days). */
export function makeReviewCard(
  due: number,
  stability = 10,
  over: Omit<Partial<Card>, 'fsrs'> = {},
): Card {
  return makeCard({
    ...over,
    due,
    state: 2,
    fsrs: {
      stability,
      difficulty: 5,
      scheduled_days: Math.round(stability),
      reps: 3,
      last_review: due - stability * DAY,
    },
  });
}

export function makeLog(over: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: nextId('log'),
    cardId: 'card-x',
    itemId: 'item-x',
    courseId: 'course-x',
    topicId: 'topic-x',
    rating: 3,
    state: 2,
    due: T0,
    stability: 5,
    difficulty: 5,
    elapsed_days: 5,
    last_elapsed_days: 3,
    scheduled_days: 5,
    learning_steps: 0,
    review: T0,
    durationMs: 5000,
    mode: 'reveal',
    updatedAt: T0,
    dirty: 0,
    ...over,
  };
}
