/** Human-readable descriptions of the sync state (pure; shared by the indicator and Settings). */
import { MINUTE } from '../domain/day';
import { CLOCK_SKEW_WARN_MS } from './client';
import type { SyncState } from './manager';

export type SyncTone = 'ok' | 'warn' | 'muted';

export function clockSkewTooLarge(skewMs: number | null): skewMs is number {
  return skewMs !== null && Math.abs(skewMs) > CLOCK_SKEW_WARN_MS;
}

/** "about 12 minutes ahead of the server", or null when the skew is tolerable. */
export function describeClockSkew(skewMs: number | null): string | null {
  if (!clockSkewTooLarge(skewMs)) return null;
  const minutes = Math.round(Math.abs(skewMs) / MINUTE);
  const amount =
    minutes < 90
      ? `${minutes} minute${minutes === 1 ? '' : 's'}`
      : `${Math.round(minutes / 60)} hours`;
  // A device clock ahead of the server sees a server time in its past.
  return `about ${amount} ${skewMs < 0 ? 'ahead of' : 'behind'} the server`;
}

export function describeSync(state: SyncState): { label: string; tone: SyncTone } {
  switch (state.status) {
    case 'syncing':
      return { label: 'Syncing…', tone: 'muted' };
    case 'offline':
      return {
        label: state.pending ? `Offline · ${state.pending} unsynced` : 'Offline',
        tone: 'muted',
      };
    case 'auth':
      return { label: 'Sign in to sync', tone: 'warn' };
    case 'unavailable':
      return { label: 'Sync unavailable', tone: 'muted' };
    case 'outdated':
      return { label: 'Update the app to sync', tone: 'warn' };
    case 'error':
      return { label: 'Sync error', tone: 'warn' };
    default:
      if (clockSkewTooLarge(state.clockSkewMs))
        return { label: 'Check device clock', tone: 'warn' };
      return state.pending
        ? { label: `${state.pending} unsynced`, tone: 'muted' }
        : { label: 'Synced', tone: 'ok' };
  }
}
