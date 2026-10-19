/** Theme preference is a per-device convenience, so it lives in localStorage. */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePref = getThemePref()): void {
  const dark = pref === 'dark' || (pref === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // ignore: the choice just won't persist
  }
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
