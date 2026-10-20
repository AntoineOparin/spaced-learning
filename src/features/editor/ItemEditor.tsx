import { type ReactNode, useId } from 'react';
import type { Item, ItemType } from '../../domain/types';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { DisclosureButton } from '../../ui/Disclosure';
import { Field, hintText, Input, Segmented, Switch, Textarea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Callout, EmptyState, Kbd, LoadingStatus, Skeleton } from '../../ui/misc';
import { Select } from '../../ui/Select';
import { MathToolbar } from './MathToolbar';
import { PreviewPane } from './PreviewPane';
import { type DoneAction, type FieldKey, useItemDraft } from './useItemDraft';

export interface ItemEditorProps {
  itemId?: string;
  defaultTopicId?: string;
  onDone: (item: Item | null, action: DoneAction) => void;
  /** Compact layout for use inside a dialog. */
  compact?: boolean;
}

export function ItemEditor({ itemId, defaultTopicId, onDone, compact = false }: ItemEditorProps) {
  const d = useItemDraft(itemId, defaultTopicId, onDone);
  const formId = useId();

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      void d.save(e.shiftKey && !itemId);
    } else if (mod && e.shiftKey && (e.key === 'c' || e.key === 'C') && d.type === 'cloze') {
      e.preventDefault();
      d.wrapCloze();
    }
  };

  if (d.status === 'loading')
    return (
      <LoadingStatus className="space-y-5">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </LoadingStatus>
    );
  if (d.status === 'missing') return <EmptyState title="This item no longer exists" icon="trash" />;
  if (d.status === 'no-topics')
    return (
      <EmptyState title="No topics yet" icon="folder">
        Create a course and a topic in the Library first.
      </EmptyState>
    );

  const errorFor = (key: FieldKey) => {
    const list = d.errorsFor(key);
    return list.length ? list.map((m) => <div key={m}>{m}</div>) : undefined;
  };

  const textarea = (key: FieldKey, label: ReactNode, hint?: ReactNode, rows = 3) => (
    <Field label={label} hint={hint} error={errorFor(key)}>
      {(id, describedBy) => (
        <Textarea
          mono
          id={id}
          aria-describedby={describedBy}
          ref={(el) => {
            d.refs.current[key] = el;
          }}
          rows={rows}
          value={d.fields[key] ?? ''}
          onChange={(e) => d.setField(key, e.target.value)}
          onFocus={() => {
            d.lastFocused.current = key;
          }}
          spellCheck={key !== 'prompt' && key !== 'answer' ? undefined : false}
        />
      )}
    </Field>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the whole form
    <div
      onKeyDown={onKeyDown}
      className={cn(
        'grid gap-8',
        !compact && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] xl:items-start',
      )}
    >
      <form
        id={formId}
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void d.save();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold" aria-hidden>
              Type
            </p>
            <Segmented<ItemType>
              legend="Type"
              value={d.type}
              onChange={d.setType}
              options={[
                { value: 'basic', label: 'Basic' },
                { value: 'cloze', label: 'Cloze' },
              ]}
            />
            <p className={hintText}>
              {d.type === 'basic'
                ? 'A question on the front, its answer on the back.'
                : 'Hide parts of a sentence or formula to fill in.'}
            </p>
          </div>
          <Field label="Topic">
            {(id) => (
              <Select
                id={id}
                value={d.topicId}
                onChange={d.setTopicId}
                groups={d.topicOptions.map(({ course, topics: ts }) => ({
                  label: course.name,
                  options: ts.map((t) => ({ value: t.id, label: t.name, indent: !!t.parentId })),
                }))}
              />
            )}
          </Field>
        </div>

        <MathToolbar onInsert={d.insert} onCloze={d.type === 'cloze' ? d.wrapCloze : undefined} />

        {d.type === 'basic' ? (
          <>
            {textarea('prompt', 'Question', 'Use $…$ for inline math and $$…$$ for display math.')}
            {textarea('answer', 'Answer')}
            <Switch
              checked={d.reverse}
              onChange={d.setReverse}
              label="Also create a reverse card"
              description="Asks answer → question too. Only when the reverse question is unambiguous."
            />
          </>
        ) : (
          <>
            {textarea(
              'prompt',
              'Text with deletions',
              <>
                Wrap what to hide in <code className="font-mono">{'{{c1::…}}'}</code> — each number
                becomes its own card. Works inside math:{' '}
                <code className="font-mono">{'$\\sin^2x + {{c1::\\cos^2x}} = 1$'}</code>
              </>,
              4,
            )}
            {textarea('answer', 'Extra (optional, shown after reveal)', undefined, 2)}
          </>
        )}

        <div>
          <DisclosureButton open={d.showMore} onToggle={() => d.setShowMore((v) => !v)} small>
            {d.showMore ? 'Hide' : 'Add'} explanation, mnemonic & source
          </DisclosureButton>
        </div>
        {d.showMore && (
          <div className="animate-rise space-y-5">
            {textarea(
              'explanation',
              'Why / derivation',
              'Shown after the answer. Explaining why something is true makes it easier to remember.',
              3,
            )}
            {textarea('mnemonic', 'Mnemonic', undefined, 2)}
            <Field label="Source">
              {(id) => (
                <Input
                  id={id}
                  value={d.fields.source ?? ''}
                  onChange={(e) => d.setField('source', e.target.value)}
                  placeholder="e.g. Stewart 7.1"
                />
              )}
            </Field>
          </div>
        )}

        <Field label="Tags" hint="Comma-separated, e.g. formula, exam-1">
          {(id) => <Input id={id} value={d.tags} onChange={(e) => d.setTags(e.target.value)} />}
        </Field>

        {d.warnings.length > 0 && (
          <Callout icon="alert" tone="streak">
            <ul className="space-y-1">
              {d.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Callout>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button type="submit" variant="primary" disabled={d.saving}>
            {itemId ? 'Save' : 'Create'}
          </Button>
          {!itemId && (
            <Button onClick={() => void d.save(true)} disabled={d.saving}>
              Create & add another
            </Button>
          )}
          <Button variant="ghost" onClick={() => onDone(null, 'cancelled')}>
            Cancel
          </Button>
          {itemId && (
            <Button variant="danger" size="sm" className="ml-auto" onClick={() => void d.remove()}>
              <Icon name="trash" size={16} /> Delete
            </Button>
          )}
        </div>
        <p className="-mt-2 hidden items-center gap-1 text-[13px] text-muted lg:flex">
          <Kbd>⌘/Ctrl</Kbd> <Kbd>Enter</Kbd> to save
          {!itemId && (
            <>
              {' '}
              · add <Kbd>Shift</Kbd> to create another
            </>
          )}
        </p>
      </form>

      <PreviewPane
        type={d.type}
        fields={d.fields}
        ordinals={d.ordinals}
        activeOrdinal={d.activeOrdinal}
        onOrdinal={d.setPreviewOrdinal}
        sticky={!compact}
      />
    </div>
  );
}
