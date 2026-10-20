/**
 * All writes go through this repository so that every synced record consistently gets
 * `updatedAt = now`, `dirty = 1` and tombstones instead of hard deletes.
 */
import { reconcileCards } from '../domain/cardgen';
import { newId } from '../domain/ids';
import { schedulerForCourse } from '../domain/scheduler';
import { subtreeIds } from '../domain/topics';
import {
  type AnswerMode,
  type Card,
  type Course,
  DEFAULT_SETTINGS,
  type Item,
  type ItemFields,
  type ItemOrigin,
  type ItemType,
  type RatingValue,
  type ReviewLog,
  type Settings,
  type Topic,
} from '../domain/types';
import type { AppDB } from './db';
import { SYNC_CURSOR_KEY } from './metaKeys';

export type Clock = () => number;

export interface ItemDraft {
  id?: string;
  topicId: string;
  type: ItemType;
  fields: ItemFields;
  options?: Item['options'];
  tags?: string[];
  origin?: ItemOrigin;
}

export type SettingsPatch = Partial<Omit<Settings, 'id' | 'updatedAt' | 'dirty' | 'deletedAt'>>;

/** Every table's rows, including tombstones: the payload of a backup file. */
export interface Snapshot {
  courses: Course[];
  topics: Topic[];
  items: Item[];
  cards: Card[];
  reviewLogs: ReviewLog[];
  settings: Settings[];
}

export interface ReviewResult {
  previous: Card;
  card: Card;
  log: ReviewLog;
}

const stamp = (now: number) => ({ updatedAt: now, dirty: 1 as const });

function maxOrder(rows: { order: number }[]): number {
  return rows.reduce((m, r) => Math.max(m, r.order), -1);
}

