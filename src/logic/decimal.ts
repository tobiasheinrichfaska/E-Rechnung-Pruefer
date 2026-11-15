// Decimal numbers as written in e-invoices ("1234.50", "-0.5"), held exactly: BigInt digits plus a
// scale. No floating point anywhere — 0.1 + 0.2 must be 0.3. Step 3 adds the arithmetic.

export interface Decimal {
  /** value = units / 10^scale */
  units: bigint;
  scale: number;
}

const DECIMAL = /^([+-]?)(\d+)(?:\.(\d*))?$|^([+-]?)\.(\d+)$/;

/** Parses the xs:decimal lexical form (no exponent, no thousands separator); undefined otherwise. */
export function parseDecimal(text: string | undefined): Decimal | undefined {
  const match = DECIMAL.exec((text ?? '').trim());
  if (!match) return undefined;
  const sign = match[1] ?? match[4] ?? '';
  const whole = match[2] ?? '0';
  const fraction = match[3] ?? match[5] ?? '';
  const units = BigInt(`${whole}${fraction}`);
  return { units: sign === '-' ? -units : units, scale: fraction.length };
}

/** Same value, smallest scale ("100.00" → 100, scale 0). */
export function normalize(value: Decimal): Decimal {
  let { units, scale } = value;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale -= 1;
  }
  return { units, scale };
}

export function decimalEquals(a: Decimal, b: Decimal): boolean {
  const x = normalize(a);
  const y = normalize(b);
  return x.units === y.units && x.scale === y.scale;
}

/** Same value written with `scale` decimals (only ever adds zeros). */
function rescale(value: Decimal, scale: number): bigint {
  return value.units * 10n ** BigInt(scale - value.scale);
}

/** -1, 0 or 1 like a comparator. */
export function compareDecimal(a: Decimal, b: Decimal): number {
  const scale = Math.max(a.scale, b.scale);
  const x = rescale(a, scale);
  const y = rescale(b, scale);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Plain text with a dot ("1234.5" → "1234.5", scale kept). */
export function decimalText(value: Decimal): string {
  const negative = value.units < 0n;
  const digits = (negative ? -value.units : value.units).toString().padStart(value.scale + 1, '0');
  const whole = digits.slice(0, digits.length - value.scale);
  const fraction = digits.slice(digits.length - value.scale);
  return `${negative ? '-' : ''}${whole}${value.scale > 0 ? `.${fraction}` : ''}`;
}

/** German display with at least two decimals and thousands dots: "1.234,50". */
export function formatAmount(value: Decimal): string {
  const scaled =
    value.scale < 2 ? { units: value.units * 10n ** BigInt(2 - value.scale), scale: 2 } : value;
  const [whole = '0', fraction = ''] = decimalText(scaled).split('.');
  const negative = whole.startsWith('-');
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped},${fraction}`;
}

// --- arithmetic (step 3a) — exact, no floating point ----------------------------------------

export const ZERO: Decimal = { units: 0n, scale: 0 };

function aligned(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [rescale(a, scale), rescale(b, scale), scale];
}

export function add(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = aligned(a, b);
  return { units: x + y, scale };
}

export function subtract(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = aligned(a, b);
  return { units: x - y, scale };
}

export function multiply(a: Decimal, b: Decimal): Decimal {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

export function abs(a: Decimal): Decimal {
  return a.units < 0n ? { units: -a.units, scale: a.scale } : a;
}

export function sum(values: readonly Decimal[]): Decimal {
  return values.reduce(add, ZERO);
}

/** floor(a / b) for BigInt (BigInt division truncates toward zero). */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

/**
 * Rounded to `digits` decimals the way the EN 16931 Schematron does it: XPath
 * `round(x * 100) div 100`, where round() is floor(x + 0.5) — halves go up (toward +∞).
 */
export function roundTo(value: Decimal, digits: number): Decimal {
  if (value.scale <= digits) return value;
  const factor = 10n ** BigInt(value.scale - digits);
  // floor(units / factor + 1/2) = floor((2 * units + factor) / (2 * factor))
  return { units: floorDiv(2n * value.units + factor, 2n * factor), scale: digits };
}

/**
 * a lies strictly within b ± tolerance (the EN 16931 checks with a tolerance of 1); `inclusive`:
 * b may also lie on a ± tolerance (the CII forms with ≤ and ≥).
 */
export function within(a: Decimal, b: Decimal, tolerance: Decimal, inclusive = false): boolean {
  const below = compareDecimal(subtract(a, tolerance), b);
  const above = compareDecimal(add(a, tolerance), b);
  return inclusive ? below <= 0 && above >= 0 : below < 0 && above > 0;
}
