import { useState } from 'react';
import { repo } from '../../db/instance';
import type { Course, Topic } from '../../domain/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { useToast } from '../../ui/Toast';

const RETENTION_CHOICES = [0.8, 0.85, 0.9, 0.93, 0.95, 0.97];

export function CourseDialog({
  open,
  course,
  onClose,
  onCreated,
}: {
  open: boolean;
  course?: Course;
  onClose: () => void;
  onCreated?: (course: Course) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(course?.name ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [retention, setRetention] = useState(course?.desiredRetention?.toString() ?? '');
  const [newPerDay, setNewPerDay] = useState(course?.newPerDay?.toString() ?? '');

  const save = async () => {
    if (!name.trim()) return;
    const overrides = {
      desiredRetention: retention ? Number(retention) : undefined,
      newPerDay:
        newPerDay === '' ? undefined : Math.max(0, Math.min(500, Math.round(Number(newPerDay)))),
    };
    if (course) {
      await repo.updateCourse(course.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        ...overrides,
      });
      toast({ message: 'Course updated' });
    } else {
      const created = await repo.createCourse({
        name,
        description: description.trim() || undefined,
      });
      if (overrides.desiredRetention !== undefined || overrides.newPerDay !== undefined) {
        await repo.updateCourse(created.id, overrides);
      }
      onCreated?.(created);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={course ? 'Course settings' : 'New course'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!name.trim()}>
            {course ? 'Save' : 'Create course'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Discrete Mathematics"
            />
          )}
        </Field>
        <Field label="Description (optional)">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              className="font-sans"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Desired retention"
            hint="Higher means more reviews. Raise it before an exam."
          >
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
              >
                <option value="">Use global setting</option>
                {RETENTION_CHOICES.map((r) => (
                  <option key={r} value={r}>
                    {Math.round(r * 100)}%
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="New cards per day" hint="Leave empty to use the global setting.">
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                type="number"
                min={0}
                max={500}
                inputMode="numeric"
                value={newPerDay}
                onChange={(e) => setNewPerDay(e.target.value)}
              />
            )}
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export function TopicDialog({
  open,
  onClose,
  courseId,
  parent,
  topic,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  parent?: Topic | null;
  topic?: Topic;
}) {
  const [name, setName] = useState(topic?.name ?? '');
  const save = async () => {
    if (!name.trim()) return;
    if (topic) await repo.updateTopic(topic.id, { name: name.trim() });
    else await repo.createTopic({ courseId, parentId: parent?.id ?? null, name });
    onClose();
  };
  const title = topic ? 'Rename topic' : parent ? `New subtopic in “${parent.name}”` : 'New topic';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name">
          {(id) => (
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
