/** Platform and storage helpers. */

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as Mac; detect touch support to tell them apart.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** True when running as an installed (home screen / standalone) app. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export interface StorageStatus {
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

export async function storageStatus(): Promise<StorageStatus> {
  const s = navigator.storage;
  const [persisted, estimate] = await Promise.all([
    s?.persisted ? s.persisted().catch(() => null) : Promise.resolve(null),
    s?.estimate ? s.estimate().catch(() => null) : Promise.resolve(null),
  ]);
  return { persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}

/** Asks the browser not to evict this site's storage under pressure. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}
