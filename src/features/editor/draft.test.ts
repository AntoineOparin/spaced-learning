import { describe, expect, it } from 'vitest';
import { cleanFields, insertSnippet, parseTags } from './draft';

describe('item draft helpers', () => {
  it('trims fields and drops blank optional ones', () => {
    expect(
      cleanFields({ prompt: ' q ', answer: 'a ', explanation: '  ', mnemonic: 'm', source: '' }),
    ).toEqual({ prompt: 'q', answer: 'a', mnemonic: 'm' });
  });

  it('parses tags lower-cased and without duplicates', () => {
    expect(parseTags('Formula, exam-1,formula, ,')).toEqual(['formula', 'exam-1']);
  });

  it('inserts a snippet at the caret or around the selection', () => {
    expect(insertSnippet('ab', 1, 1, '\\frac{|}{}')).toEqual({ value: 'a\\frac{}{}b', caret: 7 });
    expect(insertSnippet('x+y', 0, 3, '$|$')).toEqual({ value: '$x+y$', caret: 4 });
    expect(insertSnippet('ab', 2, 2, '\\pi')).toEqual({ value: 'ab\\pi', caret: 5 });
  });
});
