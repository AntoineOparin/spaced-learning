// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RichText } from './RichText';

afterEach(cleanup);

describe('RichText', () => {
  it('renders math with KaTeX including MathML for screen readers', () => {
    const { container } = render(<RichText source="Area: $\pi r^2$" />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.querySelector('math')).not.toBeNull();
  });

  it('shows a readable fallback for invalid LaTeX instead of crashing', () => {
    const { container } = render(<RichText source="$\frac{1}{$" />);
    const err = container.querySelector('.math-error');
    expect(err?.textContent).toBe('$\\frac{1}{$');
    expect(err?.getAttribute('title')).toBeTruthy();
  });

  it('blanks the active math cloze and highlights it on reveal', () => {
    const source = '$\\sin^2 x + {{c1::\\cos^2 x}} = 1$';
    const blank = render(<RichText source={source} cloze={{ ordinal: 1, reveal: false }} />);
    expect(blank.container.querySelector('.cloze-blank')).not.toBeNull();
    expect(blank.container.textContent).not.toContain('cos');
    cleanup();
    const shown = render(<RichText source={source} cloze={{ ordinal: 1, reveal: true }} />);
    expect(shown.container.querySelector('.cloze-answer')?.textContent).toContain('cos');
  });

  it('never injects raw HTML from content', () => {
    const { container } = render(<RichText source={'<img src=x onerror="alert(1)"> **b**'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
    expect(container.querySelector('strong')?.textContent).toBe('b');
  });

  it('places display math in a div, not inside a <p>', () => {
    const { container } = render(<RichText source={'Text\n$$x^2$$'} />);
    expect(container.querySelector('p .math-display')).toBeNull();
    expect(container.querySelector('div .math-display, div.math-display')).not.toBeNull();
  });
});
