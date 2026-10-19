import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { buildQueueInput, IDLE_SESSION, loadStudyData, type StudyData } from '../../app/studyData';
import { db, repo } from '../../db/instance';
import { LAST_EXPORT_AT_KEY, LAST_SYNC_AT_KEY } from '../../db/metaKeys';
import { stripCloze } from '../../domain/cloze';
import { startOfStudyDay } from '../../domain/day';
import { queueCounts } from '../../domain/queue';
import {
  daySummary,
  forecast,
  leeches,
  maturity,
  trueRetention,
  weakestTopics,
} from '../../domain/stats';
import { topicPath } from '../../domain/topics';
import type { Course, ReviewLog } from '../../domain/types';
import { useSyncState } from '../../sync/manager';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { EmptyState, Kbd, Panel } from '../../ui/misc';
import { InstallDeckDialog } from '../decks/InstallDeckDialog';
import { ForecastChart, MaturityBar } from './charts';

const DAY = 86_400_000;
const BACKUP_STALE_DAYS = 14;

interface DashboardData {
  data: StudyData;
  recentLogs: ReviewLog[];
  now: number;
  lastExportAt: number | null;
  lastSyncAt: number | null;
}

function useDashboardData(): DashboardData | undefined {
  return useLiveQuery(async () => {
    const now = Date.now();
    const settings = await repo.getSettings();
    const data = await loadStudyData(db, settings, now);
    const recentLogs = (
      await db.reviewLogs
        .where('review')
        .aboveOrEqual(now - 30 * DAY)
        .toArray()
    ).filter((l) => l.deletedAt === undefined);
    return {
      data,
      recentLogs,
      now,
      lastExportAt: (await repo.getMeta<number>(LAST_EXPORT_AT_KEY)) ?? null,
      lastSyncAt: (await repo.getMeta<number>(LAST_SYNC_AT_KEY)) ?? null,
    };
  }, []);
}

function minutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m < 1 ? '< 1 min' : `${m} min`;
}

function CountPills({
  learning,
  review,
  fresh,
}: {
  learning: number;
  review: number;
  fresh: number;
}) {
  return (
    <span className="flex gap-3 text-sm tabular-nums">
      <span title="Learning / relearning" className="text-hard">
        {learning}
        <span className="sr-only"> learning</span>
      </span>
      <span title="Reviews due" className="text-good">
        {review}
        <span className="sr-only"> reviews due</span>
      </span>
      <span title="New cards available today" className="text-easy">
        {fresh}
        <span className="sr-only"> new</span>
      </span>
    </span>
  );
}

function Welcome() {
  const [installing, setInstalling] = useState(false);
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
      <p className="mt-3 text-muted">
        This app schedules reviews with <strong className="text-fg">FSRS</strong> so you study each
        item just before you'd forget it. You recall the answer first, check it, then rate how well
        you remembered.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Panel>
          <h2 className="font-semibold">Start with Calculus 2</h2>
          <p className="mt-1 text-sm text-muted">
            About 200 curated items covering identities, integration techniques, convergence tests
            and series.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => setInstalling(true)}>
            Install starter deck
          </Button>
        </Panel>
        <Panel>
          <h2 className="font-semibold">Build your own</h2>
          <p className="mt-1 text-sm text-muted">
            Create a course, organise topics, and write your own cards.
          </p>
          <Link to="/library?new=course" className="mt-4 inline-flex">
            <Button tabIndex={-1}>Create a course</Button>
          </Link>
        </Panel>
      </div>
      <InstallDeckDialog open={installing} onClose={() => setInstalling(false)} />
    </div>
  );
}

