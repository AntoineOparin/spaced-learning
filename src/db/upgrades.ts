/**
 * Per-table upgrades of synced records from one schema version to the next. Key N converts a
 * record written at version N-1 into version N. The sync client applies them to records pulled
 * from older clients; Dexie `version(n).upgrade()` functions should call the same ones so local
 * and wire migrations can't diverge.
 */
import { SCHEMA_VERSION, type SyncedTable } from '../domain/types';

export type RecordUpgrade = (data: Record<string, unknown>) => Record<string, unknown>;
export type UpgradeMap = Record<number, Partial<Record<SyncedTable, RecordUpgrade>>>;

export const RECORD_UPGRADES: UpgradeMap = {};

/** Brings a record written at schema version `from` up to `to`, applying each step in order. */
export function upgradeRecord(
  tbl: SyncedTable,
  data: Record<string, unknown>,
  from: number,
  upgrades: UpgradeMap = RECORD_UPGRADES,
  to: number = SCHEMA_VERSION,
): Record<string, unknown> {
  let out = data;
  for (let v = from + 1; v <= to; v++) {
    const step = upgrades[v]?.[tbl];
    if (step) out = step(out);
  }
  return out;
}
