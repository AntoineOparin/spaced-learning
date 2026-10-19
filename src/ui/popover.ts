/**
 * Places a popover next to the element that opened it: below, or above when there is more room
 * there, extending away from the nearer screen edge. It anchors with right/bottom when flipping,
 * so it never needs the popover's own size, and it grows out of the trigger's centre.
 */
const GAP = 6;
const MARGIN = 8;

export interface PlaceOptions {
  /** 'end' aligns right edges; 'auto' picks the side away from the nearer screen edge. */
  align: 'end' | 'auto';
  /** Grow to fit the content, at least as wide as the trigger (and `minWidth`), up to `maxWidth`. */
  fit?: { minWidth: number; maxWidth: number };
  maxHeight?: number;
}

export function placePopover(trigger: HTMLElement, pop: HTMLElement, opts: PlaceOptions): void {
  const r = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fromRight = opts.align === 'end' || r.left + r.width / 2 > vw / 2;
  const below = vh - r.bottom - GAP - MARGIN;
  const above = r.top - GAP - MARGIN;
  const down = below >= 240 || below >= above;
  const style: Record<string, string> = {
    left: fromRight ? 'auto' : `${Math.max(r.left, MARGIN)}px`,
    right: fromRight ? `${Math.max(vw - r.right, MARGIN)}px` : 'auto',
    top: down ? `${r.bottom + GAP}px` : 'auto',
    bottom: down ? 'auto' : `${vh - r.top + GAP}px`,
    transformOrigin: `${fromRight ? `calc(100% - ${r.width / 2}px)` : `${r.width / 2}px`} ${down ? 'top' : 'bottom'}`,
  };
  if (opts.fit) {
    const room = fromRight ? r.right - MARGIN : vw - r.left - MARGIN;
    const maxWidth = Math.min(opts.fit.maxWidth, room);
    style.width = 'max-content';
    style.minWidth = `${Math.min(Math.max(r.width, opts.fit.minWidth), maxWidth)}px`;
    style.maxWidth = `${maxWidth}px`;
  }
  if (opts.maxHeight) style.maxHeight = `${Math.min(opts.maxHeight, down ? below : above)}px`;
  Object.assign(pop.style, style);
}
