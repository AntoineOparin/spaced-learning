import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { RichText } from '../../content/RichText';
import { db, repo } from '../../db/instance';
import { stripCloze } from '../../domain/cloze';
import { endOfStudyDay } from '../../domain/day';
import { formatInterval } from '../../domain/scheduler';
import { isLeech } from '../../domain/stats';
import { childTopics, curriculumOrder, subtreeIds, topicPath } from '../../domain/topics';
import { type Card, CardState, type Course, type Item, type Topic } from '../../domain/types';
import { Button, IconButton } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Input, Select } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Badge, EmptyState, PageHeader } from '../../ui/misc';
import { useToast } from '../../ui/Toast';
import { CourseDialog, TopicDialog } from './dialogs';

type Filter = 'all' | 'new' | 'due' | 'suspended' | 'leech';
const PAGE = 50;

const alive = <T extends { deletedAt?: number }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === undefined);

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
        let tone: Parameters<typeof Badge>[0]['tone'] = 'neutral';
        let label: string;
        if (c.suspended) label = 'Suspended';
        else if (c.state === CardState.New) {
          tone = 'easy';
          label = 'New';
        } else if (c.state !== CardState.Review) {
          tone = 'hard';
          label = 'Learning';
        } else if (c.due < dayEnd) {
          tone = 'good';
          label = 'Due';
        } else label = `in ${formatInterval(c.due - now)}`;
        const leech = isLeech(c, leechThreshold);
        return (
          <span key={c.id} className="flex gap-1">
            {cards.length > 1 && <Badge>{c.key}</Badge>}
            <Badge tone={tone}>{label}</Badge>
            {leech && <Badge tone="again">Leech</Badge>}
          </span>
        );
      })}
    </span>
  );
}

