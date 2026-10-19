/**
 * Small hand-built charts. Single-series columns (no legend; the title names it) and a stacked
 * maturity bar (ordinal green ramp + legend). Every chart has a screen-reader table.
 */
import {
  type KeyboardEvent,
  type PointerEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DAY } from '../../domain/day';
import type { Maturity } from '../../domain/stats';
import { cn } from '../../ui/cn';
import { type AxisDay, axisLabels } from './axis';

const SHORT = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const NARROW = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
const FULL_DATE = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

/** Column path with a 4px rounded top and a square base. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Tracks an element's width so SVG text renders at its real size instead of scaling. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width) || fallback);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

let canvas: CanvasRenderingContext2D | null | undefined;
/** Rendered width of an axis label in the page font (an estimate where canvas is missing). */
function measureLabel(text: string, bold: boolean, family: string): number {
  if (canvas === undefined) canvas = document.createElement('canvas').getContext('2d');
  if (!canvas) return text.length * (bold ? 7 : 6.5);
  canvas.font = `${bold ? 700 : 500} 11px ${family}`;
  return canvas.measureText(text).width;
}

export function ForecastChart({ counts, start }: { counts: number[]; start: number }) {
  const [active, setActive] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLElement>(560);
  // A readout band above the columns holds the tooltip, so it never covers data.
  const readout = 46;
  const height = 176;
  const top = readout + 6;
  const baseline = height - 26;
  const slot = width / counts.length;
  const barW = Math.max(6, Math.min(24, slot * 0.6));
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(...counts));
  const dates = useMemo(() => counts.map((_, i) => new Date(start + i * DAY)), [counts, start]);
  const nameFor = (i: number) =>
    i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : FULL_DATE.format(dates[i]);

  // Label text and fit only change with the days or the width, not on hover.
  const [family, setFamily] = useState('system-ui');
  useLayoutEffect(() => {
    if (ref.current) setFamily(getComputedStyle(ref.current).fontFamily);
  }, [ref]);
  const labels = useMemo(() => {
    const days: AxisDay[] = dates.map((d, i) => ({
      short: SHORT.format(d),
      narrow: NARROW.format(d),
      isToday: i === 0,
    }));
    return axisLabels(days, slot, (text, bold) => measureLabel(text, bold, family));
  }, [dates, slot, family]);

  const columnAt = (clientX: number, el: Element) => {
    const x = clientX - el.getBoundingClientRect().left;
    return Math.min(counts.length - 1, Math.max(0, Math.floor(x / slot)));
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'touch') setActive(columnAt(e.clientX, e.currentTarget));
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    // Touch has no hover: a tap shows the column, tapping it again hides it.
    if (e.pointerType !== 'touch') return;
    const i = columnAt(e.clientX, e.currentTarget);
    setActive((a) => (a === i ? null : i));
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const last = counts.length - 1;
    const cur = active ?? -1;
    const next = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: last }[e.key];
    if (e.key === 'Escape') setActive(null);
    if (next === undefined) return;
    e.preventDefault();
    setActive(Math.min(last, Math.max(0, next)));
  };

  const heightOf = (c: number) => (c === 0 ? 0 : Math.max(2, ((baseline - top) * c) / max));
  // Direct value labels sit just above a column; the tallest one reaches into the readout band.
  const centerOf = (i: number) => i * slot + slot / 2;
  const activeCount = active === null ? 0 : (counts[active] ?? 0);

  return (
    <figure ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block max-w-full touch-manipulation rounded-lg focus-visible:outline-offset-4"
        role="img"
        aria-label={`Reviews due over the next ${counts.length} days. Today: ${counts[0] ?? 0}. Busiest day: ${nameFor(peak)} with ${counts[peak] ?? 0}. Use the arrow keys to read each day.`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys show each day's tooltip; the table below has the same data
        tabIndex={0}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerLeave={(e) => e.pointerType !== 'touch' && setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {/* The active day's column is highlighted, which also marks days with nothing due. */}
        {active !== null && (
          <rect
            x={active * slot + 1}
            y={top - 6}
            width={slot - 2}
            height={baseline - top + 6}
            rx={6}
            className="fill-surface"
          />
        )}
        <line
          x1={0}
          x2={width}
          y1={baseline}
          y2={baseline}
          className="stroke-line"
          strokeWidth={1}
        />
        {counts.map((c, i) => {
          const h = heightOf(c);
          const x = centerOf(i) - barW / 2;
          // Direct labels only for today and the busiest day; the tooltip covers the rest.
          const showValue = active === null && (i === 0 || i === peak) && c > 0;
          const label = labels[i];
          const key = `${start}-${i}`;
          return (
            <g key={key}>
              {h > 0 && (
                <path
                  d={columnPath(x, baseline - h, barW, h)}
                  className={cn(
                    'fill-chart-bar transition-opacity duration-150',
                    active !== null && active !== i && 'opacity-35',
                  )}
                />
              )}
              {showValue && (
                <text
                  x={centerOf(i)}
                  y={baseline - h - 7}
                  textAnchor="middle"
                  className="fill-fg text-[12px] font-bold tabular-nums"
                >
                  {c}
                </text>
              )}
              {label && (
                <text
                  x={centerOf(i)}
                  y={height - 8}
                  textAnchor="middle"
                  className={cn(
                    'text-[11px]',
                    i === 0 ? 'fill-fg font-bold' : 'fill-muted font-medium',
                    active === i && 'fill-fg',
                  )}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {active !== null && (
        // Value first, then the day; kept inside the chart's edges.
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 animate-fade rounded-lg bg-fg px-2.5 py-1.5 text-center whitespace-nowrap text-bg shadow-pop"
          style={{
            left: Math.min(Math.max(centerOf(active), 56), width - 56),
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-sm font-bold tabular-nums">
            {activeCount} {activeCount === 1 ? 'review' : 'reviews'}
          </div>
          <div className="text-[11px] opacity-75">{nameFor(active)}</div>
        </div>
      )}

      {/* Hide a wrapper, not the table: tables treat height: 1px as a minimum and grow. */}
      <div className="sr-only">
        <table>
          <caption>Reviews due per day</caption>
          <tbody>
            {counts.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one row per day offset
              <tr key={i}>
                <th scope="row">{nameFor(i)}</th>
                <td>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

const SEGMENTS: { key: keyof Omit<Maturity, 'suspended'>; label: string; className: string }[] = [
  { key: 'learning', label: 'Learning', className: 'bg-mat-1' },
  { key: 'young', label: 'Young', className: 'bg-mat-2' },
  { key: 'mature', label: 'Mature (≥ 21 d)', className: 'bg-mat-3' },
  { key: 'new', label: 'New', className: 'bg-line-strong' },
];

export function MaturityBar({ m }: { m: Maturity }) {
  const total = m.new + m.learning + m.young + m.mature;
  if (total === 0) return null;
  const visible = SEGMENTS.filter((s) => m[s.key] > 0);
  return (
    <div
      className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full"
      role="img"
      aria-label={SEGMENTS.map((s) => `${s.label}: ${m[s.key]}`).join(', ')}
    >
      {visible.map((s) => (
        <div
          key={s.key}
          className={cn('h-full first:rounded-l-full last:rounded-r-full', s.className)}
          style={{ width: `${(m[s.key] / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

/** One shared legend for a list of maturity bars. */
export function MaturityLegend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {SEGMENTS.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={cn('size-2 rounded-full', s.className)} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
