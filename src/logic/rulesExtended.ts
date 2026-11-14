// F29 (Tobias 2026-11-14): the calculation rules of FeRD for Factur-X 1.09.2 EXTENDED, as the FeRD
// Schematron (FACTUR-X_EXTENDED.sch) computes them — they replace BR-CO-10 … -13, -15, -16, the
// breakdown per category and BR-CO-17 (S: BR-FXEXT-S-09b); BR-CO-14 stays as in EN 16931.
//
//   - lines count only without a status or with status DETAIL (GROUP and INFORMATION lines carry
//     subtotals or texts);
//   - logistics charges (BT-X-272) count as charges, in BT-108 and in the breakdown;
//   - financial adjustments change the amount due (BR-FXEXT-CO-16);
//   - sums are rounded with round(x × 100) div 100 and compared with a tolerance of 0.01 per
//     amount involved (≤, not <).
//
// Only the errors of the Schematron are rebuilt, not its warnings (…-08ini, …-08rev). The breakdown
// rules group by category, rate and exemption reason, or else by category and rate; where several
// breakdowns share category and rate (only the exemption reason tells them apart) the tool does not
// rebuild that grouping and says "nicht prüfbar" instead of risking a false irregularity.
import type { ExtendedAmounts } from './analysis';
import {
  ZERO,
  abs,
  add,
  compareDecimal,
  decimalEquals,
  multiply,
  parseDecimal,
  roundTo,
  subtract,
  sum,
} from './decimal';
import type { Decimal } from './decimal';
import { groupsOf, valuesOf } from './model';
import type { InvoiceModel, ModelGroup } from './model';

export interface ExtendedCheck {
  id: string;
  ok: boolean | undefined;
  /** label → value; `null` missing, `undefined` no number */
  values: [string, Decimal | null | undefined][];
  expected?: Decimal | undefined;
  /** For the rules per VAT breakdown: category and rate */
  breakdown?: { category: string; rate: Decimal | null | undefined };
}

/** The breakdown rule of FeRD per VAT category (ids as in the Schematron). */
export const EXTENDED_BREAKDOWN: Readonly<Record<string, string>> = {
  S: 'BR-FXEXT-S08b',
  Z: 'BR-FXEXT-Z-08b',
  E: 'BR-FXEXT-E-08b',
  AE: 'BR-FXEXT-AE-08b',
  K: 'BR-FXEXT-IC-08b',
  G: 'BR-FXEXT-G-08b',
  O: 'BR-FXEXT-O-08b',
  L: 'BR-FXEXT-AF-08b',
  M: 'BR-FXEXT-AG-08b',
};

const CENT: Decimal = { units: 1n, scale: 2 };
const PERCENT: Decimal = { units: 1n, scale: 2 };
const round2 = (value: Decimal) => roundTo(value, 2);
/** |a − b| ≤ 0.01 × count */
const close = (a: Decimal, b: Decimal, count: number) =>
  compareDecimal(abs(subtract(a, b)), multiply(CENT, { units: BigInt(count), scale: 0 })) <= 0;

type Source = InvoiceModel | ModelGroup;

function one(source: Source, path: string): Decimal | null | undefined {
  const [first] = valuesOf(source, path);
  if (!first) return null;
  return parseDecimal(first.value);
}

/** The sum of the values, rounded to cents; undefined when one is missing or no number. */
function rounded(values: (Decimal | null | undefined)[]): Decimal | undefined {
  return values.every((v): v is Decimal => v !== null && v !== undefined)
    ? round2(sum(values))
    : undefined;
}

const code = (source: Source, path: string) =>
  valuesOf(source, path)[0]?.value.trim().toUpperCase() ?? '';

interface Taxed {
  amount: Decimal | null | undefined;
  category: string;
  rate: Decimal | null | undefined;
}

