/**
 * Enforces the import directions between source layers (see CLAUDE.md). Each layer may import
 * only from the layers listed for it; `domain` depends on nothing in the app and the Worker
 * shares no code with the client.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');

const ALLOWED: Record<string, readonly string[]> = {
  domain: [],
  lib: [],
  ui: ['lib'],
  content: ['domain', 'lib'],
  'content/decks': ['io'],
  db: ['domain', 'lib'],
  io: ['db', 'domain', 'lib'],
  sync: ['db', 'domain', 'io', 'lib'],
  app: ['db', 'domain', 'lib', 'sync', 'ui'],
  test: ['domain'],
  features: ['app', 'content', 'db', 'domain', 'io', 'lib', 'sync', 'ui', 'features/decks'],
  'features/study': ['features/editor'],
  'src(root)': ['app', 'features', 'lib', 'sync', 'ui'],
  worker: [],
};

/** Packages only the persistence and sync layers may touch. */
const RESTRICTED_PACKAGES: Record<string, readonly string[]> = {
  dexie: ['db', 'sync'],
  'dexie-react-hooks': ['db'],
  'ts-fsrs': ['domain'],
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')
      ? [full]
      : [];
  });
}

/** `src/features/study/x.ts` → `features/study`; `src/App.tsx` → `src(root)`. */
function layerOf(file: string): string {
  const rel = path.relative(ROOT, file).split(path.sep);
  if (rel[0] === 'worker') return 'worker';
  if (rel.length <= 2) return 'src(root)';
  const [, a, b] = rel;
  if (a === 'features' || (a === 'content' && b === 'decks')) return `${a}/${b}`;
  return a as string;
}

function allowed(from: string, to: string): boolean {
  if (from === to) return true;
  const group = from.split('/')[0] as string;
  const list = [...(ALLOWED[from] ?? []), ...(from !== group ? (ALLOWED[group] ?? []) : [])];
  return list.includes(to) || list.includes(to.split('/')[0] as string);
}

function imports(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'|import\s+'([^']+)'/g)].map(
    (m) => (m[1] ?? m[2]) as string,
  );
}

function resolve(file: string, spec: string): string {
  const base = path.resolve(path.dirname(file), spec);
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '.json']) {
    try {
      if (statSync(base + ext).isFile()) return base + ext;
    } catch {}
  }
  throw new Error(`${path.relative(ROOT, file)}: cannot resolve '${spec}'`);
}

const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'worker'))].filter(
  (f) => !f.includes(`${path.sep}worker${path.sep}test${path.sep}`),
);

describe('layering', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('every relative import points to an allowed layer', () => {
    const violations: string[] = [];
    for (const file of files) {
      const from = layerOf(file);
      for (const spec of imports(file)) {
        if (!spec.startsWith('.')) continue;
        const to = layerOf(resolve(file, spec));
        if (!allowed(from, to)) {
          violations.push(`${path.relative(ROOT, file)} (${from}) → ${to}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('persistence and scheduling packages stay behind their adapters', () => {
    const violations: string[] = [];
    for (const file of files) {
      const from = layerOf(file);
      for (const spec of imports(file)) {
        const pkg = spec.startsWith('@')
          ? spec.split('/').slice(0, 2).join('/')
          : spec.split('/')[0];
        const owners = RESTRICTED_PACKAGES[pkg as string];
        if (owners && !owners.includes(from)) {
          violations.push(`${path.relative(ROOT, file)} (${from}) imports ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
