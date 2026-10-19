/**
 * Delta sync between IndexedDB and the Worker (D1).
 *
 * 1. Pull every server record with `seq > cursor`; apply last-write-wins per record (a local
 *    record that is dirty and at least as new is kept — it will be pushed).
 * 2. Push every dirty record; clear `dirty` only if the record didn't change while in flight.
 *
 * Review logs are immutable (union merge); tombstones propagate deletions.
 */
import type { Table } from 'dexie';
import type { AppDB } from '../db/db';
import { LAST_SYNC_AT_KEY, SYNC_CURSOR_KEY } from '../db/metaKeys';
import { SYNCED_TABLES, type SyncedTable } from '../domain/types';

export interface WireRecord {
  tbl: SyncedTable;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown>;
}

export interface PulledRecord extends WireRecord {
  seq: number;
}

export interface PullPage {
  records: PulledRecord[];
  cursor: number;
  hasMore: boolean;
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

type SyncRow = { id: string; updatedAt: number; deletedAt?: number; dirty: 0 | 1 };

export const PUSH_BATCH = 500;
export const PULL_LIMIT = 1000;

function table(db: AppDB, name: SyncedTable): Table<SyncRow, string> {
  return db.table(name);
}

export function toWire(tbl: SyncedTable, row: SyncRow): WireRecord {
  const { dirty: _dirty, ...data } = row;
  return { tbl, id: row.id, updatedAt: row.updatedAt, deleted: row.deletedAt !== undefined, data };
}

async function applyPage(db: AppDB, page: PullPage): Promise<number> {
  let applied = 0;
  const tables = SYNCED_TABLES.map((t) => table(db, t));
  await db.transaction('rw', [...tables, db.meta], async () => {
    for (const name of SYNCED_TABLES) {
      const incoming = page.records.filter((r) => r.tbl === name);
      if (!incoming.length) continue;
      const t = table(db, name);
      const locals = await t.bulkGet(incoming.map((r) => r.id));
      const writes: SyncRow[] = [];
      incoming.forEach((remote, i) => {
        const local = locals[i];
        if (local && local.updatedAt >= remote.updatedAt) return; // local is same or newer
        writes.push({ ...(remote.data as Omit<SyncRow, 'dirty'>), dirty: 0 });
      });
      if (writes.length) await t.bulkPut(writes);
      applied += writes.length;
    }
    await db.meta.put({ key: SYNC_CURSOR_KEY, value: page.cursor });
  });
  return applied;
}

async function pullAll(db: AppDB, transport: SyncTransport): Promise<number> {
  let cursor = ((await db.meta.get(SYNC_CURSOR_KEY))?.value as number | undefined) ?? 0;
  let applied = 0;
  for (;;) {
    const page = await transport.pull(cursor, PULL_LIMIT);
    applied += await applyPage(db, page);
    if (!page.hasMore || page.cursor === cursor) break;
    cursor = page.cursor;
  }
  return applied;
}

export async function countDirty(db: AppDB): Promise<number> {
  const counts = await Promise.all(
    SYNCED_TABLES.map((t) => table(db, t).where('dirty').equals(1).count()),
  );
  return counts.reduce((a, b) => a + b, 0);
}

async function pushAll(db: AppDB, transport: SyncTransport): Promise<number> {
  const dirty: WireRecord[] = [];
  for (const name of SYNCED_TABLES) {
    const rows = await table(db, name).where('dirty').equals(1).toArray();
    for (const row of rows) dirty.push(toWire(name, row));
  }

  for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
    const batch = dirty.slice(i, i + PUSH_BATCH);
    await transport.push(batch);
    const tables = SYNCED_TABLES.map((t) => table(db, t));
    await db.transaction('rw', tables, async () => {
      for (const rec of batch) {
        const t = table(db, rec.tbl);
        const current = await t.get(rec.id);
        // Only mark clean if nothing changed while the request was in flight.
        if (current && current.updatedAt === rec.updatedAt && current.dirty === 1) {
          await t.update(rec.id, { dirty: 0 });
        }
      }
    });
  }
  return dirty.length;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

export async function syncOnce(
  db: AppDB,
  transport: SyncTransport,
  now: () => number = Date.now,
): Promise<SyncResult> {
  const pulled = await pullAll(db, transport);
  const pushed = await pushAll(db, transport);
  await db.meta.put({ key: LAST_SYNC_AT_KEY, value: now() });
  return { pulled, pushed };
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
        body: JSON.stringify({ records }),
      });
    },
    pull(since, limit) {
      return call<PullPage>(`/api/sync/pull?since=${since}&limit=${limit}`);
    },
  };
}
