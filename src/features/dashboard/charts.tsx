/**
 * Small hand-built charts. Single-series columns (no legend; the title names it) and a stacked
 * maturity bar (ordinal ramp + legend). Every chart has a screen-reader table.
 */
import { useState } from 'react';
import type { Maturity } from '../../domain/stats';
import { cn } from '../../ui/cn';

const DAY_LABEL = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

/** Column path with a 4px rounded top and a square base. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function ForecastChart({ counts, start }: { counts: number[]; start: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const height = 132;
  const top = 18;
  const baseline = height - 20;
  const slot = width / counts.length;
  const barW = Math.min(24, slot - 6);
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(...counts));
  const labelFor = (i: number) =>
    i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_LABEL.format(new Date(start + i * 86_400_000));

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Reviews due over the next ${counts.length} days. Today: ${counts[0] ?? 0}. Busiest day: ${labelFor(peak)} with ${counts[peak] ?? 0}.`}
        onMouseLeave={() => setHover(null)}
      >
        <line
          x1={0}
          x2={width}
          y1={baseline}
          y2={baseline}
          className="stroke-line"
          strokeWidth={1}
        />
        {counts.map((c, i) => {
          const h = c === 0 ? 0 : Math.max(2, ((baseline - top) * c) / max);
          const x = i * slot + (slot - barW) / 2;
          const showLabel = hover === i || (hover === null && (i === 0 || i === peak) && c > 0);
          const key = `${start}-${i}`;
          return (
            <g key={key}>
              {/* Hit target spans the whole slot, larger than the mark. */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: hover tooltip only; the same data is in the table below */}
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              >
                <title>{`${labelFor(i)}: ${c} due`}</title>
              </rect>
              {h > 0 && (
                <path
                  d={columnPath(x, baseline - h, barW, h)}
                  className={cn(
                    'fill-chart-bar transition-opacity',
                    hover !== null && hover !== i && 'opacity-40',
                  )}
                  pointerEvents="none"
                />
              )}
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={baseline - h - 5}
                  textAnchor="middle"
                  className="fill-fg text-[11px] font-medium tabular-nums"
                  pointerEvents="none"
                >
                  {c}
                </text>
              )}
              {(i === 0 || i % 2 === 0 || hover === i) && (
                <text
                  x={i * slot + slot / 2}
                  y={height - 5}
                  textAnchor="middle"
                  className={cn('text-[10px]', hover === i ? 'fill-fg' : 'fill-muted')}
                  pointerEvents="none"
                >
                  {i === 0
                    ? 'Today'
                    : DAY_LABEL.format(new Date(start + i * 86_400_000)).slice(0, 2)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Reviews due per day</caption>
        <tbody>
          {counts.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: one row per day offset
            <tr key={i}>
              <th scope="row">{labelFor(i)}</th>
              <td>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const SEGMENTS: { key: keyof Omit<Maturity, 'suspended'>; label: string; className: string }[] = [
  { key: 'new', label: 'New', className: 'bg-surface-2' },
  { key: 'learning', label: 'Learning', className: 'bg-mat-1' },
  { key: 'young', label: 'Young', className: 'bg-mat-2' },
  { key: 'mature', label: 'Mature (≥ 21 d)', className: 'bg-mat-3' },
];

export function MaturityBar({ m, showLegend = true }: { m: Maturity; showLegend?: boolean }) {
  const total = m.new + m.learning + m.young + m.mature;
  if (total === 0) return null;
  const visible = SEGMENTS.filter((s) => m[s.key] > 0);
  return (
    <div>
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
      {showLegend && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className={cn('size-2 rounded-sm border border-line', s.className)}
                aria-hidden
              />
              {s.label} <span className="tabular-nums text-fg">{m[s.key]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
