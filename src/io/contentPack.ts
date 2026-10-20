/**
 * Installs a content pack (courses/topics/items without scheduling), merging by stable keys:
 * re-installing never duplicates items, and items you deleted are not resurrected.
 */
import type { Repo } from '../db/repo';
import type { Course, Topic } from '../domain/types';
import type { ContentPack } from './schema';

export interface InstallOptions {
  /** Topic keys to activate (a parent key activates its subtopics). Undefined = all active. */
  activeTopicKeys?: ReadonlySet<string>;
}

export interface InstallSummary {
  coursesCreated: number;
  topicsCreated: number;
  itemsCreated: number;
  itemsSkipped: number;
}

export async function installContentPack(
  repo: Repo,
  pack: ContentPack,
  opts: InstallOptions = {},
): Promise<InstallSummary> {
  const { db } = repo;
  const deckId = pack.deck.id;
  const summary: InstallSummary = {
    coursesCreated: 0,
    topicsCreated: 0,
    itemsCreated: 0,
    itemsSkipped: 0,
  };

  const isActive = (key: string, parentKey: string | null) =>
    !opts.activeTopicKeys ||
    opts.activeTopicKeys.has(key) ||
    (parentKey !== null && opts.activeTopicKeys.has(parentKey));

  await db.transaction('rw', [db.courses, db.topics, db.items, db.cards], async () => {
    const courseByKey = new Map<string, Course>();
    const allCourses = await db.courses.toArray();
    for (const c of pack.courses) {
      const originKey = `${deckId}:${c.key}`;
      let course = allCourses.find((x) => x.originKey === originKey && x.deletedAt === undefined);
      if (!course) {
        course = await repo.createCourse({ name: c.name, description: c.description, originKey });
        summary.coursesCreated++;
      }
      courseByKey.set(c.key, course);
    }

    const topicByKey = new Map<string, Topic>();
    const allTopics = await db.topics.toArray();
    // Parents first so subtopics can reference them.
    const ordered = [
      ...pack.topics.filter((t) => t.parentKey === null),
      ...pack.topics.filter((t) => t.parentKey !== null),
    ];
    for (const t of ordered) {
      const course = courseByKey.get(t.courseKey);
      if (!course) throw new Error(`Unknown course ${t.courseKey}`);
      const originKey = `${deckId}:${t.key}`;
      let topic = allTopics.find(
        (x) => x.originKey === originKey && x.courseId === course.id && x.deletedAt === undefined,
      );
      if (!topic) {
        const parent = t.parentKey ? topicByKey.get(t.parentKey) : undefined;
        topic = await repo.createTopic({
          courseId: course.id,
          parentId: parent?.id ?? null,
          name: t.name,
          active: isActive(t.key, t.parentKey),
          originKey,
        });
        summary.topicsCreated++;
      }
      topicByKey.set(t.key, topic);
    }

    const existingKeys = new Set(
      (await db.items.toArray()).filter((i) => i.origin?.deck === deckId).map((i) => i.origin?.key),
    );
    for (const it of pack.items) {
      if (existingKeys.has(it.key)) {
        summary.itemsSkipped++;
        continue;
      }
      const topic = topicByKey.get(it.topicKey);
      if (!topic) throw new Error(`Unknown topic ${it.topicKey}`);
      await repo.saveItem({
        topicId: topic.id,
        type: it.type,
        fields: {
          prompt: it.prompt,
          answer: it.answer,
          ...(it.explanation ? { explanation: it.explanation } : {}),
          ...(it.mnemonic ? { mnemonic: it.mnemonic } : {}),
          ...(it.source ? { source: it.source } : {}),
        },
        options: it.reverse ? { reverse: true } : {},
        tags: it.tags ?? [],
        origin: { deck: deckId, key: it.key, version: pack.deck.version },
      });
      summary.itemsCreated++;
    }
  });

  return summary;
}
