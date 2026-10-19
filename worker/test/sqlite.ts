/** Test adapter: runs the Worker's SQL against node:sqlite with D1-like semantics. */
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlDb, SqlStatement } from '../sync.ts';

const MIGRATION = new URL('../migrations/0001_init.sql', import.meta.url);

export function createTestDb(): SqlDb & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(MIGRATION, 'utf8'));

  class Statement implements SqlStatement {
    private readonly sql: string;
    private readonly params: SQLInputValue[];

    constructor(sql: string, params: SQLInputValue[] = []) {
      this.sql = sql;
      this.params = params;
    }
    bind(...values: unknown[]): SqlStatement {
      return new Statement(this.sql, values as SQLInputValue[]);
    }
    async all<T>() {
      return { results: raw.prepare(this.sql).all(...this.params) as T[] };
    }
    async first<T>() {
      return (raw.prepare(this.sql).get(...this.params) as T | undefined) ?? null;
    }
    async run() {
      return raw.prepare(this.sql).run(...this.params);
    }
  }

  return {
    raw,
    prepare: (sql) => new Statement(sql),
    // D1 batches run as a single transaction.
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const results: unknown[] = [];
        for (const s of statements) results.push(await s.run());
        raw.exec('COMMIT');
        return results;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };
}
