/**
 * Numeric spot-checks for the formulas in calc2.json. Each check names the deck item it verifies;
 * calc2.checks.test.ts samples every check at deterministic points.
 */

export type Fn1 = (x: number) => number;
export type Fn2 = (x: number, y: number) => number;
export type NumericCheck =
  /** lhs ≈ rhs; y is ignored by one-variable identities (both x and y are sampled from domain). */
  | { key: string; kind: 'identity'; lhs: Fn2; rhs: Fn2; domain: [number, number] }
  /** df ≈ central-difference derivative of f. */
  | { key: string; kind: 'derivative'; f: Fn1; df: Fn1; domain: [number, number] }
  /** Central-difference derivative of F ≈ f. */
  | { key: string; kind: 'antiderivative'; F: Fn1; f: Fn1; domain: [number, number] }
  /** sum_{n=start}^{start+terms-1} term(n, x) ≈ f(x). */
  | {
      key: string;
      kind: 'series';
      term: (n: number, x: number) => number;
      start: number;
      f: Fn1;
      domain: [number, number];
      terms?: number;
    };

const { sin, cos, tan, exp, log, sqrt, abs, asin, acos, atan } = Math;
const sec = (x: number) => 1 / cos(x);
const csc = (x: number) => 1 / sin(x);
const cot = (x: number) => cos(x) / sin(x);

function factorial(n: number): number {
  let p = 1;
  for (let i = 2; i <= n; i++) p *= i;
  return p;
}

/** Generalized binomial coefficient C(k, n) = k(k-1)...(k-n+1)/n!. */
function binom(k: number, n: number): number {
  let c = 1;
  for (let i = 0; i < n; i++) c *= (k - i) / (i + 1);
  return c;
}

type Domain = [number, number];

const identity = (key: string, lhs: Fn2, rhs: Fn2, domain: Domain): NumericCheck => ({
  key,
  kind: 'identity',
  lhs,
  rhs,
  domain,
});
const derivative = (key: string, f: Fn1, df: Fn1, domain: Domain): NumericCheck => ({
  key,
  kind: 'derivative',
  f,
  df,
  domain,
});
const antiderivative = (key: string, F: Fn1, f: Fn1, domain: Domain): NumericCheck => ({
  key,
  kind: 'antiderivative',
  F,
  f,
  domain,
});
const series = (
  key: string,
  term: (n: number, x: number) => number,
  start: number,
  f: Fn1,
  domain: Domain,
  terms: number,
): NumericCheck => ({ key, kind: 'series', term, start, f, domain, terms });

/** Partial sum of the antiderivative series of e^{-x^2} (used by the taylor-integral check). */
function erfLikeSeries(x: number): number {
  let s = 0;
  for (let n = 0; n < 60; n++) s += ((-1) ** n * x ** (2 * n + 1)) / ((2 * n + 1) * factorial(n));
  return s;
}

const TRIG: Domain = [-3, 3];
const NEAR_ZERO: Domain = [-1.3, 1.3]; // cos(x) > 0, avoids the poles of tan and sec
const UPPER_HALF: Domain = [0.3, 2.8]; // sin(x) > 0, avoids the poles of cot and csc
const INSIDE_UNIT: Domain = [-0.5, 0.5];

