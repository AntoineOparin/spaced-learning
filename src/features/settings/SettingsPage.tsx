import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { describeSync } from '../../app/SyncIndicator';
import { BUNDLED_DECKS } from '../../content/decks';
import { useMeta, useSettings } from '../../db/hooks';
import { db, repo } from '../../db/instance';
import { LAST_EXPORT_AT_KEY } from '../../db/metaKeys';
import type { Settings, StepUnit } from '../../domain/types';
import { backupFileName, exportBackup, restoreBackup, summarizeBackup } from '../../io/backup';
import { installContentPack } from '../../io/contentPack';
import { type BackupFile, backupSchema, contentPackSchema, parseJson } from '../../io/schema';
import { downloadJson } from '../../lib/files';
import {
  formatBytes,
  requestPersistence,
  type StorageStatus,
  storageStatus,
} from '../../lib/platform';
import { getThemePref, setThemePref, type ThemePref } from '../../lib/theme';
import { syncManager, useSyncState } from '../../sync/manager';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Dialog } from '../../ui/Dialog';
import { Field, Input, Select, Switch } from '../../ui/Field';
import { Icon, type IconName } from '../../ui/Icon';
import { PageHeader, Panel } from '../../ui/misc';
import { useToast } from '../../ui/Toast';
import { InstallDeckDialog } from '../decks/InstallDeckDialog';

function formatDate(ts: number | null | undefined): string {
  if (!ts) return 'never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ts);
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function parseSteps(s: string): StepUnit[] | null {
  const parts = s.split(/[\s,]+/).filter(Boolean);
  return parts.every((p) => /^\d+(\.\d+)?[mhd]$/.test(p)) ? (parts as StepUnit[]) : null;
}

function ThemePicker() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const options: { value: ThemePref; label: string; icon: IconName }[] = [
    { value: 'system', label: 'System', icon: 'monitor' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ];
  return (
    <fieldset className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      <legend className="sr-only">Theme</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
            pref === o.value
              ? 'bg-surface font-medium text-fg shadow-sm'
              : 'text-muted hover:text-fg',
          )}
        >
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={pref === o.value}
            onChange={() => {
              setPref(o.value);
              setThemePref(o.value);
            }}
            className="sr-only"
          />
          <Icon name={o.icon} size={16} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

function StudySettings({ settings }: { settings: Settings }) {
  const toast = useToast();
  const [learning, setLearning] = useState(settings.learningSteps.join(' '));
  const [relearning, setRelearning] = useState(settings.relearningSteps.join(' '));
  const update = async (patch: Partial<Settings>) => {
    await repo.updateSettings(patch);
  };

  return (
    <div className="space-y-5">
      <Field
        label={`Desired retention: ${Math.round(settings.desiredRetention * 100)}%`}
        hint="The probability of recalling a card when it comes due. 90% is a good default; each extra point costs noticeably more reviews. Courses can override this."
      >
        {(id, d) => (
          <input
            id={id}
            aria-describedby={d}
            type="range"
            min={0.8}
            max={0.97}
            step={0.01}
            value={settings.desiredRetention}
            onChange={(e) => void update({ desiredRetention: Number(e.target.value) })}
            className="w-full accent-[var(--accent)]"
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New cards per day (per course)">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={500}
              inputMode="numeric"
              value={settings.newPerDay}
              onChange={(e) =>
                void update({
                  newPerDay: Math.max(0, Math.min(500, Math.round(Number(e.target.value) || 0))),
                })
              }
            />
          )}
        </Field>
        <Field label="New day starts at" hint="Late-night reviews count for the previous day.">
          {(id, d) => (
            <Select
              id={id}
              aria-describedby={d}
              value={settings.dayStartHour}
              onChange={(e) => void update({ dayStartHour: Number(e.target.value) })}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Learning steps" hint="Short same-day repeats for new cards, e.g. 1m 10m.">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              value={learning}
              onChange={(e) => setLearning(e.target.value)}
              onBlur={() => {
                const steps = parseSteps(learning);
                if (steps) void update({ learningSteps: steps });
                else {
                  toast({ tone: 'error', message: 'Steps look like 1m 10m 1h' });
                  setLearning(settings.learningSteps.join(' '));
                }
              }}
            />
          )}
        </Field>
        <Field label="Relearning steps" hint="Repeats after you forget a card, e.g. 10m.">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              value={relearning}
              onChange={(e) => setRelearning(e.target.value)}
              onBlur={() => {
                const steps = parseSteps(relearning);
                if (steps) void update({ relearningSteps: steps });
                else {
                  toast({ tone: 'error', message: 'Steps look like 10m' });
                  setRelearning(settings.relearningSteps.join(' '));
                }
              }}
            />
          )}
        </Field>
        <Field label="Leech threshold" hint="Flag a card after this many lapses.">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              type="number"
              min={2}
              max={20}
              value={settings.leechThreshold}
              onChange={(e) =>
                void update({
                  leechThreshold: Math.max(
                    2,
                    Math.min(20, Math.round(Number(e.target.value) || 5)),
                  ),
                })
              }
            />
          )}
        </Field>
      </div>
      <Switch
        checked={settings.enableFuzz}
        onChange={(v) => void update({ enableFuzz: v })}
        label="Spread out reviews (fuzz)"
        description="Adds a little randomness to long intervals so cards learned together don't all fall due on the same day."
      />
    </div>
  );
}

