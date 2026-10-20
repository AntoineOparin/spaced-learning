import { useEffect, useState } from 'react';
import { useMeta } from '../../db/hooks';
import { repo } from '../../db/instance';
import { LAST_EXPORT_AT_KEY } from '../../db/metaKeys';
import { backupFileName, exportBackup, summarizeBackup } from '../../io/backup';
import { type BackupFile, backupSchema } from '../../io/schema';
import { downloadJson } from '../../lib/files';
import {
  formatBytes,
  requestPersistence,
  type StorageStatus,
  storageStatus,
} from '../../lib/platform';
import { syncManager } from '../../sync/manager';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { formatDate, JsonFileButton, Row, Section, useJsonFileReader } from './fields';

export function BackupSection() {
  const toast = useToast();
  const readJsonFile = useJsonFileReader();
  const lastExportAt = useMeta<number>(LAST_EXPORT_AT_KEY);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void storageStatus().then(setStorage);
  }, []);

  const doExport = async () => {
    const now = Date.now();
    const backup = await exportBackup(repo, now);
    downloadJson(backupFileName(now), backup);
    await repo.setMeta(LAST_EXPORT_AT_KEY, now);
    toast({ tone: 'success', message: 'Backup downloaded' });
  };

  const onPickBackup = async (file: File) => {
    const backup = await readJsonFile(file, backupSchema, 'backup');
    if (backup) setPending({ backup, name: file.name });
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      // Safety net: download the current state before replacing it.
      const now = Date.now();
      downloadJson(`before-restore-${backupFileName(now)}`, await exportBackup(repo, now));
      await repo.restoreSnapshot(pending.backup);
      toast({ tone: 'success', message: 'Backup restored' });
      setPending(null);
      void syncManager.sync();
    } catch (err) {
      toast({
        tone: 'error',
        message: `Restore failed — nothing was changed. ${err instanceof Error ? err.message : ''}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const summary = pending ? summarizeBackup(pending.backup) : null;

  return (
    <Section id="backup" title="Backup">
      <Row
        label="Backup file"
        hint={`A complete JSON copy of courses, items, scheduling and review history. Last exported ${formatDate(lastExportAt)}.`}
      >
        <Button size="sm" onClick={() => void doExport()}>
          <Icon name="download" size={16} /> Export backup
        </Button>
        <JsonFileButton variant="ghost" onPick={(file) => void onPickBackup(file)}>
          <Icon name="upload" size={16} /> Restore…
        </JsonFileButton>
      </Row>
      <Row
        label="Storage on this device"
        hint={
          <>
            {storage?.usage != null && `Using ${formatBytes(storage.usage)}. `}
            {storage?.persisted
              ? 'Persistent storage is granted, so the browser won’t evict this data under storage pressure.'
              : 'Persistent storage isn’t granted yet; the browser may evict data under storage pressure (sync and backups protect you).'}
          </>
        }
      >
        {storage && !storage.persisted && (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const ok = await requestPersistence();
              setStorage(await storageStatus());
              toast({
                message: ok
                  ? 'Persistent storage granted'
                  : 'The browser declined for now (installing the app helps)',
              });
            }}
          >
            Request
          </Button>
        )}
      </Row>

      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title="Restore this backup?"
        description={pending?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmRestore()} disabled={busy}>
              {busy ? 'Restoring…' : 'Replace local data'}
            </Button>
          </>
        }
      >
        {summary && (
          <div className="space-y-3 text-[15px]">
            <p>
              Exported {formatDate(summary.exportedAt)}: {summary.courses} courses, {summary.items}{' '}
              items, {summary.cards} cards, {summary.reviews} reviews.
            </p>
            <p className="text-muted">
              Local data on this device will be replaced. A copy of the current data is downloaded
              first. After the next sync, the restored data takes precedence; anything created on
              other devices since this backup is kept.
            </p>
          </div>
        )}
      </Dialog>
    </Section>
  );
}
