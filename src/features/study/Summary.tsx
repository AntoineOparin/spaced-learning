import { Link } from 'react-router';
import { RichText } from '../../content/RichText';
import { stripCloze } from '../../domain/cloze';
import { MINUTE } from '../../domain/day';
import type { SessionStats } from '../../domain/stats';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { surface } from '../../ui/misc';

/** End-of-session screen: totals and the cards that were forgotten. */
export function Summary({ stats, onExit }: { stats: SessionStats; onExit: () => void }) {
  const mins = Math.max(1, Math.round(stats.timeMs / MINUTE));
  const tiles = [
    { label: 'Reviewed', value: stats.reviewed, tone: 'text-accent-text' },
    { label: 'Minutes', value: mins, tone: 'text-xp-text' },
    { label: 'Forgotten', value: stats.again, tone: 'text-danger-text' },
  ];
  return (
    <div className="mx-auto w-full max-w-[480px] px-5 pt-12 pb-16 text-center">
      <div
        className={cn(
          'mx-auto flex size-20 animate-pop items-center justify-center rounded-full',
          stats.reviewed ? 'bg-accent-soft text-accent-text' : 'bg-surface text-muted',
        )}
      >
        <Icon name={stats.reviewed ? 'check' : 'today'} size={40} strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-3xl font-bold">
        {stats.reviewed ? 'Session complete' : 'Nothing due right now'}
      </h1>
      <p className="mt-2 text-muted">
        {!stats.reviewed
          ? 'New cards and reviews will appear here when they’re ready.'
          : stats.again === 0
            ? 'Every card recalled. Nicely done.'
            : `${stats.again} forgotten (${Math.round((stats.again / stats.reviewed) * 100)}%) — they’ll come back soon.`}
      </p>

      {stats.reviewed > 0 && (
        <dl className="mt-8 grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className={cn(surface, 'animate-rise px-2 py-4')}>
              <dt className={cn('text-xs font-bold', t.tone)}>{t.label}</dt>
              <dd className="mt-1 text-3xl font-extrabold tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {stats.forgotten.length > 0 && (
        <div className="mt-10 text-left">
          <h2 className="text-[15px] font-bold">Forgotten this session</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            If a card keeps failing, rewrite it: make it smaller, add a cue, or explain why.
          </p>
          <ul className={cn(surface, 'mt-3 divide-y divide-line')}>
            {stats.forgotten.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <RichText
                  source={stripCloze(item.fields.prompt)}
                  className="line-clamp-2 min-w-0 flex-1 text-sm"
                />
                <Link
                  to={`/items/${item.id}`}
                  className="shrink-0 text-sm font-bold text-accent-text hover:underline"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button variant="primary" size="lg" className="mt-10 w-full" onClick={onExit} autoFocus>
        Back to Today
      </Button>
    </div>
  );
}
