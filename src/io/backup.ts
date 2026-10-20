/** Full backup export (all records, including tombstones and review history). */
import type { Repo } from '../db/repo';
import { BACKUP_FORMAT, type BackupFile } from './schema';

export async function exportBackup(repo: Repo, now: number): Promise<BackupFile> {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now, ...(await repo.exportSnapshot()) };
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
