import { describe, expect, it } from 'vitest';
import { makeItem } from '../../test/factories';
import { cardFaces, isExactMatch, normalizeAnswer } from './answer';

describe('cardFaces', () => {
  it('swaps prompt and answer for reverse cards', () => {
    const item = makeItem({
      fields: { prompt: 'Name?', answer: 'Formula' },
      options: { reverse: true },
    });
    expect(cardFaces(item, { key: 'fwd' })).toMatchObject({
      prompt: 'Name?',
      answer: 'Formula',
      isReverse: false,
    });
    expect(cardFaces(item, { key: 'rev' })).toMatchObject({
      prompt: 'Formula',
      answer: 'Name?',
      isReverse: true,
    });
  });

  it('expects the active cloze content', () => {
    const item = makeItem({
      type: 'cloze',
      fields: { prompt: '$\\int u\\,dv = {{c1::uv}} - {{c2::\\int v\\,du}}$', answer: 'IBP' },
    });
    expect(cardFaces(item, { key: 'c2' })).toMatchObject({
      clozeOrdinal: 2,
      expected: '\\int v\\,du',
      answer: 'IBP',
    });
  });
});

describe('typed answer matching', () => {
  it.each([
    ['$\\dfrac{1}{2}$', '\\frac12'],
    ['\\frac{1}{\\sqrt{1-x^2}}', '\\frac{1}{\\sqrt{1 - x^{2}}}'],
    ['\\ln|x| + C', '\\ln|x|'],
    ['\\left(x+1\\right)^2', '(x + 1)^2'],
    ['Integration by Parts.', 'integration by parts'],
    ['a \\cdot b', 'a*b'],
  ])('%s ≈ %s', (a, b) => {
    expect(isExactMatch(a, b)).toBe(true);
  });

  it('does not match different answers or empty input', () => {
    expect(isExactMatch('\\frac{1}{\\sqrt{1+x^2}}', '\\frac{1}{\\sqrt{1-x^2}}')).toBe(false);
    expect(isExactMatch('', '')).toBe(false);
    expect(isExactMatch('\\Delta', '\\delta')).toBe(false); // LaTeX stays case-sensitive
  });

  it('normalises whitespace and spacing commands', () => {
    expect(normalizeAnswer('x \\, dx')).toBe('xdx');
  });
});
