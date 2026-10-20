import { describe, expect, it } from 'vitest';
import { type Point, strokeBounds, strokeEnd, strokePath, strokeSegment } from './sketch';

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

describe('strokeSegment / strokeEnd', () => {
  it('chain into exactly the full path, so live drawing matches the redraw', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 25.33, y: 3.07 },
    ];
    const live = (stroke: Point[]) => {
      const pieces: string[] = [];
      for (let n = 2; n <= stroke.length; n++) pieces.push(strokeSegment(stroke, n));
      pieces.push(strokeEnd(stroke));
      // Each piece starts where the previous one ended: drop the repeated move-to.
      return pieces.map((p, i) => (i === 0 ? p : p.replace(/^M[^LQ]*/, ''))).join('');
    };
    for (let len = 3; len <= pts.length; len++) {
      expect(live(pts.slice(0, len))).toBe(strokePath(pts.slice(0, len)));
    }
    // Two samples: the same straight line, drawn as two collinear halves.
    expect(live(pts.slice(0, 2))).toBe('M0 0L5 0L10 0');
    expect(strokePath(pts.slice(0, 2))).toBe('M0 0L10 0');
  });
});
