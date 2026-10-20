import { reloadToUpdate } from '../../app/UpdatePrompt';
import { cn } from '../../lib/cn';
import { syncManager, useSyncState } from '../../sync/manager';
import { describeClockSkew, describeSync } from '../../sync/status';
import { Button, buttonClass } from '../../ui/Button';
import { hintText } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { formatDate, Row, Section } from './fields';

function Notice({
  tone,
  children,
}: {
  tone: 'danger' | 'warn' | 'muted';
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        'flex gap-2 px-5 py-3 text-[13px] font-medium',
        tone === 'danger' && 'text-danger-text',
        tone === 'warn' && 'text-streak-text',
        tone === 'muted' && 'text-muted',
      )}
    >
      {tone !== 'muted' && <Icon name="alert" size={16} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

export function SyncSection() {
  const sync = useSyncState();
  const { label } = describeSync(sync);
  const skew = describeClockSkew(sync.clockSkewMs);
  return (
    <Section id="sync" title="Sync">
      <Row
        label={`Cloud sync · ${label}`}
        hint={`Last synced ${formatDate(sync.lastSyncAt)} · ${sync.pending} local change${sync.pending === 1 ? '' : 's'} pending`}
      >
        {sync.status === 'auth' && (
          // Full navigation: Cloudflare Access shows its login page, then returns here.
          <a href="/auth/refresh" className={buttonClass('primary', 'sm')}>
            Sign in
          </a>
        )}
        {sync.status === 'outdated' && (
          <Button size="sm" variant="primary" onClick={reloadToUpdate}>
            <Icon name="sparkles" size={16} /> Update the app
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => void syncManager.sync()}
          disabled={sync.status === 'syncing'}
        >
          <Icon name="refresh" size={16} /> Sync now
        </Button>
      </Row>
      {sync.error && <Notice tone="danger">{sync.error}</Notice>}
      {sync.status === 'outdated' && (
        <Notice tone="warn">
          Your data on the server was written by a newer version of the app. Update to keep syncing;
          studying keeps working meanwhile.
        </Notice>
      )}
      {skew && (
        <Notice tone="warn">
          This device’s clock is {skew}. Edits made here may lose to older edits from another
          device. Fix the date and time in the system settings.
        </Notice>
      )}
      {sync.superseded > 0 && (
        <Notice tone="muted">
          {sync.superseded} local {sync.superseded === 1 ? 'change was' : 'changes were'} replaced
          by newer edits from another device during the last sync.
        </Notice>
      )}
      {sync.invalid > 0 && (
        <Notice tone="muted">
          Skipped {sync.invalid} {sync.invalid === 1 ? 'record' : 'records'} this app could not read
          (details in the browser console).
        </Notice>
      )}
      <p className={cn('px-5 py-4', hintText)}>
        Your data lives on this device first. Sync copies changes to your private Cloudflare
        database, so your other devices — and a reinstalled app — get them too. Studying works
        offline.
      </p>
    </Section>
  );
}