function TreeNode({
  topic,
  topics,
  counts,
  selected,
  onSelect,
}: {
  topic: Topic;
  topics: Topic[];
  counts: Map<string, number>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const children = childTopics(topics, topic.id);
  const count = [...subtreeIds(topics, topic.id)].reduce((n, id) => n + (counts.get(id) ?? 0), 0);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(topic.id)}
        aria-current={selected === topic.id ? 'true' : undefined}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm',
          selected === topic.id ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-surface-2',
          !topic.active && 'text-faint',
        )}
      >
        <span className="truncate">{topic.name}</span>
        <span className="text-xs tabular-nums text-faint">{count}</span>
      </button>
      {children.length > 0 && (
        <ul className="ml-3 border-l border-line pl-2">
          {children.map((c) => (
            <TreeNode
              key={c.id}
              topic={c}
              topics={topics}
              counts={counts}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function LibraryPage() {
  const data = useLibraryData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [dialog, setDialog] = useState<
    | { kind: 'course'; course?: Course }
    | { kind: 'topic'; courseId: string; parent?: Topic | null; topic?: Topic }
    | null
  >(() => (params.get('new') === 'course' ? { kind: 'course' } : null));

  const topicParam = params.get('topic');
  const selectedTopic = data?.topics.find((t) => t.id === topicParam) ?? null;
  const courseId = selectedTopic?.courseId ?? params.get('course') ?? data?.courses[0]?.id ?? null;
  const course = data?.courses.find((c) => c.id === courseId) ?? null;

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
    for (const list of m.values())
      list.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    return m;
  }, [data]);

  const visibleItems = useMemo(() => {
    if (!data || !course) return [];
    const q = query.trim().toLowerCase();
    const inScope = selectedTopic
      ? subtreeIds(data.topics, selectedTopic.id)
      : new Set(data.topics.filter((t) => t.courseId === course.id).map((t) => t.id));
    const order = new Map(curriculumOrder(data.topics, course.id).map((t, i) => [t.id, i]));
    return data.items
      .filter((it) => (q ? it.courseId === course.id || !selectedTopic : inScope.has(it.topicId)))
      .filter((it) => !selectedTopic || inScope.has(it.topicId))
      .filter((it) => {
        if (!q) return true;
        const hay = [
          it.fields.prompt,
          stripCloze(it.fields.prompt),
          it.fields.answer,
          it.fields.explanation,
          it.fields.mnemonic,
          it.tags.join(' '),
        ]
          .join('\n')
          .toLowerCase();
        return hay.includes(q);
      })
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
      );
  }, [data, course, selectedTopic, query, filter, cardsByItem, dayEnd]);

  if (!data) return <p className="py-12 text-center text-sm text-muted">Loading…</p>;

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
    const n = [...subtreeIds(data.topics, t.id)].reduce(
      (s, id) => s + (itemCounts.get(id) ?? 0),
      0,
    );
    if (
      !window.confirm(
        `Delete “${t.name}”${n ? ` and its ${n} items` : ''}? Review history is kept.`,
      )
    )
      return;
    await repo.deleteTopic(t.id);
    select({ course: t.courseId });
  };

  const deleteCourse = async (c: Course) => {
    if (
      !window.confirm(
        `Delete the course “${c.name}” with all its topics and items? Review history is kept.`,
      )
    )
      return;
    await repo.deleteCourse(c.id);
    select({});
  };

  const roots = course
    ? childTopics(data.topics, null).filter((t) => t.courseId === course.id)
    : [];
  const flatTopics = course ? curriculumOrder(data.topics, course.id) : [];

  return (
    <div>
      <PageHeader
        title="Library"
        actions={
          <>
            <Button onClick={() => setDialog({ kind: 'course' })}>
              <Icon name="plus" /> Course
            </Button>
            {course && (
              <Button
                variant="primary"
                disabled={flatTopics.length === 0}
                onClick={() =>
                  navigate(`/items/new${selectedTopic ? `?topic=${selectedTopic.id}` : ''}`)
                }
              >
                <Icon name="plus" /> Item
              </Button>
            )}
          </>
        }
      />

      {data.courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          action={
            <Button variant="primary" onClick={() => setDialog({ kind: 'course' })}>
              Create a course
            </Button>
          }
        >
          Courses contain topics and subtopics, which contain your learning items.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          {/* Tree (desktop) / selectors (mobile) */}
          <nav aria-label="Courses and topics" className="space-y-4">
            <div className="flex gap-2 lg:hidden">
              <Select
                aria-label="Course"
                value={course?.id ?? ''}
                onChange={(e) => select({ course: e.target.value })}
              >
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Topic"
                value={selectedTopic?.id ?? ''}
                onChange={(e) =>
                  select(e.target.value ? { topic: e.target.value } : { course: course?.id })
                }
              >
                <option value="">All topics</option>
                {flatTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.parentId ? ` ${t.name}` : t.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="hidden space-y-4 lg:block">
              {data.courses.map((c) => (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={() => select({ course: c.id })}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold',
                      c.id === course?.id && !selectedTopic
                        ? 'bg-accent-soft text-accent'
                        : 'hover:bg-surface-2',
                    )}
                  >
                    <Icon name="folder" size={16} className="text-muted" />
                    <span className="truncate">{c.name}</span>
                    {c.archived && <Badge>archived</Badge>}
                  </button>
                  {c.id === course?.id && (
                    <ul className="mt-1 space-y-0.5">
                      {roots.map((t) => (
                        <TreeNode
                          key={t.id}
                          topic={t}
                          topics={data.topics}
                          counts={itemCounts}
                          selected={selectedTopic?.id ?? null}
                          onSelect={(id) => select({ topic: id })}
                        />
                      ))}
                      <li>
                        <button
                          type="button"
                          onClick={() => setDialog({ kind: 'topic', courseId: c.id, parent: null })}
                          className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted hover:text-fg"
                        >
                          <Icon name="plus" size={14} /> Add topic
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </nav>

          <section className="min-w-0">
            {/* Context toolbar for the selected course / topic */}
            {course && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                  <p className="truncate text-sm font-medium">
                    {selectedTopic
                      ? topicPath(data.topics, selectedTopic.id)
                          .map((t) => t.name)
                          .join(' › ')
                      : course.name}
                  </p>
                  {selectedTopic && (
                    <p className="text-xs text-muted">
                      {selectedTopic.active
                        ? 'Active — new cards are introduced'
                        : 'Inactive — no new cards until you activate it'}
                    </p>
                  )}
                </div>
                {selectedTopic ? (
                  <>
                    <Button
                      size="sm"
                      variant={selectedTopic.active ? 'secondary' : 'primary'}
                      onClick={() =>
                        void repo.setTopicActive(selectedTopic.id, !selectedTopic.active)
                      }
                    >
                      {selectedTopic.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    {!selectedTopic.parentId && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setDialog({ kind: 'topic', courseId: course.id, parent: selectedTopic })
                        }
                      >
                        <Icon name="plus" size={14} /> Subtopic
                      </Button>
                    )}
                    <IconButton
                      label="Rename"
                      onClick={() =>
                        setDialog({ kind: 'topic', courseId: course.id, topic: selectedTopic })
                      }
                    >
                      <Icon name="edit" />
                    </IconButton>
                    <IconButton
                      label="Move up"
                      onClick={() => void repo.moveTopic(selectedTopic.id, -1)}
                    >
                      <Icon name="chevronUp" />
                    </IconButton>
                    <IconButton
                      label="Move down"
                      onClick={() => void repo.moveTopic(selectedTopic.id, 1)}
                    >
                      <Icon name="chevronDown" />
                    </IconButton>
                    <IconButton
                      label="Delete topic"
                      onClick={() => void deleteTopic(selectedTopic)}
                    >
                      <Icon name="trash" />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        setDialog({ kind: 'topic', courseId: course.id, parent: null })
                      }
                      className="lg:hidden"
                    >
                      <Icon name="plus" size={14} /> Topic
                    </Button>
                    <Button size="sm" onClick={() => setDialog({ kind: 'course', course })}>
                      Settings
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        void repo.updateCourse(course.id, { archived: !course.archived })
                      }
                    >
                      {course.archived ? 'Unarchive' : 'Archive'}
                    </Button>
                    <IconButton label="Delete course" onClick={() => void deleteCourse(course)}>
                      <Icon name="trash" />
                    </IconButton>
                  </>
                )}
              </div>
            )}

            <div className="mb-3 flex gap-2">
              <div className="relative flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
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
                  className="pl-9"
                />
              </div>
              <div className="w-32 shrink-0 sm:w-36">
                <Select
                  aria-label="Filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as Filter)}
                >
                  <option value="all">All</option>
                  <option value="due">Due today</option>
                  <option value="new">New</option>
                  <option value="suspended">Suspended</option>
                  <option value="leech">Leeches</option>
                </Select>
              </div>
            </div>

            <p className="mb-2 text-xs text-muted">
              {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}
            </p>

            {flatTopics.length === 0 && course ? (
              <EmptyState
                title="No topics yet"
                action={
                  <Button
                    variant="primary"
                    onClick={() => setDialog({ kind: 'topic', courseId: course.id, parent: null })}
                  >
                    Add a topic
                  </Button>
                }
              >
                Organise the course into topics (e.g. “Integration Techniques”), then add items.
              </EmptyState>
            ) : visibleItems.length === 0 ? (
              <EmptyState
                title={query || filter !== 'all' ? 'No matching items' : 'No items here yet'}
              />
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {visibleItems.slice(0, limit).map((item) => {
                  const cards = cardsByItem.get(item.id) ?? [];
                  const allSuspended = cards.length > 0 && cards.every((c) => c.suspended);
                  return (
                    <li key={item.id} className="group flex gap-3 px-4 py-3">
                      <Link to={`/items/${item.id}`} className="min-w-0 flex-1">
                        <RichText
                          source={stripCloze(item.fields.prompt)}
                          className="line-clamp-3 text-sm"
                        />
                        {item.type === 'basic' && (
                          <RichText
                            source={item.fields.answer}
                            className="mt-1 line-clamp-2 text-sm text-muted"
                          />
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
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
                      <div className="flex shrink-0 flex-col gap-1 sm:opacity-60 sm:group-hover:opacity-100">
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
              <div className="mt-4 text-center">
                <Button onClick={() => setLimit((l) => l + PAGE)}>Show more</Button>
              </div>
            )}
            {selectedTopic && (
              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/study?topic=${selectedTopic.id}`)}
                >
                  <Icon name="play" /> Study this topic
                </Button>
              </div>
            )}
          </section>
        </div>
      )}

      {dialog?.kind === 'course' && (
        <CourseDialog
          open
          course={dialog.course}
          onClose={() => setDialog(null)}
          onCreated={(c) => select({ course: c.id })}
        />
      )}
      {dialog?.kind === 'topic' && (
        <TopicDialog
          open
          courseId={dialog.courseId}
          parent={dialog.parent}
          topic={dialog.topic}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
