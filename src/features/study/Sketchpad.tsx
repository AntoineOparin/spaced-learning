/**
 * A writing pad for answering by hand. Ink follows the pointer 1:1 from pointer-down,
 * using coalesced events for smooth curves; once a stylus is seen, touches are ignored
 * (palm rejection). Strokes are data, so they redraw on resize and theme changes.
 */
import { type PointerEvent, useCallback, useEffect, useRef } from 'react';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { type Point, STROKE_WIDTH, type Stroke, strokeBounds, strokePath } from './sketch';

/** Ignore jitter smaller than this (CSS px) between samples. */
const MIN_STEP = 0.75;

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Fills its parent, which should be a flex column; never shorter than 15rem. */
export function Sketchpad({
  strokes,
  onChange,
}: {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = useRef<{ pointerId: number; points: Point[] } | null>(null);
  const penSeen = useRef(false);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const context = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { desynchronized: true });
    if (!canvas || !ctx) return null;
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }, []);

  const redraw = useCallback(
    (list: Stroke[] = strokesRef.current) => {
      const canvas = canvasRef.current;
      const ctx = context();
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of list) ctx.stroke(new Path2D(strokePath(s)));
    },
    [context],
  );

  // Match the backing store to the element size (sharp on HiDPI), and follow theme changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      // The first getContext call fixes the options, so ask for low latency here too.
      canvas.getContext('2d', { desynchronized: true })?.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const mo = new MutationObserver(() => redraw());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [redraw]);

  // Undo and clear change the strokes from outside the pointer handlers.
  useEffect(() => {
    if (!active.current) redraw(strokes);
  }, [strokes, redraw]);

  const at = (e: { clientX: number; clientY: number }): Point => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'pen') penSeen.current = true;
    else if (e.pointerType === 'touch' && penSeen.current) return; // a resting palm
    if (active.current) return; // one stroke at a time
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e);
    active.current = { pointerId: e.pointerId, points: [p] };
    // Ink appears on contact, before any movement.
    const ctx = context();
    ctx?.beginPath();
    ctx?.arc(p.x, p.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx?.fill();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    const ctx = context();
    if (!ctx) return;
    const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [e.nativeEvent]) {
      const p = at(sample);
      const pts = a.points;
      const last = pts[pts.length - 1] as Point;
      if (Math.hypot(p.x - last.x, p.y - last.y) < MIN_STEP) continue;
      pts.push(p);
      // Draw just the newest piece of the same curve strokePath() describes.
      const n = pts.length;
      ctx.beginPath();
      if (n === 2) {
        const [p0, p1] = pts as [Point, Point];
        const m = mid(p0, p1);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(m.x, m.y);
      } else {
        const a0 = pts[n - 3] as Point;
        const a1 = pts[n - 2] as Point;
        const from = mid(a0, a1);
        const to = mid(a1, p);
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(a1.x, a1.y, to.x, to.y);
      }
      ctx.stroke();
    }
  };

  const onPointerEnd = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = active.current;
    if (!a || e.pointerId !== a.pointerId) return;
    active.current = null;
    const pts = a.points;
    if (pts.length >= 2) {
      const ctx = context();
      const prev = pts[pts.length - 2] as Point;
      const last = pts[pts.length - 1] as Point;
      const from = mid(prev, last);
      ctx?.beginPath();
      ctx?.moveTo(from.x, from.y);
      ctx?.lineTo(last.x, last.y);
      ctx?.stroke();
    }
    onChange([...strokesRef.current, pts]);
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
