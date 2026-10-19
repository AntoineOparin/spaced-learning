import { describe, expect, it } from 'vitest';
import { type AxisDay, axisLabels, type Measure } from './axis';

const WEEK: [string, string][] = [
  ['Sun', 'S'],
  ['Mon', 'M'],
  ['Tue', 'T'],
  ['Wed', 'W'],
  ['Thu', 'T'],
  ['Fri', 'F'],
  ['Sat', 'S'],
];
const days: AxisDay[] = Array.from({ length: 14 }, (_, i) => {
  const [short, narrow] = WEEK[i % 7] as [string, string];
  return { short, narrow, isToday: i === 0 };
});
// A monospace-ish stand-in: 6px per character, 7px when bold.
const measure: Measure = (text, bold) => text.length * (bold ? 7 : 6);

describe('axisLabels', () => {
  it('uses "Today" and weekday names when every label fits its column', () => {
    const labels = axisLabels(days, 40, measure);
    expect(labels.slice(0, 3)).toEqual(['Today', 'Mon', 'Tue']);
    expect(labels).toHaveLength(14);
  });

  it('uses the weekday for today when "Today" is wider than its column', () => {
    // Bold "Today" measures 35px: it fits a 36px column but would clip in a 32px one.
    expect(axisLabels(days, 36, measure)[0]).toBe('Today');
    expect(axisLabels(days, 32, measure)[0]).toBe('Sun');
  });

  it('rejects labels that would touch their neighbours', () => {
    const wide: Measure = (text) => (text.length === 3 ? 30 : 6);
    // 30px labels need 30 + 4px gap per column; at 33px they would collide.
    expect(axisLabels(days, 33, wide)[1]).toBe('M');
    expect(axisLabels(days, 34, wide)[1]).toBe('Mon');
  });

  it('falls back to initials on narrow columns, still labelling every day', () => {
    const labels = axisLabels(days, 20, measure);
    expect(labels).toEqual(days.map((d) => d.narrow));
    expect(labels.every((l) => l !== null)).toBe(true);
  });

  it('skips alternate days only when even initials cannot fit', () => {
    const labels = axisLabels(days, 8, measure);
    expect(labels[0]).toBe('S');
    expect(labels[1]).toBeNull();
    expect(labels[2]).toBe('T');
  });
});
