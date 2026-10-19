/** Full backup export/restore (all records, including tombstones and review history). */
import type { AppDB } from '../db/db';
import { SYNC_CURSOR_KEY } from '../db/metaKeys';
import { BACKUP_FORMAT, type BackupFile } from './schema';

export async function exportBackup(db: AppDB, now: number): Promise<BackupFile> {
  return db.transaction(
    'r',
    [db.courses, db.topics, db.items, db.cards, db.reviewLogs, db.settings],
    async () => ({
      format: BACKUP_FORMAT,
      version: 1 as const,
      exportedAt: now,
      courses: await db.courses.toArray(),
      topics: await db.topics.toArray(),
      items: await db.items.toArray(),
      cards: await db.cards.toArray(),
      reviewLogs: await db.reviewLogs.toArray(),
      settings: await db.settings.toArray(),
    }),
  );
}

export function backupFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `spaced-learning-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export interface BackupSummary {
  exportedAt: number;
  courses: number;
  items: number;
  cards: number;
  reviews: number;
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  const alive = <T extends { deletedAt?: number }>(rows: T[]) =>
    rows.filter((r) => r.deletedAt === undefined).length;
  return {
    exportedAt: backup.exportedAt,
    courses: alive(backup.courses),
    items: alive(backup.items),
    cards: alive(backup.cards),
    reviews: alive(backup.reviewLogs),
  };
}

/**
 * Replaces all local data with the backup, in one transaction (all or nothing).
 *
 * Every record is re-stamped (`updatedAt = now`, dirty) so the restored state wins on the next
 * sync, and the sync cursor is reset so records created on other devices after the backup are
 * pulled back rather than lost.
 */
export async function restoreBackup(db: AppDB, backup: BackupFile, now: number): Promise<void> {
  const tables = [db.courses, db.topics, db.items, db.cards, db.reviewLogs, db.settings];
  await db.transaction('rw', [...tables, db.meta], async () => {
    const restamp = <T extends object>(rows: T[]) =>
      rows.map((r) => ({ ...r, updatedAt: now, dirty: 1 as const }));
    await Promise.all(tables.map((t) => t.clear()));
    await db.courses.bulkAdd(restamp(backup.courses));
    await db.topics.bulkAdd(restamp(backup.topics));
    await db.items.bulkAdd(restamp(backup.items));
    await db.cards.bulkAdd(restamp(backup.cards));
    await db.reviewLogs.bulkAdd(restamp(backup.reviewLogs));
    await db.settings.bulkAdd(restamp(backup.settings));
    await db.meta.delete(SYNC_CURSOR_KEY);
  });
}
