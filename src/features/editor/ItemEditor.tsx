import { useLiveQuery } from 'dexie-react-hooks';
import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RichText } from '../../content/RichText';
import { itemErrors, qualityWarnings } from '../../content/validate';
import { useCourses, useTopics } from '../../db/hooks';
import { db, repo } from '../../db/instance';
import { clozeOrdinals } from '../../domain/cloze';
import { curriculumOrder } from '../../domain/topics';
import type { Item, ItemFields, ItemType } from '../../domain/types';
import { errorMessage } from '../../lib/errors';
import { Button } from '../../ui/Button';
import { useConfirm } from '../../ui/Confirm';
import { cn } from '../../ui/cn';
import { DisclosureButton } from '../../ui/Disclosure';
import { Field, hintText, Input, Segmented, Switch, Textarea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Callout, EmptyState, Kbd, LoadingStatus, Skeleton } from '../../ui/misc';
import { Select } from '../../ui/Select';
import { useToast } from '../../ui/Toast';

type FieldKey = keyof ItemFields;

const SNIPPETS: { label: string; insert: string; title: string }[] = [
  { label: '$x$', insert: '$|$', title: 'Inline math' },
  { label: '$$', insert: '\n$$\n|\n$$\n', title: 'Display math' },
  { label: 'a/b', insert: '\\frac{|}{}', title: 'Fraction' },
  { label: '√', insert: '\\sqrt{|}', title: 'Square root' },
  { label: 'xⁿ', insert: '^{|}', title: 'Superscript' },
  { label: 'xₙ', insert: '_{|}', title: 'Subscript' },
  { label: '∫', insert: '\\int_{|}^{} \\,dx', title: 'Integral' },
  { label: 'Σ', insert: '\\sum_{n=1}^{\\infty} |', title: 'Series' },
  { label: 'lim', insert: '\\lim_{x \\to |}', title: 'Limit' },
  { label: '∞', insert: '\\infty', title: 'Infinity' },
  { label: 'θ', insert: '\\theta', title: 'theta' },
  { label: 'π', insert: '\\pi', title: 'pi' },
];

const EMPTY_FIELDS: ItemFields = {
  prompt: '',
  answer: '',
  explanation: '',
  mnemonic: '',
  source: '',
};

