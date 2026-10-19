/** Course → Topic → Subtopic tree helpers. */
import type { Card, Course, Item, Topic } from './types';

function byOrder<T extends { order: number; name?: string }>(a: T, b: T): number {
  return a.order - b.order || (a.name ?? '').localeCompare(b.name ?? '');
}

export function aliveTopics(topics: readonly Topic[]): Topic[] {
  return topics.filter((t) => t.deletedAt === undefined);
}

export function childTopics(topics: readonly Topic[], parentId: string | null): Topic[] {
  return aliveTopics(topics)
    .filter((t) => t.parentId === parentId)
    .sort(byOrder);
}

/** Topics of a course in depth-first curriculum order (topic, its subtopics, next topic, …). */
export function curriculumOrder(topics: readonly Topic[], courseId: string): Topic[] {
  const own = aliveTopics(topics).filter((t) => t.courseId === courseId);
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
  const byId = new Map(aliveTopics(topics).map((t) => [t.id, t]));
  const active = new Set<string>();
  for (const t of byId.values()) {
    let cur: Topic | undefined = t;
    let ok = true;
    while (cur) {
      if (!cur.active) {
        ok = false;
        break;
      }
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    if (ok) active.add(t.id);
  }
  return active;
}

/** The topic and all its descendants. */
export function subtreeIds(topics: readonly Topic[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of aliveTopics(topics)) {
      if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) {
        ids.add(t.id);
        grew = true;
      }
    }
  }
  return ids;
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
  const rankOf = (it: Item) => [
    courseRank.get(it.courseId) ?? Number.MAX_SAFE_INTEGER,
    topicRank.get(it.topicId) ?? Number.MAX_SAFE_INTEGER,
    it.order,
    it.createdAt,
  ];
  const sorted = [...items].sort((a, b) => {
    const ra = rankOf(a);
    const rb = rankOf(b);
    for (let i = 0; i < ra.length; i++) {
      const d = (ra[i] ?? 0) - (rb[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  });
  const itemIndex = new Map(sorted.map((it, i) => [it.id, i] as const));
  const keyRank = (key: string) =>
    key === 'fwd' ? 0 : key === 'rev' ? 1 : Math.min(Number(key.slice(1)) || 0, 999);

  return (card) => (itemIndex.get(card.itemId) ?? sorted.length) * 1000 + keyRank(card.key);
}
