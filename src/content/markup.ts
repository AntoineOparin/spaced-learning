/**
 * "Markdown-lite + LaTeX" parser producing a small AST (no HTML is ever passed through).
 *
 * Supported: paragraphs (blank line), line breaks, `- ` / `1. ` lists, **bold**, *italic*,
 * `code`, $inline math$, $$display math$$, escapes (\$ \* \` \\ \_), and the cloze markers
 * emitted by `renderCloze`.
 */
import {
  CLOZE_ANSWER_CLOSE,
  CLOZE_ANSWER_OPEN,
  CLOZE_BLANK_CLOSE,
  CLOZE_BLANK_OPEN,
} from '../domain/cloze';

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'math'; tex: string; display: boolean }
  | { t: 'br' }
  | { t: 'clozeBlank'; c: Inline[] }
  | { t: 'clozeAnswer'; c: Inline[] };

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] };

const MATH_OPEN = '';
const MATH_CLOSE = '';
const ESCAPABLE = '\\$*`_';

interface MathToken {
  tex: string;
  display: boolean;
}

/** Index of the closing delimiter starting the search at `from`, skipping backslash escapes. */
function findDelimiter(src: string, from: number, delim: string): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') {
      i++;
      continue;
    }
    if (src.startsWith(delim, i)) return i;
  }
  return -1;
}

/** Replaces math with placeholders so block/inline parsing never looks inside LaTeX. */
function extractMath(src: string): { text: string; math: MathToken[] } {
  const math: MathToken[] = [];
  let text = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < src.length) {
      text += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '$') {
      const display = src[i + 1] === '$';
      const open = display ? 2 : 1;
      const end = findDelimiter(src, i + open, display ? '$$' : '$');
      const tex = end === -1 ? '' : src.slice(i + open, end);
      // Inline math may not span a blank line; empty math is not math.
      if (end !== -1 && tex.trim() && (display || !/\n\s*\n/.test(tex))) {
        text += `${MATH_OPEN}${math.length}${MATH_CLOSE}`;
        math.push({ tex: tex.trim(), display });
        i = end + open;
        continue;
      }
    }
    text += ch;
    i++;
  }
  return { text, math };
}

function restoreMath(s: string, math: MathToken[]): string {
  return s.replace(new RegExp(`${MATH_OPEN}(\\d+)${MATH_CLOSE}`, 'g'), (_, n: string) => {
    const m = math[Number(n)];
    if (!m) return '';
    return m.display ? `$$${m.tex}$$` : `$${m.tex}$`;
  });
}

function isSpace(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

/** Finds `closer` (not escaped, preceded by non-space) after `from`. */
function findCloser(s: string, from: number, closer: string): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') {
      i++;
      continue;
    }
    if (s.startsWith(closer, i) && !isSpace(s[i - 1])) {
      if (closer === '*' && (s[i + 1] === '*' || s[i - 1] === '*')) continue;
      return i;
    }
  }
  return -1;
}

/** Matching close marker, allowing nesting of the same marker pair. */
function findMarkerEnd(s: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function parseInline(s: string, math: MathToken[]): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf });
    buf = '';
  };

  let i = 0;
  while (i < s.length) {
    const ch = s[i] as string;
    const next = s[i + 1];

    if (ch === '\\' && next !== undefined && ESCAPABLE.includes(next)) {
      buf += next;
      i += 2;
      continue;
    }
    if (ch === '\n') {
      flush();
      out.push({ t: 'br' });
      i++;
      continue;
    }
    if (ch === MATH_OPEN) {
      const end = s.indexOf(MATH_CLOSE, i);
      const token = math[Number(s.slice(i + 1, end))];
      flush();
      if (token) out.push({ t: 'math', tex: token.tex, display: token.display });
      i = end + 1;
      continue;
    }
    if (ch === CLOZE_BLANK_OPEN || ch === CLOZE_ANSWER_OPEN) {
      const close = ch === CLOZE_BLANK_OPEN ? CLOZE_BLANK_CLOSE : CLOZE_ANSWER_CLOSE;
      const end = findMarkerEnd(s, i + 1, ch, close);
      if (end !== -1) {
        flush();
        const c = parseInline(s.slice(i + 1, end), math);
        out.push(ch === CLOZE_BLANK_OPEN ? { t: 'clozeBlank', c } : { t: 'clozeAnswer', c });
        i = end + 1;
        continue;
      }
    }
    if (ch === '`') {
      const end = s.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: 'code', v: restoreMath(s.slice(i + 1, end), math) });
        i = end + 1;
        continue;
      }
    }
    if (ch === '*' && next === '*' && !isSpace(s[i + 2])) {
      const end = findCloser(s, i + 2, '**');
      if (end !== -1) {
        flush();
        out.push({ t: 'strong', c: parseInline(s.slice(i + 2, end), math) });
        i = end + 2;
        continue;
      }
    }
    if (ch === '*' && next !== '*' && !isSpace(next)) {
      const end = findCloser(s, i + 1, '*');
      if (end !== -1) {
        flush();
        out.push({ t: 'em', c: parseInline(s.slice(i + 1, end), math) });
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();

  // Line breaks around display math are redundant (display math is already block-level).
  return out.filter((node, idx) => {
    if (node.t !== 'br') return true;
    const prev = out[idx - 1];
    const nxt = out[idx + 1];
    const isDisplay = (n: Inline | undefined) => n?.t === 'math' && n.display;
    return !isDisplay(prev) && !isDisplay(nxt);
  });
}

const UL_RE = /^\s*[-*]\s+/;
const OL_RE = /^\s*\d+[.)]\s+/;

function parseBlock(block: string, math: MathToken[]): Block {
  const lines = block.split('\n');
  const first = lines[0] ?? '';
  const listRe = UL_RE.test(first) ? UL_RE : OL_RE.test(first) ? OL_RE : null;
  if (!listRe) return { t: 'p', c: parseInline(block, math) };

  const items: string[] = [];
  for (const line of lines) {
    if (listRe.test(line)) items.push(line.replace(listRe, ''));
    else if (items.length) items[items.length - 1] += `\n${line.trim()}`;
  }
  const parsed = items.map((it) => parseInline(it, math));
  return listRe === UL_RE ? { t: 'ul', items: parsed } : { t: 'ol', items: parsed };
}

export function parseMarkup(src: string): Block[] {
  const { text, math } = extractMath(src.replace(/\r\n?/g, '\n'));
  return text
    .split(/\n[ \t]*\n/)
    .map((b) => b.replace(/^\n+|\n+$/g, ''))
    .filter((b) => b.trim() !== '')
    .map((b) => parseBlock(b, math));
}

/** All math expressions in a source string (for validation). */
export function mathTokens(src: string): MathToken[] {
  return extractMath(src).math;
}
