/** The one thing to do now: today's queue and the Start button, or "all caught up". */
import type { QueueCounts } from '../../domain/queue';
import type { DaySummary } from '../../domain/stats';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Dot, Kbd, ProgressBar } from '../../ui/misc';
import { minutes } from './derive';

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

const QUEUE = [
  { key: 'learning', label: 'learning', dot: 'bg-streak' },
  { key: 'review', label: 'due', dot: 'bg-accent' },
  { key: 'new', label: 'new', dot: 'bg-xp' },
] as const;

function QueueBreakdown({ counts, className }: { counts: QueueCounts; className?: string }) {
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

export function SessionCard({
  all,
  today,
  estimate,
  upcoming,
  onStart,
}: {
  all: QueueCounts;
  today: DaySummary;
  /** Estimated session length in ms. */
  estimate: number;
  /** Review counts per upcoming study day (index 0 = today). */
  upcoming: number[];
  onStart: () => void;
}) {
  const toStudy = all.review + all.learning + all.new;
  return (
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
          <QueueBreakdown counts={all} className="mt-3" />
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
              onClick={onStart}
              className="w-full sm:w-auto sm:min-w-56"
            >
              Start studying
            </Button>
            <span className="hidden items-center gap-1.5 text-[13px] text-muted lg:flex">
              <Kbd>Space</Kbd> reveal <span className="text-dim">·</span> <Kbd>1</Kbd>–<Kbd>4</Kbd>{' '}
              rate
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
  );
}
