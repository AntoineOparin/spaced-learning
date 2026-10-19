import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

export function Kbd({
  children,
  onAccent = false,
  small = false,
}: {
  children: ReactNode;
  /** For use inside an accent-coloured (primary) button. */
  onAccent?: boolean;
  small?: boolean;
}) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-b-2 px-1 font-mono font-medium leading-none',
        small ? 'h-4 min-w-4 text-[10px]' : 'h-5 min-w-5 text-[11px]',
        onAccent ? 'border-on-accent/25 text-on-accent' : 'border-line-strong bg-bg text-muted',
      )}
    >
      {children}
    </kbd>
  );
}

/** The card surface (Notion): border-only depth, never a tactile shadow. Add padding with cn. */
export const surface = 'rounded-xl border border-line bg-bg-alt';

/** A flat document surface (Notion): border-only depth, never a tactile shadow. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(surface, 'p-5 sm:p-6', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A Notion callout: a quiet inline message with an icon. */
export function Callout({
  icon,
  tone,
  children,
  action,
}: {
  icon: IconName;
  tone: 'streak' | 'accent';
  children: ReactNode;
  action?: ReactNode;
}) {
  const iconTone = { streak: 'text-streak-text', accent: 'text-accent-text' };
  return (
    <div className={cn(surface, 'flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 text-sm')}>
      <Icon name={icon} className={cn('mt-0.5 shrink-0', iconTone[tone])} />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: IconName;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={cn(surface, 'px-6 py-12 text-center')}>
      {icon && (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface text-muted">
          <Icon name={icon} size={22} />
        </div>
      )}
      <p className="text-base font-bold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'streak' | 'xp';

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-surface text-muted',
    accent: 'bg-accent-soft text-accent-text',
    danger: 'bg-danger-soft text-danger-text',
    streak: 'bg-streak-soft text-streak-text',
    xp: 'bg-xp-soft text-xp-text',
  };
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-1.5 text-xs font-semibold',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** A coloured dot that carries identity next to a text label (never colour alone). */
export function Dot({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', className)} />
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-prose text-[15px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  className,
}: {
  /** 0–1 */
  value: number;
  label: string;
  className?: string;
}) {
  const pct = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      className={cn('progress h-3', className)}
    >
      <div className="progress-fill" style={{ transform: `translateX(${(pct - 1) * 100}%)` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

/** A loading placeholder that screen readers announce as "Loading…". */
export function LoadingStatus({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className} role="status">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** Generic page placeholder while a route or its data loads. */
export function PageSkeleton() {
  return (
    <LoadingStatus className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </LoadingStatus>
  );
}
