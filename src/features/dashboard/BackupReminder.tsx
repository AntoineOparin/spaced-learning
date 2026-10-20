import { Link } from 'react-router';
import { useMeta } from '../../db/hooks';
import { LAST_EXPORT_AT_KEY } from '../../db/metaKeys';
import { useSyncState } from '../../sync/manager';
import { buttonClass } from '../../ui/Button';
import { Callout } from '../../ui/misc';
import { BACKUP_STALE_DAYS, backupStatus } from './derive';

/** Nags only when sync can't act as a backup and no file was exported recently. */
export function BackupReminder({ now }: { now: number }) {
  const sync = useSyncState();
  // null when never exported; undefined while loading.
  const lastExportAt = useMeta<number | null>(LAST_EXPORT_AT_KEY, null);
  const { stale, lastBackup } = backupStatus(lastExportAt, sync.lastSyncAt, now);
  const syncBroken =
    sync.status === 'unavailable' || sync.status === 'error' || sync.status === 'auth';
  if (!stale || !syncBroken) return null;
  return (
    <Callout
      icon="alert"
      tone="streak"
      action={
        <Link to="/settings#backup" className={buttonClass('secondary', 'sm')}>
          Back up now
        </Link>
      }
    >
      <p className="pt-0.5">
        {lastBackup
          ? `No backup in the last ${BACKUP_STALE_DAYS} days.`
          : 'Your progress has never been backed up.'}{' '}
        <span className="text-muted">
          {sync.status === 'auth'
            ? 'Sign in to sync, or export a backup file.'
            : 'Export a backup file to be safe.'}
        </span>
      </p>
    </Callout>
  );
}
