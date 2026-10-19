import { extendTailwindMerge } from 'tailwind-merge';

/** Knows this app's custom theme names, so it never confuses e.g. `shadow-pop` with a colour. */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['pop', 'modal'],
      animate: ['rise', 'card', 'pop', 'fade'],
      ease: ['spring'],
    },
  },
});

/** Joins class names; when two conflict (e.g. `bg-bg` then `bg-accent-soft`), the later wins. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return merge(...parts);
}