export function checkExtendedRules(model: InvoiceModel, ext: ExtendedAmounts): ExtendedCheck[] {
  const checks: ExtendedCheck[] = [];
  const total = (bt: string) => one(model, `BG-22/${bt}`);
  const [bt106, bt107, bt108, bt109, bt110, bt112, bt113, bt114, bt115] = [
    'BT-106',
    'BT-107',
    'BT-108',
    'BT-109',
    'BT-110',
    'BT-112',
    'BT-113',
    'BT-114',
    'BT-115',
  ].map(total);

  // Lines: only those without a status or with status DETAIL; the status list must match the lines
  const lineGroups = groupsOf(model, 'BG-25');
  const linesKnown = ext.lineStatus.length === lineGroups.length;
  const detail = lineGroups.filter((_, i) => {
    const status = (ext.lineStatus[i] ?? '').toUpperCase();
    return status === '' || status === 'DETAIL';
  });
  const lines: Taxed[] = detail.map((g) => ({
    amount: one(g, 'BT-131'),
    category: code(g, 'BG-30/BT-151'),
    rate: one(g, 'BG-30/BT-152'),
  }));
  const allowances: Taxed[] = groupsOf(model, 'BG-20').map((g) => ({
    amount: one(g, 'BT-92'),
    category: code(g, 'BT-95'),
    rate: one(g, 'BT-96'),
  }));
  const charges: Taxed[] = groupsOf(model, 'BG-21').map((g) => ({
    amount: one(g, 'BT-99'),
    category: code(g, 'BT-102'),
    rate: one(g, 'BT-103'),
  }));
  const logistics: Taxed[] = ext.logistics.map((l) => ({
    amount: parseDecimal(l.amount),
    category: l.category.trim().toUpperCase(),
    rate: l.rate === '' ? null : parseDecimal(l.rate),
  }));
  const amounts = (items: Taxed[]) => items.map((i) => i.amount);
  const lineSum = linesKnown ? rounded(amounts(lines)) : undefined;
  const allowanceSum = rounded(amounts(allowances));
  const chargeSum = rounded(amounts(charges));
  const logisticsSum = rounded(amounts(logistics));
  const chargesAll = chargeSum && logisticsSum ? add(chargeSum, logisticsSum) : undefined;
  const nbCharges = charges.length + logistics.length;

  // BR-FXEXT-CO-10: |BT-106 − round(Σ BT-131 of DETAIL lines)| ≤ 0.01 × number of all lines
  checks.push({
    id: 'BR-FXEXT-CO-10',
    ok: lineSum && bt106 ? close(bt106, lineSum, lineGroups.length) : undefined,
    values: [
      ['lineSum', lineSum],
      ['BT-106', bt106],
    ],
    expected: lineSum,
  });

  // BR-FXEXT-CO-11: no allowance and no BT-107, or |BT-107 − round(Σ BT-92)| ≤ 0.01 × count
  if (allowances.length > 0 || bt107 !== null) {
    checks.push({
      id: 'BR-FXEXT-CO-11',
      ok:
        allowanceSum === undefined || bt107 === undefined
          ? undefined
          : bt107 !== null && close(bt107, allowanceSum, allowances.length),
      values: [
        ['allowanceSum', allowanceSum],
        ['BT-107', bt107],
      ],
      expected: allowanceSum,
    });
  }

  // BR-FXEXT-CO-12: no charge and no BT-108, or |BT-108 − round(Σ BT-99) − round(Σ BT-X-272)| ≤
  // 0.01 × (charges + logistics charges)
  if (charges.length > 0 || bt108 !== null) {
    checks.push({
      id: 'BR-FXEXT-CO-12',
      ok:
        chargesAll === undefined || bt108 === undefined
          ? undefined
          : bt108 !== null && close(bt108, chargesAll, nbCharges),
      values: [
        ['chargeSum', chargeSum],
        ['logisticsSum', logisticsSum],
        ['BT-108', bt108],
      ],
      expected: chargesAll,
    });
  }

  // BR-FXEXT-CO-13: |BT-109 − Σ BT-131 + Σ BT-92 − Σ BT-99 − Σ BT-X-272| ≤ 0.01 × all counts
  {
    const expected =
      lineSum && allowanceSum && chargesAll
        ? add(subtract(lineSum, allowanceSum), chargesAll)
        : undefined;
    checks.push({
      id: 'BR-FXEXT-CO-13',
      ok:
        expected && bt109
          ? close(bt109, expected, detail.length + allowances.length + nbCharges)
          : undefined,
      values: [
        ['lineSum', lineSum],
        ['allowanceSum', allowanceSum],
        ['chargeSum', chargesAll],
        ['BT-109', bt109],
      ],
      expected,
    });
  }

  // BR-FXEXT-CO-15: with BT-110 |BT-112 − BT-110 − BT-109| ≤ 0.01 × all counts; without it BT-109
  // equals BT-112
  {
    const expected = bt109 && bt110 !== undefined ? add(bt109, bt110 ?? ZERO) : undefined;
    let ok: boolean | undefined;
    if (bt112 && bt109 && bt110 !== undefined) {
      ok =
        bt110 === null
          ? decimalEquals(bt112, bt109)
          : linesKnown
            ? close(bt112, add(bt109, bt110), detail.length + allowances.length + nbCharges)
            : undefined;
    }
    checks.push({
      id: 'BR-FXEXT-CO-15',
      ok,
      values: [
        ['BT-109', bt109],
        ['BT-110', bt110],
        ['BT-112', bt112],
      ],
      expected,
    });
  }

  // BR-FXEXT-CO-16: BT-115 = BT-112 − BT-113 + BT-114 + Σ financial adjustments (exactly)
  {
    const adjustments = ext.adjustments.map(parseDecimal);
    const adjustmentSum = adjustments.every((a): a is Decimal => a !== undefined)
      ? sum(adjustments)
      : undefined;
    const expected =
      bt112 && bt113 !== undefined && bt114 !== undefined && adjustmentSum
        ? add(add(subtract(bt112, bt113 ?? ZERO), bt114 ?? ZERO), adjustmentSum)
        : undefined;
    checks.push({
      id: 'BR-FXEXT-CO-16',
      ok: expected && bt115 ? decimalEquals(bt115, expected) : undefined,
      values: [
        ['BT-112', bt112],
        ['BT-113', bt113],
        ['BT-114', bt114],
        ['adjustmentSum', adjustmentSum],
        ['BT-115', bt115],
      ],
      expected,
    });
  }

  // Per VAT breakdown: BR-FXEXT-S-09b (S only) and the breakdown rule of the category
  const breakdowns = groupsOf(model, 'BG-23');
  for (const breakdown of breakdowns) {
    const category = code(breakdown, 'BT-118');
    const rate = one(breakdown, 'BT-119');
    const base = one(breakdown, 'BT-116');
    const tax = one(breakdown, 'BT-117');
    const perRate = category !== 'O';
    const sameRate = (item: Taxed) =>
      !perRate || Boolean(item.rate && rate && decimalEquals(item.rate, rate));
    const ofThis = (items: Taxed[]) => items.filter((i) => i.category === category && sameRate(i));
    // only the exemption reason tells these apart: not rebuilt (see the head of this file)
    const ambiguous =
      breakdowns.filter(
        (b) =>
          code(b, 'BT-118') === category &&
          (!perRate ||
            ((): boolean => {
              const other = one(b, 'BT-119');
              return Boolean(other && rate && decimalEquals(other, rate));
            })()),
      ).length > 1;
    const counted =
      ofThis(lines).length +
      ofThis(allowances).length +
      ofThis(charges).length +
      ofThis(logistics).length;
    const breakdownOf = { category, rate };

    if (category === 'S') {
      const expectedTax =
        rate && base ? round2(multiply(base, multiply(rate, PERCENT))) : undefined;
      checks.push({
        id: 'BR-FXEXT-S-09b',
        ok:
          expectedTax && tax && linesKnown && !ambiguous
            ? close(tax, expectedTax, counted)
            : undefined,
        values: [
          ['BT-116', base],
          ['BT-119', rate],
          ['BT-117', tax],
        ],
        expected: expectedTax,
        breakdown: breakdownOf,
      });
    }

    const id = EXTENDED_BREAKDOWN[category];
    if (!id) continue;
    const lineAmount = rounded(amounts(ofThis(lines)));
    const allowanceAmount = rounded(amounts(ofThis(allowances)));
    const chargeAmount = rounded(amounts(ofThis(charges)));
    const logisticsAmount = rounded(amounts(ofThis(logistics)));
    const expected =
      lineAmount && allowanceAmount && chargeAmount && logisticsAmount
        ? add(subtract(add(lineAmount, chargeAmount), allowanceAmount), logisticsAmount)
        : undefined;
    const rateKnown = !perRate || (rate !== null && rate !== undefined);
    checks.push({
      id,
      ok:
        expected && base && linesKnown && rateKnown && !ambiguous
          ? close(base, expected, counted)
          : undefined,
      values: [
        ['lineSum', lineAmount],
        ['chargeSum', chargeAmount],
        ['logisticsSum', logisticsAmount],
        ['allowanceSum', allowanceAmount],
        ['BT-116', base],
      ],
      expected,
      breakdown: breakdownOf,
    });
  }
  return checks;
}
