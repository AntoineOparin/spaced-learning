import { createEmptyCard, fsrs, type Grade, generatorParameters } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { DAY, MIN, T0 } from '../test/factories';
import {
  describeInterval,
  formatInterval,
  fromFsrsCard,
  getScheduler,
  newFsrsCard,
  type SchedulerConfig,
  toFsrsCard,
} from './scheduler';
import { DEFAULT_SETTINGS, type RatingValue } from './types';

const config: SchedulerConfig = {
  desiredRetention: 0.9,
  maximumInterval: 36500,
  enableFuzz: false,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
};

describe('scheduler adapter', () => {
  it('round-trips cards through epoch-ms storage', () => {
    const stored = newFsrsCard(T0);
    expect(stored.due).toBe(T0);
    expect(stored.state).toBe(0);
    expect(stored.last_review).toBeUndefined();
    expect(fromFsrsCard(toFsrsCard(stored))).toEqual(stored);

    const reviewed = getScheduler(config).rate(stored, T0, 3).card;
    expect(reviewed.last_review).toBe(T0);
    expect(fromFsrsCard(toFsrsCard(reviewed))).toEqual(reviewed);
  });

  it('matches ts-fsrs exactly over a long rating sequence', () => {
    const ratings: RatingValue[] = [3, 3, 1, 3, 2, 4, 3, 1, 1, 3, 3, 4, 2, 3, 3];
    const f = fsrs(
      generatorParameters({
        request_retention: 0.9,
        maximum_interval: 36500,
        enable_fuzz: false,
        enable_short_term: true,
        learning_steps: ['1m', '10m'],
        relearning_steps: ['10m'],
      }),
    );
    const scheduler = getScheduler(config);

    let reference = createEmptyCard(new Date(T0));
    let ours = newFsrsCard(T0);
    let now = T0;
    for (const rating of ratings) {
      const expected = f.next(reference, new Date(now), rating as Grade);
      const actual = scheduler.rate(ours, now, rating);
      expect(actual.card).toEqual(fromFsrsCard(expected.card));
      expect(actual.log.rating).toBe(expected.log.rating);
      expect(actual.log.state).toBe(expected.log.state);
      expect(actual.log.review).toBe(expected.log.review.getTime());
      reference = expected.card;
      ours = actual.card;
      now = ours.due + 5 * MIN; // review a little after it falls due
    }
    expect(ours.reps).toBe(ratings.length);
    expect(ours.lapses).toBeGreaterThan(0);
  });

  it('previews all four ratings with non-decreasing intervals', () => {
    const scheduler = getScheduler(config);
    let card = newFsrsCard(T0);
    card = scheduler.rate(card, T0, 3).card;
    card = scheduler.rate(card, card.due, 3).card; // graduates to Review
    const now = card.due;
    const preview = scheduler.preview(card, now);
    const ivl = ([1, 2, 3, 4] as const).map((r) => preview[r].card.due - now);
    expect(ivl[0]).toBeLessThanOrEqual(ivl[1] ?? 0);
    expect(ivl[1]).toBeLessThanOrEqual(ivl[2] ?? 0);
    expect(ivl[2]).toBeLessThanOrEqual(ivl[3] ?? 0);
    expect(preview[1].card.state).toBe(3); // Again → Relearning
    expect(preview[1].card.lapses).toBe(card.lapses + 1);
  });

  it('uses learning steps for new cards and relearning steps after a lapse', () => {
    const scheduler = getScheduler(config);
    const first = scheduler.rate(newFsrsCard(T0), T0, 1).card;
    expect(first.state).toBe(1); // Learning
    expect(first.due - T0).toBe(1 * MIN);

    let card = scheduler.rate(newFsrsCard(T0), T0, 4).card; // Easy graduates immediately
    expect(card.state).toBe(2);
    card = scheduler.rate(card, card.due, 1).card; // lapse
    expect(card.state).toBe(3);
    expect(card.due - (card.last_review ?? 0)).toBe(10 * MIN);
  });

  it('reports retrievability 0 for new cards and decaying values for reviewed ones', () => {
    const scheduler = getScheduler(config);
    expect(scheduler.retrievability(newFsrsCard(T0), T0)).toBe(0);
    const card = scheduler.rate(newFsrsCard(T0), T0, 4).card;
    const soon = scheduler.retrievability(card, T0 + DAY);
    const later = scheduler.retrievability(card, T0 + 30 * DAY);
    expect(soon).toBeGreaterThan(later);
    expect(soon).toBeLessThanOrEqual(1);
  });

  it('honours a per-course desired retention (higher retention → shorter interval)', () => {
    const base = { ...DEFAULT_SETTINGS, enableFuzz: false };
    const graduated = getScheduler({ ...config }).rate(newFsrsCard(T0), T0, 4).card;
    const now = graduated.due;
    const lax = getScheduler({ ...config, desiredRetention: base.desiredRetention });
    const strict = getScheduler({ ...config, desiredRetention: 0.97 });
    const laxIvl = lax.rate(graduated, now, 3).card.due - now;
    const strictIvl = strict.rate(graduated, now, 3).card.due - now;
    expect(strictIvl).toBeLessThan(laxIvl);
  });

  it('memoises schedulers per configuration', () => {
    expect(getScheduler({ ...config })).toBe(getScheduler({ ...config }));
    expect(getScheduler({ ...config, desiredRetention: 0.85 })).not.toBe(getScheduler(config));
  });
});

describe('interval formatting', () => {
  it.each([
    [30_000, '<1m', 'less than a minute'],
    [10 * MIN, '10m', '10 minutes'],
    [3 * 60 * MIN, '3h', '3 hours'],
    [DAY, '1d', '1 day'],
    [5 * DAY, '5d', '5 days'],
    [75 * DAY, '2.5mo', '2.5 months'],
    [60 * DAY, '2mo', '2 months'],
    [400 * DAY, '1.1y', '1.1 years'],
  ])('%d ms → %s', (ms, short, long) => {
    expect(formatInterval(ms)).toBe(short);
    expect(describeInterval(ms)).toBe(long);
  });
});
