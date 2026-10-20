/**
 * What a card asks and expects, plus a conservative "exact match" check for typed answers.
 * Typed answers are never auto-graded (symbolic equivalence is unreliable); a match is only a
 * hint shown next to the key before you rate yourself.
 */
import { clozeOrdinalFromKey } from '../../domain/cardgen';
import { parseCloze, stripCloze } from '../../domain/cloze';
import type { Card, Item } from '../../domain/types';

export interface CardFaces {
  /** Source rendered as the question. */
  prompt: string;
  /** Source rendered as the answer (for cloze: the extra field, may be empty). */
  answer: string;
  /** Cloze ordinal when this is a cloze card. */
  clozeOrdinal?: number;
  isReverse: boolean;
  /** What a typed answer is compared against. */
  expected: string;
}

export function cardFaces(item: Item, card: Pick<Card, 'key'>): CardFaces {
  const ordinal = clozeOrdinalFromKey(card.key);
  if (item.type === 'cloze' && ordinal !== null) {
    const expected = parseCloze(item.fields.prompt)
      .flatMap((s) => (s.kind === 'cloze' && s.ordinal === ordinal ? [stripCloze(s.content)] : []))
      .join(' / ');
    return {
      prompt: item.fields.prompt,
      answer: item.fields.answer,
      clozeOrdinal: ordinal,
      isReverse: false,
      expected,
    };
  }
  if (card.key === 'rev') {
    return {
      prompt: item.fields.answer,
      answer: item.fields.prompt,
      isReverse: true,
      expected: item.fields.prompt,
    };
  }
  return {
    prompt: item.fields.prompt,
    answer: item.fields.answer,
    isReverse: false,
    expected: item.fields.answer,
  };
}

/** Normalises formatting-only differences in text/LaTeX answers. */
export function normalizeAnswer(s: string): string {
  let out = s
    .replace(/\$/g, '')
    .replace(/\\(left|right|displaystyle|textstyle|big|Big|bigg|Bigg)\b/g, '')
    .replace(/\\[dt]frac/g, '\\frac')
    .replace(/\\[,;:! ]/g, '')
    .replace(/\\(cdot|times)\b/g, '*')
    .replace(/\s+/g, '')
    .replace(/\{(\w)\}/g, '$1')
    .replace(/\+C$/i, '')
    .replace(/[.。]+$/, '');
  if (!out.includes('\\')) out = out.toLowerCase();
  return out;
}

export function isExactMatch(typed: string, expected: string): boolean {
  const a = normalizeAnswer(typed);
  return a.length > 0 && a === normalizeAnswer(expected);
}
