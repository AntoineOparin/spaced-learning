import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  buildQueueInput,
  IDLE_SESSION,
  loadStudyData,
  type StudyData,
  scopeCards,
} from '../../app/studyData';
import { db, repo } from '../../db/instance';
import { LAST_EXPORT_AT_KEY } from '../../db/metaKeys';
import { stripCloze } from '../../domain/cloze';
import { DAY, MINUTE, startOfStudyDay } from '../../domain/day';
import { queueCounts } from '../../domain/queue';
import {
  daySummary,
  forecast,
  leeches,
  maturity,
  type Streak,
  studyStreak,
  trueRetention,
  weakestTopics,
} from '../../domain/stats';
import { TRAIL_SEPARATOR, topicTrail } from '../../domain/topics';
import { alive, type ReviewLog } from '../../domain/types';
import { useSyncState } from '../../sync/manager';
import { Button, buttonClass } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Icon } from '../../ui/Icon';
import {
  Callout,
  Dot,
  EmptyState,
  Kbd,
  LoadingStatus,
  Panel,
  ProgressBar,
  Skeleton,
  surface,
} from '../../ui/misc';
import { InstallDeckDialog } from '../decks/InstallDeckDialog';
import { ForecastChart, MaturityBar, MaturityLegend } from './charts';

const BACKUP_STALE_DAYS = 14;

interface DashboardData {
  data: StudyData;
  recentLogs: ReviewLog[];
  streak: Streak;
  now: number;
}

function useDashboardData(): DashboardData | undefined {
  return useLiveQuery(async () => {
    const now = Date.now();
    const settings = await repo.getSettings();
    const data = await loadStudyData(db, settings, now);
    const recentLogs = alive(
      await db.reviewLogs
        .where('review')
        .aboveOrEqual(now - 30 * DAY)
        .toArray(),
    );
    let streak = studyStreak(
      recentLogs.map((l) => l.review),
      now,
      settings.dayStartHour,
    );
    if (streak.days >= 29) {
      // Long streaks outrun the 30-day window: read just the review index keys. Undone
      // reviews are counted here, which only matters on a day whose every review was undone.
      const times = await db.reviewLogs
        .where('review')
        .aboveOrEqual(now - 3 * 365 * DAY)
        .keys();
      streak = studyStreak(times as number[], now, settings.dayStartHour);
    }
    return { data, recentLogs, streak, now };
  }, []);
}

/** null when never exported; undefined while loading. */
function useLastExportAt(): number | null | undefined {
  return useLiveQuery(async () => (await repo.getMeta<number>(LAST_EXPORT_AT_KEY)) ?? null, []);
}

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** Everything the page shows, computed once per data change rather than on every render. */
function deriveDashboard({ data, recentLogs, now }: DashboardData) {
  const { settings } = data;
  const all = queueCounts(buildQueueInput(data, {}, IDLE_SESSION, now));
  const dayStart = startOfStudyDay(now, settings.dayStartHour);
  const liveCards = scopeCards(data, {});
  const durations = recentLogs.filter((l) => l.durationMs > 0).map((l) => l.durationMs);
  const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 10_000;
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
    retention: trueRetention(recentLogs, now - 30 * DAY),
    // New cards typically need ~3 exposures on their first day (learning steps).
    estimate: (all.review + all.learning + all.new * 3) * avgMs,
    leechList: leeches(liveCards, settings.leechThreshold).slice(0, 5),
    itemById: new Map(data.items.map((i) => [i.id, i])),
    weak: weakestTopics(recentLogs, now - 30 * DAY).slice(0, 3),
  };
}

function minutes(ms: number): string {
  const m = Math.round(ms / MINUTE);
  return m < 1 ? '< 1 min' : `${m} min`;
}

function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

const QUEUE = [
  { key: 'learning', label: 'learning', dot: 'bg-streak' },
  { key: 'review', label: 'due', dot: 'bg-accent' },
  { key: 'fresh', label: 'new', dot: 'bg-xp' },
] as const;

