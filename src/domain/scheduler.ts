/**
 * The single adapter between the app and ts-fsrs (FSRS-6). Everything else in the app works
 * with `StoredFsrsCard` (epoch-ms timestamps, plain JSON); only this module touches ts-fsrs
 * types, so a future ts-fsrs major version only requires changes here.
 */
import {
  createEmptyCard,
  type FSRS,
  type Card as FsrsCard,
  type ReviewLog as FsrsReviewLog,
  fsrs,
  type Grade,
  generatorParameters,
} from 'ts-fsrs';
import { DAY, HOUR, MINUTE } from './day';
import {
  CardState,
  type CardStateValue,
  type Course,
  type RatingValue,
  type ReviewLog,
  type Settings,
  type StepUnit,
  type StoredFsrsCard,
} from './types';

export interface SchedulerConfig {
  desiredRetention: number;
  maximumInterval: number;
  enableFuzz: boolean;
  learningSteps: readonly StepUnit[];
  relearningSteps: readonly StepUnit[];
  weights?: readonly number[];
}

export type ReviewLogFields = Pick<
  ReviewLog,
  | 'rating'
  | 'state'
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'elapsed_days'
  | 'last_elapsed_days'
  | 'scheduled_days'
  | 'learning_steps'
  | 'review'
>;

export interface ReviewOutcome {
  card: StoredFsrsCard;
  log: ReviewLogFields;
}

export const RATINGS: readonly RatingValue[] = [1, 2, 3, 4];

export function schedulerConfig(
  settings: Pick<
    Settings,
    | 'desiredRetention'
    | 'maximumInterval'
    | 'enableFuzz'
    | 'learningSteps'
    | 'relearningSteps'
    | 'fsrsWeights'
  >,
  course?: Pick<Course, 'desiredRetention'>,
): SchedulerConfig {
  return {
    desiredRetention: course?.desiredRetention ?? settings.desiredRetention,
    maximumInterval: settings.maximumInterval,
    enableFuzz: settings.enableFuzz,
    learningSteps: settings.learningSteps,
    relearningSteps: settings.relearningSteps,
    weights: settings.fsrsWeights,
  };
}

export function toFsrsCard(card: StoredFsrsCard): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review === undefined ? undefined : new Date(card.last_review),
  };
}

export function fromFsrsCard(card: FsrsCard): StoredFsrsCard {
  const stored: StoredFsrsCard = {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as CardStateValue,
  };
  if (card.last_review) stored.last_review = card.last_review.getTime();
  return stored;
}

function fromFsrsLog(log: FsrsReviewLog): ReviewLogFields {
  return {
    rating: log.rating as RatingValue,
    state: log.state as CardStateValue,
    due: log.due.getTime(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    last_elapsed_days: log.last_elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    review: log.review.getTime(),
  };
}

export function newFsrsCard(now: number): StoredFsrsCard {
  return fromFsrsCard(createEmptyCard(new Date(now)));
}

export class Scheduler {
  private readonly f: FSRS;

  constructor(config: SchedulerConfig) {
    this.f = fsrs(
      generatorParameters({
        request_retention: config.desiredRetention,
        maximum_interval: config.maximumInterval,
        enable_fuzz: config.enableFuzz,
        enable_short_term: true,
        learning_steps: [...config.learningSteps],
        relearning_steps: [...config.relearningSteps],
        ...(config.weights ? { w: [...config.weights] } : {}),
      }),
    );
  }

  rate(card: StoredFsrsCard, now: number, rating: RatingValue): ReviewOutcome {
    const result = this.f.next(toFsrsCard(card), new Date(now), rating as Grade);
    return { card: fromFsrsCard(result.card), log: fromFsrsLog(result.log) };
  }

  /** Outcome of every rating, for the interval hints on the rating buttons. */
  preview(card: StoredFsrsCard, now: number): Record<RatingValue, ReviewOutcome> {
    const preview = this.f.repeat(toFsrsCard(card), new Date(now));
    const out = {} as Record<RatingValue, ReviewOutcome>;
    for (const rating of RATINGS) {
      const item = preview[rating as Grade];
      out[rating] = { card: fromFsrsCard(item.card), log: fromFsrsLog(item.log) };
    }
    return out;
  }

  /** Probability of recall at `now` (0 for never-reviewed cards). */
  retrievability(card: StoredFsrsCard, now: number): number {
    if (card.state === CardState.New) return 0;
    return this.f.get_retrievability(toFsrsCard(card), new Date(now), false);
  }
}

const cache = new Map<string, Scheduler>();

/** The scheduler for a course: its own retention / limits, falling back to the settings. */
export function schedulerForCourse(settings: Settings, course: Course | undefined): Scheduler {
  return getScheduler(schedulerConfig(settings, course));
}

/** Memoised scheduler per configuration (schedulers are stateless). */
export function getScheduler(config: SchedulerConfig): Scheduler {
  const key = JSON.stringify(config);
  let scheduler = cache.get(key);
  if (!scheduler) {
    scheduler = new Scheduler(config);
    cache.set(key, scheduler);
  }
  return scheduler;
}

function trimFixed(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/** Compact interval label, e.g. "<1m", "10m", "3h", "5d", "2.5mo", "1.2y". */
export function formatInterval(ms: number): string {
  if (ms < MINUTE) return '<1m';
  if (ms < HOUR) return `${Math.round(ms / MINUTE)}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${trimFixed(days / 30)}mo`;
  return `${trimFixed(days / 365)}y`;
}

/** Long form for accessible labels, e.g. "10 minutes", "5 days". */
export function describeInterval(ms: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (ms < MINUTE) return 'less than a minute';
  if (ms < HOUR) return plural(Math.round(ms / MINUTE), 'minute');
  if (ms < DAY) return plural(Math.round(ms / HOUR), 'hour');
  const days = ms / DAY;
  if (days < 30) return plural(Math.round(days), 'day');
  if (days < 365) return `${trimFixed(days / 30)} months`;
  return `${trimFixed(days / 365)} years`;
}
