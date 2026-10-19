import { describe, expect, it } from 'vitest';
import { renderCloze } from '../domain/cloze';
import { mathTokens, parseMarkup } from './markup';
import { itemErrors, markupErrors, qualityWarnings } from './validate';

describe('parseMarkup', () => {
  it('splits paragraphs and line breaks', () => {
    expect(parseMarkup('a\nb\n\nc')).toEqual([
      { t: 'p', c: [{ t: 'text', v: 'a' }, { t: 'br' }, { t: 'text', v: 'b' }] },
      { t: 'p', c: [{ t: 'text', v: 'c' }] },
    ]);
  });

  it('parses inline and display math without touching LaTeX content', () => {
    const blocks = parseMarkup('Let $x_1 * y_2$ be\n$$\\int_0^1 f(x)\\,dx$$\nthen');
    expect(blocks).toEqual([
      {
        t: 'p',
        c: [
          { t: 'text', v: 'Let ' },
          { t: 'math', tex: 'x_1 * y_2', display: false },
          { t: 'text', v: ' be' },
          { t: 'math', tex: '\\int_0^1 f(x)\\,dx', display: true },
          { t: 'text', v: 'then' },
        ],
      },
    ]);
  });

  it('supports bold, italic, code and escapes', () => {
    expect(parseMarkup('**bold** *it* `x*y` \\$5 \\*not\\*')[0]).toEqual({
      t: 'p',
      c: [
        { t: 'strong', c: [{ t: 'text', v: 'bold' }] },
        { t: 'text', v: ' ' },
        { t: 'em', c: [{ t: 'text', v: 'it' }] },
        { t: 'text', v: ' ' },
        { t: 'code', v: 'x*y' },
        { t: 'text', v: ' $5 *not*' },
      ],
    });
  });

  it('does not treat a lone asterisk (multiplication) as emphasis', () => {
    expect(parseMarkup('2 * 3 = 6')[0]).toEqual({ t: 'p', c: [{ t: 'text', v: '2 * 3 = 6' }] });
  });

  it('treats unmatched dollars as text', () => {
    expect(parseMarkup('costs $5 today')[0]).toEqual({
      t: 'p',
      c: [{ t: 'text', v: 'costs $5 today' }],
    });
  });

  it('parses bullet and numbered lists with continuation lines', () => {
    expect(parseMarkup('- one $a$\n- two\n  more\n\n1. first\n2. second')).toEqual([
      {
        t: 'ul',
        items: [
          [
            { t: 'text', v: 'one ' },
            { t: 'math', tex: 'a', display: false },
          ],
          [{ t: 'text', v: 'two' }, { t: 'br' }, { t: 'text', v: 'more' }],
        ],
      },
      { t: 'ol', items: [[{ t: 'text', v: 'first' }], [{ t: 'text', v: 'second' }]] },
    ]);
  });

  it('turns cloze markers into cloze nodes, including math inside them', () => {
    const blank = parseMarkup(renderCloze('The {{c1::chain rule::rule}} says', 1, false));
    expect(blank[0]).toEqual({
      t: 'p',
      c: [
        { t: 'text', v: 'The ' },
        { t: 'clozeBlank', c: [{ t: 'text', v: 'rule' }] },
        { t: 'text', v: ' says' },
      ],
    });
    const answer = parseMarkup(renderCloze('So {{c1::$x^2$}}.', 1, true));
    expect(answer[0]).toEqual({
      t: 'p',
      c: [
        { t: 'text', v: 'So ' },
        { t: 'clozeAnswer', c: [{ t: 'math', tex: 'x^2', display: false }] },
        { t: 'text', v: '.' },
      ],
    });
  });

  it('extracts math tokens', () => {
    expect(mathTokens('$a$ and $$b$$ and \\$c')).toEqual([
      { tex: 'a', display: false },
      { tex: 'b', display: true },
    ]);
  });
});

describe('validation', () => {
  it('reports KaTeX errors', () => {
    expect(markupErrors('$\\frac{1}{2}$')).toEqual([]);
    expect(markupErrors('$\\frac{1}{$')).toHaveLength(1);
    expect(markupErrors('$\\notacommand$')[0]).toMatch(/Undefined control sequence/);
  });

  it('validates cloze items in both blanked and revealed form', () => {
    const ok = itemErrors({
      type: 'cloze',
      fields: { prompt: '$\\int u\\,dv = {{c1::uv}} - \\int v\\,du$', answer: '' },
    });
    expect(ok).toEqual([]);
    const none = itemErrors({ type: 'cloze', fields: { prompt: 'no deletions', answer: '' } });
    expect(none[0]?.message).toMatch(/at least one deletion/);
  });

  it('requires prompt and answer for basic items and checks every field', () => {
    const errors = itemErrors({
      type: 'basic',
      fields: { prompt: '', answer: '', explanation: '$\\bad$' },
    });
    expect(errors.map((e) => e.field)).toEqual(['prompt', 'answer', 'explanation']);
  });

  it('warns about overloaded answers', () => {
    const answer = Array.from({ length: 6 }, (_, i) => `- item ${i}`).join('\n');
    expect(qualityWarnings({ type: 'basic', fields: { prompt: 'q', answer } })).toHaveLength(1);
  });
});
