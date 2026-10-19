/**
 * Accessible modal built on the native <dialog> element (focus trap and Esc for free).
 * Desktop: a centered panel. Phones: a bottom sheet that can be dragged down to dismiss.
 */
import { type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { IconButton } from './Button';
import { cn } from './cn';
import { Icon } from './Icon';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'xl';
  /** Makes body and footer one form: Enter submits, and a footer `type="submit"` button saves. */
  onSubmit?: () => void;
}

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', xl: 'sm:max-w-4xl' };

/** Resting distance of a flick, as in scroll deceleration (Designing Fluid Interfaces). */
function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary instead of a hard stop. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** A form around body and footer when the dialog submits; layout is unchanged either way. */
function Body({ onSubmit, children }: { onSubmit?: () => void; children: ReactNode }) {
  if (!onSubmit) return children;
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** Below Tailwind's `sm` breakpoint dialogs are bottom sheets (see dialog.panel in index.css). */
const isSheet = () => window.matchMedia('(width < 40rem)').matches;

interface Drag {
  pointerId: number;
  startY: number;
  samples: { y: number; t: number }[];
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  onSubmit,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const drag = useRef<Drag | null>(null);
  // Keep rendering the last content while the exit transition plays.
  const [present, setPresent] = useState(open);
  const shown = useRef({ title, description, children, footer });
  if (open) shown.current = { title, description, children, footer };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      setPresent(true);
      el.style.removeProperty('translate');
      el.style.removeProperty('transition');
      if (!el.open) {
        el.showModal();
        // React handles autoFocus itself (before the dialog is shown), so use a data attribute.
        el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      }
      return;
    }
    if (el.open) el.close();
    // Unmount the content once the exit transition has played (none where unsupported).
    let reopened = false;
    void Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined))).then(
      () => !reopened && setPresent(false),
    );
    return () => {
      reopened = true;
    };
  }, [open]);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!isSheet() || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      samples: [{ y: e.clientY, t: e.timeStamp }],
    };
    ref.current?.style.setProperty('transition', 'none');
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || e.pointerId !== d.pointerId) return;
    const dy = e.clientY - d.startY;
    // 1:1 downwards; resist upwards, where there is nothing more to reveal.
    const y = dy >= 0 ? dy : -rubberband(-dy, el.offsetHeight);
    el.style.setProperty('translate', `0 ${y}px`);
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    if (d.samples.length > 5) d.samples.shift();
  };

  const onPointerEnd = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = first && last ? last.t - first.t : 0;
    const velocity = first && last && dt > 0 ? ((last.y - first.y) / dt) * 1000 : 0;
    const dy = Math.max(0, e.clientY - d.startY);
    el.style.removeProperty('transition');
    // Decide from where the gesture is going, not where it stopped.
    if (e.type === 'pointerup' && dy + project(velocity) > el.offsetHeight * 0.5) {
      el.style.setProperty('translate', '0 100%');
      onClose();
    } else {
      el.style.removeProperty('translate'); // springs back from the current position
    }
  };

  const view = shown.current;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      // A modal is a keyboard boundary: page shortcuts never fire underneath it (Esc still
      // reaches the native cancel).
      onKeyDown={(e) => e.stopPropagation()}
      aria-labelledby={titleId}
      className={cn(
        'panel m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-bg p-0 text-fg shadow-modal',
        'max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)]',
        WIDTHS[size],
      )}
    >
      {(open || present) && (
        <div className="flex max-h-[inherit] flex-col">
          <header
            className="relative flex items-start justify-between gap-4 px-5 pt-5 pb-3 max-sm:touch-none sm:px-6"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <span
              aria-hidden
              className="absolute top-2 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line-strong sm:hidden"
            />
            <div className="min-w-0 pt-1">
              <h2 id={titleId} className="text-lg font-bold">
                {view.title}
              </h2>
              {view.description && (
                <div className="mt-1 text-sm text-muted">{view.description}</div>
              )}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
              <Icon name="x" />
            </IconButton>
          </header>
          <Body onSubmit={onSubmit}>
            <div
              className={cn(
                // A stable gutter: content that grows past the height doesn't shift sideways.
                'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-5 [scrollbar-gutter:stable] sm:px-6',
                !view.footer && 'max-sm:pb-[max(env(safe-area-inset-bottom),1.25rem)]',
              )}
            >
              {view.children}
            </div>
            {view.footer && (
              <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-5 pt-4 pb-4 max-sm:pb-[max(env(safe-area-inset-bottom),1rem)] max-sm:[&>*]:flex-1 sm:px-6">
                {view.footer}
              </footer>
            )}
          </Body>
        </div>
      )}
    </dialog>
  );
}
