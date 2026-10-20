/**
 * localStorage for per-device conveniences (theme, UI preferences). Every access is guarded:
 * storage can be unavailable (private mode, blocked site data), and a preference that doesn't
 * persist is never worth an error.
 */

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The preference just won't persist.
  }
}

export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // As above.
  }
}
