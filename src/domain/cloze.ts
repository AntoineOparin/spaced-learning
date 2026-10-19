/**
 * Anki-compatible cloze deletions: `{{c1::hidden}}` or `{{c1::hidden::hint}}`.
 *
 * Clozes may sit in text or inside math (`$\int u\,dv = {{c1::uv}} - \int v\,du$`). Cloze bodies
 * are scanned with brace counting, so `{{c1::\frac{1}{2}}}` parses as `\frac{1}{2}`.
 *
 * `renderCloze` rewrites a field for display: inside math it emits KaTeX (`\htmlClass`), in
 * text it emits private-use marker characters that the markup parser turns into cloze nodes.
 */

export const CLOZE_BLANK_OPEN = '';
export const CLOZE_BLANK_CLOSE = '';
export const CLOZE_ANSWER_OPEN = '';
export const CLOZE_ANSWER_CLOSE = '';

export type ClozeSegment =
  | { kind: 'text'; text: string }
  | { kind: 'cloze'; ordinal: number; content: string; hint?: string; inMath: boolean };

const OPEN_RE = /^\{\{c(\d+)::/;

type MathMode = 'none' | 'inline' | 'display';

/** Finds the end of a cloze body starting at `start`; returns the index of the closing `}}`. */
function findClozeEnd(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      i++; // skip escaped char (e.g. \{ \} \$)
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      if (depth === 0) {
        return src[i + 1] === '}' ? i : -1;
      }
      depth--;
    }
  }
  return -1;
}

/** Splits a cloze body into content and optional hint at the first top-level `::`. */
function splitHint(body: string): { content: string; hint?: string } {
  let depth = 0;
  for (let i = 0; i < body.length - 1; i++) {
    const ch = body[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === ':' && body[i + 1] === ':' && depth === 0) {
      return { content: body.slice(0, i), hint: body.slice(i + 2) };
    }
  }
  return { content: body };
}

export function parseCloze(src: string): ClozeSegment[] {
  const segments: ClozeSegment[] = [];
  let mode: MathMode = 'none';
  let text = '';
  let i = 0;

  const flush = () => {
    if (text) segments.push({ kind: 'text', text });
    text = '';
  };

  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      text += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '$') {
      if (src[i + 1] === '$' && mode !== 'inline') {
        mode = mode === 'display' ? 'none' : 'display';
        text += '$$';
        i += 2;
        continue;
      }
      if (mode !== 'display') {
        mode = mode === 'inline' ? 'none' : 'inline';
      }
      text += '$';
      i++;
      continue;
    }
    if (ch === '{') {
      const m = OPEN_RE.exec(src.slice(i, i + 12));
      if (m) {
        const bodyStart = i + m[0].length;
        const end = findClozeEnd(src, bodyStart);
        if (end !== -1) {
          flush();
          const { content, hint } = splitHint(src.slice(bodyStart, end));
          const segment: ClozeSegment = {
            kind: 'cloze',
            ordinal: Number(m[1]),
            content,
            inMath: mode !== 'none',
          };
          if (hint !== undefined) segment.hint = hint;
          segments.push(segment);
          i = end + 2;
          continue;
        }
      }
    }
    text += ch;
    i++;
  }
  flush();
  return segments;
}

/** Distinct cloze ordinals in ascending order. */
export function clozeOrdinals(src: string): number[] {
  const set = new Set<number>();
  for (const seg of parseCloze(src)) {
    if (seg.kind === 'cloze') set.add(seg.ordinal);
  }
  return [...set].sort((a, b) => a - b);
}

/** Replaces every cloze (including nested ones) with its content. */
export function stripCloze(src: string): string {
  return parseCloze(src)
    .map((seg) => (seg.kind === 'text' ? seg.text : stripCloze(seg.content)))
    .join('');
}

const TEXT_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '%': '\\%',
  '#': '\\#',
  _: '\\_',
  '^': '\\textasciicircum{}',
  '~': '\\textasciitilde{}',
};

function escapeLatexText(s: string): string {
  return s.replace(/[\\{}$&%#_^~]/g, (c) => TEXT_ESCAPES[c] ?? c);
}

/**
 * Rewrites a cloze field for display of the card with ordinal `active`.
 * Other clozes show their content; the active one is blanked (prompt) or highlighted (answer).
 */
export function renderCloze(src: string, active: number, reveal: boolean): string {
  return parseCloze(src)
    .map((seg) => {
      if (seg.kind === 'text') return seg.text;
      const content = stripCloze(seg.content);
      if (seg.ordinal !== active) return content;
      if (seg.inMath) {
        if (reveal) return `\\htmlClass{cloze-answer}{${content}}`;
        const inner = seg.hint ? `\\text{${escapeLatexText(seg.hint)}}` : '\\,?\\,';
        return `\\htmlClass{cloze-blank}{\\boxed{${inner}}}`;
      }
      if (reveal) return `${CLOZE_ANSWER_OPEN}${content}${CLOZE_ANSWER_CLOSE}`;
      return `${CLOZE_BLANK_OPEN}${seg.hint ?? ''}${CLOZE_BLANK_CLOSE}`;
    })
    .join('');
}
