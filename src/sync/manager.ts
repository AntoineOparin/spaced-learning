/**
 * Runs sync in the background and exposes its status to React.
 * Triggers: app start, coming back online, the tab being hidden, every few minutes while
 * visible and there are local changes, the end of a study session, and "Sync now".
 */
import { liveQuery } from 'dexie';
import { useSyncExternalStore } from 'react';
import { db, repo } from '../db/instance';
import { LAST_SYNC_AT_KEY } from '../db/metaKeys';
import { MINUTE } from '../domain/day';
import { errorMessage } from '../lib/errors';
import {
  AuthRequiredError,
  countDirty,
  httpTransport,
  OfflineError,
  OutdatedClientError,
  type SyncTransport,
  SyncUnavailableError,
  syncOnce,
} from './client';

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'auth'
  | 'unavailable'
  | 'outdated'
  | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  pending: number;
  error: string | null;
  /** From the last successful run: records skipped as unreadable. */
  invalid: number;
  /** From the last successful run: local edits replaced by newer ones from another device. */
  superseded: number;
  /** From the last run that reached the server: `serverTime - Date.now()`, or null if unknown. */
  clockSkewMs: number | null;
}

const INITIAL: SyncState = {
  status: 'idle',
  lastSyncAt: null,
  pending: 0,
  error: null,
  invalid: 0,
  superseded: 0,
  clockSkewMs: null,
};

const PERIOD_MS = 5 * MINUTE;

class SyncManager {
  private state: SyncState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private started = false;
  private readonly transport: SyncTransport = httpTransport();

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  private async loadLastSyncAt(): Promise<void> {
    this.set({ lastSyncAt: (await repo.getMeta<number>(LAST_SYNC_AT_KEY)) ?? null });
  }

  /** Runs a sync; concurrent calls coalesce into one follow-up run. */
  sync = (): Promise<void> => {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    });
    return this.running;
  };

  private async run(): Promise<void> {
    this.set({ status: 'syncing', error: null });
    try {
      const r = await syncOnce(db, this.transport);
      this.set({
        status: 'idle',
        invalid: r.invalid,
        superseded: r.superseded,
        clockSkewMs: r.clockSkewMs,
      });
    } catch (err) {
      if (err instanceof OfflineError) this.set({ status: 'offline' });
      else if (err instanceof AuthRequiredError) this.set({ status: 'auth' });
      else if (err instanceof OutdatedClientError) this.set({ status: 'outdated' });
      else if (err instanceof SyncUnavailableError)
        this.set({ status: 'unavailable', error: err.message });
      else this.set({ status: 'error', error: errorMessage(err) });
    } finally {
      await this.loadLastSyncAt();
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    // Every local write marks rows dirty: a live count keeps the indicator and the periodic
    // sync below up to date without each write having to report in.
    liveQuery(() => countDirty(db)).subscribe({
      next: (pending) => this.set({ pending }),
      error: (err) => console.warn('Could not count unsynced changes', err),
    });
    void this.loadLastSyncAt();
    void this.sync();
    window.addEventListener('online', () => void this.sync());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.sync();
    });
    window.setInterval(() => {
      // An outdated app can't push; retrying every few minutes would only repeat the refusal.
      if (this.state.status === 'outdated') return;
      if (document.visibilityState === 'visible' && this.state.pending > 0) void this.sync();
    }, PERIOD_MS);
  }
}

export const syncManager = new SyncManager();

export function useSyncState(): SyncState {
  return useSyncExternalStore(syncManager.subscribe, syncManager.getState);
}
