/**
 * A small action menu on the native Popover API (light dismiss and Esc for free). It grows
 * out of its trigger and supports arrow-key navigation.
 */
import { type KeyboardEvent, useId, useRef } from 'react';
import { cn } from '../lib/cn';
import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import { placePopover } from './popover';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        // Position before showing (so the entry transition starts in place), focus after.
        onBeforeToggle={(e) => {
          if (e.newState === 'open' && buttonRef.current && menuRef.current)
            placePopover(buttonRef.current, menuRef.current, { align: 'end' });
        }}
        onToggle={(e) => {
          if (e.newState === 'open')
            menuRef.current?.querySelector<HTMLElement>('[role=menuitem]:not(:disabled)')?.focus();
        }}
        className="menu w-56"
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
