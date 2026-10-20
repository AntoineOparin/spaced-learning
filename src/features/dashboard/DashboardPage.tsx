import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDashboardData } from '../../db/hooks';
import { LEARN_AHEAD_MS } from '../../domain/queue';
import { LoadingStatus, Panel, Skeleton } from '../../ui/misc';
import { BackupReminder } from './BackupReminder';
import { CourseList } from './CourseList';
import { ForecastChart } from './charts';
import { deriveDashboard, greeting } from './derive';
import { SessionCard } from './SessionCard';
import { RetentionPanel, StreakBadge, TodayPanel } from './StatsPanels';
import { TroubleSpots } from './TroubleSpots';
import { Welcome } from './Welcome';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

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

export function DashboardPage() {
  const [refresh, setRefresh] = useState(0);
  const dash = useDashboardData(refresh);
  const navigate = useNavigate();
  const view = useMemo(() => (dash ? deriveDashboard(dash) : null), [dash]);

  // A learning card waiting for later today becomes studyable once it's within learn-ahead.
  const nextLearningDue = view?.all.nextLearningDue;
  useEffect(() => {
    if (!nextLearningDue) return;
    const t = window.setTimeout(
      () => setRefresh((n) => n + 1),
      nextLearningDue - LEARN_AHEAD_MS - Date.now(),
    );
    return () => window.clearTimeout(t);
  }, [nextLearningDue]);

  if (!dash || !view) return <DashboardSkeleton />;
  const { data, now, streak } = dash;
  const { settings } = data;
  if (data.courses.length === 0) return <Welcome />;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">{DATE_FORMAT.format(now)}</p>
          <h1 className="mt-1 text-3xl font-bold">{greeting(now)}</h1>
        </div>
        <StreakBadge streak={streak} />
      </header>

      <SessionCard
        all={view.all}
        today={view.today}
        estimate={view.estimate}
        upcoming={view.upcoming}
        onStart={() => navigate('/study')}
      />

      <BackupReminder now={now} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          <CourseList courses={view.courses} />

          <Panel title="Coming up" action={<span className="text-xs text-muted">14 days</span>}>
            {view.upcoming.some((c) => c > 0) ? (
              <ForecastChart counts={view.upcoming} start={view.dayStart} />
            ) : (
              <p className="text-sm text-muted">
                Nothing scheduled yet. Cards you study will show up here when they come due.
              </p>
            )}
          </Panel>

          <TroubleSpots
            leechList={view.leechList}
            itemById={view.itemById}
            weak={view.weak}
            topics={data.topics}
            leechThreshold={settings.leechThreshold}
          />
        </div>

        <aside className="grid content-start gap-6 sm:grid-cols-2 xl:grid-cols-1">
          <TodayPanel today={view.today} />
          <RetentionPanel retention={view.retention} desiredRetention={settings.desiredRetention} />
        </aside>
      </div>
    </div>
  );
}
