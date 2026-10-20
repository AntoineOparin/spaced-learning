import type { ReactNode } from 'react';
import { RichText } from '../../content/RichText';
import type { ItemFields, ItemType } from '../../domain/types';
import { cn } from '../../lib/cn';

function PreviewCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-bg-alt p-5">
      <div className="mb-2 text-xs font-bold text-muted">{label}</div>
      <div className="min-h-8 text-lg font-medium">{children}</div>
    </div>
  );
}

/** Live front/back rendering of the draft; cloze items get one tab per deletion. */
export function PreviewPane({
  type,
  fields,
  ordinals,
  activeOrdinal,
  onOrdinal,
  sticky,
}: {
  type: ItemType;
  fields: ItemFields;
  ordinals: number[];
  activeOrdinal: number;
  onOrdinal: (n: number) => void;
  sticky: boolean;
}) {
  return (
    <aside aria-label="Preview" className={cn('space-y-3', sticky && 'xl:sticky xl:top-12')}>
      <div className="flex h-7 items-center justify-between">
        <h3 className="text-sm font-bold text-muted">Preview</h3>
        {ordinals.length > 1 && (
          <div className="flex gap-1">
            {ordinals.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onOrdinal(n)}
                aria-pressed={n === activeOrdinal}
                className={cn(
                  'h-7 min-w-8 rounded-full px-2 text-xs font-bold transition-colors',
                  n === activeOrdinal ? 'bg-fg text-bg' : 'bg-surface text-muted hover:text-fg',
                )}
              >
                c{n}
              </button>
            ))}
          </div>
        )}
      </div>
      <PreviewCard label="Front">
        <RichText
          source={fields.prompt}
          cloze={type === 'cloze' ? { ordinal: activeOrdinal, reveal: false } : undefined}
        />
      </PreviewCard>
      <PreviewCard label="Back">
        {type === 'cloze' ? (
          <>
            <RichText source={fields.prompt} cloze={{ ordinal: activeOrdinal, reveal: true }} />
            {fields.answer.trim() && (
              <RichText source={fields.answer} className="mt-3 text-base text-muted" />
            )}
          </>
        ) : (
          <RichText source={fields.answer} />
        )}
      </PreviewCard>
      {fields.explanation?.trim() && (
        <PreviewCard label="Why">
          <RichText source={fields.explanation} className="text-base" />
        </PreviewCard>
      )}
    </aside>
  );
}
