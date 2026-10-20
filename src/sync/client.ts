/**
 * Delta sync between IndexedDB and the Worker (D1).
 *
 * 1. Pull every server record with `seq > cursor`; apply last-write-wins per record (a local
 *    record that is dirty and at least as new is kept — it will be pushed). Records are
 *    validated against the file-format schemas first; ones the app can't read are skipped and
 *    counted, never written. Records from a newer app version stop the sync (`outdated`).
 * 2. Push every dirty record; clear `dirty` only if the record didn't change while in flight.
 *
 * Review logs are immutable (union merge); tombstones propagate deletions.
 */
import type { Table } from 'dexie';
import type { AppDB } from '../db/db';
import { LAST_SYNC_AT_KEY, SYNC_CURSOR_KEY } from '../db/metaKeys';
import { upgradeRecord } from '../db/upgrades';
import { MINUTE } from '../domain/day';
import { SCHEMA_VERSION, SYNCED_TABLES, type SyncedTable } from '../domain/types';
import { wireRecordSchema } from '../io/schema';

export interface WireRecord {
  tbl: SyncedTable;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown>;
}

export interface PulledRecord extends WireRecord {
  seq: number;
  /** Absent from Workers deployed before versioning; those records are version 1. */
  schemaVersion?: number;
}

export interface PullPage {
  records: PulledRecord[];
  cursor: number;
  hasMore: boolean;
  /** Server clock when the page was built; absent from older Workers. */
  serverTime?: number;
}

export interface SyncTransport {
  push(records: WireRecord[]): Promise<void>;
  pull(since: number, limit: number): Promise<PullPage>;
}

/** The Access session expired (or never existed): the user must sign in again. */
export class AuthRequiredError extends Error {
  constructor() {
    super('Sign-in required');
    this.name = 'AuthRequiredError';
  }
}

/** The network is unreachable. */
export class OfflineError extends Error {
  constructor() {
    super('Offline');
    this.name = 'OfflineError';
  }
}

/** The sync API isn't available on this host (e.g. plain static hosting). */
export class SyncUnavailableError extends Error {
  constructor(detail: string) {
    super(`Sync is not available: ${detail}`);
    this.name = 'SyncUnavailableError';
  }
}

/** The server holds records written by a newer app version; this app must update first. */
export class OutdatedClientError extends Error {
  constructor() {
    super('Update the app to sync');
    this.name = 'OutdatedClientError';
  }
}

type SyncRow = { id: string; updatedAt: number; deletedAt?: number; dirty: 0 | 1 };

export const PUSH_BATCH = 500;
export const PULL_LIMIT = 1000;
/** Device clocks further than this from the server make last-write-wins unreliable. */
export const CLOCK_SKEW_WARN_MS = 5 * MINUTE;
const MAX_SAMPLES = 3;

function table(db: AppDB, name: SyncedTable): Table<SyncRow, string> {
  return db.table(name);
}

export function toWire(tbl: SyncedTable, row: SyncRow): WireRecord {
  const { dirty: _dirty, ...data } = row;
  return { tbl, id: row.id, updatedAt: row.updatedAt, deleted: row.deletedAt !== undefined, data };
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  /** Pulled records the app could not read (skipped). */
  invalid: number;
  /** Unpushed local changes discarded because the server had a newer version. */
  superseded: number;
  /** `serverTime - Date.now()` measured on the first pull, or null when the server didn't say. */
  clockSkewMs: number | null;
}

interface PullStats {
  applied: number;
  invalid: number;
  superseded: number;
  samples: string[];
  clockSkewMs: number | null;
}

type Prepared = { ok: true; row: SyncRow } | { ok: false; reason: string };

/** Validates (and if needed upgrades) one pulled record into a row the app can store. */
export function prepareRecord(remote: PulledRecord): Prepared {
  const schema = wireRecordSchema(remote.tbl);
  if (!schema) return { ok: false, reason: `unknown table ${remote.tbl}` };
  const version = remote.schemaVersion ?? 1;
  const data =
    version < SCHEMA_VERSION ? upgradeRecord(remote.tbl, remote.data, version) : remote.data;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: issue ? `${issue.path.join('.') || '(root)'}: ${issue.message}` : 'invalid',
    };
  }
  if (data.id !== remote.id) return { ok: false, reason: 'data.id does not match id' };
  if (remote.deleted !== (data.deletedAt !== undefined)) {
    return { ok: false, reason: 'deleted flag does not match deletedAt' };
  }
  // The raw object is stored (not Zod's stripped copy) so optional fields added by a same-version
  // newer client survive a round trip instead of being pushed back without them.
  return { ok: true, row: { ...(data as Omit<SyncRow, 'dirty'>), dirty: 0 } };
}

