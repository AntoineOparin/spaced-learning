import { useState } from 'react';
import { isIOS, isStandalone } from '../lib/platform';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';

const KEY = 'installHintDismissed';

/**
 * On iOS Safari (not installed), explain why installing matters: Safari may delete site data
 * after 7 days without a visit, and the home-screen app keeps separate, longer-lived storage.
 */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (dismissed || !isIOS() || isStandalone()) return null;

  return (
    <div className="border-b border-line bg-hard-soft">
      <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 py-2.5 text-sm">
        <Icon name="info" className="mt-0.5 shrink-0 text-hard" />
        <p className="flex-1">
          <strong>Install this app on your iPhone:</strong> tap Share → <em>Add to Home Screen</em>,
          then study only from the installed app. Safari keeps its own copy of your data and may
          delete it after 7 days without a visit.
        </p>
        <IconButton
          label="Dismiss"
          className="-my-1"
          onClick={() => {
            try {
              localStorage.setItem(KEY, '1');
            } catch {
              // ignore
            }
            setDismissed(true);
          }}
        >
          <Icon name="x" />
        </IconButton>
      </div>
    </div>
  );
}
