/**
 * The item form's state: loading an existing item into the draft, live validation, snippet
 * insertion, and saving/deleting through the repository.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { itemErrors, qualityWarnings } from '../../content/validate';
import { useCourses, useItem, useTopics } from '../../db/hooks';
import { repo } from '../../db/instance';
import { clozeOrdinals } from '../../domain/cloze';
import { curriculumOrder } from '../../domain/topics';
import type { Item, ItemFields, ItemType } from '../../domain/types';
import { errorMessage } from '../../lib/errors';
import { useConfirm } from '../../ui/Confirm';
import { useToast } from '../../ui/Toast';
import { cleanFields, EMPTY_FIELDS, insertSnippet, parseTags } from './draft';

export type FieldKey = keyof ItemFields;
export type DoneAction = 'saved' | 'deleted' | 'cancelled';

export function useItemDraft(
  itemId: string | undefined,
  defaultTopicId: string | undefined,
  onDone: (item: Item | null, action: DoneAction) => void,
) {
  const toast = useToast();
  const confirm = useConfirm();
  const courses = useCourses();
  const topics = useTopics();
  // null when missing; a deleted item can't be edited either (saving would not bring it back).
  const item = useItem(itemId);
  const existing = item?.deletedAt === undefined ? item : null;

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
  /** Messages for a field; required-field errors wait until a save was attempted. */
  const errorsFor = (key: FieldKey) =>
    errors.filter((e) => e.field === key && (touched || !e.required)).map((e) => e.message);

  const setField = (key: FieldKey, value: string) => setFields((f) => ({ ...f, [key]: value }));

  const insert = (snippet: string, field: FieldKey = lastFocused.current) => {
    const el = refs.current[field];
    if (!el) return;
    const next = insertSnippet(el.value, el.selectionStart, el.selectionEnd, snippet);
    setField(field, next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const wrapCloze = () => {
    if (!refs.current.prompt) return;
    const n = Math.max(0, ...clozeOrdinals(fields.prompt)) + 1;
    lastFocused.current = 'prompt';
    insert(`{{c${n}::|}}`, 'prompt');
  };

  const topicOptions = useMemo(() => {
    if (!courses || !topics) return [];
    return courses.map((c) => ({ course: c, topics: curriculumOrder(topics, c.id) }));
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
      const saved = await repo.saveItem({
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
        onDone(saved, 'saved');
      }
    } catch (err) {
      toast({ tone: 'error', message: `Could not save: ${errorMessage(err)}` });
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

  /** 'loading' until data and the existing item are in; 'missing' for a deleted/unknown id. */
  const status =
    !loaded || !courses || !topics
      ? 'loading'
      : itemId && existing === null
        ? 'missing'
        : !topicOptions.some((o) => o.topics.length)
          ? 'no-topics'
          : 'ready';

  return {
    status,
    type,
    setType,
    topicId,
    setTopicId,
    topicOptions,
    fields,
    setField,
    reverse,
    setReverse,
    tags,
    setTags,
    showMore,
    setShowMore,
    ordinals,
    activeOrdinal,
    setPreviewOrdinal,
    errorsFor,
    warnings,
    saving,
    refs,
    lastFocused,
    insert,
    wrapCloze,
    save,
    remove,
  };
}