function QueueBreakdown({
  counts,
  className,
}: {
  counts: { learning: number; review: number; fresh: number };
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted', className)}>
      {QUEUE.map((q) => (
        <li key={q.key} className="flex items-center gap-1.5">
          <Dot className={q.dot} />
          <span className="font-bold text-fg tabular-nums">{counts[q.key]}</span>
          {q.label}
        </li>
      ))}
    </ul>
  );
}

function StreakBadge({ streak }: { streak: Streak }) {
  if (streak.days === 0) return null;
  return (
    <span
      title={streak.today ? 'You studied today' : 'Study today to keep your streak'}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full pr-4 pl-3 text-[15px] font-extrabold tabular-nums',
        streak.today ? 'bg-streak-soft text-streak-text' : 'bg-surface text-muted',
      )}
    >
      <Icon
        name="flame"
        size={20}
        fill="currentColor"
        className={streak.today ? 'text-streak' : 'text-dim'}
      />
      {streak.days}
      <span className="font-semibold">{streak.days === 1 ? 'day' : 'days'}</span>
      <span className="sr-only">
        study streak{streak.today ? '' : ' — study today to keep it going'}
      </span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

/** Retention against target on a 50–100% scale, where the interesting differences live. */
function RetentionMeter({ rate, target }: { rate: number; target: number }) {
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - 0.5) / 0.5) * 100))}%`;
  return (
    <div className="relative mt-4 h-2 rounded-full bg-surface" aria-hidden>
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent"
        style={{ width: pos(rate) }}
      />
      <div
        className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-fg"
        style={{ left: pos(target) }}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <LoadingStatus className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-28" />
    </LoadingStatus>
  );
}

function Welcome() {
  const [installing, setInstalling] = useState(false);
  const steps = [
    ['Recall', 'Try to answer from memory before you look. The effort is what makes it stick.'],
    ['Check', 'Reveal the answer and compare it with what you remembered.'],
    ['Rate', 'Say how it went. FSRS schedules the card for just before you’d forget it.'],
  ];
  return (
    <div className="mx-auto max-w-2xl md:py-4">
      <img src="/favicon.svg" alt="" className="size-14 animate-pop" />
      <h1 className="mt-6 text-4xl font-bold">Welcome to Spaced</h1>
      <p className="mt-3 text-lg text-muted">
        A few minutes a day keeps a whole course in memory. Here is how a review works:
      </p>
      <ol className="mt-8 space-y-5">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-extrabold text-accent-text">
              {i + 1}
            </span>
            <p className="pt-1 text-[15px] text-muted">
              <strong className="font-bold text-fg">{title}.</strong> {body}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Panel className="flex flex-col">
          <h2 className="text-lg font-bold">Start with Calculus 2</h2>
          <p className="mt-1 mb-6 text-sm text-muted">
            About 200 curated cards: identities, integration techniques, convergence tests and
            series.
          </p>
          <Button variant="primary" className="mt-auto" onClick={() => setInstalling(true)}>
            Install starter deck
          </Button>
        </Panel>
        <Panel className="flex flex-col">
          <h2 className="text-lg font-bold">Build your own</h2>
          <p className="mt-1 mb-6 text-sm text-muted">
            Create a course, organise it into topics, and write your own cards.
          </p>
          <Link to="/library?new=course" className={buttonClass('secondary', 'md', 'mt-auto')}>
            Create a course
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
  const lastExportAt = useLastExportAt();
  const navigate = useNavigate();
  const view = useMemo(() => (dash ? deriveDashboard(dash) : null), [dash]);

  if (!dash || !view) return <DashboardSkeleton />;
  const { data, now, streak } = dash;
  const { settings } = data;
  if (data.courses.length === 0) return <Welcome />;

  const { all, dayStart, today, upcoming, retention, estimate, leechList, itemById, weak } = view;
  const totalDue = all.review + all.learning;
  const toStudy = totalDue + all.new;
  const target = Math.round(settings.desiredRetention * 100);
  const lastBackup = Math.max(
    lastExportAt ?? 0,
    sync.status === 'idle' ? (sync.lastSyncAt ?? 0) : 0,
  );
  const backupStale = lastExportAt !== undefined && now - lastBackup > BACKUP_STALE_DAYS * DAY;

  const courseTile = ({ course, counts, maturity: m }: (typeof view.courses)[number]) => {
    const parts = [
      counts.learning && `${counts.learning} learning`,
      counts.review && `${counts.review} due`,
      counts.new && `${counts.new} new`,
    ].filter(Boolean);
    return (
      <li
        key={course.id}
        className={cn(surface, 'p-4 transition-colors hover:border-line-strong sm:p-5')}
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <Link
              to={`/library?course=${course.id}`}
              className="block truncate text-base font-bold decoration-line-strong decoration-2 underline-offset-4 hover:underline"
            >
              {course.name}
            </Link>
            <p className="mt-0.5 text-[13px] text-muted">
              {parts.length ? parts.join(' · ') : 'Nothing left today'}
            </p>
          </div>
          {parts.length ? (
            <Button size="sm" onClick={() => navigate(`/study?course=${course.id}`)}>
              Study
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-sm font-bold text-accent-text">
              <Icon name="check" size={18} /> Done
            </span>
          )}
        </div>
        <div className="mt-4">
          <MaturityBar m={m} />
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">{DATE_FORMAT.format(now)}</p>
          <h1 className="mt-1 text-3xl font-bold">{greeting(now)}</h1>
        </div>
        <StreakBadge streak={streak} />
      </header>

      {/* The one thing to do now */}
      <section
        aria-labelledby="session-heading"
        className="rounded-2xl border border-line bg-bg-alt p-6 sm:p-8"
      >
        {toStudy > 0 ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="session-heading" className="text-sm font-semibold text-muted">
                  Today’s session
                </h2>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tabular-nums">{toStudy}</span>
                  <span className="text-xl font-bold text-muted">
                    {toStudy === 1 ? 'card' : 'cards'}
                  </span>
                </p>
              </div>
              <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold text-muted">
                <Icon name="clock" size={16} /> {minutes(estimate)}
              </span>
            </div>
            <QueueBreakdown
              counts={{ learning: all.learning, review: all.review, fresh: all.new }}
              className="mt-3"
            />
            <div className="mt-7">
              <ProgressBar value={today.reviewed / (today.reviewed + toStudy)} label="Today" />
              <p className="mt-2 text-[13px] text-muted">
                <span className="font-semibold text-fg tabular-nums">{today.reviewed}</span> of{' '}
                {today.reviewed + toStudy} done today
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/study')}
                className="w-full sm:w-auto sm:min-w-56"
              >
                Start studying
              </Button>
              <span className="hidden items-center gap-1.5 text-[13px] text-muted lg:flex">
                <Kbd>Space</Kbd> reveal <span className="text-dim">·</span> <Kbd>1</Kbd>–
                <Kbd>4</Kbd> rate
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 animate-pop items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
              <Icon name="check" size={26} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="session-heading" className="text-2xl font-bold">
                All caught up
              </h2>
              <p className="mt-1 text-muted">
                {all.nextLearningDue
                  ? `Your next card is due at ${TIME_FORMAT.format(all.nextLearningDue)}.`
                  : upcoming[1]
                    ? `Come back tomorrow for ${upcoming[1]} ${upcoming[1] === 1 ? 'review' : 'reviews'}.`
                    : 'Nothing is scheduled for tomorrow.'}
              </p>
              {today.reviewed > 0 && (
                <div className="mt-6">
                  <ProgressBar value={1} label="Today" />
                  <p className="mt-2 text-[13px] text-muted">
                    <span className="font-semibold text-fg tabular-nums">{today.reviewed}</span>{' '}
                    reviewed today
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {backupStale &&
        (sync.status === 'unavailable' || sync.status === 'error' || sync.status === 'auth') && (
          <Callout
            icon="alert"
            tone="streak"
            action={
              <Link to="/settings#backup" className={buttonClass('secondary', 'sm')}>
                Back up now
              </Link>
            }
          >
            <p className="pt-0.5">
              {lastBackup
                ? `No backup in the last ${BACKUP_STALE_DAYS} days.`
                : 'Your progress has never been backed up.'}{' '}
              <span className="text-muted">
                {sync.status === 'auth'
                  ? 'Sign in to sync, or export a backup file.'
                  : 'Export a backup file to be safe.'}
              </span>
            </p>
          </Callout>
        )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="courses-heading">
            <h2 id="courses-heading" className="mb-3 text-xl font-bold">
              Courses
            </h2>
            {view.courses.length ? (
              <>
                <ul className="space-y-3">{view.courses.map(courseTile)}</ul>
                <MaturityLegend />
              </>
            ) : (
              <EmptyState title="No active courses" icon="folder">
                Archived courses live in the Library.
              </EmptyState>
            )}
          </section>

          <Panel title="Coming up" action={<span className="text-xs text-muted">14 days</span>}>
            {upcoming.some((c) => c > 0) ? (
              <ForecastChart counts={upcoming} start={dayStart} />
            ) : (
              <p className="text-sm text-muted">
                Nothing scheduled yet. Cards you study will show up here when they come due.
              </p>
            )}
          </Panel>

          {(leechList.length > 0 || weak.length > 0) && (
            <Panel title="Trouble spots">
              <div className="grid gap-8 md:grid-cols-2">
                {leechList.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold">
                      Forgotten {settings.leechThreshold}+ times
                    </h3>
                    <p className="mt-0.5 text-[13px] text-muted">
                      Rewrite or split these — repetition alone isn’t working.
                    </p>
                    <ul className="mt-3 divide-y divide-line">
                      {leechList.map((card) => {
                        const item = itemById.get(card.itemId);
                        return (
                          <li
                            key={card.id}
                            className="flex items-center justify-between gap-3 py-2 text-sm"
                          >
                            <span className="truncate">
                              {item ? stripCloze(item.fields.prompt).slice(0, 90) : '—'}
                            </span>
                            <Link
                              to={`/items/${card.itemId}`}
                              className="shrink-0 font-semibold text-accent-text hover:underline"
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
                    <h3 className="text-sm font-bold">Weakest topics</h3>
                    <p className="mt-0.5 text-[13px] text-muted">
                      Highest share of forgotten reviews this month.
                    </p>
                    <ul className="mt-3 divide-y divide-line">
                      {weak.map((t) => {
                        return (
                          <li
                            key={t.topicId}
                            className="flex items-center justify-between gap-3 py-2 text-sm"
                          >
                            <Link
                              to={`/library?topic=${t.topicId}`}
                              className="truncate hover:underline"
                            >
                              {topicTrail(data.topics, t.topicId).join(TRAIL_SEPARATOR) ||
                                'Unknown topic'}
                            </Link>
                            <span className="shrink-0 text-muted tabular-nums">
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

        <aside className="grid content-start gap-6 sm:grid-cols-2 xl:grid-cols-1">
          <Panel title="Today">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Stat label="Reviewed" value={today.reviewed} />
              <Stat label="Time" value={minutes(today.timeMs)} />
              <Stat label="New learned" value={today.newIntroduced} />
              <Stat label="Forgotten" value={today.again} />
            </dl>
          </Panel>

          <Panel title="Retention" action={<span className="text-xs text-muted">30 days</span>}>
            {retention.rate === null || retention.total < 10 ? (
              <p className="text-sm text-muted">
                Appears after about 10 reviews of graduated cards. Your target is {target}%.
              </p>
            ) : (
              <div>
                <p className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tabular-nums">
                    {Math.round(retention.rate * 100)}%
                  </span>
                  <span className="text-sm text-muted">target {target}%</span>
                </p>
                <RetentionMeter rate={retention.rate} target={settings.desiredRetention} />
                <p className="mt-4 text-sm text-muted">
                  {retention.rate < settings.desiredRetention - 0.05
                    ? 'Below target. Rewriting or splitting hard cards helps more than extra reviews.'
                    : retention.rate > settings.desiredRetention + 0.05
                      ? 'Above target. You remember more than planned, so intervals will grow.'
                      : 'On target — the scheduler is calibrated for you.'}
                </p>
                <p className="mt-2 text-xs text-muted tabular-nums">
                  Based on {retention.total} reviews
                </p>
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
