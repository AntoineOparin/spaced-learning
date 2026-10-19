/** KaTeX configuration and a small render cache. */
import katex, { type KatexOptions } from 'katex';
import { errorMessage } from '../lib/errors';

export const KATEX_MACROS: Record<string, string> = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\dd': '\\mathop{}\\!\\mathrm{d}',
};

function options(display: boolean): KatexOptions {
  return {
    displayMode: display,
    throwOnError: true,
    output: 'htmlAndMathml', // MathML for screen readers
    // Only \htmlClass is trusted (used for cloze highlighting); no URLs, ids or styles.
    trust: (context) => context.command === '\\htmlClass',
    strict: 'ignore',
    macros: { ...KATEX_MACROS }, // fresh copy: KaTeX mutates the macros object
    maxSize: 20,
    maxExpand: 500,
  };
}

export type MathResult = { ok: true; html: string } | { ok: false; error: string };

const CACHE_LIMIT = 1000;
const cache = new Map<string, MathResult>();

export function renderMath(tex: string, display: boolean): MathResult {
  const key = `${display ? 'D' : 'I'}${tex}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let result: MathResult;
  try {
    result = { ok: true, html: katex.renderToString(tex, options(display)) };
  } catch (err) {
    const message = errorMessage(err);
    result = { ok: false, error: message.replace(/^KaTeX parse error: /, '') };
  }
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, result);
  return result;
}
