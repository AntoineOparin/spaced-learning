import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
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
import { Button, buttonClass } from '../../ui/Button';
import { useConfirm } from '../../ui/Confirm';
import { cn } from '../../ui/cn';
import { Dialog } from '../../ui/Dialog';
import { Input, Segmented, Select, Switch } from '../../ui/Field';
import { Icon, type IconName } from '../../ui/Icon';
import { PageHeader } from '../../ui/misc';
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

/** A titled, grouped list of settings rows (iOS Settings / Notion). */
function Section({
  id,
  title,
  children,
  plain = false,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  /** Render children as-is instead of a divided list. */
  plain?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div
        className={cn(
          'rounded-xl border border-line bg-bg-alt',
          plain ? 'px-5 py-5' : 'divide-y divide-line',
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** One setting: label and hint on the left, its control on the right (stacked on phones). */
function Row({
  label,
  hint,
  children,
  stacked = false,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Receives the id to put on the control and the id of the hint for aria-describedby. */
  children?: ReactNode | ((id: string, describedBy: string | undefined) => ReactNode);
  stacked?: boolean;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const control = typeof children === 'function' ? children(id, hintId) : children;
  const labelled = typeof children === 'function';
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-5 py-4',
        !stacked && 'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0">
        {labelled ? (
          <label htmlFor={id} className="text-[15px] font-semibold">
            {label}
          </label>
        ) : (
          <p className="text-[15px] font-semibold">{label}</p>
        )}
        {hint && (
          <p id={hintId} className="mt-0.5 text-[13px] leading-5 text-muted">
            {hint}
          </p>
        )}
      </div>
      {control && <div className="flex shrink-0 flex-wrap gap-2">{control}</div>}
    </div>
  );
}

function ThemePicker() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const options: { value: ThemePref; label: string; icon: IconName }[] = [
    { value: 'system', label: 'System', icon: 'monitor' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ];
  return (
    <Segmented
      legend="Theme"
      value={pref}
      onChange={(v) => {
        setPref(v);
        setThemePref(v);
      }}
      options={options}
      className="w-full sm:w-80"
    />
  );
}

function StudySettings({ settings }: { settings: Settings }) {
  const toast = useToast();
  const [learning, setLearning] = useState(settings.learningSteps.join(' '));
  const [relearning, setRelearning] = useState(settings.relearningSteps.join(' '));
  const update = async (patch: Partial<Settings>) => {
    await repo.updateSettings(patch);
  };

  const retention = Math.round(settings.desiredRetention * 100);
  const fill = ((settings.desiredRetention - 0.8) / (0.97 - 0.8)) * 100;
  return (
    <>
      <Row
        stacked
        label={
          <span className="flex items-baseline justify-between gap-4">
            Desired retention
            <span className="text-lg font-extrabold tabular-nums">{retention}%</span>
          </span>
        }
        hint="The chance of recalling a card when it comes due. 90% is a good default; each extra point costs noticeably more reviews. Courses can override this."
        className="[&>div:first-child]:w-full"
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
            className="range w-full"
            style={{ '--fill': `${fill}%` } as React.CSSProperties}
          />
        )}
      </Row>
      <Row label="New cards per day" hint="Per course.">
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            type="number"
            min={0}
            max={500}
            inputMode="numeric"
            value={settings.newPerDay}
            className="w-28 text-right tabular-nums"
            onChange={(e) =>
              void update({
                newPerDay: Math.max(0, Math.min(500, Math.round(Number(e.target.value) || 0))),
              })
            }
          />
        )}
      </Row>
      <Row label="New day starts at" hint="Late-night reviews count for the previous day.">
        {(id, d) => (
          <Select
            id={id}
            aria-describedby={d}
            value={settings.dayStartHour}
            className="w-28 tabular-nums"
            onChange={(e) => void update({ dayStartHour: Number(e.target.value) })}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </Select>
        )}
      </Row>
      <Row label="Learning steps" hint="Short same-day repeats for new cards, e.g. 1m 10m.">
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            value={learning}
            className="w-40 font-mono text-sm"
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
      </Row>
      <Row label="Relearning steps" hint="Repeats after you forget a card, e.g. 10m.">
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            value={relearning}
            className="w-40 font-mono text-sm"
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
      </Row>
      <Row label="Leech threshold" hint="Flag a card after this many lapses.">
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            type="number"
            min={2}
            max={20}
            value={settings.leechThreshold}
            className="w-28 text-right tabular-nums"
            onChange={(e) =>
              void update({
                leechThreshold: Math.max(2, Math.min(20, Math.round(Number(e.target.value) || 5))),
              })
            }
          />
        )}
      </Row>
      <div className="px-5 py-4">
        <Switch
          checked={settings.enableFuzz}
          onChange={(v) => void update({ enableFuzz: v })}
          label="Spread out reviews"
          description="Adds a little randomness to long intervals so cards learned together don’t all fall due on the same day."
        />
      </div>
    </>
  );
}

