import { describe, expect, it } from 'vitest';
import { endOfStudyDay, startOfStudyDay, studyDayStartOffset, studyDaysBetween } from './day';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).getTime();

describe('study day boundaries (day starts at 4am)', () => {
  it('a review at 1am belongs to the previous study day', () => {
    expect(startOfStudyDay(at(2026, 10, 2, 1), 4)).toBe(at(2026, 10, 1, 4));
    expect(endOfStudyDay(at(2026, 10, 2, 1), 4)).toBe(at(2026, 10, 2, 4));
  });

  it('the day rolls over exactly at 4am', () => {
    expect(startOfStudyDay(at(2026, 10, 2, 4), 4)).toBe(at(2026, 10, 2, 4));
    expect(startOfStudyDay(at(2026, 10, 2, 3, 59), 4)).toBe(at(2026, 10, 1, 4));
  });

  it('counts whole study days between timestamps', () => {
    expect(studyDaysBetween(at(2026, 10, 1, 23), at(2026, 10, 2, 2), 4)).toBe(0);
    expect(studyDaysBetween(at(2026, 10, 1, 23), at(2026, 10, 2, 5), 4)).toBe(1);
    expect(studyDaysBetween(at(2026, 10, 1, 12), at(2026, 10, 31, 12), 4)).toBe(30);
    expect(studyDaysBetween(at(2026, 10, 5, 12), at(2026, 10, 1, 12), 4)).toBe(-4);
  });

  it('stays aligned to 4am across DST transitions (local time)', () => {
    // Iterate across a full year; every boundary must land on 4:00 local time.
    let t = studyDayStartOffset(at(2026, 1, 1, 12), 4, 0);
    for (let i = 0; i < 400; i++) {
      const d = new Date(t);
      expect(d.getHours()).toBe(4);
      expect(d.getMinutes()).toBe(0);
      t = studyDayStartOffset(t, 4, 1);
    }
    // Spring-forward / fall-back weeks in common zones still count 7 days per week.
    expect(studyDaysBetween(at(2026, 3, 25, 12), at(2026, 4, 1, 12), 4)).toBe(7);
    expect(studyDaysBetween(at(2026, 10, 28, 12), at(2026, 11, 4, 12), 4)).toBe(7);
  });
});
