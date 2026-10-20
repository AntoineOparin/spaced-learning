/**
 * A styled dropdown in place of the native <select>, whose open list is always drawn by the
 * OS. Follows the ARIA "select-only combobox" pattern: focus stays on the trigger while the
 * arrow keys move through the options; the list is a native popover (light dismiss for free)
 * that grows out of the trigger. Type a letter to jump, as with a native select.
 */
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../lib/cn';
import { fieldControl } from './Field';
import { Icon } from './Icon';
import { placePopover } from './popover';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  /** Show as a child of the option above it (e.g. a subtopic). */
  indent?: boolean;
}

export interface SelectGroup<T extends string | number> {
  label: string;
  options: SelectOption<T>[];
}

export interface SelectProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  /** Flat options, or `groups` for labelled sections. */
  options?: SelectOption<T>[];
  groups?: SelectGroup<T>[];
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const MAX_HEIGHT = 320;
const MAX_WIDTH = 360;

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  groups,
  id,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: SelectProps<T>) {
  const autoId = useId();
  const triggerId = id ?? `${autoId}-trigger`;
  const listId = `${autoId}-list`;
  const optionId = (i: number) => `${autoId}-opt-${i}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: '', at: 0 });

  const sections = useMemo(
    () => groups ?? [{ label: '', options: options ?? [] }],
    [groups, options],
  );
  const flat = useMemo(() => sections.flatMap((g) => g.options), [sections]);
  const selectedIndex = Math.max(
    0,
    flat.findIndex((o) => o.value === value),
  );
  const selected = flat.find((o) => o.value === value);

  const close = useCallback(() => popRef.current?.hidePopover(), []);
  const choose = (i: number) => {
    const option = flat[i];
    close();
    if (option && option.value !== value) onChange(option.value);
  };

  // Like a native select, close when the page scrolls or resizes under the open list.
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  });

  /** Type-to-jump: the next option starting with what was typed in the last half second. */
  const jump = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at < 500 ? t.text + key.toLowerCase() : key.toLowerCase();
    t.at = now;
    const from = open ? active : selectedIndex;
    const order = [...flat.keys()].map(
      (k) => (from + (t.text.length === 1 ? 1 : 0) + k) % flat.length,
    );
    return order.find((i) => flat[i]?.label.toLowerCase().startsWith(t.text));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = flat.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        popRef.current?.showPopover();
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const i = jump(e.key);
        if (i !== undefined) choose(i);
      }
      return;
    }
    const move: Record<string, number> = {
      ArrowDown: active + 1,
      ArrowUp: active - 1,
      Home: 0,
      End: last,
      PageDown: active + 8,
      PageUp: active - 8,
    };
    if (e.key in move) {
      e.preventDefault();
      setActive(Math.min(last, Math.max(0, move[e.key] as number)));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault(); // close just the list, not a dialog around it
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close();
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const i = jump(e.key);
      if (i !== undefined) setActive(i);
    }
  };

  // Clicks inside the list must not take focus from the trigger.
  const keepFocus = (e: MouseEvent) => e.preventDefault();

  let index = 0;
  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        popoverTarget={`${autoId}-pop`}
        onKeyDown={onKeyDown}
        className={cn(
          fieldControl,
          'flex h-11 items-center justify-between gap-2 text-left',
          open && 'border-line-strong',
          className,
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? ''}</span>
        <Icon
          name="chevronDown"
          size={18}
          className={cn(
            'shrink-0 text-muted transition-transform duration-(--spring-fast) ease-spring',
            open && 'rotate-180',
          )}
        />
      </button>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: only stops clicks from moving focus off the combobox */}
      <div
        ref={popRef}
        id={`${autoId}-pop`}
        popover="auto"
        onMouseDown={keepFocus}
        // At least as wide as the trigger, growing to fit the options.
        onBeforeToggle={(e) => {
          if (e.newState === 'open' && triggerRef.current && popRef.current)
            placePopover(triggerRef.current, popRef.current, {
              align: 'auto',
              fit: { minWidth: 180, maxWidth: MAX_WIDTH },
              maxHeight: MAX_HEIGHT,
            });
        }}
        onToggle={(e) => {
          const isOpen = e.newState === 'open';
          setOpen(isOpen);
          if (isOpen) {
            setActive(selectedIndex);
            document.getElementById(optionId(selectedIndex))?.scrollIntoView({ block: 'center' });
          }
        }}
        className="menu overflow-y-auto overscroll-contain"
      >
        <div id={listId} role="listbox" aria-labelledby={triggerId}>
          {sections.map((g, gi) => {
            const items = g.options.map((o) => {
              const i = index++;
              const isSelected = o.value === value;
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled on the combobox trigger, which keeps focus
                <div
                  key={`${o.value}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onClick={() => choose(i)}
                  onMouseMove={() => active !== i && setActive(i)}
                  className={cn(
                    'flex h-11 cursor-pointer items-center gap-2 rounded-lg pr-2.5 text-[15px] sm:h-9 sm:text-sm',
                    o.indent ? 'pl-7' : 'pl-2.5',
                    open && active === i && 'bg-surface',
                    isSelected && 'font-semibold',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {isSelected && (
                    <Icon name="check" size={16} className="shrink-0 text-accent-text" />
                  )}
                </div>
              );
            });
            if (!g.label) return items;
            const labelId = `${autoId}-group-${gi}`;
            return (
              // biome-ignore lint/a11y/useSemanticElements: listbox sections are ARIA groups; <fieldset> is for form controls
              <div
                key={g.label}
                role="group"
                aria-labelledby={labelId}
                className={cn(gi > 0 && 'mt-1 border-t border-line pt-1')}
              >
                <div
                  id={labelId}
                  className="truncate px-2.5 pt-1.5 pb-1 text-xs font-bold text-muted"
                >
                  {g.label}
                </div>
                {items}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
