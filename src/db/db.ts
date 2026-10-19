/**
 * IndexedDB schema (Dexie). IndexedDB is the primary store on each device; the server copy is
 * a sync target. Schema changes must add a new `this.version(n)` with an upgrade function —
 * never edit an existing version.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Card, Course, Item, ReviewLog, Settings, SyncedTable, Topic } from '../domain/types';

export interface MetaRecord {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  declare courses: EntityTable<Course, 'id'>;
  declare topics: EntityTable<Topic, 'id'>;
  declare items: EntityTable<Item, 'id'>;
  declare cards: EntityTable<Card, 'id'>;
  declare reviewLogs: EntityTable<ReviewLog, 'id'>;
  declare settings: EntityTable<Settings, 'id'>;
  /** Device-local key/value data (theme, sync cursor, backup timestamps). Never synced. */
  declare meta: EntityTable<MetaRecord, 'key'>;

  constructor(name = 'spaced-learning') {
    super(name);
    this.version(1).stores({
      courses: 'id, dirty',
      topics: 'id, courseId, parentId, dirty',
      items: 'id, courseId, topicId, dirty',
      cards: 'id, itemId, courseId, topicId, due, dirty',
      reviewLogs: 'id, cardId, itemId, courseId, review, dirty',
      settings: 'id, dirty',
      meta: 'key',
    });
  }

  syncedTable(name: SyncedTable) {
    return this.table(name);
  }
}
