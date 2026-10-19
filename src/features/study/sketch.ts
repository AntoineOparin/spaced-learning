/**
 * Geometry for hand-drawn answers. Strokes are smoothed with quadratic curves through the
 * midpoints of successive samples; the live canvas and the SVG preview share this path so a
 * drawing looks identical in both.
 */

export interface Point {
  x: number;
  y: number;
}
export type Stroke = Point[];

export const STROKE_WIDTH = 2.5;

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const fmt = (p: Point) => `${round(p.x)} ${round(p.y)}`;
const round = (n: number) => Math.round(n * 10) / 10;

/** SVG path data for one stroke (also usable with `new Path2D(d)`). */
export function strokePath(points: readonly Point[]): string {
  const [first, second] = points;
  if (!first) return '';
  // A tap is a dot: a near-zero segment drawn with round caps.
  if (!second) return `M${fmt(first)}l0.01 0`;
  if (points.length === 2) return `M${fmt(first)}L${fmt(second)}`;
  let d = `M${fmt(first)}L${fmt(mid(first, second))}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as Point;
    const next = points[i + 1] as Point;
    d += `Q${fmt(p)} ${fmt(mid(p, next))}`;
  }
  return `${d}L${fmt(points[points.length - 1] as Point)}`;
}

/** Bounding box of all strokes, or null when there is nothing drawn. */
export function strokeBounds(
  strokes: readonly Stroke[],
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes)
    for (const p of s) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
