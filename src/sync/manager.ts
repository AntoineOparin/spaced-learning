/**
 * Runs sync in the background and exposes its status to React.
 * Triggers: app start, coming back online, the tab being hidden, every few minutes while
 * visible and there are local changes, the end of a study session, and "Sync now".
 */
import { useSyncExternalStore } from 'react';
import { db } from '../db/instance';
import { LAST_SYNC_AT_KEY } from '../db/metaKeys';
import { MINUTE } from '../domain/day';
import { errorMessage } from '../lib/errors';
import {
  AuthRequiredError,
  countDirty,
  httpTransport,
  OfflineError,
  type SyncTransport,
  SyncUnavailableError,
  syncOnce,
} from './client';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'auth' | 'unavailable' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  pending: number;
  error: string | null;
}

const PERIOD_MS = 5 * MINUTE;

class SyncManager {
  private state: SyncState = { status: 'idle', lastSyncAt: null, pending: 0, error: null };
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

  async refreshPending(): Promise<void> {
    const [pending, last] = await Promise.all([countDirty(db), db.meta.get(LAST_SYNC_AT_KEY)]);
    this.set({ pending, lastSyncAt: (last?.value as number | undefined) ?? null });
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
      await syncOnce(db, this.transport);
      this.set({ status: 'idle' });
    } catch (err) {
      if (err instanceof OfflineError) this.set({ status: 'offline' });
      else if (err instanceof AuthRequiredError) this.set({ status: 'auth' });
      else if (err instanceof SyncUnavailableError)
        this.set({ status: 'unavailable', error: err.message });
      else this.set({ status: 'error', error: errorMessage(err) });
    } finally {
      await this.refreshPending();
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.refreshPending();
    void this.sync();
    window.addEventListener('online', () => void this.sync());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.sync();
    });
    window.setInterval(() => {
      if (document.visibilityState === 'visible' && this.state.pending > 0) void this.sync();
    }, PERIOD_MS);
  }
}

export const syncManager = new SyncManager();

export function useSyncState(): SyncState {
  return useSyncExternalStore(syncManager.subscribe, syncManager.getState);
}
