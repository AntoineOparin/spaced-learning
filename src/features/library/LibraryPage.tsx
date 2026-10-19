import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { RichText } from '../../content/RichText';
import { db, repo } from '../../db/instance';
import { compareCardKeys } from '../../domain/cardgen';
import { stripCloze } from '../../domain/cloze';
import { endOfStudyDay } from '../../domain/day';
import { formatInterval } from '../../domain/scheduler';
import { isLeech } from '../../domain/stats';
import { curriculumOrder, subtreeIds, TRAIL_SEPARATOR, topicTrail } from '../../domain/topics';
import {
  alive,
  type Card,
  CardState,
  type Course,
  type Item,
  type Topic,
} from '../../domain/types';
import { Button, IconButton } from '../../ui/Button';
import { useConfirm } from '../../ui/Confirm';
import { cn } from '../../ui/cn';
import { Input, Switch } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Menu, type MenuItem } from '../../ui/Menu';
import {
  Badge,
  type BadgeTone,
  EmptyState,
  LoadingStatus,
  PageHeader,
  Skeleton,
  surface,
} from '../../ui/misc';
import { Select } from '../../ui/Select';
import { useToast } from '../../ui/Toast';
import { CourseDialog, TopicDialog } from './dialogs';
import { TopicTree } from './TopicTree';
import { courseKey, subtreeItemCount, type TreeRow, topicKey } from './tree';

type Filter = 'all' | 'new' | 'due' | 'suspended' | 'leech';
const PAGE = 50;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due today' },
  { value: 'new', label: 'New' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'leech', label: 'Leeches' },
];

type DialogState =
  | { kind: 'course'; course?: Course }
  | { kind: 'topic'; courseId: string; parent?: Topic | null; topic?: Topic };

function useLibraryData() {
  return useLiveQuery(async () => {
    const [courses, topics, items, cards, settings] = await Promise.all([
      db.courses.toArray(),
      db.topics.toArray(),
      db.items.toArray(),
      db.cards.toArray(),
      repo.getSettings(),
    ]);
    return {
      courses: alive(courses).sort((a, b) => a.order - b.order),
      topics: alive(topics),
      items: alive(items),
      cards: alive(cards),
      settings,
    };
  }, []);
}

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

