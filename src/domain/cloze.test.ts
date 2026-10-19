import { describe, expect, it } from 'vitest';
import {
  CLOZE_ANSWER_CLOSE,
  CLOZE_ANSWER_OPEN,
  CLOZE_BLANK_CLOSE,
  CLOZE_BLANK_OPEN,
  clozeOrdinals,
  parseCloze,
  renderCloze,
  stripCloze,
} from './cloze';

describe('parseCloze', () => {
  it('parses text clozes with and without hints', () => {
    expect(parseCloze('The {{c1::derivative::d/dx}} of {{c2::sin}} x')).toEqual([
      { kind: 'text', text: 'The ' },
      { kind: 'cloze', ordinal: 1, content: 'derivative', hint: 'd/dx', inMath: false },
      { kind: 'text', text: ' of ' },
      { kind: 'cloze', ordinal: 2, content: 'sin', inMath: false },
      { kind: 'text', text: ' x' },
    ]);
  });

  it('balances braces inside the cloze body', () => {
    const segs = parseCloze('$\\int_0^1 x\\,dx = {{c1::\\frac{1}{2}}}$');
    expect(segs[1]).toEqual({ kind: 'cloze', ordinal: 1, content: '\\frac{1}{2}', inMath: true });
    expect(segs[2]).toEqual({ kind: 'text', text: '$' });
  });

  it('handles superscripts ending right before the closing braces', () => {
    const segs = parseCloze('$e^{x} = {{c1::x^{2}}}$');
    expect(segs[1]).toMatchObject({ content: 'x^{2}', inMath: true });
  });

  it('tracks inline and display math, and escaped dollars', () => {
    const src = 'Costs \\$5 {{c1::a}} $x={{c2::1}}$ $$y={{c3::2}}$$ {{c4::b}}';
    const clozes = parseCloze(src).filter((s) => s.kind === 'cloze');
    expect(clozes.map((c) => (c.kind === 'cloze' ? c.inMath : null))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it('ignores escaped braces and does not treat a top-level :: inside braces as a hint', () => {
    const segs = parseCloze('{{c1::\\{a\\}}}');
    expect(segs[0]).toMatchObject({ content: '\\{a\\}' });
    const nested = parseCloze('{{c1::f{a::b}::hint}}');
    expect(nested[0]).toMatchObject({ content: 'f{a::b}', hint: 'hint' });
  });

  it('leaves malformed clozes as plain text', () => {
    expect(parseCloze('{{c1::never closed')).toEqual([
      { kind: 'text', text: '{{c1::never closed' },
    ]);
    expect(parseCloze('{{x::y}}')).toEqual([{ kind: 'text', text: '{{x::y}}' }]);
  });
});

describe('clozeOrdinals / stripCloze', () => {
  it('returns distinct sorted ordinals', () => {
    expect(clozeOrdinals('{{c2::a}} {{c1::b}} {{c2::c}} {{c10::d}}')).toEqual([1, 2, 10]);
    expect(clozeOrdinals('no clozes')).toEqual([]);
  });

  it('strips clozes including nested ones', () => {
    expect(stripCloze('A {{c1::b::hint}} {{c2::x {{c3::y}}}}')).toBe('A b x y');
  });
});

describe('renderCloze', () => {
  const src =
    '$\\sin^2 x + {{c1::\\cos^2 x}} = {{c2::1}}$ is the {{c3::Pythagorean::name}} identity';

  it('blanks only the active cloze in math with a boxed placeholder', () => {
    const out = renderCloze(src, 1, false);
    expect(out).toContain('\\htmlClass{cloze-blank}{\\boxed{\\,?\\,}}');
    expect(out).toContain('= 1$'); // other clozes show their content
    expect(out).toContain('the Pythagorean identity');
  });

  it('highlights the active math cloze on reveal', () => {
    expect(renderCloze(src, 1, true)).toContain('\\htmlClass{cloze-answer}{\\cos^2 x}');
  });

  it('uses marker characters for text clozes, with the hint as blank content', () => {
    expect(renderCloze(src, 3, false)).toContain(`the ${CLOZE_BLANK_OPEN}name${CLOZE_BLANK_CLOSE}`);
    expect(renderCloze(src, 3, true)).toContain(
      `${CLOZE_ANSWER_OPEN}Pythagorean${CLOZE_ANSWER_CLOSE}`,
    );
  });

  it('escapes hint text placed inside \\text{} in math', () => {
    const out = renderCloze('$x = {{c1::y::a_b {c}}}$', 1, false);
    expect(out).toContain('\\text{a\\_b \\{c\\}}');
  });
});
