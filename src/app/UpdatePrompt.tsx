import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button';

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
    <div className="border-b border-line bg-accent-soft">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <span>A new version is available.</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
