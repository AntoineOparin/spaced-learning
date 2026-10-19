/**
 * The library's course/topic tree as a flat list of visible rows (collapsed branches are left
 * out), plus keyboard navigation in the style of VS Code's explorer and the ARIA tree pattern.
 */
import { childTopics, topicPath } from '../../domain/topics';
import type { Course, Topic } from '../../domain/types';

export interface TreeRow {
  /** `course:<id>` or `topic:<id>`, unique across the tree. */
  key: string;
  kind: 'course' | 'topic';
  id: string;
  courseId: string;
  name: string;
  /** 1 for courses, 2 for root topics, … */
  level: number;
  parentKey: string | null;
  /** Position among siblings, for aria-posinset / aria-setsize. */
  pos: number;
  siblings: number;
  hasChildren: boolean;
  expanded: boolean;
  /** Items in this course or topic, including subtopics. */
  count: number;
  paused: boolean;
  archived: boolean;
}

export const courseKey = (id: string) => `course:${id}`;
export const topicKey = (id: string) => `topic:${id}`;

export function visibleRows(
  courses: readonly Course[],
  topics: readonly Topic[],
  itemCounts: ReadonlyMap<string, number>,
  expanded: ReadonlySet<string>,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const subtreeCount = new Map<string, number>();
  const countOf = (t: Topic): number => {
    const cached = subtreeCount.get(t.id);
    if (cached !== undefined) return cached;
    const n = childTopics(topics, t.id).reduce((s, c) => s + countOf(c), itemCounts.get(t.id) ?? 0);
    subtreeCount.set(t.id, n);
    return n;
  };

  const addTopics = (list: Topic[], level: number, parentKey: string) => {
    list.forEach((t, i) => {
      const children = childTopics(topics, t.id);
      const key = topicKey(t.id);
      const open = children.length > 0 && expanded.has(key);
      rows.push({
        key,
        kind: 'topic',
        id: t.id,
        courseId: t.courseId,
        name: t.name,
        level,
        parentKey,
        pos: i + 1,
        siblings: list.length,
        hasChildren: children.length > 0,
        expanded: open,
        count: countOf(t),
        paused: !t.active,
        archived: false,
      });
      if (open) addTopics(children, level + 1, key);
    });
  };

  courses.forEach((c, i) => {
    const roots = childTopics(topics, null).filter((t) => t.courseId === c.id);
    const key = courseKey(c.id);
    const open = roots.length > 0 && expanded.has(key);
    rows.push({
      key,
      kind: 'course',
      id: c.id,
      courseId: c.id,
      name: c.name,
      level: 1,
      parentKey: null,
      pos: i + 1,
      siblings: courses.length,
      hasChildren: roots.length > 0,
      expanded: open,
      count: roots.reduce((s, t) => s + countOf(t), 0),
      paused: false,
      archived: !!c.archived,
    });
    if (open) addTopics(roots, 2, key);
  });
  return rows;
}

/** Keys to expand so a topic is visible: its course and every ancestor topic. */
export function revealKeys(topics: readonly Topic[], topic: Topic): string[] {
  const ancestors = topicPath(topics, topic.id).slice(0, -1);
  return [courseKey(topic.courseId), ...ancestors.map((t) => topicKey(t.id))];
}

export type TreeAction =
  | { focus: string }
  | { expand: string }
  | { collapse: string }
  | { select: string }
  | { none: true };

/** What a key press does on the focused row; null when the key isn't the tree's. */
export function treeKey(
  rows: readonly TreeRow[],
  focusKey: string,
  key: string,
): TreeAction | null {
  const i = rows.findIndex((r) => r.key === focusKey);
  const row = rows[i];
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!row || !first || !last) return first ? { focus: first.key } : null;
  const next = rows[i + 1];
  const prev = rows[i - 1];
  switch (key) {
    case 'ArrowDown':
      return next ? { focus: next.key } : { none: true };
    case 'ArrowUp':
      return prev ? { focus: prev.key } : { none: true };
    case 'Home':
      return { focus: first.key };
    case 'End':
      return { focus: last.key };
    case 'ArrowRight':
      if (row.hasChildren && !row.expanded) return { expand: row.key };
      if (row.expanded && next?.parentKey === row.key) return { focus: next.key };
      return { none: true };
    case 'ArrowLeft':
      if (row.expanded) return { collapse: row.key };
      return row.parentKey ? { focus: row.parentKey } : { none: true };
    case 'Enter':
    case ' ':
      return { select: row.key };
    default:
      return null;
  }
}
