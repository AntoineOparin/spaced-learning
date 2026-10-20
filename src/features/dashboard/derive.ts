/** Pure derivations for the dashboard, computed once per data change rather than per render. */
import { buildQueueInput, type DashboardData, IDLE_SESSION, scopeCards } from '../../db/queries';
import { DAY, MINUTE, startOfStudyDay } from '../../domain/day';
import { queueCounts } from '../../domain/queue';
import {
  daySummary,
  forecast,
  leeches,
  maturity,
  trueRetention,
  weakestTopics,
} from '../../domain/stats';

export const BACKUP_STALE_DAYS = 14;
const RECENT_MS = 30 * DAY;
/** New cards typically need about this many exposures on their first day (learning steps). */
const NEW_CARD_EXPOSURES = 3;
const DEFAULT_ANSWER_MS = 10_000;

export type DashboardView = ReturnType<typeof deriveDashboard>;

export function deriveDashboard({ data, recentLogs, now }: DashboardData) {
  const { settings } = data;
  const all = queueCounts(buildQueueInput(data, {}, IDLE_SESSION, now));
  const dayStart = startOfStudyDay(now, settings.dayStartHour);
  const liveCards = scopeCards(data, {});
  const durations = recentLogs.filter((l) => l.durationMs > 0).map((l) => l.durationMs);
  const avgMs = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : DEFAULT_ANSWER_MS;
  const courses = data.courses
    .filter((c) => !c.archived)
    .sort((a, b) => a.order - b.order)
    .map((course) => ({
      course,
      counts: queueCounts(buildQueueInput(data, { courseId: course.id }, IDLE_SESSION, now)),
      maturity: maturity(data.cards.filter((c) => c.courseId === course.id)),
    }));
  return {
    all,
    dayStart,
    courses,
    today: daySummary(data.todayLogs, dayStart),
    upcoming: forecast(liveCards, now, settings.dayStartHour, 14),
    retention: trueRetention(recentLogs, now - RECENT_MS),
    estimate: (all.review + all.learning + all.new * NEW_CARD_EXPOSURES) * avgMs,
    leechList: leeches(liveCards, settings.leechThreshold).slice(0, 5),
    itemById: new Map(data.items.map((i) => [i.id, i])),
    weak: weakestTopics(recentLogs, now - RECENT_MS).slice(0, 3),
  };
}

export function minutes(ms: number): string {
  const m = Math.round(ms / MINUTE);
  return m < 1 ? '< 1 min' : `${m} min`;
}

export function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Whether to nag about backups. The server copy from the last successful sync counts as a
 * backup too. `lastExportAt` is null when never exported, undefined while still loading.
 */
export function backupStatus(
  lastExportAt: number | null | undefined,
  lastSyncAt: number | null,
  now: number,
): { stale: boolean; lastBackup: number } {
  const lastBackup = Math.max(lastExportAt ?? 0, lastSyncAt ?? 0);
  return {
    stale: lastExportAt !== undefined && now - lastBackup > BACKUP_STALE_DAYS * DAY,
    lastBackup,
  };
}
