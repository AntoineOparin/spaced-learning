import { useState } from 'react';
import { isIOS, isStandalone } from '../lib/platform';
import { readLocal, writeLocal } from '../lib/storage';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Callout } from '../ui/misc';

const KEY = 'installHintDismissed';

/**
 * On iOS Safari (not installed), explain why installing matters: Safari may delete site data
 * after 7 days without a visit, and the home-screen app keeps separate, longer-lived storage.
 */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => readLocal(KEY) === '1');
  if (dismissed || !isIOS() || isStandalone()) return null;

  return (
    <Callout
      icon="download"
      tone="streak"
      action={
        <IconButton
          label="Dismiss"
          className="-my-2 -mr-2"
          onClick={() => {
            writeLocal(KEY, '1');
            setDismissed(true);
          }}
        >
          <Icon name="x" />
        </IconButton>
      }
    >
      <p className="font-semibold">Add Spaced to your Home Screen</p>
      <p className="mt-0.5 text-muted">
        Tap Share, then <em>Add to Home Screen</em>, and study from the installed app. Safari keeps
        a separate copy of your data and may delete it after 7 days without a visit.
      </p>
    </Callout>
  );
}