async function applyPage(db: AppDB, page: PullPage, stats: PullStats): Promise<void> {
  if (page.records.some((r) => (r.schemaVersion ?? 1) > SCHEMA_VERSION)) {
    throw new OutdatedClientError();
  }
  const skip = (remote: PulledRecord, reason: string) => {
    stats.invalid++;
    if (stats.samples.length < MAX_SAMPLES)
      stats.samples.push(`${remote.tbl}/${remote.id}: ${reason}`);
  };
  const byTable = new Map<SyncedTable, { remote: PulledRecord; row: SyncRow }[]>();
  for (const remote of page.records) {
    const prepared = prepareRecord(remote);
    if (!prepared.ok) {
      skip(remote, prepared.reason);
      continue;
    }
    const list = byTable.get(remote.tbl) ?? [];
    list.push({ remote, row: prepared.row });
    byTable.set(remote.tbl, list);
  }

  const tables = SYNCED_TABLES.map((t) => table(db, t));
  await db.transaction('rw', [...tables, db.meta], async () => {
    for (const [name, incoming] of byTable) {
      const t = table(db, name);
      const locals = await t.bulkGet(incoming.map((r) => r.remote.id));
      const writes: SyncRow[] = [];
      incoming.forEach(({ remote, row }, i) => {
        const local = locals[i];
        if (local && local.updatedAt >= remote.updatedAt) return; // local is same or newer
        if (local?.dirty === 1) stats.superseded++; // an unpushed local edit loses
        writes.push(row);
      });
      if (writes.length) await t.bulkPut(writes);
      stats.applied += writes.length;
    }
    // Advance past skipped records too, so one bad record can never wedge sync.
    await db.meta.put({ key: SYNC_CURSOR_KEY, value: page.cursor });
  });
}

async function pullAll(
  db: AppDB,
  transport: SyncTransport,
  now: () => number,
  stats: PullStats,
): Promise<void> {
  let cursor = ((await db.meta.get(SYNC_CURSOR_KEY))?.value as number | undefined) ?? 0;
  let first = true;
  for (;;) {
    const page = await transport.pull(cursor, PULL_LIMIT);
    if (first && typeof page.serverTime === 'number') stats.clockSkewMs = page.serverTime - now();
    first = false;
    await applyPage(db, page, stats);
    if (!page.hasMore || page.cursor === cursor) break;
    cursor = page.cursor;
  }
  if (stats.invalid) {
    console.warn(`Sync skipped ${stats.invalid} record(s) this app could not read`, stats.samples);
  }
}

export async function countDirty(db: AppDB): Promise<number> {
  const counts = await Promise.all(
    SYNCED_TABLES.map((t) => table(db, t).where('dirty').equals(1).count()),
  );
  return counts.reduce((a, b) => a + b, 0);
}

async function pushAll(db: AppDB, transport: SyncTransport): Promise<number> {
  const perTable = await Promise.all(
    SYNCED_TABLES.map((name) => table(db, name).where('dirty').equals(1).toArray()),
  );
  const dirty = SYNCED_TABLES.flatMap((name, i) =>
    (perTable[i] ?? []).map((row) => toWire(name, row)),
  );

  for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
    const batch = dirty.slice(i, i + PUSH_BATCH);
    await transport.push(batch);
    await markClean(db, batch);
  }
  return dirty.length;
}

/** Clears `dirty` on pushed rows, unless they changed while the request was in flight. */
async function markClean(db: AppDB, batch: readonly WireRecord[]): Promise<void> {
  const tables = SYNCED_TABLES.map((t) => table(db, t));
  await db.transaction('rw', tables, async () => {
    for (const name of SYNCED_TABLES) {
      const pushed = batch.filter((r) => r.tbl === name);
      if (!pushed.length) continue;
      const t = table(db, name);
      const current = await t.bulkGet(pushed.map((r) => r.id));
      const clean = current
        .filter(
          (row, j): row is SyncRow =>
            !!row && row.dirty === 1 && row.updatedAt === pushed[j]?.updatedAt,
        )
        .map((row) => ({ ...row, dirty: 0 as const }));
      if (clean.length) await t.bulkPut(clean);
    }
  });
}

export async function syncOnce(
  db: AppDB,
  transport: SyncTransport,
  now: () => number = Date.now,
): Promise<SyncResult> {
  const stats: PullStats = {
    applied: 0,
    invalid: 0,
    superseded: 0,
    samples: [],
    clockSkewMs: null,
  };
  await pullAll(db, transport, now, stats);
  const pushed = await pushAll(db, transport);
  await db.meta.put({ key: LAST_SYNC_AT_KEY, value: now() });
  return {
    pulled: stats.applied,
    pushed,
    invalid: stats.invalid,
    superseded: stats.superseded,
    clockSkewMs: stats.clockSkewMs,
  };
}

function isPullPage(body: unknown): body is PullPage {
  const b = body as Partial<PullPage> | null;
  return (
    !!b &&
    typeof b === 'object' &&
    Array.isArray(b.records) &&
    Number.isSafeInteger(b.cursor) &&
    typeof b.hasMore === 'boolean'
  );
}

/** Fetch-based transport for the Worker API. */
export function httpTransport(base = ''): SyncTransport {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        ...init,
        credentials: 'same-origin',
        cache: 'no-store',
        // An expired Access session answers with a redirect to the login page; with
        // `manual` we see an opaque redirect instead of a CORS error that looks like "offline".
        redirect: 'manual',
      });
    } catch {
      throw new OfflineError();
    }
    if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) {
      throw new AuthRequiredError();
    }
    if (res.status === 404 || res.status === 405)
      throw new SyncUnavailableError(`HTTP ${res.status}`);
    if (res.status === 426) throw new OutdatedClientError();
    if (!res.ok) throw new Error(`Sync request failed (HTTP ${res.status})`);
    if (!res.headers.get('content-type')?.includes('application/json')) {
      throw new SyncUnavailableError('unexpected response');
    }
    return (await res.json()) as T;
  }

  return {
    async push(records) {
      await call('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaVersion: SCHEMA_VERSION, records }),
      });
    },
    async pull(since, limit) {
      const page = await call<unknown>(`/api/sync/pull?since=${since}&limit=${limit}`);
      if (!isPullPage(page)) throw new SyncUnavailableError('unexpected response');
      return page;
    },
  };
}
