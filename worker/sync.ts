/**
 * Sync storage logic, written against a minimal SQL interface (satisfied by D1, and by a
 * node:sqlite adapter in tests) so it can be tested with the real SQL.
 *
 * Push: last-write-wins upsert of client records. Each accepted row gets a monotonic `seq`,
 * allocated inside the same D1 batch (transaction) so concurrent pushes can't share numbers.
 * Pull: everything with `seq > cursor`, in seq order.
 *
 * Schema versions: every push states the client's record schema version; it is stored per row
 * and returned on pull. The server never interprets `data`; it only refuses pushes from a client
 * older than the newest one it has seen, so an outdated app can't write stale shapes.
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

/** Must match `SYNCED_TABLES` in src/domain/types.ts (a test guards the duplication). */
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
  schemaVersion: number;
}

export interface PushBody {
  /** The client's record schema version; clients predating the field are version 1. */
  schemaVersion: number;
  records: WireRecord[];
}

export interface PullPage {
  records: PulledRecord[];
  cursor: number;
  hasMore: boolean;
  /** Server clock at the time of the response, so clients can detect skew. */
  serverTime: number;
}

export const MAX_PUSH_RECORDS = 500;
export const MAX_PULL_LIMIT = 1000;
const MAX_RECORD_BYTES = 200_000;
/** D1 bound-parameter values are capped (~2 MB); keep each JSON chunk well below that. */
const MAX_CHUNK_BYTES = 900_000;

export class BadRequest extends Error {}

/** The client's schema version is older than records already on the server. */
export class OutdatedClient extends Error {
  readonly required: number;
  constructor(required: number) {
    super(`Client schema is outdated; version ${required} required`);
    this.name = 'OutdatedClient';
    this.required = required;
  }
}

/** Validates an untrusted push body. */
export function parsePushBody(body: unknown): PushBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as { records?: unknown }).records)
  ) {
    throw new BadRequest('Expected { records: [...] }');
  }
  const { records, schemaVersion = 1 } = body as { records: unknown[]; schemaVersion?: unknown };
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isSafeInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    throw new BadRequest('schemaVersion must be a positive integer');
  }
  if (records.length > MAX_PUSH_RECORDS)
    throw new BadRequest(`At most ${MAX_PUSH_RECORDS} records per push`);

  const parsed = records.map((raw, i) => {
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
  return { schemaVersion, records: parsed };
}

const UPSERT_SQL = `
INSERT INTO records (tbl, id, updated_at, deleted, seq, data, schema_version)
SELECT
  j.value ->> '$.tbl',
  j.value ->> '$.id',
  j.value ->> '$.updatedAt',
  j.value ->> '$.deleted',
  (SELECT v FROM meta WHERE k = 'seq') + j.key + 1,
  j.value ->> '$.data',
  ?2
FROM json_each(?1) AS j
WHERE true
ON CONFLICT (tbl, id) DO UPDATE SET
  updated_at = excluded.updated_at,
  deleted = excluded.deleted,
  seq = excluded.seq,
  data = excluded.data,
  schema_version = excluded.schema_version
WHERE excluded.updated_at > records.updated_at`;

/**
 * Splits rows into JSON arrays under MAX_CHUNK_BYTES. Each row is serialised once; a chunk is
 * `[` + rows joined by `,` + `]`, byte-identical to JSON.stringify of the array.
 */
function chunk(records: WireRecord[]): { json: string; count: number }[] {
  const chunks: { json: string; count: number }[] = [];
  let rows: string[] = [];
  let size = 2;
  const flush = () => {
    chunks.push({ json: `[${rows.join(',')}]`, count: rows.length });
    rows = [];
    size = 2;
  };
  for (const r of records) {
    const row = JSON.stringify({
      tbl: r.tbl,
      id: r.id,
      updatedAt: r.updatedAt,
      deleted: r.deleted ? 1 : 0,
      data: JSON.stringify(r.data),
    });
    if (rows.length && size + row.length + 1 > MAX_CHUNK_BYTES) flush();
    rows.push(row);
    size += row.length + 1;
  }
  if (rows.length) flush();
  return chunks;
}

/** The newest schema version any client has pushed (1 before the column existed). */
export async function serverSchemaVersion(db: SqlDb): Promise<number> {
  const row = await db
    .prepare(`SELECT v FROM meta WHERE k = 'schemaVersion'`)
    .first<{ v: number }>();
  return row ? Number(row.v) : 1;
}

/**
 * Upserts records (newer `updatedAt` wins) in a single atomic batch.
 *
 * The version check runs before the batch rather than inside it; two clients of different
 * versions pushing in the same instant could interleave, which at one user is not a concern,
 * and the stored version only ever rises.
 */
export async function pushRecords(
  db: SqlDb,
  records: WireRecord[],
  schemaVersion = 1,
): Promise<void> {
  const required = await serverSchemaVersion(db);
  if (required > schemaVersion) throw new OutdatedClient(required);
  if (records.length === 0) return;
  const statements: SqlStatement[] = [
    db.prepare(`INSERT OR IGNORE INTO meta (k, v) VALUES ('seq', 0)`),
    db.prepare(`INSERT OR IGNORE INTO meta (k, v) VALUES ('schemaVersion', 1)`),
    db.prepare(`UPDATE meta SET v = max(v, ?1) WHERE k = 'schemaVersion'`).bind(schemaVersion),
  ];
  for (const { json, count } of chunk(records)) {
    statements.push(db.prepare(UPSERT_SQL).bind(json, schemaVersion));
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
  schema_version: number;
}

export async function pullRecords(
  db: SqlDb,
  since: number,
  limit: number,
  now: () => number = Date.now,
): Promise<PullPage> {
  const capped = Math.max(1, Math.min(MAX_PULL_LIMIT, Math.floor(limit)));
  const { results } = await db
    .prepare(
      'SELECT tbl, id, updated_at, deleted, seq, data, schema_version FROM records WHERE seq > ?1 ORDER BY seq LIMIT ?2',
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
    schemaVersion: Number(row.schema_version ?? 1),
    data: JSON.parse(row.data) as Record<string, unknown>,
  }));
  const last = records[records.length - 1];
  return { records, cursor: last ? last.seq : since, hasMore, serverTime: now() };
}
