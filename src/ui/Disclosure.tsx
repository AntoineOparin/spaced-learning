import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

/** A chevron that turns to point down when its section is open. */
export function DisclosureChevron({ open, size = 18 }: { open: boolean; size?: number }) {
  return (
    <Icon
      name="chevronRight"
      size={size}
      className={cn(
        'transition-transform duration-(--spring-fast) ease-spring',
        open && 'rotate-90',
      )}
    />
  );
}

/** Shows or hides the section below it ("Why?", "Add explanation…"). */
export function DisclosureButton({
  open,
  onToggle,
  small = false,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        '-ml-1 flex items-center gap-1 rounded-lg px-1 py-0.5 font-bold text-accent-text',
        small ? 'text-sm' : 'text-[15px]',
      )}
    >
      <DisclosureChevron open={open} size={small ? 16 : 18} />
      {children}
    </button>
  );
}
