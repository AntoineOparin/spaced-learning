import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

/**
 * primary/secondary/destructive are tactile (they sink onto their lip when pressed);
 * ghost and danger are quiet, for secondary actions next to a tactile one.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'tactile bg-accent text-on-accent [--lip-color:var(--accent-deep)] hover:bg-accent-hover',
  secondary:
    'tactile border-2 border-line-strong bg-bg text-fg [--lip-color:var(--line-strong)] hover:bg-bg-alt',
  destructive:
    'tactile bg-danger-text text-white [--lip-color:var(--danger-deep)] hover:brightness-110 dark:text-[#25241f]',
  ghost: 'text-muted transition-colors hover:bg-surface hover:text-fg active:bg-line',
  danger: 'text-danger-text transition-colors hover:bg-danger-soft active:bg-danger-soft',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 rounded-xl px-3.5 text-sm gap-1.5',
  md: 'h-11 rounded-2xl px-5 text-[15px] gap-2',
  lg: 'h-13 rounded-2xl px-6 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Button styling for other elements, e.g. a router <Link> that should look like a button. */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center font-bold',
    'disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-[background-color,color,transform] duration-150',
        'hover:bg-surface hover:text-fg active:scale-[0.94] active:bg-line',
        'disabled:pointer-events-none disabled:opacity-35',
        className,
      )}
      {...props}
    />
  );
});
