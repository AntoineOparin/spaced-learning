import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../domain/types';
import { AppDB } from './db';

describe('AppDB', () => {
  it('has the same version as the sync wire schema', () => {
    const db = new AppDB('db-version-test');
    expect(db.verno).toBe(SCHEMA_VERSION);
    db.close();
  });
});
