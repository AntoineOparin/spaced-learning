/**
 * A small action menu on the native Popover API (light dismiss and Esc for free). It grows
 * out of its trigger and supports arrow-key navigation.
 */
import { type KeyboardEvent, useEffect, useId, useRef } from 'react';
import { IconButton } from './Button';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const WIDTH = 224; // w-56
const ITEM_HEIGHT = 40;

export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    // Position before showing (so the entry transition starts in place), focus after.
    const onBeforeToggle = (e: Event) => {
      const btn = buttonRef.current;
      if ((e as ToggleEvent).newState !== 'open' || !btn) return;
      const r = btn.getBoundingClientRect();
      const height = items.length * ITEM_HEIGHT + 12;
      const left = Math.min(Math.max(8, r.right - WIDTH), window.innerWidth - WIDTH - 8);
      const below = r.bottom + 6 + height <= window.innerHeight - 8;
      menu.style.left = `${left}px`;
      menu.style.top = `${below ? r.bottom + 6 : r.top - 6 - height}px`;
      menu.style.transformOrigin = `${r.left + r.width / 2 - left}px ${below ? 'top' : 'bottom'}`;
    };
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open')
        menu.querySelector<HTMLElement>('[role=menuitem]:not(:disabled)')?.focus();
    };
    menu.addEventListener('beforetoggle', onBeforeToggle);
    menu.addEventListener('toggle', onToggle);
    return () => {
      menu.removeEventListener('beforetoggle', onBeforeToggle);
      menu.removeEventListener('toggle', onToggle);
    };
  }, [items.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)') ?? []),
    ];
    const i = all.indexOf(document.activeElement as HTMLElement);
    const move = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
    if (move === undefined || !all.length) return;
    e.preventDefault();
    all[(move + all.length) % all.length]?.focus();
  };

  return (
    <>
      <IconButton ref={buttonRef} label={label} popoverTarget={id} aria-haspopup="menu">
        <Icon name="more" size={22} />
      </IconButton>
      <div
        ref={menuRef}
        id={id}
        popover="auto"
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="menu w-56 rounded-xl border border-line bg-bg p-1.5 text-fg shadow-pop"
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              menuRef.current?.hidePopover();
              item.onSelect();
            }}
            className={cn(
              'flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] font-medium transition-colors',
              'focus-visible:outline-none disabled:opacity-40',
              item.danger
                ? 'text-danger-text hover:bg-danger-soft focus:bg-danger-soft'
                : 'hover:bg-surface focus:bg-surface',
            )}
          >
            {item.icon && (
              <Icon
                name={item.icon}
                size={18}
                className={item.danger ? 'text-danger-text' : 'text-muted'}
              />
            )}
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