export function DashboardPage() {
  const dash = useDashboardData();
  const sync = useSyncState();
  const navigate = useNavigate();

  if (!dash) return <div className="py-12 text-center text-sm text-muted">Loading…</div>;
  const { data, recentLogs, now } = dash;
  const { settings } = data;
  const activeCourses = data.courses.filter((c) => !c.archived).sort((a, b) => a.order - b.order);
  if (data.courses.length === 0) return <Welcome />;

  const all = queueCounts(buildQueueInput(data, {}, IDLE_SESSION, now));
  const dayStart = startOfStudyDay(now, settings.dayStartHour);
  const today = daySummary(data.todayLogs, dayStart);
  const archived = new Set(data.courses.filter((c) => c.archived).map((c) => c.id));
  const liveCards = data.cards.filter((c) => !archived.has(c.courseId));
  const upcoming = forecast(liveCards, now, settings.dayStartHour, 14);
  const retention = trueRetention(recentLogs, now - 30 * DAY);
  const reviewDurations = recentLogs.filter((l) => l.durationMs > 0).map((l) => l.durationMs);
  const avgMs = reviewDurations.length
    ? reviewDurations.reduce((a, b) => a + b, 0) / reviewDurations.length
    : 10_000;
  // New cards typically need ~3 exposures on their first day (learning steps).
  const estimate = (all.review + all.learning + all.new * 3) * avgMs;
  const totalDue = all.review + all.learning;

  const leechList = leeches(liveCards, settings.leechThreshold).slice(0, 5);
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const weak = weakestTopics(recentLogs, now - 30 * DAY).slice(0, 3);
  const lastBackup = Math.max(
    dash.lastExportAt ?? 0,
    sync.status === 'idle' ? (dash.lastSyncAt ?? 0) : 0,
  );
  const backupStale = now - lastBackup > BACKUP_STALE_DAYS * DAY;

  const courseRow = (course: Course) => {
    const counts = queueCounts(buildQueueInput(data, { courseId: course.id }, IDLE_SESSION, now));
    const m = maturity(data.cards.filter((c) => c.courseId === course.id));
    const empty = counts.review + counts.learning + counts.new === 0;
    return (
      <li
        key={course.id}
        className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              to={`/library?course=${course.id}`}
              className="truncate font-medium hover:underline"
            >
              {course.name}
            </Link>
            <CountPills learning={counts.learning} review={counts.review} fresh={counts.new} />
          </div>
          <div className="mt-2">
            <MaturityBar m={m} showLegend={false} />
          </div>
        </div>
        <Button
          size="sm"
          variant={empty ? 'secondary' : 'primary'}
          disabled={empty}
          onClick={() => navigate(`/study?course=${course.id}`)}
          className="sm:w-24"
        >
          {empty ? 'Done' : 'Study'}
        </Button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {/* Headline: what to do now */}
      <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(now)}
          </p>
          {totalDue + all.new > 0 ? (
            <>
              <p className="mt-1 text-5xl font-semibold tracking-tight">{totalDue + all.new}</p>
              <p className="mt-1 text-sm text-muted">
                cards to study · {totalDue} due · {all.new} new · about {minutes(estimate)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-semibold tracking-tight">All caught up</p>
              <p className="mt-1 text-sm text-muted">
                {all.nextLearningDue
                  ? `Next learning card at ${new Date(all.nextLearningDue).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}.`
                  : `Tomorrow: ${upcoming[1] ?? 0} reviews.`}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            variant="primary"
            size="lg"
            disabled={totalDue + all.new === 0}
            onClick={() => navigate('/study')}
            className="sm:min-w-44"
          >
            <Icon name="play" />
            Study all
          </Button>
          <span className="hidden text-xs text-faint sm:block">
            Shortcuts in session: <Kbd>Space</Kbd> reveal · <Kbd>1</Kbd>–<Kbd>4</Kbd> rate
          </span>
        </div>
      </section>

      {backupStale &&
        (sync.status === 'unavailable' || sync.status === 'error' || sync.status === 'auth') && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hard/30 bg-hard-soft px-4 py-3 text-sm">
            <Icon name="alert" className="text-hard" />
            <span className="flex-1">
              {lastBackup
                ? `No backup in the last ${BACKUP_STALE_DAYS} days.`
                : 'Your progress has never been backed up.'}{' '}
              {sync.status === 'auth'
                ? 'Sign in to sync, or export a backup file.'
                : 'Export a backup file to be safe.'}
            </span>
            <Link to="/settings#backup" className="font-medium text-accent hover:underline">
              Back up now
            </Link>
          </div>
        )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          title="Courses"
          className="lg:col-span-3"
          action={
            <span className="flex gap-3 text-xs text-muted">
              <span className="text-hard">learning</span>
              <span className="text-good">review</span>
              <span className="text-easy">new</span>
            </span>
          }
        >
          {activeCourses.length ? (
            <ul className="divide-y divide-line">{activeCourses.map(courseRow)}</ul>
          ) : (
            <EmptyState title="No active courses" />
          )}
        </Panel>

        <Panel title="Today" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <dt className="text-xs text-muted">Reviewed</dt>
              <dd className="text-2xl font-semibold">{today.reviewed}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Time</dt>
              <dd className="text-2xl font-semibold">{minutes(today.timeMs)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">New learned</dt>
              <dd className="text-2xl font-semibold">{today.newIntroduced}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Forgotten (Again)</dt>
              <dd className="text-2xl font-semibold">{today.again}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Upcoming reviews · 14 days" className="lg:col-span-3">
          {upcoming.some((c) => c > 0) ? (
            <ForecastChart counts={upcoming} start={dayStart} />
          ) : (
            <p className="text-sm text-muted">
              Nothing scheduled yet. Cards you study will appear here when they come due.
            </p>
          )}
        </Panel>

        <Panel title="Retention · last 30 days" className="lg:col-span-2">
          {retention.rate === null || retention.total < 10 ? (
            <p className="text-sm text-muted">
              Shown after about 10 reviews of graduated cards. Target:{' '}
              {Math.round(settings.desiredRetention * 100)}%.
            </p>
          ) : (
            <div>
              <p className="text-4xl font-semibold">{Math.round(retention.rate * 100)}%</p>
              <p className="mt-1 text-sm text-muted">
                recalled in {retention.total} reviews · target{' '}
                {Math.round(settings.desiredRetention * 100)}%
              </p>
              <p className="mt-3 text-sm">
                {retention.rate < settings.desiredRetention - 0.05
                  ? 'Below target. Check the trouble spots below — rewriting or splitting hard cards helps more than extra reviews.'
                  : retention.rate > settings.desiredRetention + 0.05
                    ? 'Above target. You are remembering more than planned; intervals will grow accordingly.'
                    : 'On target — the scheduler is calibrated for you.'}
              </p>
            </div>
          )}
        </Panel>
      </div>

      {(leechList.length > 0 || weak.length > 0) && (
        <Panel title="Trouble spots">
          <div className="grid gap-6 md:grid-cols-2">
            {leechList.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                  Leeches (forgotten {settings.leechThreshold}+ times)
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Rewrite or split these — repetition alone isn't working.
                </p>
                <ul className="mt-3 space-y-2">
                  {leechList.map((card) => {
                    const item = itemById.get(card.itemId);
                    return (
                      <li key={card.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">
                          {item ? stripCloze(item.fields.prompt).slice(0, 90) : '—'}
                        </span>
                        <Link
                          to={`/items/${card.itemId}`}
                          className="shrink-0 text-accent hover:underline"
                        >
                          Edit · {card.fsrs.lapses}×
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {weak.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                  Weakest topics
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Highest share of forgotten reviews this month.
                </p>
                <ul className="mt-3 space-y-2">
                  {weak.map((t) => {
                    const path = topicPath(data.topics, t.topicId);
                    return (
                      <li
                        key={t.topicId}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <Link
                          to={`/library?topic=${t.topicId}`}
                          className="truncate hover:underline"
                        >
                          {path.map((p) => p.name).join(' › ') || 'Unknown topic'}
                        </Link>
                        <span className="shrink-0 tabular-nums text-muted">
                          {Math.round(t.lapseRate * 100)}% of {t.reviews}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
