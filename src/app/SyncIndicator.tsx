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

export function SyncIndicator({ variant = 'bar' }: { variant?: 'bar' | 'rail' }) {
  const state = useSyncState();
  const { label, tone } = describeSync(state);
  const offline = state.status === 'offline' || state.status === 'unavailable';
  return (
    <Link
      to="/settings#sync"
      className={cn(
        'flex items-center gap-2 rounded-xl text-[13px] font-medium transition-colors hover:bg-surface',
        variant === 'rail' ? 'h-10 px-3' : 'h-9 px-2.5',
        tone === 'warn' ? 'text-streak-text' : 'text-muted',
      )}
      title={state.error ?? label}
    >
      <span className="relative">
        <Icon name={offline ? 'cloudOff' : 'cloud'} size={18} />
        {tone === 'ok' && (
          <span
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-accent ring-2 ring-bg-alt"
          />
        )}
      </span>
      <span className={cn(variant === 'bar' && tone === 'ok' && 'sr-only')}>{label}</span>
    </Link>
  );
}
