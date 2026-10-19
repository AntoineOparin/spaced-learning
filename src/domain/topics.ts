/** Course → Topic → Subtopic tree helpers. */
import { cardKeyRank } from './cardgen';
import { alive, type Card, type Course, type Item, type Topic } from './types';

function byOrder<T extends { order: number; name?: string }>(a: T, b: T): number {
  return a.order - b.order || (a.name ?? '').localeCompare(b.name ?? '');
}

export function childTopics(topics: readonly Topic[], parentId: string | null): Topic[] {
  return alive(topics)
    .filter((t) => t.parentId === parentId)
    .sort(byOrder);
}

/** Topics of a course in depth-first curriculum order (topic, its subtopics, next topic, …). */
export function curriculumOrder(topics: readonly Topic[], courseId: string): Topic[] {
  const own = alive(topics).filter((t) => t.courseId === courseId);
  const out: Topic[] = [];
  const visit = (parentId: string | null) => {
    for (const t of own.filter((x) => x.parentId === parentId).sort(byOrder)) {
      out.push(t);
      visit(t.id);
    }
  };
  visit(null);
  return out;
}

/** A topic is effectively active when it and all its ancestors are active. */
export function effectiveActiveTopicIds(topics: readonly Topic[]): Set<string> {
  const byId = new Map(alive(topics).map((t) => [t.id, t]));
  const active = new Set<string>();
  for (const t of byId.values()) {
    // Climb while active; reaching past the root means every ancestor was active.
    let cur: Topic | undefined = t;
    while (cur?.active) cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    if (!cur) active.add(t.id);
  }
  return active;
}

/** The topic and all its descendants. */
export function subtreeIds(topics: readonly Topic[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of alive(topics)) {
      if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) {
        ids.add(t.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Separator for breadcrumb trails ("Calculus 2 › Integration › By parts"). */
export const TRAIL_SEPARATOR = ' › ';

/** Names from the course (when given) down to the topic itself. */
export function topicTrail(
  topics: readonly Topic[],
  topicId: string,
  course?: Pick<Course, 'name'>,
): string[] {
  const names = topicPath(topics, topicId).map((t) => t.name);
  return course ? [course.name, ...names] : names;
}

export function topicPath(topics: readonly Topic[], topicId: string): Topic[] {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const path: Topic[] = [];
  let cur = byId.get(topicId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/**
 * Curriculum rank for new cards: course order, then topic DFS order, then item order,
 * then card key (fwd before rev, c1 before c2).
 */
export function buildNewRank(
  courses: readonly Course[],
  topics: readonly Topic[],
  items: readonly Item[],
): (card: Card) => number {
  const courseRank = new Map([...courses].sort(byOrder).map((c, i) => [c.id, i] as const));
  const topicRank = new Map<string, number>();
  for (const course of courses) {
    curriculumOrder(topics, course.id).forEach((t, i) => {
      topicRank.set(t.id, i);
    });
  }
  const last = Number.MAX_SAFE_INTEGER;
  const courseOf = (it: Item) => courseRank.get(it.courseId) ?? last;
  const topicOf = (it: Item) => topicRank.get(it.topicId) ?? last;
  const sorted = [...items].sort(
    (a, b) =>
      courseOf(a) - courseOf(b) ||
      topicOf(a) - topicOf(b) ||
      a.order - b.order ||
      a.createdAt - b.createdAt,
  );
  const itemIndex = new Map(sorted.map((it, i) => [it.id, i] as const));
  return (card) => (itemIndex.get(card.itemId) ?? sorted.length) * 1000 + cardKeyRank(card.key);
}
