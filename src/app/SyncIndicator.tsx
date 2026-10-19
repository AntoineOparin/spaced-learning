import { Link } from 'react-router';
import { type SyncState, useSyncState } from '../sync/manager';
import { cn } from '../ui/cn';
import { Icon } from '../ui/Icon';

export function describeSync(state: SyncState): { label: string; tone: 'ok' | 'warn' | 'muted' } {
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
    case 'error':
      return { label: 'Sync error', tone: 'warn' };
    default:
      return state.pending
        ? { label: `${state.pending} unsynced`, tone: 'muted' }
        : { label: 'Synced', tone: 'ok' };
  }
}

export function SyncIndicator() {
  const state = useSyncState();
  const { label, tone } = describeSync(state);
  const offline = state.status === 'offline' || state.status === 'unavailable';
  return (
    <Link
      to="/settings#sync"
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-surface-2',
        tone === 'warn' ? 'text-hard' : 'text-muted',
      )}
      title={state.error ?? label}
    >
      <Icon name={offline ? 'cloudOff' : 'cloud'} size={16} />
      <span className={cn(tone === 'ok' && 'hidden sm:inline')}>{label}</span>
    </Link>
  );
}
