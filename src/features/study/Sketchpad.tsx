/**
 * A writing pad for answering by hand. Ink follows the pointer 1:1 from pointer-down,
 * using coalesced events for smooth curves; once a stylus is seen, touches are ignored
 * (palm rejection). Strokes are data, so they redraw on resize and theme changes.
 */
import { type PointerEvent, useCallback, useEffect, useRef } from 'react';
import { onThemeChange } from '../../lib/theme';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import {
  type Point,
  STROKE_WIDTH,
  type Stroke,
  strokeBounds,
  strokeEnd,
  strokePath,
  strokeSegment,
} from './sketch';

/** Ignore jitter smaller than this (CSS px) between samples. */
const MIN_STEP = 0.75;

/** Fills its parent, which should be a flex column; never shorter than 15rem. */
export function Sketchpad({
  strokes,
  onChange,
}: {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const active = useRef<{ pointerId: number; points: Point[] } | null>(null);
  const penSeen = useRef(false);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const redraw = useCallback((list: Stroke[] = strokesRef.current) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of list) ctx.stroke(new Path2D(strokePath(s)));
  }, []);

  // Size the backing store to the element (sharp on HiDPI) and style the pen; both are reset by
  // a resize, and the colour follows the theme. Pointer handlers then only draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    // The first getContext call fixes the options: ask for low latency.
    const ctx = canvas?.getContext('2d', { desynchronized: true });
    if (!canvas || !ctx) return;
    ctxRef.current = ctx;
    const style = () => {
      ctx.strokeStyle = getComputedStyle(canvas).color;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = STROKE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      redraw();
    };
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      style();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const offTheme = onThemeChange(style);
    return () => {
      ro.disconnect();
      offTheme();
    };
  }, [redraw]);

  // Repaint from the stroke data whenever it changes (a finished stroke, undo, clear). The live
  // pieces are stroked separately, so this also makes a finished stroke render exactly like any
  // later repaint (resize, theme). It is cheap: a Path2D per stroke.
  useEffect(() => {
    if (!active.current) redraw(strokes);
  }, [strokes, redraw]);

  const origin = () => canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'pen') penSeen.current = true;
    else if (e.pointerType === 'touch' && penSeen.current) return; // a resting palm
    if (active.current) return; // one stroke at a time
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = origin();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    active.current = { pointerId: e.pointerId, points: [p] };
    // Ink appears on contact, before any movement.
    const ctx = ctxRef.current;
    ctx?.beginPath();
    ctx?.arc(p.x, p.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx?.fill();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = active.current;
    const ctx = ctxRef.current;
    if (!a || !ctx || e.pointerId !== a.pointerId) return;
    const r = origin(); // once per event, not per coalesced sample
    const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [e.nativeEvent]) {
      const p = { x: sample.clientX - r.left, y: sample.clientY - r.top };
      const pts = a.points;
      const last = pts[pts.length - 1] as Point;
      if (Math.hypot(p.x - last.x, p.y - last.y) < MIN_STEP) continue;
      pts.push(p);
      ctx.stroke(new Path2D(strokeSegment(pts, pts.length))); // just the newest piece
    }
  };

  const onPointerEnd = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    active.current = null;
    const end = strokeEnd(a.points);
    if (end) ctxRef.current?.stroke(new Path2D(end));
    onChange([...strokesRef.current, a.points]);
  };

  const empty = strokes.length === 0;

  return (
    <div className="relative min-h-60 flex-1 animate-rise overflow-hidden rounded-xl border border-line bg-bg-alt [-webkit-touch-callout:none] select-none">
      {/* A faint dot grid helps keep handwriting level, like squared paper. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--line-strong) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundPosition: 'center',
        }}
      />
      {empty && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[15px] font-medium text-dim">
          Write your answer here
        </p>
      )}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={
          empty
            ? 'Drawing pad, empty'
            : `Drawing pad, ${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'} drawn`
        }
        className="absolute inset-0 size-full cursor-crosshair touch-none text-fg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      />
      <div className="absolute top-1.5 right-1.5 flex gap-0.5 rounded-xl bg-bg-alt/80">
        <IconButton
          label="Undo last stroke"
          disabled={empty}
          onClick={() => onChange(strokes.slice(0, -1))}
        >
          <Icon name="undo" size={18} />
        </IconButton>
        <IconButton label="Clear drawing" disabled={empty} onClick={() => onChange([])}>
          <Icon name="trash" size={18} />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * A drawn answer, cropped to its ink. Shown at natural size but never enlarged, and scaled down
 * to at most 10rem tall so a big drawing stays easy to compare with the answer above it.
 */
export function SketchPreview({ strokes }: { strokes: Stroke[] }) {
  const b = strokeBounds(strokes);
  if (!b) return null;
  const pad = STROKE_WIDTH * 2;
  const width = b.width + pad * 2;
  const height = b.height + pad * 2;
  return (
    <svg
      viewBox={`${b.x - pad} ${b.y - pad} ${width} ${height}`}
      preserveAspectRatio="xMinYMin meet"
      className="block max-h-40 w-full text-fg"
      style={{ maxWidth: width, aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label="Your drawing"
    >
      {strokes.map((s, i) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: strokes are append-only
          key={i}
          d={strokePath(s)}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
