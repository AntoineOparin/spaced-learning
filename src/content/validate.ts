/** Content validation used by the editor (inline errors) and the curated-deck tests. */
import { clozeOrdinals, renderCloze } from '../domain/cloze';
import type { ItemFields, ItemType } from '../domain/types';
import { renderMath } from './katex';
import { mathTokens } from './markup';

export interface ContentError {
  field: keyof ItemFields;
  message: string;
}

/** KaTeX errors for every math expression in a source string. */
export function markupErrors(source: string): string[] {
  const errors: string[] = [];
  for (const { tex, display } of mathTokens(source)) {
    const result = renderMath(tex, display);
    if (!result.ok) errors.push(result.error);
  }
  return errors;
}

const FIELDS: (keyof ItemFields)[] = ['prompt', 'answer', 'explanation', 'mnemonic', 'source'];

export function itemErrors(item: { type: ItemType; fields: ItemFields }): ContentError[] {
  const errors: ContentError[] = [];
  const add = (field: keyof ItemFields, messages: string[]) => {
    for (const message of new Set(messages)) errors.push({ field, message });
  };

  if (!item.fields.prompt.trim()) add('prompt', ['The prompt is empty.']);

  if (item.type === 'cloze') {
    const ordinals = clozeOrdinals(item.fields.prompt);
    if (ordinals.length === 0) {
      add('prompt', ['A cloze item needs at least one deletion, e.g. {{c1::hidden text}}.']);
    }
    // Validate how each card will actually render: blanked and revealed.
    const variants = ordinals.flatMap((n) => [
      renderCloze(item.fields.prompt, n, false),
      renderCloze(item.fields.prompt, n, true),
    ]);
    add('prompt', variants.flatMap(markupErrors));
  } else {
    if (!item.fields.answer.trim()) add('answer', ['The answer is empty.']);
    add('prompt', markupErrors(item.fields.prompt));
  }

  for (const field of FIELDS) {
    if (field === 'prompt') continue;
    const value = item.fields[field];
    if (value) add(field, markupErrors(value));
  }
  return errors;
}

/** Card-quality hints (minimum information principle). Advisory, never blocking. */
export function qualityWarnings(item: { type: ItemType; fields: ItemFields }): string[] {
  const warnings: string[] = [];
  const answer = item.type === 'basic' ? item.fields.answer : '';
  if (answer.length > 280) {
    warnings.push('Long answer — consider splitting it into several atomic items or using cloze.');
  }
  const listItems = answer.split('\n').filter((l) => /^\s*([-*]|\d+[.)])\s+/.test(l)).length;
  if (listItems > 4) {
    warnings.push('The answer is a long list. Enumerations are hard to recall — split them up.');
  }
  if (item.type === 'cloze' && clozeOrdinals(item.fields.prompt).length > 4) {
    warnings.push('Many deletions in one item — each becomes a card; consider splitting.');
  }
  return warnings;
}
