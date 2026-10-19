import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useId,
} from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

/** Shared look of text inputs, textareas and the Select trigger. */
export const fieldControl =
  'w-full rounded-[10px] border border-line bg-bg px-3.5 text-base text-fg placeholder:text-dim sm:text-[15px] ' +
  'transition-colors hover:border-line-strong focus:border-line-strong';

/** The small explanatory text under a label or control. */
export const hintText = 'text-[13px] leading-5 text-muted';

/** Ids that tie a control to its label, hint and error (for aria-describedby). */
export function useFieldIds(hint: unknown, error?: unknown) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy };
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(hint, error);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={hintId} className={hintText}>
          {hint}
        </p>
      )}
      {error && (
        <div
          id={errorId}
          className="flex gap-1.5 text-[13px] leading-5 font-medium text-danger-text"
          role="alert"
        >
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldControl, 'h-11', className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    /** For LaTeX and markup source. */ mono?: boolean;
  }
>(function Textarea({ className, mono = false, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        fieldControl,
        'min-h-20 py-2.5 leading-relaxed',
        mono && 'font-mono text-[15px] sm:text-sm',
        className,
      )}
      {...props}
    />
  );
});

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[15px] font-semibold">
          {label}
        </label>
        {description && <p className={cn('mt-0.5', hintText)}>{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'group relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'inline-block size-6 rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.18)]',
            'transition-transform duration-(--spring-fast) ease-spring group-active:scale-x-110',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: IconName;
}

/** iOS-style segmented control: radio inputs under a thumb that slides with a spring. */
export function Segmented<T extends string>({
  legend,
  value,
  onChange,
  options,
  className,
}: {
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  className?: string;
}) {
  const name = useId();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <fieldset
      className={cn('relative grid min-w-0 rounded-xl bg-surface p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <legend className="sr-only">{legend}</legend>
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-[9px] bg-bg shadow-[0_1px_3px_rgb(55_53_47/0.14)] transition-transform duration-(--spring-fast) ease-spring dark:bg-line-strong"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'relative z-10 flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-3 text-sm font-semibold transition-colors',
            'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-(--ring)',
            o.value === value ? 'text-fg' : 'text-muted hover:text-fg',
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