/** Sync, backup and content: everything that moves data in or out of this device. */
function DataSections() {
  const toast = useToast();
  const sync = useSyncState();
  const lastExportAt = useMeta<number>(LAST_EXPORT_AT_KEY);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState(false);
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
    <>
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
          <Button
            size="sm"
            onClick={() => void syncManager.sync()}
            disabled={sync.status === 'syncing'}
          >
            <Icon name="refresh" size={16} /> Sync now
          </Button>
        </Row>
        {sync.error && (
          <p className="flex gap-2 px-5 py-3 text-[13px] font-medium text-danger-text">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            {sync.error}
          </p>
        )}
        <p className="px-5 py-4 text-[13px] leading-5 text-muted">
          Your data lives on this device first. Sync copies changes to your private Cloudflare
          database, so your other devices — and a reinstalled app — get them too. Studying works
          offline.
        </p>
      </Section>

      <Section id="backup" title="Backup">
        <Row
          label="Backup file"
          hint={`A complete JSON copy of courses, items, scheduling and review history. Last exported ${formatDate(lastExportAt)}.`}
        >
          <Button size="sm" onClick={() => void doExport()}>
            <Icon name="download" size={16} /> Export backup
          </Button>
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
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
      </Section>

      <Section title="Content">
        {BUNDLED_DECKS.map((d) => (
          <Row key={d.id} label={d.title} hint={d.description}>
            <Button size="sm" onClick={() => setInstalling(true)}>
              Install / update
            </Button>
          </Row>
        ))}
        <Row
          label="Import content pack"
          hint={
            <>
              Add courses and items from a{' '}
              <code className="font-mono text-xs">spaced-learning-content</code> JSON file. Existing
              items are never duplicated.
            </>
          }
        >
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
        </Row>
        <InstallDeckDialog open={installing} onClose={() => setInstalling(false)} />
      </Section>

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
    </>
  );
}

const PRINCIPLES: [string, ReactNode][] = [
  [
    'Recall first.',
    <>
      Try to answer from memory before revealing — that effort is what strengthens memory. Typing or
      drawing your answer (press <kbd className="font-mono">T</kbd> or{' '}
      <kbd className="font-mono">D</kbd> in a session) makes the attempt concrete.
    </>,
  ],
  [
    'Rate honestly.',
    'Again = forgot; Hard = recalled with real effort; Good = recalled; Easy = instant. The FSRS scheduler uses these to predict when you’d forget each card.',
  ],
  [
    'Write small cards.',
    'One fact per item. Use cloze deletions for long formulas, add a short “why” explanation, and rewrite cards that keep failing (leeches).',
  ],
  [
    'Mix it up.',
    'Sessions interleave topics so you learn to tell similar formulas and techniques apart — that’s harder, and it works better.',
  ],
];

export default function SettingsPage() {
  const settings = useSettings();
  const location = useLocation();
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  const resetDevice = async () => {
    const ok = await confirm({
      title: 'Reset this device?',
      body: 'This deletes all data stored on this device. Synced data stays on the server and comes back on the next sync.',
      confirmLabel: 'Erase this device',
      typeToConfirm: 'ERASE',
    });
    if (!ok) return;
    db.close();
    await db.delete();
    toast({ message: 'Device reset' });
    window.location.assign('/');
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="Settings" />
      <div className="space-y-10">
        <Section title="Appearance">
          <Row label="Theme">
            <ThemePicker />
          </Row>
        </Section>

        <Section title="Study">{settings ? <StudySettings settings={settings} /> : null}</Section>

        <DataSections />

        <Section title="How this app works" plain>
          <ul className="space-y-4 text-[15px] text-muted">
            {PRINCIPLES.map(([lead, body]) => (
              <li key={lead}>
                <strong className="font-bold text-fg">{lead}</strong> {body}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Danger zone">
          <Row
            label="Reset this device"
            hint="Erase everything stored on this device. The server copy is not affected."
          >
            <Button variant="danger" size="sm" onClick={() => void resetDevice()}>
              Reset this device
            </Button>
          </Row>
        </Section>
      </div>
    </div>
  );
}
