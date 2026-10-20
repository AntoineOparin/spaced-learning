import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from '../db/db';
import { Repo } from '../db/repo';
import { SYNCED_TABLES } from '../domain/types';
import { toWire } from '../sync/client';
import { T0 } from '../test/factories';
import { syncRecordSchemas, wireRecordSchema } from './schema';

const open: AppDB[] = [];
afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe('sync record schemas', () => {
  it('covers every synced table and nothing else', () => {
    for (const tbl of SYNCED_TABLES) expect(wireRecordSchema(tbl)).toBe(syncRecordSchemas[tbl]);
    expect(wireRecordSchema('users')).toBeUndefined();
    expect(wireRecordSchema('constructor')).toBeUndefined();
  });

  it('accepts every record the repository writes, as sent on the wire', async () => {
    const db = new AppDB('schema-test');
    open.push(db);
    const repo = new Repo(db, () => T0);
    const course = await repo.createCourse({ name: 'Calc', description: 'd' });
    const topic = await repo.createTopic({ courseId: course.id, parentId: null, name: 'T' });
    const item = await repo.saveItem({
      topicId: topic.id,
      type: 'cloze',
      fields: { prompt: '{{c1::a}} {{c2::b}}', answer: '' },
      tags: ['x'],
      origin: { deck: 'd', key: 'k', version: 1 },
    });
    const card = await db.cards.where('itemId').equals(item.id).first();
    if (!card) throw new Error('missing card');
    await repo.recordReview({ cardId: card.id, rating: 3, durationMs: 1200, mode: 'typed' });
    await repo.updateSettings({ newPerDay: 20 });
    await repo.deleteTopic(topic.id); // tombstones too

    for (const tbl of SYNCED_TABLES) {
      const rows = await db.table(tbl).toArray();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        const wire = toWire(tbl, row);
        const result = syncRecordSchemas[tbl].safeParse(wire.data);
        expect(result.success, `${tbl}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      }
    }
  });
});
