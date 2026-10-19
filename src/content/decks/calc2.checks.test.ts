import { describe, expect, it } from 'vitest';
import { checks, type NumericCheck } from './calc2.checks';
import deck from './calc2.json';

const SAMPLES = 25;
const H = 1e-5; // central-difference step
const TOL_EXACT = 1e-6; // identity and series checks
const TOL_DIFF = 1e-4; // checks that go through a central difference

/** Deterministic PRNG (mulberry32) so failures are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of the test name, used as the seed. */
function seedFor(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Relative tolerance, with an absolute floor of `tol` for values near zero. */
function close(actual: number, expected: number, tol: number): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(actual), Math.abs(expected));
}

const centralDiff = (f: (x: number) => number, x: number) => (f(x + H) - f(x - H)) / (2 * H);

/** Returns [actual, expected, tolerance] for one sample point. */
function evaluate(check: NumericCheck, x: number, y: number): [number, number, number] {
  switch (check.kind) {
    case 'identity':
      return [check.lhs(x, y), check.rhs(x, y), TOL_EXACT];
    case 'derivative':
      return [centralDiff(check.f, x), check.df(x), TOL_DIFF];
    case 'antiderivative':
      return [centralDiff(check.F, x), check.f(x), TOL_DIFF];
    case 'series': {
      let sum = 0;
      const terms = check.terms ?? 60;
      for (let n = check.start; n < check.start + terms; n++) sum += check.term(n, x);
      return [sum, check.f(x), TOL_EXACT];
    }
  }
}

const itemKeys = new Set(deck.items.map((item) => item.key));

describe('calc2 numeric checks', () => {
  it('every check refers to a deck item', () => {
    const unknown = checks.map((c) => c.key).filter((key) => !itemKeys.has(key));
    expect(unknown).toEqual([]);
  });

  const seen = new Map<string, number>();
  for (const check of checks) {
    const count = (seen.get(check.key) ?? 0) + 1;
    seen.set(check.key, count);
    const name = count === 1 ? check.key : `${check.key} (#${count})`;

    it(name, () => {
      const random = mulberry32(seedFor(name));
      const [lo, hi] = check.domain;
      for (let i = 0; i < SAMPLES; i++) {
        const x = lo + (hi - lo) * random();
        const y = lo + (hi - lo) * random();
        const [actual, expected, tol] = evaluate(check, x, y);
        expect(
          close(actual, expected, tol),
          `${check.kind} at x=${x}, y=${y}: got ${actual}, expected ${expected}`,
        ).toBe(true);
      }
    });
  }
});
