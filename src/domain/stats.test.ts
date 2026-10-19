import { describe, expect, it } from 'vitest';
import { DAY, HOUR, makeCard, makeLog, makeReviewCard, T0 } from '../test/factories';
import { startOfStudyDay } from './day';
import {
  daySummary,
  forecast,
  leeches,
  maturity,
  studyStreak,
  trueRetention,
  weakestTopics,
} from './stats';

describe('forecast', () => {
  it('buckets due cards by study day, folding overdue into today and skipping new/suspended', () => {
    const cards = [
      makeReviewCard(T0 - 3 * DAY), // overdue → today
      makeReviewCard(T0 + HOUR), // today
      makeReviewCard(T0 + DAY), // tomorrow
      makeReviewCard(T0 + 2 * DAY, 10, { suspended: true }),
      makeCard(), // new
      makeCard({ state: 1, due: T0 + 2 * DAY }), // learning, day 2
      makeReviewCard(T0 + 30 * DAY), // beyond window
    ];
    expect(forecast(cards, T0, 4, 7)).toEqual([2, 1, 1, 0, 0, 0, 0]);
  });
});

describe('daySummary', () => {
  it('summarises reviews since the start of the study day, excluding undone logs', () => {
    const dayStart = startOfStudyDay(T0, 4);
    const logs = [
      makeLog({ review: dayStart - 1 }),
      makeLog({ review: T0, state: 0, rating: 3, durationMs: 4000 }),
      makeLog({ review: T0, state: 2, rating: 1, durationMs: 6000 }),
      makeLog({ review: T0, deletedAt: T0 }),
    ];
    expect(daySummary(logs, dayStart)).toEqual({
      reviewed: 2,
      newIntroduced: 1,
      again: 1,
      timeMs: 10_000,
    });
  });
});

describe('trueRetention', () => {
  it('uses only Review-state reviews in the window', () => {
    const logs = [
      makeLog({ state: 2, rating: 3 }),
      makeLog({ state: 2, rating: 2 }),
      makeLog({ state: 2, rating: 1 }),
      makeLog({ state: 2, rating: 4 }),
      makeLog({ state: 1, rating: 1 }), // learning step: ignored
      makeLog({ state: 2, rating: 1, review: T0 - 40 * DAY }), // outside window
    ];
    expect(trueRetention(logs, T0 - 30 * DAY)).toEqual({ passed: 3, total: 4, rate: 0.75 });
    expect(trueRetention([], T0).rate).toBeNull();
  });
});

describe('maturity and leeches', () => {
  it('classifies cards', () => {
    const cards = [
      makeCard(),
      makeCard({ state: 1 }),
      makeReviewCard(T0, 5),
      makeReviewCard(T0, 40),
      makeReviewCard(T0, 40, { suspended: true }),
      makeReviewCard(T0, 40, { deletedAt: T0 }),
    ];
    expect(maturity(cards)).toEqual({ new: 1, learning: 1, young: 1, mature: 1, suspended: 1 });
  });

  it('lists leeches by lapse count', () => {
    const a = makeCard({ fsrs: { lapses: 6 } });
    const b = makeCard({ fsrs: { lapses: 9 } });
    const c = makeCard({ fsrs: { lapses: 2 } });
    expect(leeches([a, b, c], 5)).toEqual([b, a]);
  });
});

describe('weakestTopics', () => {
  it('ranks topics by lapse rate with a minimum sample size', () => {
    const logs = [
      ...Array.from({ length: 6 }, (_, i) => makeLog({ topicId: 'hard', rating: i < 3 ? 1 : 3 })),
      ...Array.from({ length: 6 }, (_, i) => makeLog({ topicId: 'ok', rating: i < 1 ? 1 : 3 })),
      ...Array.from({ length: 2 }, () => makeLog({ topicId: 'tiny', rating: 1 })),
    ];
    const ranked = weakestTopics(logs, T0 - DAY);
    expect(ranked.map((t) => t.topicId)).toEqual(['hard', 'ok']);
    expect(ranked[0]?.lapseRate).toBe(0.5);
  });
});

describe('studyStreak', () => {
  const today = startOfStudyDay(T0, 4) + HOUR;

  it('counts consecutive study days ending today', () => {
    const times = [today, today - DAY, today - DAY + 60_000, today - 2 * DAY, today - 4 * DAY];
    expect(studyStreak(times, today, 4)).toEqual({ days: 3, today: true });
  });

  it('keeps yesterday’s streak alive until today ends', () => {
    expect(studyStreak([today - DAY, today - 2 * DAY], today, 4)).toEqual({
      days: 2,
      today: false,
    });
  });

  it('is broken by a whole day without reviews', () => {
    expect(studyStreak([today - 2 * DAY, today - 3 * DAY], today, 4)).toEqual({
      days: 0,
      today: false,
    });
    expect(studyStreak([], today, 4)).toEqual({ days: 0, today: false });
  });

  it('counts late-night reviews toward the previous study day', () => {
    const start = startOfStudyDay(T0, 4);
    // 3am belongs to yesterday's study day when the day starts at 4am.
    expect(studyStreak([start - HOUR], start + HOUR, 4)).toEqual({ days: 1, today: false });
  });
});
