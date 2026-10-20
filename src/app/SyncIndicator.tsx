import { Link } from 'react-router';
import { cn } from '../lib/cn';
import { useSyncState } from '../sync/manager';
import { describeSync } from '../sync/status';
import { Icon } from '../ui/Icon';

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
