import { describe, expect, it } from 'vitest';
import { strokeBounds, strokePath } from './sketch';

describe('strokePath', () => {
  it('draws a tap as a dot and two samples as a line', () => {
    expect(strokePath([])).toBe('');
    expect(strokePath([{ x: 5, y: 5 }])).toBe('M5 5l0.01 0');
    expect(
      strokePath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe('M0 0L10 0');
  });

  it('smooths longer strokes through sample midpoints and ends on the last sample', () => {
    const d = strokePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
    ]);
    expect(d).toBe('M0 0L5 0Q10 0 10 5Q10 10 15 10L20 10');
  });

  it('rounds coordinates to keep paths compact', () => {
    expect(
      strokePath([
        { x: 1.234, y: 5.678 },
        { x: 2, y: 3 },
      ]),
    ).toBe('M1.2 5.7L2 3');
  });
});

describe('strokeBounds', () => {
  it('spans every point of every stroke', () => {
    expect(
      strokeBounds([
        [
          { x: 10, y: 20 },
          { x: 30, y: 5 },
        ],
        [{ x: -4, y: 40 }],
      ]),
    ).toEqual({ x: -4, y: 5, width: 34, height: 35 });
  });

  it('is null for an empty drawing', () => {
    expect(strokeBounds([])).toBeNull();
    expect(strokeBounds([[]])).toBeNull();
  });
});