export const checks: NumericCheck[] = [
  // ---------------------------------------------------------------- derivatives
  derivative('deriv-cos', cos, (x) => -sin(x), TRIG),
  derivative('deriv-tan', tan, (x) => sec(x) ** 2, NEAR_ZERO),
  derivative('deriv-sec', sec, (x) => sec(x) * tan(x), NEAR_ZERO),
  derivative('deriv-csc', csc, (x) => -csc(x) * cot(x), UPPER_HALF),
  derivative(
    'deriv-ln-abs',
    (x) => log(abs(x)),
    (x) => 1 / x,
    [-4, -0.25],
  ),
  derivative(
    'deriv-ln-abs',
    (x) => log(abs(x)),
    (x) => 1 / x,
    [0.25, 4],
  ),
  derivative(
    'deriv-exp-a',
    (x) => 3 ** x,
    (x) => 3 ** x * log(3),
    [-2, 2],
  ),
  derivative('deriv-arcsin', asin, (x) => 1 / sqrt(1 - x * x), [-0.9, 0.9]),
  derivative('deriv-arccos', acos, (x) => -1 / sqrt(1 - x * x), [-0.9, 0.9]),
  derivative('deriv-arctan', atan, (x) => 1 / (1 + x * x), [-4, 4]),
  // d/dx ∫_0^{x^2} cos t dt = 2x cos(x^2), with the integral evaluated as sin(x^2)
  derivative(
    'ftc1-chain',
    (x) => sin(x * x),
    (x) => 2 * x * cos(x * x),
    [-2, 2],
  ),

  // ---------------------------------------------------------------- antiderivatives
  antiderivative(
    'antideriv-power',
    (x) => x ** 3.5 / 3.5,
    (x) => x ** 2.5,
    [0.2, 3],
  ),
  antiderivative(
    'antideriv-power',
    (x) => x ** -2 / -2,
    (x) => x ** -3,
    [0.5, 3],
  ),
  antiderivative(
    'antideriv-recip',
    (x) => log(abs(x)),
    (x) => 1 / x,
    [-4, -0.25],
  ),
  antiderivative(
    'antideriv-exp-a',
    (x) => 2 ** x / log(2),
    (x) => 2 ** x,
    [-3, 3],
  ),
  antiderivative('antideriv-sin', (x) => -cos(x), sin, TRIG),
  antiderivative(
    'antideriv-csc2',
    (x) => -cot(x),
    (x) => csc(x) ** 2,
    UPPER_HALF,
  ),
  antiderivative('antideriv-tan', (x) => log(abs(sec(x))), tan, NEAR_ZERO),
  antiderivative('antideriv-tan', (x) => log(abs(sec(x))), tan, [1.8, 4.4]), // cos < 0
  antiderivative('antideriv-sec', (x) => log(abs(sec(x) + tan(x))), sec, NEAR_ZERO),
  antiderivative('antideriv-sec', (x) => log(abs(sec(x) + tan(x))), sec, [1.9, 4.3]),
  antiderivative('antideriv-csc', (x) => -log(abs(csc(x) + cot(x))), csc, UPPER_HALF),
  antiderivative('antideriv-csc', (x) => -log(abs(csc(x) + cot(x))), csc, [3.5, 6]), // sin < 0
  antiderivative('antideriv-csc', (x) => log(abs(csc(x) - cot(x))), csc, UPPER_HALF),
  antiderivative(
    'antideriv-arctan-a',
    (x) => atan(x / 2) / 2,
    (x) => 1 / (x * x + 4),
    [-5, 5],
  ),
  antiderivative(
    'antideriv-arcsin-a',
    (x) => asin(x / 3),
    (x) => 1 / sqrt(9 - x * x),
    [-2.7, 2.7],
  ),
  antiderivative(
    'antideriv-mistake-xm2',
    (x) => -1 / x,
    (x) => 1 / (x * x),
    [0.3, 3],
  ),

  // ---------------------------------------------------------------- trig identities
  identity(
    'trig-pyth-sin-cos',
    (x) => 1 - sin(x) ** 2,
    (x) => cos(x) ** 2,
    [-6, 6],
  ),
  identity(
    'trig-pyth-tan-sec',
    (x) => 1 + tan(x) ** 2,
    (x) => sec(x) ** 2,
    NEAR_ZERO,
  ),
  identity(
    'trig-pyth-cot-csc',
    (x) => 1 + cot(x) ** 2,
    (x) => csc(x) ** 2,
    UPPER_HALF,
  ),
  identity(
    'trig-even-odd',
    (x) => sin(-x),
    (x) => -sin(x),
    [-6, 6],
  ),
  identity(
    'trig-even-odd',
    (x) => cos(-x),
    (x) => cos(x),
    [-6, 6],
  ),
  identity(
    'trig-double-sin',
    (x) => sin(2 * x),
    (x) => 2 * sin(x) * cos(x),
    [-6, 6],
  ),
  identity(
    'trig-double-cos',
    (x) => cos(2 * x),
    (x) => cos(x) ** 2 - sin(x) ** 2,
    [-6, 6],
  ),
  identity(
    'trig-double-cos',
    (x) => cos(2 * x),
    (x) => 2 * cos(x) ** 2 - 1,
    [-6, 6],
  ),
  identity(
    'trig-double-cos',
    (x) => cos(2 * x),
    (x) => 1 - 2 * sin(x) ** 2,
    [-6, 6],
  ),
  identity(
    'trig-double-derive',
    (x) => sin(x + x),
    (x) => 2 * sin(x) * cos(x),
    [-6, 6],
  ),
  identity(
    'trig-double-derive',
    (x) => cos(x + x),
    (x) => cos(x) ** 2 - sin(x) ** 2,
    [-6, 6],
  ),
  identity(
    'trig-sincos-half',
    (x) => sin(x) * cos(x),
    (x) => sin(2 * x) / 2,
    [-6, 6],
  ),
  identity(
    'trig-power-sin',
    (x) => sin(x) ** 2,
    (x) => (1 - cos(2 * x)) / 2,
    [-6, 6],
  ),
  identity(
    'trig-power-cos',
    (x) => cos(x) ** 2,
    (x) => (1 + cos(2 * x)) / 2,
    [-6, 6],
  ),
  identity(
    'trig-power-derive',
    (x) => sin(x) ** 2,
    (x) => (1 - cos(2 * x)) / 2,
    [-6, 6],
  ),
  // θ in (0, 2π) puts θ/2 in quadrants I–II, where the sign is +
  identity(
    'trig-half-sin',
    (t) => sin(t / 2),
    (t) => sqrt((1 - cos(t)) / 2),
    [0.1, 6.2],
  ),
  // θ in (−π, π) puts θ/2 in quadrants I or IV, where the sign is +
  identity(
    'trig-half-cos',
    (t) => cos(t / 2),
    (t) => sqrt((1 + cos(t)) / 2),
    [-3, 3],
  ),
  identity(
    'trig-sin2cos2',
    (x) => sin(x) ** 2 * cos(x) ** 2,
    (x) => (1 - cos(4 * x)) / 8,
    [-6, 6],
  ),
  identity(
    'trig-sum-sin',
    (a, b) => sin(a + b),
    (a, b) => sin(a) * cos(b) + cos(a) * sin(b),
    TRIG,
  ),
  identity(
    'trig-sum-sin',
    (a, b) => sin(a - b),
    (a, b) => sin(a) * cos(b) - cos(a) * sin(b),
    TRIG,
  ),
  identity(
    'trig-sum-cos',
    (a, b) => cos(a + b),
    (a, b) => cos(a) * cos(b) - sin(a) * sin(b),
    TRIG,
  ),
  identity(
    'trig-sum-cos',
    (a, b) => cos(a - b),
    (a, b) => cos(a) * cos(b) + sin(a) * sin(b),
    TRIG,
  ),
  identity(
    'trig-prod-sin-cos',
    (a, b) => sin(a) * cos(b),
    (a, b) => (sin(a - b) + sin(a + b)) / 2,
    TRIG,
  ),
  identity(
    'trig-prod-sin-sin',
    (a, b) => sin(a) * sin(b),
    (a, b) => (cos(a - b) - cos(a + b)) / 2,
    TRIG,
  ),
  identity(
    'trig-prod-cos-cos',
    (a, b) => cos(a) * cos(b),
    (a, b) => (cos(a - b) + cos(a + b)) / 2,
    TRIG,
  ),
  identity(
    'trig-prod-derive',
    (a, b) => cos(a - b) - cos(a + b),
    (a, b) => 2 * sin(a) * sin(b),
    TRIG,
  ),

  // ---------------------------------------------------------------- u-substitution
  antiderivative(
    'usub-pattern',
    (x) => sin(x * x),
    (x) => 2 * x * cos(x * x),
    [-2, 2],
  ),
  antiderivative(
    'usub-log-deriv',
    (x) => log(x ** 3 + 2),
    (x) => (3 * x * x) / (x ** 3 + 2),
    [-1, 2],
  ),
  antiderivative(
    'usub-linear',
    (x) => sin(3 * x + 1) / 3,
    (x) => cos(3 * x + 1),
    TRIG,
  ),
  antiderivative(
    'usub-linear',
    (x) => -exp(-2 * x) / 2,
    (x) => exp(-2 * x),
    [-2, 2],
  ),
  antiderivative(
    'usub-xexp',
    (x) => exp(x * x) / 2,
    (x) => x * exp(x * x),
    [-1.5, 1.5],
  ),
  antiderivative(
    'usub-back-sub',
    (x) => (2 / 5) * (x + 1) ** 2.5 - (2 / 3) * (x + 1) ** 1.5,
    (x) => x * sqrt(x + 1),
    [-0.9, 3],
  ),

  // ---------------------------------------------------------------- integration by parts
  antiderivative(
    'ibp-xex',
    (x) => (x - 1) * exp(x),
    (x) => x * exp(x),
    [-2, 2],
  ),
  antiderivative('ibp-lnx', (x) => x * log(x) - x, log, [0.2, 4]),
  antiderivative('ibp-arctan', (x) => x * atan(x) - log(1 + x * x) / 2, atan, [-4, 4]),
  antiderivative(
    'ibp-xcos',
    (x) => x * sin(x) + cos(x),
    (x) => x * cos(x),
    TRIG,
  ),
  antiderivative(
    'ibp-tabular',
    (x) => exp(x) * (x * x - 2 * x + 2),
    (x) => x * x * exp(x),
    [-2, 2],
  ),
  antiderivative(
    'ibp-cyclic',
    (x) => (exp(x) * (sin(x) - cos(x))) / 2,
    (x) => exp(x) * sin(x),
    [-2, 2],
  ),

  // ---------------------------------------------------------------- trigonometric integrals
  antiderivative(
    'trigint-odd-sin',
    (x) => -cos(x) + cos(x) ** 3 / 3,
    (x) => sin(x) ** 3,
    TRIG,
  ),
  antiderivative(
    'trigint-sin2',
    (x) => x / 2 - sin(2 * x) / 4,
    (x) => sin(x) ** 2,
    TRIG,
  ),
  antiderivative(
    'trigint-sin2',
    (x) => x / 2 + sin(2 * x) / 4,
    (x) => cos(x) ** 2,
    TRIG,
  ),
  antiderivative(
    'trigint-sec-even',
    (x) => tan(x) + tan(x) ** 3 / 3,
    (x) => sec(x) ** 4,
    [-1.2, 1.2],
  ),
  antiderivative(
    'trigint-tan-odd',
    (x) => sec(x) ** 5 / 5 - sec(x) ** 3 / 3,
    (x) => tan(x) ** 3 * sec(x) ** 3,
    [-1.2, 1.2],
  ),
  antiderivative(
    'trigint-tan2',
    (x) => tan(x) - x,
    (x) => tan(x) ** 2,
    NEAR_ZERO,
  ),
  antiderivative('trigint-sec-derive', (x) => log(abs(sec(x) + tan(x))), sec, NEAR_ZERO),
  antiderivative(
    'trigint-sec3',
    (x) => (sec(x) * tan(x) + log(abs(sec(x) + tan(x)))) / 2,
    (x) => sec(x) ** 3,
    NEAR_ZERO,
  ),
  antiderivative(
    'trigint-prod-sum',
    (x) => -cos(8 * x) / 16 + cos(2 * x) / 4,
    (x) => sin(3 * x) * cos(5 * x),
    TRIG,
  ),
  identity(
    'trigint-prod-sum',
    (x) => sin(3 * x) * cos(5 * x),
    (x) => (sin(8 * x) - sin(2 * x)) / 2,
    TRIG,
  ),
  antiderivative(
    'trigint-equivalent',
    (x) => sin(x) ** 2 / 2,
    (x) => sin(x) * cos(x),
    TRIG,
  ),
  antiderivative(
    'trigint-equivalent',
    (x) => -(cos(x) ** 2) / 2,
    (x) => sin(x) * cos(x),
    TRIG,
  ),
  antiderivative(
    'trigint-equivalent',
    (x) => -cos(2 * x) / 4,
    (x) => sin(x) * cos(x),
    TRIG,
  ),

  // ---------------------------------------------------------------- trig substitution (a = 3 or 2)
  // The radical simplifies to a nonnegative expression on the stated θ-range.
  identity(
    'trigsub-sin',
    (t) => sqrt(9 - 9 * sin(t) ** 2),
    (t) => 3 * cos(t),
    [-1.55, 1.55],
  ),
  identity(
    'trigsub-tan',
    (t) => sqrt(9 + 9 * tan(t) ** 2),
    (t) => 3 * sec(t),
    [-1.4, 1.4],
  ),
  identity(
    'trigsub-sec',
    (t) => sqrt(9 * sec(t) ** 2 - 9),
    (t) => 3 * tan(t),
    [0.05, 1.5],
  ),
  identity(
    'trigsub-sec',
    (t) => sqrt(9 * sec(t) ** 2 - 9),
    (t) => 3 * tan(t),
    [3.2, 4.6],
  ),
  identity(
    'trigsub-triangle',
    (x) => tan(asin(x / 3)),
    (x) => x / sqrt(9 - x * x),
    [-2.8, 2.8],
  ),
  antiderivative(
    'trigsub-int-sqrt-x2-plus-a2',
    (x) => log(x + sqrt(x * x + 4)),
    (x) => 1 / sqrt(x * x + 4),
    [-4, 4],
  ),
  antiderivative(
    'trigsub-half-disk',
    (x) => (x / 2) * sqrt(9 - x * x) + (9 / 2) * asin(x / 3),
    (x) => sqrt(9 - x * x),
    [-2.8, 2.8],
  ),
  antiderivative(
    'trigsub-example',
    (x) => -sqrt(4 - x * x) / (4 * x),
    (x) => 1 / (x * x * sqrt(4 - x * x)),
    [0.3, 1.9],
  ),
  antiderivative(
    'trigsub-complete-square',
    (x) => asin((x + 1) / 2),
    (x) => 1 / sqrt(3 - 2 * x - x * x),
    [-2.8, 0.8],
  ),
  antiderivative(
    'trigsub-not-needed',
    (x) => -sqrt(4 - x * x),
    (x) => x / sqrt(4 - x * x),
    [-1.8, 1.8],
  ),

  // ---------------------------------------------------------------- partial fractions
  identity(
    'pf-proper',
    (x) => (x * x) / (x - 1),
    (x) => x + 1 + 1 / (x - 1),
    [1.2, 5],
  ),
  antiderivative(
    'pf-proper',
    (x) => (x * x) / 2 + x + log(abs(x - 1)),
    (x) => (x * x) / (x - 1),
    [1.2, 5],
  ),
  identity(
    'pf-coverup',
    (x) => (3 * x + 1) / ((x - 2) * (x + 1)),
    (x) => 7 / 3 / (x - 2) + 2 / 3 / (x + 1),
    [2.2, 6],
  ),
  antiderivative(
    'pf-x2-minus-a2',
    (x) => log(abs((x - 2) / (x + 2))) / 4,
    (x) => 1 / (x * x - 4),
    [2.3, 6],
  ),
  antiderivative(
    'pf-x2-minus-a2',
    (x) => log(abs((x - 2) / (x + 2))) / 4,
    (x) => 1 / (x * x - 4),
    [-1.8, 1.8],
  ),
  antiderivative(
    'pf-example',
    (x) => log(abs(x / (x + 1))),
    (x) => 1 / (x * (x + 1)),
    [0.2, 4],
  ),
  antiderivative(
    'pf-example-quad',
    (x) => log(abs(x)) - log(x * x + 1) / 2,
    (x) => 1 / (x * (x * x + 1)),
    [0.2, 4],
  ),
  identity(
    'pf-mistake-repeated',
    (x) => (x + 3) / (x - 1) ** 2,
    (x) => 1 / (x - 1) + 4 / (x - 1) ** 2,
    [1.2, 5],
  ),

  // ---------------------------------------------------------------- choosing a technique
  antiderivative(
    'intstrat-x2-sinx',
    (x) => -x * x * cos(x) + 2 * x * sin(x) + 2 * cos(x),
    (x) => x * x * sin(x),
    TRIG,
  ),
  antiderivative(
    'intstrat-sqrt-9-x2',
    (x) => (x / 2) * sqrt(9 - x * x) + (9 / 2) * asin(x / 3),
    (x) => sqrt(9 - x * x),
    [-2.8, 2.8],
  ),
  antiderivative(
    'intstrat-pf',
    (x) => 2 * log(abs(x - 2)) + 3 * log(abs(x + 1)),
    (x) => (5 * x - 4) / (x * x - x - 2),
    [2.3, 6],
  ),
  antiderivative(
    'intstrat-sin3-cos2',
    (x) => -(cos(x) ** 3) / 3 + cos(x) ** 5 / 5,
    (x) => sin(x) ** 3 * cos(x) ** 2,
    TRIG,
  ),
  antiderivative(
    'intstrat-split',
    (x) => log(x * x + 1) / 2 + atan(x),
    (x) => (x + 1) / (x * x + 1),
    [-4, 4],
  ),
  antiderivative(
    'intstrat-lnx-over-x',
    (x) => log(x) ** 2 / 2,
    (x) => log(x) / x,
    [0.2, 5],
  ),
  antiderivative(
    'intstrat-complete-square',
    (x) => atan((x + 3) / 2) / 2,
    (x) => 1 / (x * x + 6 * x + 13),
    [-8, 3],
  ),
  antiderivative(
    'intstrat-x-lnx',
    (x) => ((x * x) / 2) * log(x) - (x * x) / 4,
    (x) => x * log(x),
    [0.2, 4],
  ),
  antiderivative(
    'intstrat-x2-sqrt-x2-plus-4',
    (x) => -sqrt(x * x + 4) / (4 * x),
    (x) => 1 / (x * x * sqrt(x * x + 4)),
    [0.3, 4],
  ),
  antiderivative(
    'intstrat-sin-sqrt',
    (x) => 2 * sin(sqrt(x)) - 2 * sqrt(x) * cos(sqrt(x)),
    (x) => sin(sqrt(x)),
    [0.2, 9],
  ),
  antiderivative(
    'intstrat-x3-over-x2-plus-1',
    (x) => (x * x) / 2 - log(x * x + 1) / 2,
    (x) => x ** 3 / (x * x + 1),
    [-4, 4],
  ),
  antiderivative(
    'intstrat-exp-arctan',
    (x) => atan(exp(x)),
    (x) => exp(x) / (1 + exp(2 * x)),
    [-3, 3],
  ),

  // ---------------------------------------------------------------- series
  series(
    'geo-sum',
    (n, x) => 3 * x ** (n - 1),
    1,
    (x) => 3 / (1 - x),
    INSIDE_UNIT,
    80,
  ),
  series(
    'serstrat-ratio-factorial',
    (n) => 3 ** n / factorial(n),
    0,
    () => exp(3),
    [0, 1],
    60,
  ),
  series(
    'ps-geometric',
    (n, x) => x ** n,
    0,
    (x) => 1 / (1 - x),
    INSIDE_UNIT,
    80,
  ),
  series(
    'ps-substitution',
    (n, x) => (-1) ** n * x ** (2 * n),
    0,
    (x) => 1 / (1 + x * x),
    INSIDE_UNIT,
    60,
  ),
  series(
    'ps-ln-derive',
    (n, x) => -(x ** n) / n,
    1,
    (x) => log(1 - x),
    INSIDE_UNIT,
    80,
  ),
  series(
    'ps-diff-derive',
    (n, x) => n * x ** (n - 1),
    1,
    (x) => 1 / (1 - x) ** 2,
    INSIDE_UNIT,
    100,
  ),
  series('mac-exp', (n, x) => x ** n / factorial(n), 0, exp, [-2, 2], 40),
  series(
    'mac-sin',
    (n, x) => ((-1) ** n * x ** (2 * n + 1)) / factorial(2 * n + 1),
    0,
    sin,
    [-3, 3],
    30,
  ),
  series('mac-cos', (n, x) => ((-1) ** n * x ** (2 * n)) / factorial(2 * n), 0, cos, [-3, 3], 30),
  series(
    'mac-ln',
    (n, x) => ((-1) ** (n - 1) * x ** n) / n,
    1,
    (x) => log(1 + x),
    INSIDE_UNIT,
    80,
  ),
  series(
    'mac-arctan',
    (n, x) => ((-1) ** n * x ** (2 * n + 1)) / (2 * n + 1),
    0,
    atan,
    INSIDE_UNIT,
    60,
  ),
  series(
    'mac-binomial',
    (n, x) => binom(0.5, n) * x ** n,
    0,
    (x) => sqrt(1 + x),
    INSIDE_UNIT,
    80,
  ),
  series(
    'mac-binomial',
    (n, x) => binom(-3, n) * x ** n,
    0,
    (x) => (1 + x) ** -3,
    INSIDE_UNIT,
    80,
  ),
  series(
    'mac-exp-neg-x2',
    (n, x) => ((-1) ** n * x ** (2 * n)) / factorial(n),
    0,
    (x) => exp(-x * x),
    [-1.5, 1.5],
    40,
  ),
  series('taylor-exp-at-2', (n, x) => (exp(2) * (x - 2) ** n) / factorial(n), 0, exp, [1, 3], 40),
  antiderivative('taylor-integral', erfLikeSeries, (x) => exp(-x * x), [-1.5, 1.5]),
  // Closer to the endpoint x = 1, where the arctan series converges slowly.
  series(
    'mac-arctan',
    (n, x) => ((-1) ** n * x ** (2 * n + 1)) / (2 * n + 1),
    0,
    atan,
    [0.6, 0.75],
    200,
  ),
];
