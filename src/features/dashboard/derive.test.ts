import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE } from '../../domain/day';
import { backupStatus, greeting, minutes } from './derive';

describe('dashboard derivations', () => {
  it('formats study time in whole minutes', () => {
    expect(minutes(20_000)).toBe('< 1 min');
    expect(minutes(3 * MINUTE)).toBe('3 min');
    expect(minutes(2.6 * MINUTE)).toBe('3 min');
  });

  it('greets by local hour', () => {
    const at = (h: number) => new Date(2026, 0, 1, h).getTime();
    expect(greeting(at(6))).toBe('Good morning');
    expect(greeting(at(13))).toBe('Good afternoon');
    expect(greeting(at(22))).toBe('Good evening');
    expect(greeting(at(3))).toBe('Good evening');
  });

  it('treats a recent sync as a backup and stays quiet while loading', () => {
    const now = 100 * DAY;
    expect(backupStatus(undefined, null, now).stale).toBe(false);
    expect(backupStatus(null, null, now)).toEqual({ stale: true, lastBackup: 0 });
    expect(backupStatus(null, now - HOUR, now).stale).toBe(false);
    expect(backupStatus(now - 20 * DAY, now - 15 * DAY, now).stale).toBe(true);
    expect(backupStatus(now - 13 * DAY, null, now).stale).toBe(false);
  });
});