function BackupAndSync() {
  const toast = useToast();
  const sync = useSyncState();
  const lastExportAt = useMeta<number>(LAST_EXPORT_AT_KEY);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const packRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void storageStatus().then(setStorage);
    void syncManager.refreshPending();
  }, []);

  const doExport = async () => {
    const now = Date.now();
    const backup = await exportBackup(db, now);
    downloadJson(backupFileName(now), backup);
    await repo.setMeta(LAST_EXPORT_AT_KEY, now);
    toast({ tone: 'success', message: 'Backup downloaded' });
  };

  const onPickBackup = async (file: File | undefined) => {
    if (!file) return;
    const result = parseJson(await file.text(), backupSchema);
    if (!result.ok) {
      toast({
        tone: 'error',
        message: `Not a valid backup: ${result.errors[0]}`,
        durationMs: 8000,
      });
      return;
    }
    setPending({ backup: result.data, name: file.name });
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      // Safety net: download the current state before replacing it.
      const now = Date.now();
      downloadJson(`before-restore-${backupFileName(now)}`, await exportBackup(db, now));
      await restoreBackup(db, pending.backup, now);
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

  const onPickPack = async (file: File | undefined) => {
    if (!file) return;
    const result = parseJson(await file.text(), contentPackSchema);
    if (!result.ok) {
      toast({
        tone: 'error',
        message: `Not a valid content pack: ${result.errors[0]}`,
        durationMs: 8000,
      });
      return;
    }
    try {
      const summary = await installContentPack(repo, result.data);
      toast({
        tone: 'success',
        message: `Imported ${summary.itemsCreated} items (${summary.itemsSkipped} already present)`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        message: `Import failed: ${err instanceof Error ? err.message : err}`,
      });
    }
  };

  const { label } = describeSync(sync);
  const summary = pending ? summarizeBackup(pending.backup) : null;

  return (
    <div className="space-y-6">
      <div id="sync" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Cloud sync · {label}</p>
            <p className="text-xs text-muted">
              Last synced {formatDate(sync.lastSyncAt)} · {sync.pending} local change
              {sync.pending === 1 ? '' : 's'} pending
            </p>
          </div>
          <div className="flex gap-2">
            {sync.status === 'auth' && (
              // Full navigation: Cloudflare Access shows its login page, then returns here.
              <a
                href="/auth/refresh"
                className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg"
              >
                Sign in
              </a>
            )}
            <Button
              size="sm"
              onClick={() => void syncManager.sync()}
              disabled={sync.status === 'syncing'}
            >
              <Icon name="refresh" size={16} /> Sync now
            </Button>
          </div>
        </div>
        {sync.error && <p className="text-xs text-again">{sync.error}</p>}
        <p className="text-xs text-muted">
          Your data lives on this device first; sync copies changes to your private Cloudflare
          database so your other devices — and a reinstalled app — get them too. Studying works
          offline.
        </p>
      </div>

      <div id="backup" className="space-y-3 border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Backup file</p>
            <p className="text-xs text-muted">Last exported {formatDate(lastExportAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void doExport()}>
              <Icon name="download" size={16} /> Export backup
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Restore…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void onPickBackup(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted">
          A complete JSON copy of courses, items, scheduling and review history — independent of any
          server. Keep one somewhere safe now and then.
        </p>
      </div>

      <div className="space-y-3 border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Import content pack</p>
            <p className="text-xs text-muted">
              Add courses and items from a{' '}
              <code className="font-mono">spaced-learning-content</code> JSON file. Existing items
              are never duplicated.
            </p>
          </div>
          <Button size="sm" onClick={() => packRef.current?.click()}>
            <Icon name="upload" size={16} /> Import…
          </Button>
          <input
            ref={packRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void onPickPack(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-line pt-6">
        <p className="text-sm font-medium">Storage on this device</p>
        <p className="text-xs text-muted">
          {storage?.usage != null && `Using ${formatBytes(storage.usage)}. `}
          {storage?.persisted
            ? 'Persistent storage is granted — the browser will not evict this data under storage pressure.'
            : 'Persistent storage not granted yet; the browser may evict data under storage pressure (sync and backups protect you).'}
        </p>
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
            Request persistent storage
          </Button>
        )}
      </div>

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
            <Button variant="primary" onClick={() => void confirmRestore()} disabled={busy}>
              {busy ? 'Restoring…' : 'Replace local data'}
            </Button>
          </>
        }
      >
        {summary && (
          <div className="space-y-3 text-sm">
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
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const location = useLocation();
  const [installing, setInstalling] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  const resetDevice = async () => {
    const answer = window.prompt(
      'This deletes ALL data stored on this device. Synced data stays on the server and comes back on the next sync. Type ERASE to confirm.',
    );
    if (answer !== 'ERASE') return;
    db.close();
    await db.delete();
    toast({ message: 'Device reset' });
    window.location.assign('/');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <Panel title="Appearance">
        <ThemePicker />
      </Panel>

      <Panel title="Study">{settings ? <StudySettings settings={settings} /> : null}</Panel>

      <Panel title="Backup & sync">
        <BackupAndSync />
      </Panel>

      <Panel title="Curated decks">
        <ul className="space-y-3">
          {BUNDLED_DECKS.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{d.title}</p>
                <p className="text-xs text-muted">{d.description}</p>
              </div>
              <Button size="sm" onClick={() => setInstalling(true)}>
                Install / update
              </Button>
            </li>
          ))}
        </ul>
        <InstallDeckDialog open={installing} onClose={() => setInstalling(false)} />
      </Panel>

      <Panel title="How this app works">
        <div className="space-y-3 text-sm text-muted">
          <p>
            <strong className="text-fg">Recall first.</strong> Try to answer from memory before
            revealing — that effort is what strengthens memory. Typing your answer (press{' '}
            <kbd>T</kbd> in a session) makes the attempt concrete.
          </p>
          <p>
            <strong className="text-fg">Rate honestly.</strong> Again = forgot; Hard = recalled with
            real effort; Good = recalled; Easy = instant. The FSRS scheduler uses these to predict
            when you'd forget each card.
          </p>
          <p>
            <strong className="text-fg">Write small cards.</strong> One fact per item. Use cloze
            deletions for long formulas, add a short “why” explanation, and rewrite cards that keep
            failing (leeches).
          </p>
          <p>
            <strong className="text-fg">Mixed practice.</strong> Sessions interleave topics so you
            learn to tell similar formulas and techniques apart — that's harder, and it works
            better.
          </p>
        </div>
      </Panel>

      <Panel title="Danger zone">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Erase everything stored on this device (the server copy is not affected).
          </p>
          <Button variant="danger" size="sm" onClick={() => void resetDevice()}>
            Reset this device
          </Button>
        </div>
      </Panel>
    </div>
  );
}
