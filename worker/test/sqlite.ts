/** Test adapter: runs the Worker's SQL against node:sqlite with D1-like semantics. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlDb, SqlStatement } from '../sync.ts';

const MIGRATIONS = path.join(import.meta.dirname, '..', 'migrations');

/** Applies every migration in order, like `wrangler d1 migrations apply`. */
export function applyMigrations(raw: DatabaseSync): void {
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    raw.exec(readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }
}

export function createTestDb(): SqlDb & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  applyMigrations(raw);

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
