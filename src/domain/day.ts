/**
 * Study-day boundaries. A study day starts at `dayStartHour` local time (default 4am), so
 * reviewing at 1am still counts for the previous day — the same convention Anki uses.
 * Uses local-time Date arithmetic, so DST transitions are handled by the platform.
 */

export function startOfStudyDay(now: number, dayStartHour: number): number {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayStartHour, 0, 0, 0);
  if (start.getTime() > now) {
    start.setDate(start.getDate() - 1);
  }
  return start.getTime();
}

/** Start of the study day `offset` days after the one containing `now`. */
export function studyDayStartOffset(now: number, dayStartHour: number, offset: number): number {
  const start = new Date(startOfStudyDay(now, dayStartHour));
  start.setDate(start.getDate() + offset);
  return start.getTime();
}

export function endOfStudyDay(now: number, dayStartHour: number): number {
  return studyDayStartOffset(now, dayStartHour, 1);
}

/** Whole study days between the day containing `from` and the day containing `to`. */
export function studyDaysBetween(from: number, to: number, dayStartHour: number): number {
  const a = new Date(startOfStudyDay(from, dayStartHour));
  const b = new Date(startOfStudyDay(to, dayStartHour));
  // Round to absorb the ±1h of a DST transition.
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
