import { describe, expect, it } from 'vitest';
import { DAY, HOUR, makeCard, makeItem, makeLog, makeReviewCard, T0 } from '../test/factories';
import { startOfStudyDay, studyDaysBetween } from './day';
import {
  daySummary,
  forecast,
  leeches,
  maturity,
  sessionStats,
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

describe('sessionStats', () => {
  it('totals the session and lists each forgotten item once, in order', () => {
    const a = makeItem();
    const b = makeItem();
    const logs = [
      makeLog({ itemId: b.id, rating: 3, durationMs: 1000 }),
      makeLog({ itemId: a.id, rating: 1, durationMs: 2000 }),
      makeLog({ itemId: a.id, rating: 1, durationMs: 3000 }),
    ];
    expect(sessionStats(logs, [a, b])).toEqual({
      reviewed: 3,
      again: 2,
      timeMs: 6000,
      forgotten: [a],
    });
  });

  it('drops an item from the forgotten list when its Again review is undone', () => {
    const a = makeItem();
    const again = makeLog({ itemId: a.id, rating: 1 });
    expect(sessionStats([again], [a]).forgotten).toEqual([a]);
    // Undo removes the log; rating Good afterwards leaves nothing forgotten.
    expect(sessionStats([makeLog({ itemId: a.id, rating: 3 })], [a]).forgotten).toEqual([]);
  });

  it('leaves out items deleted during the session', () => {
    expect(sessionStats([makeLog({ itemId: 'gone', rating: 1 })], []).forgotten).toEqual([]);
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

describe('fast streak and forecast agree with the per-timestamp definitions', () => {
  // The original, obviously-correct versions: one calendar computation per timestamp.
  const refStreak = (times: number[], now: number, h: number) => {
    const daysAgo = new Set(times.map((t) => studyDaysBetween(t, now, h)).filter((d) => d >= 0));
    const today = daysAgo.has(0);
    let days = 0;
    for (let d = today ? 0 : 1; daysAgo.has(d); d++) days++;
    return { days, today };
  };
  const refForecast = (dues: number[], now: number, h: number, days: number) => {
    const out = new Array<number>(days).fill(0);
    for (const due of dues) {
      const offset = Math.max(0, studyDaysBetween(now, due, h));
      if (offset < days) out[offset] = (out[offset] ?? 0) + 1;
    }
    return out;
  };
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Around both 2026 daylight-saving changes, plus a late-night "now".
  const nows = [
    new Date(2026, 2, 30, 9).getTime(),
    new Date(2026, 9, 27, 2).getTime(),
    new Date(2026, 10, 3, 23).getTime(),
  ];

  it('studyStreak', () => {
    for (const now of nows)
      for (let trial = 0; trial < 60; trial++) {
        const times: number[] = [];
        for (let d = -1; d < 45; d++) if (rand() < 0.85) times.push(now - d * DAY - rand() * DAY);
        expect(studyStreak(times, now, 4)).toEqual(refStreak(times, now, 4));
      }
  });

  it('forecast', () => {
    for (const now of nows)
      for (let trial = 0; trial < 20; trial++) {
        const dues = Array.from({ length: 80 }, () => now + (rand() * 24 - 4) * DAY);
        expect(
          forecast(
            dues.map((d) => makeReviewCard(d)),
            now,
            4,
            14,
          ),
        ).toEqual(refForecast(dues, now, 4, 14));
      }
  });
});
