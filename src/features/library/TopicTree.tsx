/**
 * The library's course/topic tree, in the style of VS Code's explorer: foldable branches with
 * indent guides, expansion remembered per device, and full keyboard navigation (ARIA tree).
 * It scrolls on its own, so the item list beside it can be long.
 */
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { Course, Topic } from '../../domain/types';
import { cn } from '../../lib/cn';
import { readLocal, writeLocal } from '../../lib/storage';
import { IconButton } from '../../ui/Button';
import { DisclosureChevron } from '../../ui/Disclosure';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/misc';
import { courseKey, revealKeys, type TreeRow, topicKey, treeKey, visibleRows } from './tree';

const STORAGE_KEY = 'libraryTreeExpanded';
/** Row geometry: left padding, indent per level, and the chevron's centre (for guides). */
const BASE = 6;
const INDENT = 14;
const GUIDE = 8;

function loadExpanded(): Set<string> | null {
  try {
    const raw = readLocal(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null; // unreadable JSON: start fresh
  }
}

export function TopicTree({
  courses,
  topics,
  itemCounts,
  selected,
  onSelect,
  onAddTopic,
  addTopicLabel,
}: {
  courses: Course[];
  topics: Topic[];
  itemCounts: Map<string, number>;
  /** What the item list shows: a course, or a topic in it. */
  selected: { courseId: string; topicId?: string } | null;
  onSelect: (row: TreeRow) => void;
  onAddTopic: () => void;
  addTopicLabel: string;
}) {
  const treeId = useId();
  const rowId = (key: string) => `${treeId}-${key}`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedTopicId = selected?.topicId;
  const selectedCourseKey = selected ? courseKey(selected.courseId) : '';
  const selectedKey = selectedTopicId ? topicKey(selectedTopicId) : selectedCourseKey;
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // First visit: open the selected course (a selected topic is revealed below).
    return loadExpanded() ?? new Set(selected && !selectedTopicId ? [selectedKey] : []);
  });
  const [focusKey, setFocusKey] = useState(selectedKey);
  const focusPending = useRef(false);

  const rows = visibleRows(courses, topics, itemCounts, expanded);
  const visible = (key: string) => rows.some((r) => r.key === key);
  // Focus falls back to the selection, then its course, when its row gets folded away.
  const focus = [focusKey, selectedKey, selectedCourseKey].find(visible) ?? rows[0]?.key ?? '';

  useEffect(() => writeLocal(STORAGE_KEY, JSON.stringify([...expanded])), [expanded]);

  const expand = useCallback(
    (keys: string[]) =>
      setExpanded((prev) => (keys.every((k) => prev.has(k)) ? prev : new Set([...prev, ...keys]))),
    [],
  );

  // The selection is always visible: arriving at a course or topic from elsewhere (a new
  // course, a dashboard link, the phone pickers) unfolds the tree to it.
  const topicsRef = useRef(topics);
  topicsRef.current = topics;
  useEffect(() => {
    const topic = topicsRef.current.find((t) => t.id === selectedTopicId);
    if (topic) expand(revealKeys(topicsRef.current, topic));
    else if (selectedKey) expand([selectedKey]);
    setFocusKey(selectedKey);
  }, [selectedKey, selectedTopicId, expand]);

  // A topic you just added appears where you added it. (A whole deck arriving at once,
  // from an import or a sync, is left folded.)
  const known = useRef(new Set(topics.map((t) => t.id)));
  useEffect(() => {
    const added = topics.filter((t) => !known.current.has(t.id));
    known.current = new Set(topics.map((t) => t.id));
    if (added.length > 0 && added.length <= 3) expand(added.flatMap((t) => revealKeys(topics, t)));
  }, [topics, expand]);

  /** Scrolls the tree (never the page) so a row is visible. */
  const reveal = (key: string) => {
    const box = scrollRef.current;
    const el = document.getElementById(rowId(key));
    if (!box || !el) return;
    if (el.offsetTop < box.scrollTop + 8) box.scrollTop = el.offsetTop - 8;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight - 8)
      box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight + 8;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reveal the selection once its row exists
  useEffect(() => reveal(selectedKey), [selectedKey, expanded]);

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    document.getElementById(rowId(focus))?.focus({ preventScroll: true });
    reveal(focus);
  });

  const setOpen = (key: string, open: boolean) =>
    setExpanded((prev) => {
      if (prev.has(key) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });

  const onRowClick = (row: TreeRow) => {
    setFocusKey(row.key);
    // Like VS Code: clicking the open folder again folds it.
    if (row.key === selectedKey) {
      if (row.hasChildren) setOpen(row.key, !row.expanded);
      return;
    }
    onSelect(row);
    if (row.hasChildren) setOpen(row.key, true);
  };

  const onChevronClick = (e: MouseEvent, row: TreeRow) => {
    e.stopPropagation(); // fold without changing what the list shows
    setFocusKey(row.key);
    setOpen(row.key, !row.expanded);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const action = treeKey(rows, focus, e.key);
    if (!action) return;
    e.preventDefault();
    if ('focus' in action) {
      focusPending.current = true;
      setFocusKey(action.focus);
    } else if ('expand' in action) setOpen(action.expand, true);
    else if ('collapse' in action) setOpen(action.collapse, false);
    else if ('select' in action) {
      const row = rows.find((r) => r.key === action.select);
      if (row && row.key !== selectedKey) onSelect(row);
    }
  };

  return (
    // Fits between the sticky offset and the page's bottom padding, so the
    // header never gets pushed off the top at the end of the page.
    <div className="flex max-h-[calc(100dvh-var(--page-top)-var(--page-bottom))] flex-col">
      <div className="mb-1 flex items-center justify-between pl-2.5">
        <h2 className="text-xs font-bold text-muted">Courses</h2>
        <div className="flex">
          <IconButton label={addTopicLabel} onClick={onAddTopic} className="size-8">
            <Icon name="plus" size={16} />
          </IconButton>
          <IconButton
            label="Collapse all"
            onClick={() => setExpanded(new Set())}
            disabled={!rows.some((r) => r.expanded)}
            className="size-8"
          >
            <Icon name="collapseAll" size={16} />
          </IconButton>
        </div>
      </div>
      <div
        ref={scrollRef}
        role="tree"
        aria-label="Courses"
        onKeyDown={onKeyDown}
        // Rows fade at the scroll edges instead of being cut by a hard line.
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 [scrollbar-gutter:stable] [mask-image:linear-gradient(to_bottom,transparent,black_8px,black_calc(100%-8px),transparent)]"
      >
        {rows.map((row) => {
          const isSelected = row.key === selectedKey;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled by the tree (ARIA roving focus)
            <div
              key={row.key}
              id={rowId(row.key)}
              role="treeitem"
              aria-level={row.level}
              aria-setsize={row.siblings}
              aria-posinset={row.pos}
              aria-expanded={row.hasChildren ? row.expanded : undefined}
              aria-selected={isSelected}
              aria-label={`${row.name}, ${row.count} ${row.count === 1 ? 'item' : 'items'}${row.paused ? ', paused' : ''}${row.archived ? ', archived' : ''}`}
              tabIndex={row.key === focus ? 0 : -1}
              onFocus={() => setFocusKey(row.key)}
              onClick={() => onRowClick(row)}
              className={cn(
                'relative flex h-8 cursor-pointer items-center gap-1.5 rounded-lg pr-2 text-sm select-none transition-colors',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)',
                row.kind === 'course' && 'font-bold',
                isSelected ? 'bg-surface font-semibold text-fg' : 'hover:bg-surface/60',
                row.paused && !isSelected && 'text-faint',
              )}
              style={{ paddingLeft: BASE + (row.level - 1) * INDENT }}
            >
              {Array.from({ length: row.level - 1 }, (_, a) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: one guide per ancestor level
                  key={a}
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-line"
                  style={{ left: BASE + a * INDENT + GUIDE }}
                />
              ))}
              {/* The chevron folds with the pointer; ← and → do it from the keyboard. */}
              <span
                aria-hidden
                onClick={(e) => row.hasChildren && onChevronClick(e, row)}
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded text-muted',
                  row.hasChildren && 'hover:bg-line hover:text-fg',
                )}
              >
                {row.hasChildren && <DisclosureChevron open={row.expanded} size={14} />}
              </span>
              {row.kind === 'course' && (
                <Icon name="folder" size={16} className="shrink-0 text-dim" />
              )}
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              {row.archived && <Badge>Archived</Badge>}
              {row.paused && <Icon name="pause" size={12} className="shrink-0 text-dim" />}
              <span className="text-xs font-normal text-faint tabular-nums">{row.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
