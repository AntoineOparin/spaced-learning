import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button';
import { Callout } from '../ui/misc';

/** Offers to reload when a new app version is ready (never forced mid-session). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates hourly while the app stays open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <Callout
      icon="sparkles"
      tone="accent"
      action={
        <>
          <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
            Reload
          </Button>
        </>
      }
    >
      <p className="pt-0.5 font-semibold">A new version is ready.</p>
    </Callout>
  );
}
