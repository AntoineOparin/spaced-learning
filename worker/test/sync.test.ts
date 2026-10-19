import { describe, expect, it } from 'vitest';
import { BadRequest, parsePushBody, pullRecords, pushRecords, type WireRecord } from '../sync.ts';
import { createTestDb } from './sqlite.ts';

function rec(
  id: string,
  updatedAt: number,
  data: Record<string, unknown> = {},
  tbl: WireRecord['tbl'] = 'items',
): WireRecord {
  return { tbl, id, updatedAt, deleted: false, data: { id, updatedAt, ...data } };
}

describe('pushRecords / pullRecords', () => {
  it('stores records and pulls them in seq order with a cursor', async () => {
    const db = createTestDb();
    await pushRecords(db, [rec('a', 1, { v: 'A' }), rec('b', 1, { v: 'B' }, 'cards')]);
    const page = await pullRecords(db, 0, 100);
    expect(page.records.map((r) => [r.tbl, r.id, r.seq, r.data.v])).toEqual([
      ['items', 'a', 1, 'A'],
      ['cards', 'b', 2, 'B'],
    ]);
    expect(page).toMatchObject({ cursor: 2, hasMore: false });
    expect(await pullRecords(db, 2, 100)).toEqual({ records: [], cursor: 2, hasMore: false });
  });

  it('last write wins: older updates are ignored, newer ones replace and get a new seq', async () => {
    const db = createTestDb();
    await pushRecords(db, [rec('a', 10, { v: 'v10' })]);
    await pushRecords(db, [rec('a', 5, { v: 'stale' })]);
    let all = await pullRecords(db, 0, 100);
    expect(all.records.map((r) => r.data.v)).toEqual(['v10']);

    await pushRecords(db, [rec('a', 20, { v: 'v20' })]);
    all = await pullRecords(db, 0, 100);
    expect(all.records).toHaveLength(1);
    expect(all.records[0]).toMatchObject({ updatedAt: 20, data: { v: 'v20' } });
    // A device whose cursor was after the first write still sees the update.
    expect((await pullRecords(db, 1, 100)).records.map((r) => r.data.v)).toEqual(['v20']);
  });

  it('re-pushing the same version is a no-op (idempotent retries)', async () => {
    const db = createTestDb();
    await pushRecords(db, [rec('a', 10)]);
    const before = await pullRecords(db, 0, 100);
    await pushRecords(db, [rec('a', 10)]);
    expect(await pullRecords(db, 0, 100)).toEqual(before);
  });

  it('propagates tombstones', async () => {
    const db = createTestDb();
    await pushRecords(db, [rec('a', 1)]);
    await pushRecords(db, [{ ...rec('a', 2, { deletedAt: 2 }), deleted: true }]);
    const { records } = await pullRecords(db, 0, 100);
    expect(records[0]).toMatchObject({ deleted: true, data: { deletedAt: 2 } });
  });

  it('paginates', async () => {
    const db = createTestDb();
    await pushRecords(
      db,
      Array.from({ length: 25 }, (_, i) => rec(`r${i}`, 1)),
    );
    const first = await pullRecords(db, 0, 10);
    expect(first).toMatchObject({ cursor: 10, hasMore: true });
    const second = await pullRecords(db, first.cursor, 10);
    const third = await pullRecords(db, second.cursor, 10);
    expect(third).toMatchObject({ cursor: 25, hasMore: false });
    expect([...first.records, ...second.records, ...third.records].map((r) => r.id)).toHaveLength(
      25,
    );
  });

  it('allocates monotonically increasing seq across pushes and large chunked pushes', async () => {
    const db = createTestDb();
    const big = 'x'.repeat(150_000);
    await pushRecords(
      db,
      Array.from({ length: 12 }, (_, i) => rec(`big${i}`, 1, { big })),
    ); // > 1 chunk
    await pushRecords(db, [rec('after', 1)]);
    const { records } = await pullRecords(db, 0, 1000);
    const seqs = records.map((r) => r.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(records[records.length - 1]?.id).toBe('after');
  });

  it('is atomic: a failing batch writes nothing', async () => {
    const db = createTestDb();
    db.raw.exec(
      "CREATE TRIGGER fail BEFORE INSERT ON records WHEN NEW.id = 'boom' BEGIN SELECT RAISE(ABORT, 'boom'); END;",
    );
    await expect(pushRecords(db, [rec('ok', 1), rec('boom', 1)])).rejects.toThrow();
    expect((await pullRecords(db, 0, 100)).records).toEqual([]);
  });
});

describe('parsePushBody', () => {
  it('accepts valid records', () => {
    expect(parsePushBody({ records: [rec('a', 1)] })).toHaveLength(1);
  });

  it.each([
    [null, /Expected/],
    [{ records: 'x' }, /Expected/],
    [{ records: [{ ...rec('a', 1), tbl: 'users' }] }, /tbl/],
    [{ records: [{ ...rec('a', 1), id: '' }] }, /id/],
    [{ records: [{ ...rec('a', 1), updatedAt: -1 }] }, /updatedAt/],
    [{ records: [{ ...rec('a', 1), deleted: 'no' }] }, /deleted/],
    [{ records: [{ ...rec('a', 1), data: [] }] }, /data/],
    [{ records: [{ ...rec('a', 1), data: { id: 'other' } }] }, /does not match/],
    [{ records: Array.from({ length: 501 }, (_, i) => rec(`r${i}`, 1)) }, /At most/],
  ])('rejects %j', (body, message) => {
    expect(() => parsePushBody(body)).toThrow(BadRequest);
    expect(() => parsePushBody(body)).toThrow(message);
  });
});