function cleanFields(f: ItemFields): ItemFields {
  const out: ItemFields = { prompt: f.prompt.trim(), answer: f.answer.trim() };
  for (const key of ['explanation', 'mnemonic', 'source'] as const) {
    const v = f[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}

function parseTags(s: string): string[] {
  return [
    ...new Set(
      s
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export interface ItemEditorProps {
  itemId?: string;
  defaultTopicId?: string;
  onDone: (item: Item | null, action: 'saved' | 'deleted' | 'cancelled') => void;
  /** Compact layout for use inside a dialog. */
  compact?: boolean;
}

export function ItemEditor({ itemId, defaultTopicId, onDone, compact = false }: ItemEditorProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const courses = useCourses();
  const topics = useTopics();
  const existing = useLiveQuery(() => (itemId ? db.items.get(itemId) : undefined), [itemId]);

  const [loaded, setLoaded] = useState(!itemId);
  const [type, setType] = useState<ItemType>('basic');
  const [chosenTopicId, setTopicId] = useState(defaultTopicId ?? '');
  const [fields, setFields] = useState<ItemFields>(EMPTY_FIELDS);
  const [reverse, setReverse] = useState(false);
  const [tags, setTags] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [previewOrdinal, setPreviewOrdinal] = useState(1);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const refs = useRef<Partial<Record<FieldKey, HTMLTextAreaElement | null>>>({});
  const lastFocused = useRef<FieldKey>('prompt');
  const formId = useId();

  useEffect(() => {
    if (!itemId || loaded || existing === undefined) return;
    if (existing) {
      setType(existing.type);
      setTopicId(existing.topicId);
      setFields({ ...EMPTY_FIELDS, ...existing.fields });
      setReverse(!!existing.options.reverse);
      setTags(existing.tags.join(', '));
      setShowMore(
        !!(existing.fields.explanation || existing.fields.mnemonic || existing.fields.source),
      );
    }
    setLoaded(true);
  }, [itemId, existing, loaded]);

  // Validation renders KaTeX for every cloze variant: let it trail typing by a frame. (Saving
  // re-validates the current fields, so a stale result can never let bad content through.)
  const deferredType = useDeferredValue(type);
  const deferredFields = useDeferredValue(fields);
  const { errors, warnings } = useMemo(() => {
    const draft = { type: deferredType, fields: cleanFields(deferredFields) };
    return { errors: itemErrors(draft), warnings: qualityWarnings(draft) };
  }, [deferredType, deferredFields]);
  const ordinals = type === 'cloze' ? clozeOrdinals(fields.prompt) : [];
  const activeOrdinal = ordinals.includes(previewOrdinal) ? previewOrdinal : (ordinals[0] ?? 1);
  const errorFor = (key: FieldKey) => {
    const list = errors.filter((e) => e.field === key && (touched || !e.required));
    return list.length ? list.map((e) => <div key={e.message}>{e.message}</div>) : undefined;
  };

  const setField = (key: FieldKey, value: string) => setFields((f) => ({ ...f, [key]: value }));

  const insert = (snippet: string, field: FieldKey = lastFocused.current) => {
    const el = refs.current[field];
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e);
    const marker = snippet.indexOf('|');
    const text =
      selected && marker >= 0 ? snippet.replace('|', selected) : snippet.replace('|', '');
    const next = value.slice(0, s) + text + value.slice(e);
    setField(field, next);
    const caret = s + (marker >= 0 ? marker + (selected ? selected.length : 0) : text.length);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const wrapCloze = () => {
    const el = refs.current.prompt;
    if (!el) return;
    const n = Math.max(0, ...clozeOrdinals(fields.prompt)) + 1;
    lastFocused.current = 'prompt';
    insert(`{{c${n}::|}}`, 'prompt');
  };

  const topicOptions = useMemo(() => {
    if (!courses || !topics) return [];
    return courses.map((c) => ({
      course: c,
      topics: curriculumOrder(topics, c.id),
    }));
  }, [courses, topics]);
  // Until one is chosen, the item goes in the first topic.
  const topicId = chosenTopicId || (topicOptions.find((o) => o.topics[0])?.topics[0]?.id ?? '');

  const save = async (addAnother = false) => {
    setTouched(true);
    const errors = itemErrors({ type, fields: cleanFields(fields) });
    if (errors.length || !topicId) {
      toast({
        tone: 'error',
        message: topicId ? 'Fix the highlighted problems first.' : 'Choose a topic first.',
      });
      return;
    }
    setSaving(true);
    try {
      const item = await repo.saveItem({
        id: itemId,
        topicId,
        type,
        fields: cleanFields(fields),
        options: {
          ...(existing?.options.answerMode ? { answerMode: existing.options.answerMode } : {}),
          ...(type === 'basic' && reverse ? { reverse: true } : {}),
        },
        tags: parseTags(tags),
      });
      if (addAnother) {
        toast({ tone: 'success', message: 'Saved — ready for the next one' });
        setFields(EMPTY_FIELDS);
        setTouched(false);
        refs.current.prompt?.focus();
      } else {
        onDone(item, 'saved');
      }
    } catch (err) {
      toast({
        tone: 'error',
        message: `Could not save: ${errorMessage(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!itemId) return;
    const ok = await confirm({
      title: 'Delete this item?',
      body: 'Its cards are deleted too. Your review history is kept.',
      confirmLabel: 'Delete item',
    });
    if (!ok) return;
    await repo.deleteItem(itemId);
    toast({ message: 'Item deleted' });
    onDone(null, 'deleted');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      void save(e.shiftKey && !itemId);
    } else if (mod && e.shiftKey && (e.key === 'c' || e.key === 'C') && type === 'cloze') {
      e.preventDefault();
      wrapCloze();
    }
  };

  if (!loaded || !courses || !topics)
    return (
      <LoadingStatus className="space-y-5">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </LoadingStatus>
    );
  if (itemId && existing === null)
    return <EmptyState title="This item no longer exists" icon="trash" />;
  if (!topicOptions.some((o) => o.topics.length)) {
    return (
      <EmptyState title="No topics yet" icon="folder">
        Create a course and a topic in the Library first.
      </EmptyState>
    );
  }

  const textarea = (key: FieldKey, label: ReactNode, hint?: ReactNode, rows = 3) => (
    <Field label={label} hint={hint} error={errorFor(key)}>
      {(id, describedBy) => (
        <Textarea
          mono
          id={id}
          aria-describedby={describedBy}
          ref={(el) => {
            refs.current[key] = el;
          }}
          rows={rows}
          value={fields[key] ?? ''}
          onChange={(e) => setField(key, e.target.value)}
          onFocus={() => {
            lastFocused.current = key;
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
          void save();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold" aria-hidden>
              Type
            </p>
            <Segmented<ItemType>
              legend="Type"
              value={type}
              onChange={setType}
              options={[
                { value: 'basic', label: 'Basic' },
                { value: 'cloze', label: 'Cloze' },
              ]}
            />
            <p className={hintText}>
              {type === 'basic'
                ? 'A question on the front, its answer on the back.'
                : 'Hide parts of a sentence or formula to fill in.'}
            </p>
          </div>
          <Field label="Topic">
            {(id) => (
              <Select
                id={id}
                value={topicId}
                onChange={setTopicId}
                groups={topicOptions.map(({ course, topics: ts }) => ({
                  label: course.name,
                  options: ts.map((t) => ({ value: t.id, label: t.name, indent: !!t.parentId })),
                }))}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Insert math">
          {SNIPPETS.map((s) => (
            <button
              key={s.title}
              type="button"
              title={s.title}
              onMouseDown={(e) => e.preventDefault()} // keep the textarea selection
              onClick={() => insert(s.insert)}
              className="h-8 min-w-8 rounded-lg border border-line bg-bg px-2 font-mono text-xs text-muted transition-[color,border-color,transform] duration-150 hover:border-line-strong hover:text-fg active:scale-95"
            >
              {s.label}
            </button>
          ))}
          {type === 'cloze' && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={wrapCloze}
              className="h-8 rounded-lg border border-xp/40 bg-xp-soft px-2.5 text-xs font-bold text-xp-text transition-transform duration-150 active:scale-95"
              title="Wrap selection in a cloze deletion (Ctrl/⌘ + Shift + C)"
            >
              {'{{c::}}'} Cloze
            </button>
          )}
        </div>

        {type === 'basic' ? (
          <>
            {textarea('prompt', 'Question', 'Use $…$ for inline math and $$…$$ for display math.')}
            {textarea('answer', 'Answer')}
            <Switch
              checked={reverse}
              onChange={setReverse}
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
          <DisclosureButton open={showMore} onToggle={() => setShowMore((v) => !v)} small>
            {showMore ? 'Hide' : 'Add'} explanation, mnemonic & source
          </DisclosureButton>
        </div>
        {showMore && (
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
                  value={fields.source ?? ''}
                  onChange={(e) => setField('source', e.target.value)}
                  placeholder="e.g. Stewart 7.1"
                />
              )}
            </Field>
          </div>
        )}

        <Field label="Tags" hint="Comma-separated, e.g. formula, exam-1">
          {(id) => <Input id={id} value={tags} onChange={(e) => setTags(e.target.value)} />}
        </Field>

        {warnings.length > 0 && (
          <Callout icon="alert" tone="streak">
            <ul className="space-y-1">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Callout>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button type="submit" variant="primary" disabled={saving}>
            {itemId ? 'Save' : 'Create'}
          </Button>
          {!itemId && (
            <Button onClick={() => void save(true)} disabled={saving}>
              Create & add another
            </Button>
          )}
          <Button variant="ghost" onClick={() => onDone(null, 'cancelled')}>
            Cancel
          </Button>
          {itemId && (
            <Button variant="danger" size="sm" className="ml-auto" onClick={() => void remove()}>
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

      <aside aria-label="Preview" className={cn('space-y-3', !compact && 'xl:sticky xl:top-12')}>
        <div className="flex h-7 items-center justify-between">
          <h3 className="text-sm font-bold text-muted">Preview</h3>
          {ordinals.length > 1 && (
            <div className="flex gap-1">
              {ordinals.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPreviewOrdinal(n)}
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
    </div>
  );
}

function PreviewCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-bg-alt p-5">
      <div className="mb-2 text-xs font-bold text-muted">{label}</div>
      <div className="min-h-8 text-lg font-medium">{children}</div>
    </div>
  );
}
