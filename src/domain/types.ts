/**
 * Core entities. Every synced record carries `updatedAt` (epoch ms, last-write-wins),
 * an optional `deletedAt` tombstone (synced records are never hard-deleted) and an
 * indexed `dirty` flag (0 | 1, because IndexedDB can't index booleans).
 */

export type Id = string;
export type Dirty = 0 | 1;

export interface SyncFields {
  updatedAt: number;
  deletedAt?: number;
  dirty: Dirty;
}

export interface Course extends SyncFields {
  id: Id;
  name: string;
  description?: string;
  order: number;
  /** Overrides the global desired retention (0.7–0.99). */
  desiredRetention?: number;
  /** Overrides the global new-cards-per-day limit. */
  newPerDay?: number;
  archived?: boolean;
  /** Stable key when the course came from a curated content pack (`deckId:courseKey`). */
  originKey?: string;
  createdAt: number;
}

export interface Topic extends SyncFields {
  id: Id;
  courseId: Id;
  /** null = top-level topic; otherwise a subtopic (the UI caps depth at 2). */
  parentId: Id | null;
  name: string;
  order: number;
  /** Inactive topics introduce no NEW cards (existing reviews continue). */
  active: boolean;
  /** Stable key when the topic came from a curated content pack. */
  originKey?: string;
  createdAt: number;
}

export type ItemType = 'basic' | 'cloze';
/** How the answer was attempted before revealing it. */
export type AnswerMode = 'reveal' | 'typed' | 'drawn';

export interface ItemFields {
  /** basic: the question. cloze: text containing {{cN::...}} deletions. */
  prompt: string;
  /** basic: the answer. cloze: optional extra shown after reveal. */
  answer: string;
  explanation?: string;
  mnemonic?: string;
  source?: string;
}

export interface ItemOrigin {
  deck: string;
  key: string;
  version: number;
}

/** A learning item is the editable content; it generates one or more Cards. */
export interface Item extends SyncFields {
  id: Id;
  courseId: Id;
  topicId: Id;
  type: ItemType;
  fields: ItemFields;
  /** answerMode is an item's suggested default; drawing is only ever a personal choice. */
  options: { reverse?: boolean; answerMode?: Exclude<AnswerMode, 'drawn'> };
  tags: string[];
  order: number;
  origin?: ItemOrigin;
  createdAt: number;
}

/** ts-fsrs `State`. */
export const CardState = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;
export type CardStateValue = (typeof CardState)[keyof typeof CardState];

/** ts-fsrs `Rating` without `Manual`. */
export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type RatingValue = (typeof Rating)[keyof typeof Rating];

/** The ts-fsrs Card with Dates stored as epoch ms. */
export interface StoredFsrsCard {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: CardStateValue;
  last_review?: number;
}

/** A scheduling unit generated from an Item. */
export interface Card extends SyncFields {
  id: Id;
  itemId: Id;
  courseId: Id;
  topicId: Id;
  /** 'fwd' | 'rev' | 'c1' | 'c2' … — stable across item edits. */
  key: string;
  suspended: boolean;
  fsrs: StoredFsrsCard;
  /** Mirrors of fsrs.due / fsrs.state for indexing. */
  due: number;
  state: CardStateValue;
}

/** Mirrors ts-fsrs's ReviewLog (state/difficulty/stability are the values BEFORE the review). */
export interface ReviewLog extends SyncFields {
  id: Id;
  cardId: Id;
  itemId: Id;
  courseId: Id;
  topicId: Id;
  rating: RatingValue;
  state: CardStateValue;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  /** When the review happened. */
  review: number;
  durationMs: number;
  mode: AnswerMode;
}

export type StepUnit = `${number}${'m' | 'h' | 'd'}`;

export interface Settings extends SyncFields {
  id: 'global';
  desiredRetention: number;
  newPerDay: number;
  /** Local hour at which a new study day begins (late-night reviews count for the previous day). */
  dayStartHour: number;
  learningSteps: StepUnit[];
  relearningSteps: StepUnit[];
  maximumInterval: number;
  enableFuzz: boolean;
  leechThreshold: number;
  /** Optimised FSRS weights; undefined = ts-fsrs defaults. */
  fsrsWeights?: number[];
}

export const DEFAULT_SETTINGS: Omit<Settings, 'updatedAt' | 'dirty'> = {
  id: 'global',
  desiredRetention: 0.9,
  newPerDay: 15,
  dayStartHour: 4,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
  maximumInterval: 36500,
  enableFuzz: true,
  leechThreshold: 5,
};

/** Names of the synced tables (also used as the `tbl` column on the server). */
export const SYNCED_TABLES = [
  'courses',
  'topics',
  'items',
  'cards',
  'reviewLogs',
  'settings',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

/** Records that aren't soft-deleted (tombstoned). */
export function alive<T extends { deletedAt?: number }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.deletedAt === undefined);
}
