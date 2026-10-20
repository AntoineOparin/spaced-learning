import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLibraryData } from '../../db/hooks';
import { repo } from '../../db/instance';
import { endOfStudyDay } from '../../domain/day';
import { curriculumOrder } from '../../domain/topics';
import type { Course, Item, Topic } from '../../domain/types';
import { Button } from '../../ui/Button';
import { useConfirm } from '../../ui/Confirm';
import { Icon } from '../../ui/Icon';
import { EmptyState, LoadingStatus, PageHeader, Skeleton } from '../../ui/misc';
import { Select } from '../../ui/Select';
import { useToast } from '../../ui/Toast';
import { CourseDialog, TopicDialog } from './dialogs';
import { ItemList } from './ItemList';
import { ScopeHeader } from './ScopeHeader';
import { TopicTree } from './TopicTree';
import { subtreeItemCount, type TreeRow } from './tree';
import { useItemFilter } from './useItemFilter';
import { useLibraryDialog } from './useLibraryDialog';

export default function LibraryPage() {
  const data = useLibraryData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const dlg = useLibraryDialog(params.get('new') === 'course' ? { kind: 'course' } : null);

  const topicParam = params.get('topic');
  const selectedTopic = data?.topics.find((t) => t.id === topicParam) ?? null;
  const courseId = selectedTopic?.courseId ?? params.get('course') ?? data?.courses[0]?.id ?? null;
  const course = data?.courses.find((c) => c.id === courseId) ?? null;

  const now = Date.now();
  const dayEnd = data ? endOfStudyDay(now, data.settings.dayStartHour) : now;
  const list = useItemFilter(
    data && { ...data, leechThreshold: data.settings.leechThreshold },
    course,
    selectedTopic,
    dayEnd,
    params.get('q') ?? '',
  );

  const contentRef = useRef<HTMLElement>(null);
  const select = (next: { course?: string; topic?: string }) => {
    list.resetPage();
    setParams(
      Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Record<string, string>,
      { replace: true },
    );
  };

  if (!data)
    return (
      <LoadingStatus className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-72 w-full" />
      </LoadingStatus>
    );

  const toggleSuspend = async (item: Item) => {
    const cards = list.cardsByItem.get(item.id) ?? [];
    const suspend = !cards.every((c) => c.suspended);
    await repo.setSuspended(
      cards.map((c) => c.id),
      suspend,
    );
    toast({ message: suspend ? 'Suspended' : 'Unsuspended' });
  };

  const deleteTopic = async (t: Topic) => {
    const n = subtreeItemCount(data.topics, list.itemCounts, t.id);
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
  const addTopic = () =>
    course && dlg.openDialog({ kind: 'topic', courseId: course.id, parent: null });

  return (
    <div>
      <PageHeader
        title="Library"
        actions={
          <>
            <Button onClick={() => dlg.openDialog({ kind: 'course' })}>
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
            <Button variant="primary" onClick={() => dlg.openDialog({ kind: 'course' })}>
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
                itemCounts={list.itemCounts}
                selected={course && { courseId: course.id, topicId: selectedTopic?.id }}
                onSelect={showFromTree}
                onAddTopic={addTopic}
                addTopicLabel={course ? `New topic in ${course.name}` : 'New topic'}
              />
            </div>
          </nav>

          <section ref={contentRef} className="min-w-0">
            {course && (
              <ScopeHeader
                course={course}
                selectedTopic={selectedTopic}
                topics={data.topics}
                onOpenDialog={dlg.openDialog}
                onDeleteTopic={(t) => void deleteTopic(t)}
                onDeleteCourse={(c) => void deleteCourse(c)}
              />
            )}
            <ItemList
              items={list.visibleItems}
              cardsByItem={list.cardsByItem}
              now={now}
              dayEnd={dayEnd}
              leechThreshold={data.settings.leechThreshold}
              query={list.query}
              onQuery={list.setQuery}
              filter={list.filter}
              onFilter={list.setFilter}
              limit={list.limit}
              onShowMore={list.showMore}
              noTopics={!!course && flatTopics.length === 0}
              onAddTopic={addTopic}
              onNewItem={newItem}
              onToggleSuspend={(item) => void toggleSuspend(item)}
            />
          </section>
        </div>
      )}

      {dlg.dialog?.kind === 'course' && (
        <CourseDialog
          key={dlg.key}
          open={dlg.open}
          course={dlg.dialog.course}
          onClose={dlg.close}
          onCreated={(c) => select({ course: c.id })}
        />
      )}
      {dlg.dialog?.kind === 'topic' && (
        <TopicDialog
          key={dlg.key}
          open={dlg.open}
          courseId={dlg.dialog.courseId}
          parent={dlg.dialog.parent}
          topic={dlg.dialog.topic}
          onClose={dlg.close}
        />
      )}
    </div>
  );
}
