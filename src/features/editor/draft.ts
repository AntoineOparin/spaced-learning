/** Pure helpers for the item form. */
import type { ItemFields } from '../../domain/types';

export const EMPTY_FIELDS: ItemFields = {
  prompt: '',
  answer: '',
  explanation: '',
  mnemonic: '',
  source: '',
};

/** Trims every field and drops the optional ones that end up blank. */
export function cleanFields(f: ItemFields): ItemFields {
  const out: ItemFields = { prompt: f.prompt.trim(), answer: f.answer.trim() };
  for (const key of ['explanation', 'mnemonic', 'source'] as const) {
    const v = f[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}

/** "Formula, exam-1,formula" → ['formula', 'exam-1']. */
export function parseTags(s: string): string[] {
  return [
    ...new Set(
      s
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

/**
 * Inserts a snippet at the selection. `|` marks where the caret lands; when text is selected
 * it is wrapped there instead. Returns the new value and caret position.
 */
export function insertSnippet(
  value: string,
  start: number,
  end: number,
  snippet: string,
): { value: string; caret: number } {
  const selected = value.slice(start, end);
  const marker = snippet.indexOf('|');
  const text = selected && marker >= 0 ? snippet.replace('|', selected) : snippet.replace('|', '');
  return {
    value: value.slice(0, start) + text + value.slice(end),
    caret: start + (marker >= 0 ? marker + (selected ? selected.length : 0) : text.length),
  };
}
