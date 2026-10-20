import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('lets a later class override a conflicting earlier one', () => {
    // A pressed toggle restyles a secondary button.
    expect(
      cn(
        'tactile border-2 border-line-strong bg-bg text-fg',
        'border-accent bg-accent-soft text-accent-text',
      ),
    ).toBe('tactile border-2 border-accent bg-accent-soft text-accent-text');
    // A narrow input overrides the control's full width and type size.
    expect(cn('w-full rounded-[10px] text-base sm:text-[15px]', 'w-40 font-mono text-sm')).toBe(
      'rounded-[10px] sm:text-[15px] w-40 font-mono text-sm',
    );
    expect(cn('animate-rise transition-opacity', 'animate-none opacity-0')).toBe(
      'transition-opacity animate-none opacity-0',
    );
  });

  it('keeps classes that only look alike', () => {
    expect(cn('text-fg', 'text-[15px]')).toBe('text-fg text-[15px]'); // colour vs size
    expect(cn('rounded-xl bg-fg shadow-pop', 'text-bg')).toBe(
      'rounded-xl bg-fg shadow-pop text-bg',
    );
    expect(cn('tactile', false, undefined, 'mt-2')).toBe('tactile mt-2');
  });
});