export default function LibraryPage() {
  const data = useLibraryData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  // The dialog's content stays mounted while it animates closed; the key resets its form.
  const [dialog, setDialog] = useState<DialogState | null>(() =>
    params.get('new') === 'course' ? { kind: 'course' } : null,
  );
  const [dialogOpen, setDialogOpen] = useState(dialog !== null);
  const [dialogKey, setDialogKey] = useState(0);
  const openDialog = (next: DialogState) => {
    setDialog(next);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const topicParam = params.get('topic');
  const selectedTopic = data?.topics.find((t) => t.id === topicParam) ?? null;
  const courseId = selectedTopic?.courseId ?? params.get('course') ?? data?.courses[0]?.id ?? null;
  const course = data?.courses.find((c) => c.id === courseId) ?? null;

  const contentRef = useRef<HTMLElement>(null);
  const select = (next: { course?: string; topic?: string }) => {
    setLimit(PAGE);
    setParams(
      Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Record<string, string>,
      { replace: true },
    );
  };

  const now = Date.now();
  const dayEnd = data ? endOfStudyDay(now, data.settings.dayStartHour) : now;

  const itemCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of data?.items ?? []) m.set(it.topicId, (m.get(it.topicId) ?? 0) + 1);
    return m;
  }, [data]);

  const cardsByItem = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const c of data?.cards ?? []) {
      const list = m.get(c.itemId) ?? [];
      list.push(c);
      m.set(c.itemId, list);
    }
    for (const list of m.values()) list.sort((a, b) => compareCardKeys(a.key, b.key));
    return m;
  }, [data]);

  // Lower-cased text per item, built once per data change rather than on every keystroke.
  const searchText = useMemo(
    () =>
      new Map(
        (data?.items ?? []).map((it) => [
          it.id,
          [
            it.fields.prompt,
            stripCloze(it.fields.prompt),
            it.fields.answer,
            it.fields.explanation,
            it.fields.mnemonic,
            it.tags.join(' '),
          ]
            .join('\n')
            .toLowerCase(),
        ]),
      ),
    [data],
  );

  const visibleItems = useMemo(() => {
    if (!data || !course) return [];
    const q = query.trim().toLowerCase();
    const inScope = selectedTopic
      ? subtreeIds(data.topics, selectedTopic.id)
      : new Set(data.topics.filter((t) => t.courseId === course.id).map((t) => t.id));
    const order = new Map(curriculumOrder(data.topics, course.id).map((t, i) => [t.id, i]));
    return (
      data.items
        // A search with no topic selected looks across every course.
        .filter((it) => (q && !selectedTopic) || inScope.has(it.topicId))
        .filter((it) => !q || searchText.get(it.id)?.includes(q))
        .filter((it) => {
          if (filter === 'all') return true;
          const cards = cardsByItem.get(it.id) ?? [];
          switch (filter) {
            case 'new':
              return cards.some((c) => c.state === CardState.New && !c.suspended);
            case 'due':
              return cards.some((c) => c.state !== CardState.New && !c.suspended && c.due < dayEnd);
            case 'suspended':
              return cards.some((c) => c.suspended);
            case 'leech':
              return cards.some((c) => isLeech(c, data.settings.leechThreshold));
            default:
              return true;
          }
        })
        .sort(
          (a, b) =>
            (order.get(a.topicId) ?? 999) - (order.get(b.topicId) ?? 999) || a.order - b.order,
        )
    );
  }, [data, course, selectedTopic, query, filter, cardsByItem, dayEnd, searchText]);

  if (!data)
    return (
      <LoadingStatus className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-72 w-full" />
      </LoadingStatus>
    );

  const toggleSuspend = async (item: Item) => {
    const cards = cardsByItem.get(item.id) ?? [];
    const suspend = !cards.every((c) => c.suspended);
    await repo.setSuspended(
      cards.map((c) => c.id),
      suspend,
    );
    toast({ message: suspend ? 'Suspended' : 'Unsuspended' });
  };

  const deleteTopic = async (t: Topic) => {
    const n = subtreeItemCount(data.topics, itemCounts, t.id);
    const ok = await confirm({
      title: `Delete “${t.name}”?`,
      body: `${n ? `Its ${n} ${n === 1 ? 'item goes' : 'items go'} with it. ` : ''}Your review history is kept.`,
      confirmLabel: 'Delete topic',
    });
    if (!ok) return;
    await repo.deleteTopic(t.id);
    select({ course: t.courseId });
  };

  const deleteCourse = async (c: Course) => {
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      body: 'All of its topics and items are deleted. Your review history is kept.',
      confirmLabel: 'Delete course',
    });
    if (!ok) return;
    await repo.deleteCourse(c.id);
    select({});
  };

  /** Picking from the tree shows the new list from its top, even when scrolled far down. */
  const showFromTree = (row: TreeRow) => {
    select(row.kind === 'course' ? { course: row.id } : { topic: row.id });
    const el = contentRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
  };
  const flatTopics = course ? curriculumOrder(data.topics, course.id) : [];
  const newItem = () => navigate(`/items/new${selectedTopic ? `?topic=${selectedTopic.id}` : ''}`);

  const topicActions: MenuItem[] = selectedTopic
    ? [
        ...(!selectedTopic.parentId && course
          ? [
              {
                label: 'Add subtopic',
                icon: 'plus' as const,
                onSelect: () =>
                  openDialog({ kind: 'topic', courseId: course.id, parent: selectedTopic }),
              },
            ]
          : []),
        {
          label: 'Rename',
          icon: 'edit',
          onSelect: () =>
            openDialog({ kind: 'topic', courseId: selectedTopic.courseId, topic: selectedTopic }),
        },
        {
          label: 'Move up',
          icon: 'chevronUp',
          onSelect: () => void repo.moveTopic(selectedTopic.id, -1),
        },
        {
          label: 'Move down',
          icon: 'chevronDown',
          onSelect: () => void repo.moveTopic(selectedTopic.id, 1),
        },
        {
          label: 'Delete topic',
          icon: 'trash',
          danger: true,
          onSelect: () => void deleteTopic(selectedTopic),
        },
      ]
    : [];

  const courseActions: MenuItem[] = course
    ? [
        {
          label: 'Add topic',
          icon: 'plus',
          onSelect: () => openDialog({ kind: 'topic', courseId: course.id, parent: null }),
        },
        {
          label: 'Course settings',
          icon: 'settings',
          onSelect: () => openDialog({ kind: 'course', course }),
        },
        {
          label: course.archived ? 'Unarchive' : 'Archive',
          icon: 'folder',
          onSelect: () => void repo.updateCourse(course.id, { archived: !course.archived }),
        },
        {
          label: 'Delete course',
          icon: 'trash',
          danger: true,
          onSelect: () => void deleteCourse(course),
        },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Library"
        actions={
          <>
            <Button onClick={() => openDialog({ kind: 'course' })}>
              <Icon name="plus" /> New course
            </Button>
            {course && (
              <Button variant="primary" disabled={flatTopics.length === 0} onClick={newItem}>
                <Icon name="plus" /> New item
              </Button>
            )}
          </>
        }
      />

      {data.courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          icon="library"
          action={
            <Button variant="primary" onClick={() => openDialog({ kind: 'course' })}>
              Create a course
            </Button>
          }
        >
          Courses hold topics and subtopics, and topics hold your cards.
        </EmptyState>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[16rem_minmax(0,1fr)]">
          {/* Tree (wide screens) / pickers (everything else) */}
          <nav aria-label="Library">
            <div className="grid grid-cols-2 gap-3 xl:hidden">
              <Select
                aria-label="Course"
                value={course?.id ?? ''}
                onChange={(v) => select({ course: v })}
                options={data.courses.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Select
                aria-label="Topic"
                value={selectedTopic?.id ?? ''}
                onChange={(v) => select(v ? { topic: v } : { course: course?.id })}
                options={[
                  { value: '', label: 'All topics' },
                  ...flatTopics.map((t) => ({ value: t.id, label: t.name, indent: !!t.parentId })),
                ]}
              />
            </div>

            {/* The tree stays in view with its own scrolling while the item list scrolls. */}
            <div className="sticky top-(--page-top) hidden xl:block">
              <TopicTree
                courses={data.courses}
                topics={data.topics}
                itemCounts={itemCounts}
                selectedKey={
                  selectedTopic ? topicKey(selectedTopic.id) : course ? courseKey(course.id) : ''
                }
                onSelect={showFromTree}
                onAddTopic={() =>
                  course && openDialog({ kind: 'topic', courseId: course.id, parent: null })
                }
                addTopicLabel={course ? `New topic in ${course.name}` : 'New topic'}
              />
            </div>
          </nav>

          <section ref={contentRef} className="min-w-0">
            {/* The selected course or topic, with its actions */}
            {course && (
              <div className="mb-6">
                {selectedTopic && (
                  <p className="mb-1 truncate text-[13px] font-medium text-muted">
                    {topicTrail(data.topics, selectedTopic.id, course)
                      .slice(0, -1)
                      .join(TRAIL_SEPARATOR)}
                  </p>
                )}
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-2xl font-bold">
                      {selectedTopic ? selectedTopic.name : course.name}
                    </h2>
                    {!selectedTopic && course.description && (
                      <p className="mt-1 text-sm text-muted">{course.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    aria-label={selectedTopic ? 'Study this topic' : 'Study this course'}
                    onClick={() =>
                      navigate(
                        selectedTopic
                          ? `/study?topic=${selectedTopic.id}`
                          : `/study?course=${course.id}`,
                      )
                    }
                  >
                    <Icon name="play" size={16} fill="currentColor" /> Study
                  </Button>
                  <Menu
                    label={selectedTopic ? 'Topic actions' : 'Course actions'}
                    items={selectedTopic ? topicActions : courseActions}
                  />
                </div>
                {selectedTopic && (
                  <div className={cn(surface, 'mt-4 px-4 py-3.5')}>
                    <Switch
                      checked={selectedTopic.active}
                      onChange={(v) => void repo.setTopicActive(selectedTopic.id, v)}
                      label="Introduce new cards"
                      description={
                        selectedTopic.active
                          ? 'New cards from this topic join your daily sessions.'
                          : 'Paused: reviews continue, but no new cards are introduced.'
                      }
                    />
                  </div>
                )}
              </div>
            )}

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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
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
                  onClick={() => {
                    setFilter(f.value);
                    setLimit(PAGE);
                  }}
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
              {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}
            </p>

            {flatTopics.length === 0 && course ? (
              <EmptyState
                title="No topics yet"
                icon="folder"
                action={
                  <Button
                    variant="primary"
                    onClick={() => openDialog({ kind: 'topic', courseId: course.id, parent: null })}
                  >
                    Add a topic
                  </Button>
                }
              >
                Organise the course into topics (e.g. “Integration Techniques”), then add items.
              </EmptyState>
            ) : visibleItems.length === 0 ? (
              query || filter !== 'all' ? (
                <EmptyState title="No matching items" icon="search">
                  Try a different search or filter.
                </EmptyState>
              ) : (
                <EmptyState
                  title="No items here yet"
                  icon="plus"
                  action={
                    <Button variant="primary" onClick={newItem}>
                      Add an item
                    </Button>
                  }
                >
                  Write one card per idea — small cards are quicker to review.
                </EmptyState>
              )
            ) : (
              <ul className={cn(surface, 'divide-y divide-line overflow-hidden')}>
                {visibleItems.slice(0, limit).map((item) => {
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
                            now={now}
                            dayEnd={dayEnd}
                            leechThreshold={data.settings.leechThreshold}
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
                          onClick={() => void toggleSuspend(item)}
                        >
                          <Icon name={allSuspended ? 'play' : 'pause'} />
                        </IconButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {visibleItems.length > limit && (
              <div className="mt-6 text-center">
                <Button onClick={() => setLimit((l) => l + PAGE)}>Show more</Button>
              </div>
            )}
          </section>
        </div>
      )}

      {dialog?.kind === 'course' && (
        <CourseDialog
          key={dialogKey}
          open={dialogOpen}
          course={dialog.course}
          onClose={() => setDialogOpen(false)}
          onCreated={(c) => select({ course: c.id })}
        />
      )}
      {dialog?.kind === 'topic' && (
        <TopicDialog
          key={dialogKey}
          open={dialogOpen}
          courseId={dialog.courseId}
          parent={dialog.parent}
          topic={dialog.topic}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
