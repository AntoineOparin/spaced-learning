/** Leeches and the topics with the highest lapse rate this month. */
import { Link } from 'react-router';
import { stripCloze } from '../../domain/cloze';
import { TRAIL_SEPARATOR, topicTrail } from '../../domain/topics';
import type { Topic } from '../../domain/types';
import { Panel } from '../../ui/misc';
import type { DashboardView } from './derive';

export function TroubleSpots({
  leechList,
  itemById,
  weak,
  topics,
  leechThreshold,
}: Pick<DashboardView, 'leechList' | 'itemById' | 'weak'> & {
  topics: Topic[];
  leechThreshold: number;
}) {
  if (leechList.length === 0 && weak.length === 0) return null;
  return (
    <Panel title="Trouble spots">
      <div className="grid gap-8 md:grid-cols-2">
        {leechList.length > 0 && (
          <div>
            <h3 className="text-sm font-bold">Forgotten {leechThreshold}+ times</h3>
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
              {weak.map((t) => (
                <li
                  key={t.topicId}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <Link to={`/library?topic=${t.topicId}`} className="truncate hover:underline">
                    {topicTrail(topics, t.topicId).join(TRAIL_SEPARATOR) || 'Unknown topic'}
                  </Link>
                  <span className="shrink-0 text-muted tabular-nums">
                    {Math.round(t.lapseRate * 100)}% of {t.reviews}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
