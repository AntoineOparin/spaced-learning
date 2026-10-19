import type { ReactNode } from 'react';
import { cn } from './cn';

export function Kbd({
  children,
  className,
  onAccent = false,
}: {
  children: ReactNode;
  className?: string;
  /** For use inside an accent-coloured (primary) button. */
  onAccent?: boolean;
}) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded border px-1 font-mono text-[11px] leading-5',
        onAccent ? 'border-accent-fg/40 text-accent-fg' : 'border-line bg-surface-2 text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

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
    <section className={cn('rounded-2xl border border-line bg-surface p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'again' | 'hard' | 'good' | 'easy';
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    again: 'bg-again-soft text-again',
    hard: 'bg-hard-soft text-hard',
    good: 'bg-good-soft text-good',
    easy: 'bg-easy-soft text-easy',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
