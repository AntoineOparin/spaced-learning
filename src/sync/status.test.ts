import { describe, expect, it } from 'vitest';
import { HOUR, MINUTE } from '../domain/day';
import type { SyncState } from './manager';
import { describeClockSkew, describeSync } from './status';

const idle: SyncState = {
  status: 'idle',
  lastSyncAt: 1,
  pending: 0,
  error: null,
  invalid: 0,
  superseded: 0,
  clockSkewMs: null,
};

describe('describeClockSkew', () => {
  it('is quiet under the threshold and names the direction above it', () => {
    expect(describeClockSkew(null)).toBeNull();
    expect(describeClockSkew(2 * MINUTE)).toBeNull();
    expect(describeClockSkew(-12 * MINUTE)).toBe('about 12 minutes ahead of the server');
    expect(describeClockSkew(7 * MINUTE)).toBe('about 7 minutes behind the server');
    expect(describeClockSkew(3 * HOUR)).toBe('about 3 hours behind the server');
  });
});

describe('describeSync', () => {
  it('reports synced, pending and skewed clocks', () => {
    expect(describeSync(idle)).toEqual({ label: 'Synced', tone: 'ok' });
    expect(describeSync({ ...idle, pending: 3 })).toEqual({ label: '3 unsynced', tone: 'muted' });
    expect(describeSync({ ...idle, clockSkewMs: 10 * MINUTE })).toEqual({
      label: 'Check device clock',
      tone: 'warn',
    });
  });

  it('asks for an update when the server is newer', () => {
    expect(describeSync({ ...idle, status: 'outdated' })).toEqual({
      label: 'Update the app to sync',
      tone: 'warn',
    });
  });
});
