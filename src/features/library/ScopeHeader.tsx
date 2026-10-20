/** The selected course or topic: its trail, title, Study button, actions menu and new-card switch. */
import { useNavigate } from 'react-router';
import { repo } from '../../db/instance';
import { TRAIL_SEPARATOR, topicTrail } from '../../domain/topics';
import type { Course, Topic } from '../../domain/types';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Menu, type MenuItem } from '../../ui/Menu';
import { surface } from '../../ui/misc';
import type { DialogState } from './useLibraryDialog';

export function ScopeHeader({
  course,
  selectedTopic,
  topics,
  onOpenDialog,
  onDeleteTopic,
  onDeleteCourse,
}: {
  course: Course;
  selectedTopic: Topic | null;
  topics: Topic[];
  onOpenDialog: (d: DialogState) => void;
  onDeleteTopic: (t: Topic) => void;
  onDeleteCourse: (c: Course) => void;
}) {
  const navigate = useNavigate();

  const topicActions: MenuItem[] = selectedTopic
    ? [
        ...(!selectedTopic.parentId
          ? [
              {
                label: 'Add subtopic',
                icon: 'plus' as const,
                onSelect: () =>
                  onOpenDialog({ kind: 'topic', courseId: course.id, parent: selectedTopic }),
              },
            ]
          : []),
        {
          label: 'Rename',
          icon: 'edit',
          onSelect: () =>
            onOpenDialog({ kind: 'topic', courseId: selectedTopic.courseId, topic: selectedTopic }),
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
          onSelect: () => onDeleteTopic(selectedTopic),
        },
      ]
    : [];

  const courseActions: MenuItem[] = [
    {
      label: 'Add topic',
      icon: 'plus',
      onSelect: () => onOpenDialog({ kind: 'topic', courseId: course.id, parent: null }),
    },
    {
      label: 'Course settings',
      icon: 'settings',
      onSelect: () => onOpenDialog({ kind: 'course', course }),
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
      onSelect: () => onDeleteCourse(course),
    },
  ];

  return (
    <div className="mb-6">
      {selectedTopic && (
        <p className="mb-1 truncate text-[13px] font-medium text-muted">
          {topicTrail(topics, selectedTopic.id, course).slice(0, -1).join(TRAIL_SEPARATOR)}
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
              selectedTopic ? `/study?topic=${selectedTopic.id}` : `/study?course=${course.id}`,
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
  );
}
