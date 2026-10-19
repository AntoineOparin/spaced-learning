/**
 * Sync storage logic, written against a minimal SQL interface (satisfied by D1, and by a
 * node:sqlite adapter in tests) so it can be tested with the real SQL.
 *
 * Push: last-write-wins upsert of client records. Each accepted row gets a monotonic `seq`,
 * allocated inside the same D1 batch (transaction) so concurrent pushes can't share numbers.
 * Pull: everything with `seq > cursor`, in seq order.
 */

export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface SqlDb {
  prepare(sql: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<unknown[]>;
}

export const SYNCED_TABLES = [
  'courses',
  'topics',
  'items',
  'cards',
  'reviewLogs',
  'settings',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export interface WireRecord {
  tbl: SyncedTable;
  id: string;
  updatedAt: number;
  deleted: boolean;
  /** The client record (without device-local fields). */
  data: Record<string, unknown>;
}

export interface PulledRecord extends WireRecord {
  seq: number;
}

export const MAX_PUSH_RECORDS = 500;
export const MAX_PULL_LIMIT = 1000;
const MAX_RECORD_BYTES = 200_000;
/** D1 bound-parameter values are capped (~2 MB); keep each JSON chunk well below that. */
const MAX_CHUNK_BYTES = 900_000;

export class BadRequest extends Error {}

/** Validates an untrusted push body. */
export function parsePushBody(body: unknown): WireRecord[] {
  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as { records?: unknown }).records)
  ) {
    throw new BadRequest('Expected { records: [...] }');
  }
  const records = (body as { records: unknown[] }).records;
  if (records.length > MAX_PUSH_RECORDS)
    throw new BadRequest(`At most ${MAX_PUSH_RECORDS} records per push`);

  return records.map((raw, i) => {
    const r = raw as Partial<WireRecord>;
    if (!r || typeof r !== 'object') throw new BadRequest(`records[${i}] is not an object`);
    if (!SYNCED_TABLES.includes(r.tbl as SyncedTable))
      throw new BadRequest(`records[${i}].tbl is invalid`);
    if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 100) {
      throw new BadRequest(`records[${i}].id is invalid`);
    }
    if (typeof r.updatedAt !== 'number' || !Number.isSafeInteger(r.updatedAt) || r.updatedAt < 0) {
      throw new BadRequest(`records[${i}].updatedAt is invalid`);
    }
    if (typeof r.deleted !== 'boolean') throw new BadRequest(`records[${i}].deleted is invalid`);
    if (typeof r.data !== 'object' || r.data === null || Array.isArray(r.data)) {
      throw new BadRequest(`records[${i}].data must be an object`);
    }
    if (r.data.id !== r.id) throw new BadRequest(`records[${i}].data.id does not match id`);
    if (JSON.stringify(r.data).length > MAX_RECORD_BYTES)
      throw new BadRequest(`records[${i}] is too large`);
    return {
      tbl: r.tbl as SyncedTable,
      id: r.id,
      updatedAt: r.updatedAt,
      deleted: r.deleted,
      data: r.data,
    };
  });
}

const UPSERT_SQL = `
INSERT INTO records (tbl, id, updated_at, deleted, seq, data)
SELECT
  j.value ->> '$.tbl',
  j.value ->> '$.id',
  j.value ->> '$.updatedAt',
  j.value ->> '$.deleted',
  (SELECT v FROM meta WHERE k = 'seq') + j.key + 1,
  j.value ->> '$.data'
FROM json_each(?1) AS j
WHERE true
ON CONFLICT (tbl, id) DO UPDATE SET
  updated_at = excluded.updated_at,
  deleted = excluded.deleted,
  seq = excluded.seq,
  data = excluded.data
WHERE excluded.updated_at > records.updated_at`;

function chunk(records: WireRecord[]): string[] {
  const chunks: string[] = [];
  let current: unknown[] = [];
  let size = 2;
  for (const r of records) {
    const row = {
      tbl: r.tbl,
      id: r.id,
      updatedAt: r.updatedAt,
      deleted: r.deleted ? 1 : 0,
      data: JSON.stringify(r.data),
    };
    const rowSize = JSON.stringify(row).length + 1;
    if (current.length && size + rowSize > MAX_CHUNK_BYTES) {
      chunks.push(JSON.stringify(current));
      current = [];
      size = 2;
    }
    current.push(row);
    size += rowSize;
  }
  if (current.length) chunks.push(JSON.stringify(current));
  return chunks;
}

/** Upserts records (newer `updatedAt` wins) in a single atomic batch. */
export async function pushRecords(db: SqlDb, records: WireRecord[]): Promise<void> {
  if (records.length === 0) return;
  const statements: SqlStatement[] = [
    db.prepare(`INSERT OR IGNORE INTO meta (k, v) VALUES ('seq', 0)`),
  ];
  for (const json of chunk(records)) {
    const count = (JSON.parse(json) as unknown[]).length;
    statements.push(db.prepare(UPSERT_SQL).bind(json));
    statements.push(db.prepare(`UPDATE meta SET v = v + ?1 WHERE k = 'seq'`).bind(count));
  }
  await db.batch(statements);
}

interface RecordRow {
  tbl: SyncedTable;
  id: string;
  updated_at: number;
  deleted: number;
  seq: number;
  data: string;
}

export async function pullRecords(
  db: SqlDb,
  since: number,
  limit: number,
): Promise<{ records: PulledRecord[]; cursor: number; hasMore: boolean }> {
  const capped = Math.max(1, Math.min(MAX_PULL_LIMIT, Math.floor(limit)));
  const { results } = await db
    .prepare(
      'SELECT tbl, id, updated_at, deleted, seq, data FROM records WHERE seq > ?1 ORDER BY seq LIMIT ?2',
    )
    .bind(since, capped + 1)
    .all<RecordRow>();
  const hasMore = results.length > capped;
  const page = results.slice(0, capped);
  const records = page.map((row) => ({
    tbl: row.tbl,
    id: row.id,
    updatedAt: Number(row.updated_at),
    deleted: Number(row.deleted) === 1,
    seq: Number(row.seq),
    data: JSON.parse(row.data) as Record<string, unknown>,
  }));
  const last = records[records.length - 1];
  return { records, cursor: last ? last.seq : since, hasMore };
}
