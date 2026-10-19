/**
 * Day labels for a column chart's x-axis. Labels are centred under their columns, so a set
 * only fits when no label is wider than its own column and neighbours keep a small gap.
 * The most descriptive set that fits wins; nothing is ever clipped or overlapped.
 */

/** Minimum space between neighbouring labels, in px. */
export const LABEL_GAP = 4;

export interface AxisDay {
  /** The weekday in each available length, e.g. "Monday" → { short: "Mon", narrow: "M" }. */
  short: string;
  narrow: string;
  isToday: boolean;
}

/** `measure(text, bold)` returns a label's rendered width in px. */
export type Measure = (text: string, bold: boolean) => number;

function fits(labels: (string | null)[], days: AxisDay[], slot: number, measure: Measure) {
  let prev: { i: number; w: number } | null = null;
  for (let i = 0; i < labels.length; i++) {
    const text = labels[i];
    if (text == null) continue;
    const w = measure(text, days[i]?.isToday ?? false);
    if (w > slot) return false; // wider than its own column: would clip at the edges
    if (prev && (prev.w + w) / 2 + LABEL_GAP > slot * (i - prev.i)) return false;
    prev = { i, w };
  }
  return true;
}

export function axisLabels(days: AxisDay[], slot: number, measure: Measure): (string | null)[] {
  const candidates: (string | null)[][] = [
    days.map((d) => (d.isToday ? 'Today' : d.short)),
    days.map((d) => d.short),
    days.map((d) => d.narrow),
  ];
  for (const labels of candidates) if (fits(labels, days, slot, measure)) return labels;
  // Extremely narrow: every other initial, always keeping the first column.
  return days.map((d, i) => (i % 2 === 0 ? d.narrow : null));
}