/** Drop keys whose value is undefined so patches don't erase fields. */
function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export class Repo {
  readonly db: AppDB;
  private readonly clock: Clock;

  constructor(db: AppDB, clock: Clock = Date.now) {
    this.db = db;
    this.clock = clock;
  }

  // ── Settings & device-local meta ────────────────────────────────────────────

  async getSettings(): Promise<Settings> {
    const stored = await this.db.settings.get('global');
    return { ...DEFAULT_SETTINGS, updatedAt: 0, dirty: 0, ...stored };
  }

  async updateSettings(patch: SettingsPatch): Promise<Settings> {
    const now = this.clock();
    return this.db.transaction('rw', this.db.settings, async () => {
      const next: Settings = {
        ...(await this.getSettings()),
        ...definedOnly(patch),
        ...stamp(now),
      };
      await this.db.settings.put(next);
      return next;
    });
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.meta.get(key))?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.meta.put({ key, value });
  }

  // ── Courses ─────────────────────────────────────────────────────────────────

  async createCourse(input: { name: string; description?: string; originKey?: string }) {
    const now = this.clock();
    return this.db.transaction('rw', this.db.courses, async () => {
      const courses = await this.db.courses.toArray();
      const course: Course = {
        id: newId(),
        name: input.name.trim(),
        order: maxOrder(courses) + 1,
        createdAt: now,
        ...stamp(now),
        ...definedOnly({ description: input.description, originKey: input.originKey }),
      };
      await this.db.courses.add(course);
      return course;
    });
  }

  async updateCourse(
    id: string,
    patch: Partial<
      Pick<Course, 'name' | 'description' | 'desiredRetention' | 'newPerDay' | 'archived' | 'order'>
    >,
  ) {
    const now = this.clock();
    await this.db.transaction('rw', this.db.courses, async () => {
      const course = await this.db.courses.get(id);
      if (!course) throw new Error(`Course ${id} not found`);
      const next: Course = { ...course, ...patch, ...stamp(now) };
      // Explicit undefined clears an override.
      for (const key of ['desiredRetention', 'newPerDay', 'description'] as const) {
        if (key in patch && patch[key] === undefined) delete next[key];
      }
      await this.db.courses.put(next);
    });
  }

  /** Tombstones the course and everything in it (review logs are kept). */
  async deleteCourse(id: string) {
    const now = this.clock();
    const { courses, topics, items, cards } = this.db;
    await this.db.transaction('rw', [courses, topics, items, cards], async () => {
      const course = await courses.get(id);
      if (!course) return;
      await courses.put({ ...course, deletedAt: now, ...stamp(now) });
      await this.tombstoneWhere(topics, 'courseId', id, now);
      await this.tombstoneWhere(items, 'courseId', id, now);
      await this.tombstoneWhere(cards, 'courseId', id, now);
    });
  }

  // ── Topics ──────────────────────────────────────────────────────────────────

  async createTopic(input: {
    courseId: string;
    parentId: string | null;
    name: string;
    active?: boolean;
    originKey?: string;
  }): Promise<Topic> {
    const now = this.clock();
    return this.db.transaction('rw', this.db.topics, async () => {
      if (input.parentId) {
        const parent = await this.db.topics.get(input.parentId);
        if (!parent || parent.courseId !== input.courseId) throw new Error('Invalid parent topic');
        if (parent.parentId) throw new Error('Subtopics cannot have subtopics');
      }
      const siblings = (
        await this.db.topics.where('courseId').equals(input.courseId).toArray()
      ).filter((t) => t.parentId === input.parentId && t.deletedAt === undefined);
      const topic: Topic = {
        id: newId(),
        courseId: input.courseId,
        parentId: input.parentId,
        name: input.name.trim(),
        order: maxOrder(siblings) + 1,
        active: input.active ?? true,
        createdAt: now,
        ...stamp(now),
        ...definedOnly({ originKey: input.originKey }),
      };
      await this.db.topics.add(topic);
      return topic;
    });
  }

  async updateTopic(id: string, patch: Partial<Pick<Topic, 'name' | 'active' | 'order'>>) {
    const now = this.clock();
    await this.db.transaction('rw', this.db.topics, async () => {
      const topic = await this.db.topics.get(id);
      if (!topic) throw new Error(`Topic ${id} not found`);
      await this.db.topics.put({ ...topic, ...definedOnly(patch), ...stamp(now) });
    });
  }

  /** Sets `active` on a topic and all of its subtopics. */
  async setTopicActive(id: string, active: boolean) {
    const now = this.clock();
    await this.db.transaction('rw', this.db.topics, async () => {
      const topic = await this.db.topics.get(id);
      if (!topic) return;
      const all = await this.db.topics.where('courseId').equals(topic.courseId).toArray();
      const ids = subtreeIds(all, id);
      await this.db.topics.bulkPut(
        all.filter((t) => ids.has(t.id)).map((t) => ({ ...t, active, ...stamp(now) })),
      );
    });
  }

  /** Swaps the topic with its previous (-1) or next (+1) sibling. */
  async moveTopic(id: string, direction: -1 | 1) {
    const now = this.clock();
    await this.db.transaction('rw', this.db.topics, async () => {
      const topic = await this.db.topics.get(id);
      if (!topic) return;
      const siblings = (await this.db.topics.where('courseId').equals(topic.courseId).toArray())
        .filter((t) => t.parentId === topic.parentId && t.deletedAt === undefined)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex((t) => t.id === id);
      const other = siblings[idx + direction];
      if (!other) return;
      // Renumber so equal orders can't make the swap a no-op.
      siblings[idx] = other;
      siblings[idx + direction] = topic;
      await this.db.topics.bulkPut(siblings.map((t, i) => ({ ...t, order: i, ...stamp(now) })));
    });
  }

  /** Tombstones the topic, its subtopics, their items and cards. */
  async deleteTopic(id: string) {
    const now = this.clock();
    const { topics, items, cards } = this.db;
    await this.db.transaction('rw', [topics, items, cards], async () => {
      const topic = await topics.get(id);
      if (!topic) return;
      const all = await topics.where('courseId').equals(topic.courseId).toArray();
      const ids = [...subtreeIds(all, id)];
      await topics.bulkPut(
        all
          .filter((t) => ids.includes(t.id) && t.deletedAt === undefined)
          .map((t) => ({ ...t, deletedAt: now, ...stamp(now) })),
      );
      for (const topicId of ids) {
        await this.tombstoneWhere(items, 'topicId', topicId, now);
        await this.tombstoneWhere(cards, 'topicId', topicId, now);
      }
    });
  }

  // ── Items & cards ───────────────────────────────────────────────────────────

  /** Creates or updates an item and reconciles its cards (scheduling is preserved by key). */
  async saveItem(draft: ItemDraft): Promise<Item> {
    const now = this.clock();
    const { topics, items, cards } = this.db;
    return this.db.transaction('rw', [topics, items, cards], async () => {
      const topic = await topics.get(draft.topicId);
      if (!topic || topic.deletedAt !== undefined) throw new Error('Topic not found');

      const existing = draft.id ? await items.get(draft.id) : undefined;
      if (existing?.deletedAt !== undefined) throw new Error('This item was deleted');
      let item: Item;
      if (existing) {
        item = {
          ...existing,
          topicId: topic.id,
          courseId: topic.courseId,
          type: draft.type,
          fields: draft.fields,
          options: draft.options ?? existing.options,
          tags: draft.tags ?? existing.tags,
          ...stamp(now),
        };
        if (existing.topicId !== topic.id) {
          const peers = await items.where('topicId').equals(topic.id).toArray();
          item.order = maxOrder(peers) + 1;
        }
      } else {
        const peers = await items.where('topicId').equals(topic.id).toArray();
        item = {
          id: draft.id ?? newId(),
          courseId: topic.courseId,
          topicId: topic.id,
          type: draft.type,
          fields: draft.fields,
          options: draft.options ?? {},
          tags: draft.tags ?? [],
          order: maxOrder(peers) + 1,
          createdAt: now,
          ...stamp(now),
          ...definedOnly({ origin: draft.origin }),
        };
      }
      await items.put(item);
      await this.reconcile(item, now);
      return item;
    });
  }

  async deleteItem(id: string) {
    const now = this.clock();
    await this.db.transaction('rw', [this.db.items, this.db.cards], async () => {
      const item = await this.db.items.get(id);
      if (!item || item.deletedAt !== undefined) return;
      const dead: Item = { ...item, deletedAt: now, ...stamp(now) };
      await this.db.items.put(dead);
      await this.reconcile(dead, now);
    });
  }

  async setSuspended(cardIds: string[], suspended: boolean) {
    const now = this.clock();
    await this.db.transaction('rw', this.db.cards, async () => {
      const rows = (await this.db.cards.bulkGet(cardIds)).filter((c): c is Card => !!c);
      await this.db.cards.bulkPut(rows.map((c) => ({ ...c, suspended, ...stamp(now) })));
    });
  }

  // ── Reviews ─────────────────────────────────────────────────────────────────

  /** Schedules the card with FSRS and appends a review log, atomically. */
  async recordReview(args: {
    cardId: string;
    rating: RatingValue;
    durationMs: number;
    mode: AnswerMode;
    now?: number;
  }): Promise<ReviewResult> {
    const now = args.now ?? this.clock();
    const { cards, reviewLogs, courses, settings } = this.db;
    return this.db.transaction('rw', [cards, reviewLogs, courses, settings], async () => {
      const previous = await cards.get(args.cardId);
      if (!previous) throw new Error(`Card ${args.cardId} not found`);
      const [course, globalSettings] = await Promise.all([
        courses.get(previous.courseId),
        this.getSettings(),
      ]);
      const scheduler = schedulerForCourse(globalSettings, course);
      const outcome = scheduler.rate(previous.fsrs, now, args.rating);

      const card: Card = {
        ...previous,
        fsrs: outcome.card,
        due: outcome.card.due,
        state: outcome.card.state,
        ...stamp(now),
      };
      const log: ReviewLog = {
        id: newId(),
        cardId: previous.id,
        itemId: previous.itemId,
        courseId: previous.courseId,
        topicId: previous.topicId,
        ...outcome.log,
        durationMs: Math.max(0, Math.round(args.durationMs)),
        mode: args.mode,
        ...stamp(now),
      };
      await cards.put(card);
      await reviewLogs.add(log);
      return { previous, card, log };
    });
  }

  /** Restores the card to its pre-review state and tombstones the review log. */
  async undoReview(result: Pick<ReviewResult, 'previous' | 'log'>) {
    const now = this.clock();
    await this.db.transaction('rw', [this.db.cards, this.db.reviewLogs], async () => {
      await this.db.cards.put({ ...result.previous, ...stamp(now) });
      const log = await this.db.reviewLogs.get(result.log.id);
      if (log) await this.db.reviewLogs.put({ ...log, deletedAt: now, ...stamp(now) });
    });
  }

  // ── Backup ──────────────────────────────────────────────────────────────────

  /** Every record, including tombstones and review history, read in one transaction. */
  async exportSnapshot(): Promise<Snapshot> {
    const { courses, topics, items, cards, reviewLogs, settings } = this.db;
    return this.db.transaction(
      'r',
      [courses, topics, items, cards, reviewLogs, settings],
      async () => ({
        courses: await courses.toArray(),
        topics: await topics.toArray(),
        items: await items.toArray(),
        cards: await cards.toArray(),
        reviewLogs: await reviewLogs.toArray(),
        settings: await settings.toArray(),
      }),
    );
  }

  /**
   * Replaces all local data with the snapshot, in one transaction (all or nothing).
   *
   * Every record is re-stamped (`updatedAt = now`, dirty) so the restored state wins on the next
   * sync, and the sync cursor is reset so records created on other devices after the backup are
   * pulled back rather than lost.
   */
  async restoreSnapshot(backup: Snapshot): Promise<void> {
    const now = this.clock();
    const { courses, topics, items, cards, reviewLogs, settings, meta } = this.db;
    const tables = [courses, topics, items, cards, reviewLogs, settings];
    await this.db.transaction('rw', [...tables, meta], async () => {
      const restamp = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, ...stamp(now) }));
      await Promise.all(tables.map((t) => t.clear()));
      await courses.bulkAdd(restamp(backup.courses));
      await topics.bulkAdd(restamp(backup.topics));
      await items.bulkAdd(restamp(backup.items));
      await cards.bulkAdd(restamp(backup.cards));
      await reviewLogs.bulkAdd(restamp(backup.reviewLogs));
      await settings.bulkAdd(restamp(backup.settings));
      await meta.delete(SYNC_CURSOR_KEY);
    });
  }

  /** Wipes this device's database (the next launch starts empty and re-syncs). */
  async resetDevice(): Promise<void> {
    this.db.close();
    await this.db.delete();
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async reconcile(item: Item, now: number) {
    const existing = await this.db.cards.where('itemId').equals(item.id).toArray();
    const { create, update } = reconcileCards(item, existing, now);
    if (create.length) await this.db.cards.bulkAdd(create);
    if (update.length) await this.db.cards.bulkPut(update);
  }

  private async tombstoneWhere<T extends { deletedAt?: number; updatedAt: number; dirty: 0 | 1 }>(
    table: import('dexie').Table<T, string>,
    index: string,
    value: string,
    now: number,
  ) {
    const rows = (await table.where(index).equals(value).toArray()).filter(
      (r) => r.deletedAt === undefined,
    );
    if (rows.length)
      await table.bulkPut(rows.map((r) => ({ ...r, deletedAt: now, ...stamp(now) })));
  }
}
