import { registerSW } from 'virtual:pwa-register';
import { useSyncExternalStore } from 'react';
import { HOUR } from '../domain/day';
import { Button } from '../ui/Button';
import { Callout } from '../ui/misc';

/*
 * The service worker is registered once for the app's lifetime, not per mount: the shell remounts
 * after every study session, and each registration used to add another hourly update timer.
 */
let needRefresh = false;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
const listeners = new Set<() => void>();

function setNeedRefresh(value: boolean) {
  needRefresh = value;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  updateSW ??= registerSW({
    onNeedRefresh: () => setNeedRefresh(true),
    onRegisteredSW(_url, registration) {
      // Check for updates hourly while the app stays open.
      if (registration) setInterval(() => void registration.update(), HOUR);
    },
  });
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Activates a waiting service worker if there is one, then reloads to the newest build. */
export function reloadToUpdate(): void {
  if (updateSW) void updateSW(true);
  else window.location.reload();
}

/** Offers to reload when a new app version is ready (never forced mid-session). */
export function UpdatePrompt() {
  const show = useSyncExternalStore(subscribe, () => needRefresh);
  if (!show) return null;
  return (
    <Callout
      icon="sparkles"
      tone="accent"
      action={
        <>
          <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button size="sm" variant="primary" onClick={reloadToUpdate}>
            Reload
          </Button>
        </>
      }
    >
      <p className="pt-0.5 font-semibold">A new version is ready.</p>
    </Callout>
  );
}
