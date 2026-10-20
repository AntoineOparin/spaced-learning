/** The small side panels: streak, today's numbers and 30-day retention. */
import type { DaySummary, Retention, Streak } from '../../domain/stats';
import { cn } from '../../lib/cn';
import { Icon } from '../../ui/Icon';
import { Panel } from '../../ui/misc';
import { minutes } from './derive';

export function StreakBadge({ streak }: { streak: Streak }) {
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

export function TodayPanel({ today }: { today: DaySummary }) {
  return (
    <Panel title="Today">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Stat label="Reviewed" value={today.reviewed} />
        <Stat label="Time" value={minutes(today.timeMs)} />
        <Stat label="New learned" value={today.newIntroduced} />
        <Stat label="Forgotten" value={today.again} />
      </dl>
    </Panel>
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

export function RetentionPanel({
  retention,
  desiredRetention,
}: {
  retention: Retention;
  desiredRetention: number;
}) {
  const target = Math.round(desiredRetention * 100);
  return (
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
          <RetentionMeter rate={retention.rate} target={desiredRetention} />
          <p className="mt-4 text-sm text-muted">
            {retention.rate < desiredRetention - 0.05
              ? 'Below target. Rewriting or splitting hard cards helps more than extra reviews.'
              : retention.rate > desiredRetention + 0.05
                ? 'Above target. You remember more than planned, so intervals will grow.'
                : 'On target — the scheduler is calibrated for you.'}
          </p>
          <p className="mt-2 text-xs text-muted tabular-nums">Based on {retention.total} reviews</p>
        </div>
      )}
    </Panel>
  );
}
