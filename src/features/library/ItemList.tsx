/** Search box, filter chips and the paged list of items (or the matching empty state). */
import { Link } from 'react-router';
import { RichText } from '../../content/RichText';
import { stripCloze } from '../../domain/cloze';
import { formatInterval } from '../../domain/scheduler';
import { isLeech } from '../../domain/stats';
import { type Card, CardState, type Item } from '../../domain/types';
import { cn } from '../../lib/cn';
import { Button, IconButton } from '../../ui/Button';
import { Input } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Badge, type BadgeTone, EmptyState, surface } from '../../ui/misc';
import type { Filter } from './useItemFilter';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due today' },
  { value: 'new', label: 'New' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'leech', label: 'Leeches' },
];

function CardBadges({
  cards,
  now,
  dayEnd,
  leechThreshold,
}: {
  cards: Card[];
  now: number;
  dayEnd: number;
  leechThreshold: number;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {cards.map((c) => {
        let tone: BadgeTone = 'neutral';
        let label: string;
        if (c.suspended) label = 'Suspended';
        else if (c.state === CardState.New) {
          tone = 'xp';
          label = 'New';
        } else if (c.state !== CardState.Review) {
          tone = 'streak';
          label = 'Learning';
        } else if (c.due < dayEnd) {
          tone = 'accent';
          label = 'Due';
        } else label = `in ${formatInterval(c.due - now)}`;
        const leech = isLeech(c, leechThreshold);
        return (
          <span key={c.id} className="flex gap-1">
            {cards.length > 1 && <Badge>{c.key}</Badge>}
            <Badge tone={tone}>{label}</Badge>
            {leech && <Badge tone="danger">Leech</Badge>}
          </span>
        );
      })}
    </span>
  );
}

export interface ItemListProps {
  items: Item[];
  cardsByItem: Map<string, Card[]>;
  now: number;
  dayEnd: number;
  leechThreshold: number;
  query: string;
  onQuery: (q: string) => void;
  filter: Filter;
  onFilter: (f: Filter) => void;
  limit: number;
  onShowMore: () => void;
  /** The course has no topics yet: offer to add one instead of an item. */
  noTopics: boolean;
  onAddTopic: () => void;
  onNewItem: () => void;
  onToggleSuspend: (item: Item) => void;
}

export function ItemList(p: ItemListProps) {
  const { items, cardsByItem, query, filter, limit } = p;
  return (
    <>
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-dim"
        />
        <Input
          type="search"
          aria-label="Search items"
          placeholder="Search questions, answers, LaTeX, tags…"
          value={query}
          onChange={(e) => p.onQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      <fieldset className="-mx-4 mt-3 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <legend className="sr-only">Filter</legend>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => p.onFilter(f.value)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors',
              filter === f.value
                ? 'border-fg bg-fg text-bg'
                : 'border-line bg-bg text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {f.label}
          </button>
        ))}
      </fieldset>

      <p className="mt-5 mb-2 text-[13px] font-medium text-muted tabular-nums">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </p>

      {p.noTopics ? (
        <EmptyState
          title="No topics yet"
          icon="folder"
          action={
            <Button variant="primary" onClick={p.onAddTopic}>
              Add a topic
            </Button>
          }
        >
          Organise the course into topics (e.g. “Integration Techniques”), then add items.
        </EmptyState>
      ) : items.length === 0 ? (
        query || filter !== 'all' ? (
          <EmptyState title="No matching items" icon="search">
            Try a different search or filter.
          </EmptyState>
        ) : (
          <EmptyState
            title="No items here yet"
            icon="plus"
            action={
              <Button variant="primary" onClick={p.onNewItem}>
                Add an item
              </Button>
            }
          >
            Write one card per idea — small cards are quicker to review.
          </EmptyState>
        )
      ) : (
        <ul className={cn(surface, 'divide-y divide-line overflow-hidden')}>
          {items.slice(0, limit).map((item) => {
            const cards = cardsByItem.get(item.id) ?? [];
            const allSuspended = cards.length > 0 && cards.every((c) => c.suspended);
            return (
              <li
                key={item.id}
                className="group flex items-start transition-colors hover:bg-surface/50"
              >
                <Link to={`/items/${item.id}`} className="min-w-0 flex-1 px-4 py-3.5">
                  <RichText
                    source={stripCloze(item.fields.prompt)}
                    className={cn(
                      'line-clamp-3 text-[15px] font-medium',
                      allSuspended && 'text-muted',
                    )}
                  />
                  {item.type === 'basic' && (
                    <RichText
                      source={item.fields.answer}
                      className="mt-1 line-clamp-2 text-sm text-muted"
                    />
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <CardBadges
                      cards={cards}
                      now={p.now}
                      dayEnd={p.dayEnd}
                      leechThreshold={p.leechThreshold}
                    />
                    {item.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-xs text-faint">
                        #{t}
                      </span>
                    ))}
                  </div>
                </Link>
                <div className="shrink-0 py-2 pr-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                  <IconButton
                    label={allSuspended ? 'Unsuspend' : 'Suspend'}
                    onClick={() => p.onToggleSuspend(item)}
                  >
                    <Icon name={allSuspended ? 'play' : 'pause'} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > limit && (
        <div className="mt-6 text-center">
          <Button onClick={p.onShowMore}>Show more</Button>
        </div>
      )}
    </>
  );
}
