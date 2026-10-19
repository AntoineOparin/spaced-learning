/** Theme preference is a per-device convenience, so it lives in localStorage. */
import { readLocal, removeLocal, writeLocal } from './storage';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  const v = readLocal(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

const themeListeners = new Set<() => void>();

/** Called after every theme application (e.g. a canvas re-reading its colours). */
export function onThemeChange(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

export function applyTheme(pref: ThemePref = getThemePref()): void {
  const dark = pref === 'dark' || (pref === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
  for (const l of themeListeners) l();
}

export function setThemePref(pref: ThemePref): void {
  if (pref === 'system') removeLocal(KEY);
  else writeLocal(KEY, pref);
  // Cross-fade instead of an abrupt brightness jump, where the browser supports it.
  if (document.startViewTransition) document.startViewTransition(() => applyTheme(pref));
  else applyTheme(pref);
}

/** Follow OS changes while the preference is "system". Returns an unsubscribe function. */
export function watchSystemTheme(): () => void {
  const mq = media();
  const onChange = () => {
    if (getThemePref() === 'system') applyTheme('system');
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
