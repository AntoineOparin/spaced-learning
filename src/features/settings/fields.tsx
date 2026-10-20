/** Building blocks shared by the settings sections. */
import { type ComponentProps, type ReactNode, useRef, useState } from 'react';
import type { z } from 'zod';
import type { StepUnit } from '../../domain/types';
import { parseJson } from '../../io/schema';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { hintText, Input, intValue, useFieldIds } from '../../ui/Field';
import { surface } from '../../ui/misc';
import { useToast } from '../../ui/Toast';

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return 'never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ts);
}

export function parseSteps(s: string): StepUnit[] | null {
  const parts = s.split(/[\s,]+/).filter(Boolean);
  return parts.every((p) => /^\d+(\.\d+)?[mhd]$/.test(p)) ? (parts as StepUnit[]) : null;
}

/** A titled, grouped list of settings rows (iOS Settings / Notion). */
export function Section({
  id,
  title,
  children,
  plain = false,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  /** Render children as-is instead of a divided list. */
  plain?: boolean;
}) {
  return (
    <section id={id}>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className={cn(surface, plain ? 'px-5 py-5' : 'divide-y divide-line')}>{children}</div>
    </section>
  );
}

/** One setting: label and hint on the left, its control on the right (stacked on phones). */
export function Row({
  label,
  hint,
  children,
  stacked = false,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Receives the id to put on the control and the id of the hint for aria-describedby. */
  children?: ReactNode | ((id: string, describedBy: string | undefined) => ReactNode);
  stacked?: boolean;
}) {
  const { id, hintId } = useFieldIds(hint);
  const control = typeof children === 'function' ? children(id, hintId) : children;
  const labelled = typeof children === 'function';
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-5 py-4',
        !stacked && 'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
      )}
    >
      <div className="min-w-0">
        {labelled ? (
          <label htmlFor={id} className="text-[15px] font-semibold">
            {label}
          </label>
        ) : (
          <p className="text-[15px] font-semibold">{label}</p>
        )}
        {hint && (
          <p id={hintId} className={cn('mt-0.5', hintText)}>
            {hint}
          </p>
        )}
      </div>
      {control && <div className="flex shrink-0 flex-wrap gap-2">{control}</div>}
    </div>
  );
}

/** Steps edited as text, saved when the field loses focus (or put back if they don't parse). */
export function StepsRow({
  label,
  hint,
  steps,
  example,
  onSave,
}: {
  label: string;
  hint: string;
  steps: StepUnit[];
  example: string;
  onSave: (steps: StepUnit[]) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState(steps.join(' '));
  return (
    <Row label={label} hint={hint}>
      {(id, d) => (
        <Input
          id={id}
          aria-describedby={d}
          value={text}
          className="w-40 font-mono text-sm"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const parsed = parseSteps(text);
            if (parsed) onSave(parsed);
            else {
              toast({ tone: 'error', message: `Steps look like ${example}` });
              setText(steps.join(' '));
            }
          }}
        />
      )}
    </Row>
  );
}

/**
 * A whole-number input. Values in range save as you type; anything else (a first digit below
 * the minimum, say) waits for the field to lose focus and is then clamped.
 */
export function IntInput({
  value,
  min,
  max,
  fallback = min,
  onSave,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur' | 'min' | 'max'> & {
  value: number;
  min: number;
  max: number;
  fallback?: number;
  onSave: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() && Number.isInteger(n) && n >= min && n <= max) onSave(n);
      }}
      onBlur={() => {
        if (draft !== null) onSave(intValue(draft, min, max, fallback));
        setDraft(null);
      }}
    />
  );
}

/** A button that opens the file picker for one JSON file. */
export function JsonFileButton({
  onPick,
  variant,
  children,
}: {
  onPick: (file: File) => void;
  variant?: ComponentProps<typeof Button>['variant'];
  children: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => ref.current?.click()}>
        {children}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // picking the same file again still fires
          if (file) onPick(file);
        }}
      />
    </>
  );
}

/** Reads and validates a picked JSON file; explains in a toast (and returns null) when it can't be used. */
export function useJsonFileReader() {
  const toast = useToast();
  return async <T,>(file: File, schema: z.ZodType<T>, what: string): Promise<T | null> => {
    const result = parseJson(await file.text(), schema);
    if (result.ok) return result.data;
    toast({ tone: 'error', message: `Not a valid ${what}: ${result.errors[0]}`, durationMs: 8000 });
    return null;
  };
}
