// Step 3a: a selection of the EN 16931 calculation rules — the totals (BR-CO-10 … BR-CO-17) and the
// VAT breakdown per category and rate (BR-S-08 …). Computed exactly as the CEN Schematron 1.3.17
// does (EN16931-UBL-model.sch): sums rounded with round(x * 100) div 100, a tolerance of 1 for
// BR-CO-17 and for the breakdown of S, L and M. Hints only ("mögliche Auffälligkeit"), never an
// approval; no full validator (non-goal).
import {
  ZERO,
  abs,
  add,
  decimalEquals,
  decimalText,
  formatAmount,
  multiply,
  normalize,
  parseDecimal,
  roundTo,
  subtract,
  sum,
  within,
} from './decimal';
import type { Decimal } from './decimal';
import { groupsOf, valuesOf } from './model';
import type { InvoiceModel, ModelGroup } from './model';
import { TEXTS, fill } from './texts';

export type RuleStatus = 'passt' | 'auffaellig' | 'nichtPruefbar';

export interface RuleValue {
  label: string;
  value: string;
}

export interface RuleResult {
  /** e.g. "BR-CO-15" */
  id: string;
  /** What is checked, in German */
  label: string;
  /** For rules per VAT breakdown: which one, e.g. "Kategorie S, 19 %" */
  occurrence?: string;
  status: RuleStatus;
  /** The values that show the result */
  values: RuleValue[];
}

export interface RulesResult {
  results: RuleResult[];
  /** Ids of the rules with a possible irregularity */
  auffaellig: string[];
  summary: string;
}

/** What each rule checks (German, shown with the rule id). */
export const RULE_LABELS: Readonly<Record<string, string>> = {
  'BR-CO-10': 'Summe der Nettobeträge (BT-106) = Summe der Positionen (BT-131)',
  'BR-CO-11': 'Summe der Nachlässe (BT-107) = Nachlässe auf Dokumentebene (BT-92)',
  'BR-CO-12': 'Summe der Zuschläge (BT-108) = Zuschläge auf Dokumentebene (BT-99)',
  'BR-CO-13': 'Gesamtbetrag ohne Umsatzsteuer (BT-109) = BT-106 − BT-107 + BT-108',
  'BR-CO-14': 'Summe der Umsatzsteuer (BT-110) = Steuerbeträge je Kategorie (BT-117)',
  'BR-CO-15': 'Gesamtbetrag mit Umsatzsteuer (BT-112) = BT-109 + BT-110',
  'BR-CO-16': 'Fälliger Betrag (BT-115) = BT-112 − Vorauszahlung (BT-113) + Rundung (BT-114)',
  'BR-CO-17':
    'Steuerbetrag (BT-117) = Bemessungsgrundlage (BT-116) × Steuersatz (BT-119), Toleranz 1',
  BREAKDOWN:
    'Bemessungsgrundlage (BT-116) = Positionen + Zuschläge − Nachlässe dieser Kategorie und dieses Satzes',
};

/** The breakdown rule per VAT category; S, L and M per rate with a tolerance of 1. */
const BREAKDOWN_RULES: Readonly<Record<string, { id: string; perRate: boolean }>> = {
  S: { id: 'BR-S-08', perRate: true },
  Z: { id: 'BR-Z-08', perRate: false },
  E: { id: 'BR-E-08', perRate: false },
  AE: { id: 'BR-AE-08', perRate: false },
  K: { id: 'BR-IC-08', perRate: false },
  G: { id: 'BR-G-08', perRate: false },
  O: { id: 'BR-O-08', perRate: false },
  L: { id: 'BR-IG-08', perRate: true },
  M: { id: 'BR-IP-08', perRate: true },
};

const ONE: Decimal = { units: 1n, scale: 0 };
const PERCENT: Decimal = { units: 1n, scale: 2 };

type Source = InvoiceModel | ModelGroup;

/** All values at a path, as decimals; undefined when one of them is no number. */
function decimals(source: Source, path: string): Decimal[] | undefined {
  const parsed = valuesOf(source, path).map((v) => parseDecimal(v.value));
  return parsed.every((d): d is Decimal => d !== undefined) ? parsed : undefined;
}

/** The value at a path: missing → null, not a number → undefined (cannot be checked). */
function one(source: Source, path: string): Decimal | null | undefined {
  const [first] = valuesOf(source, path);
  if (!first) return null;
  return parseDecimal(first.value);
}

const round2 = (value: Decimal) => roundTo(value, 2);
const percent = (rate: Decimal) => `${decimalText(normalize(rate)).replace('.', ',')} %`;
const code = (source: Source, path: string) =>
  valuesOf(source, path)[0]?.value.trim().toUpperCase();

export interface RulesOptions {
  /**
   * false for profiles with hierarchical lines (FeRD EXTENDED: GROUP lines carry subtotals that the
   * tool reads as positions, audit B-02b) — the rules that sum the lines are then not checked.
   */
  lineSums?: boolean;
}

export function checkRules(model: InvoiceModel, options: RulesOptions = {}): RulesResult {
  const lineSums = options.lineSums ?? true;
  const currency = valuesOf(model, 'BT-5')[0]?.value;
  const money = (value: Decimal | null | undefined) =>
    value === null
      ? TEXTS.ruleMissing
      : value === undefined
        ? TEXTS.ruleNoNumber
        : `${formatAmount(value)}${currency ? ` ${currency}` : ''}`;
  const results: RuleResult[] = [];
  const add_ = (
    id: string,
    ok: boolean | undefined,
    values: RuleValue[],
    occurrence?: string,
    label = RULE_LABELS[id] ?? id,
  ) =>
    results.push({
      id,
      label,
      ...(occurrence ? { occurrence } : {}),
      status: ok === undefined ? 'nichtPruefbar' : ok ? 'passt' : 'auffaellig',
      values,
    });

  const total = (bt: string) => one(model, `BG-22/${bt}`);
  const bt106 = total('BT-106');
  const bt107 = total('BT-107');
  const bt108 = total('BT-108');
  const bt109 = total('BT-109');
  const bt110 = total('BT-110');
  const bt112 = total('BT-112');
  const bt113 = total('BT-113');
  const bt114 = total('BT-114');
  const bt115 = total('BT-115');
  const known = (...values: (Decimal | null | undefined)[]) => values.every((v) => v !== undefined);

  // BR-CO-10: BT-106 = round(Σ BT-131)
  const lines = groupsOf(model, 'BG-25');
  const lineAmounts = lines.map((line) => one(line, 'BT-131'));
  const lineSum = lineAmounts.every((a): a is Decimal => a !== null && a !== undefined)
    ? sum(lineAmounts)
    : undefined;
  add_(
    'BR-CO-10',
    lineSums && lines.length > 0 && lineSum && bt106
      ? decimalEquals(bt106, round2(lineSum))
      : undefined,
    [
      { label: TEXTS.ruleLineSum, value: lineSum ? money(lineSum) : TEXTS.ruleNoNumber },
      { label: 'BT-106', value: money(bt106) },
    ],
  );

  // BR-CO-11 / BR-CO-12: document level allowances and charges (only where any is given)
  for (const [id, group, path, bt, value] of [
    ['BR-CO-11', 'BG-20', 'BT-92', 'BT-107', bt107],
    ['BR-CO-12', 'BG-21', 'BT-99', 'BT-108', bt108],
  ] as const) {
    const parts = groupsOf(model, group);
    if (parts.length === 0 && value === null) continue;
    const amounts = parts.map((p) => one(p, path));
    const partSum = amounts.every((a): a is Decimal => a !== null && a !== undefined)
      ? sum(amounts)
      : undefined;
    add_(
      id,
      partSum === undefined || value === undefined
        ? undefined
        : value !== null && decimalEquals(value, round2(partSum)),
      [
        { label: `Σ ${path}`, value: partSum ? money(partSum) : TEXTS.ruleNoNumber },
        { label: bt, value: money(value) },
      ],
    );
  }

  // BR-CO-13: BT-109 = round(BT-106 + BT-108 − BT-107); without both: BT-109 = BT-106
  {
    const ok =
      bt109 && bt106 && known(bt107, bt108)
        ? bt107 === null && bt108 === null
          ? decimalEquals(bt109, bt106)
          : decimalEquals(bt109, round2(subtract(add(bt106, bt108 ?? ZERO), bt107 ?? ZERO)))
        : undefined;
    add_('BR-CO-13', ok, [
      { label: 'BT-106', value: money(bt106) },
      { label: 'BT-107', value: money(bt107) },
      { label: 'BT-108', value: money(bt108) },
      { label: 'BT-109', value: money(bt109) },
    ]);
  }

  // BR-CO-14: BT-110 = round(Σ BT-117) — where a VAT breakdown is given
  const breakdowns = groupsOf(model, 'BG-23');
  if (breakdowns.length > 0) {
    const taxes = decimals(model, 'BG-23/BT-117');
    const taxSum = taxes ? sum(taxes) : undefined;
    add_('BR-CO-14', taxSum && bt110 ? decimalEquals(bt110, round2(taxSum)) : undefined, [
      { label: 'Σ BT-117', value: taxSum ? money(taxSum) : TEXTS.ruleNoNumber },
      { label: 'BT-110', value: money(bt110) },
    ]);
  }

  // BR-CO-15: BT-112 = round(BT-109 + BT-110)
  add_(
    'BR-CO-15',
    bt112 && bt109 && bt110 !== undefined
      ? decimalEquals(bt112, round2(add(bt109, bt110 ?? ZERO)))
      : undefined,
    [
      { label: 'BT-109', value: money(bt109) },
      { label: 'BT-110', value: money(bt110) },
      { label: 'BT-112', value: money(bt112) },
    ],
  );

  // BR-CO-16: BT-115 (minus rounding BT-114) = BT-112 minus prepaid BT-113
  {
    let ok: boolean | undefined;
    if (bt115 && bt112 && known(bt113, bt114)) {
      const due = bt114 ? round2(subtract(bt115, bt114)) : bt115;
      const expected = bt113 ? round2(subtract(bt112, bt113)) : bt112;
      ok = decimalEquals(due, expected);
    }
    add_('BR-CO-16', ok, [
      { label: 'BT-112', value: money(bt112) },
      { label: 'BT-113', value: money(bt113) },
      { label: 'BT-114', value: money(bt114) },
      { label: 'BT-115', value: money(bt115) },
    ]);
  }

  // Per VAT breakdown: BR-CO-17 and the breakdown rule of its category
  for (const breakdown of breakdowns) {
    const category = code(breakdown, 'BT-118') ?? '';
    const rate = one(breakdown, 'BT-119');
    const base = one(breakdown, 'BT-116');
    const tax = one(breakdown, 'BT-117');
    const occurrence = fill(TEXTS.ruleOccurrence, {
      category: category || '–',
      rate: rate ? percent(rate) : '–',
    });

    // BR-CO-17: no rate or rate 0 → tax 0; else |BT-117| within 1 of round(|BT-116| × rate / 100)
    let co17: boolean | undefined;
    if (tax && rate !== undefined && base !== undefined) {
      if (rate === null || roundTo(rate, 0).units === 0n) {
        co17 = roundTo(tax, 0).units === 0n;
      } else if (base) {
        co17 = within(abs(tax), round2(multiply(abs(base), multiply(rate, PERCENT))), ONE);
      }
    }
    add_(
      'BR-CO-17',
      co17,
      [
        { label: 'BT-116', value: money(base) },
        { label: 'BT-119', value: rate ? percent(rate) : money(rate) },
        { label: 'BT-117', value: money(tax) },
      ],
      occurrence,
    );

    const rule = BREAKDOWN_RULES[category];
    if (!rule) continue;
    const sameRate = (group: Source, ratePath: string) => {
      if (!rule.perRate) return true;
      const own = one(group, ratePath);
      return Boolean(own && rate && decimalEquals(own, rate));
    };
    const ofThis = (groupPath: string, categoryPath: string, ratePath: string) =>
      groupsOf(model, groupPath).filter(
        (g) => code(g, categoryPath) === category && sameRate(g, ratePath),
      );
    const theLines = ofThis('BG-25', 'BG-30/BT-151', 'BG-30/BT-152');
    const theCharges = ofThis('BG-21', 'BT-102', 'BT-103');
    const theAllowances = ofThis('BG-20', 'BT-95', 'BT-96');
    const amountsOf = (groups: ModelGroup[], path: string) => {
      const values = groups.map((g) => one(g, path));
      return values.every((v): v is Decimal => v !== null && v !== undefined)
        ? sum(values)
        : undefined;
    };
    const lineSum = amountsOf(theLines, 'BT-131');
    const chargeSum = amountsOf(theCharges, 'BT-99');
    const allowanceSum = amountsOf(theAllowances, 'BT-92');
    const expected =
      lineSum && chargeSum && allowanceSum
        ? subtract(add(lineSum, chargeSum), allowanceSum)
        : undefined;
    let ok: boolean | undefined;
    if (lineSums && expected && base) {
      ok = rule.perRate
        ? theLines.length + theCharges.length > 0 && within(base, expected, ONE)
        : decimalEquals(base, expected);
    }
    add_(
      rule.id,
      ok,
      [
        { label: TEXTS.ruleLineSum, value: lineSum ? money(lineSum) : TEXTS.ruleNoNumber },
        { label: 'Σ BT-99', value: chargeSum ? money(chargeSum) : TEXTS.ruleNoNumber },
        { label: 'Σ BT-92', value: allowanceSum ? money(allowanceSum) : TEXTS.ruleNoNumber },
        { label: 'BT-116', value: money(base) },
      ],
      occurrence,
      RULE_LABELS.BREAKDOWN,
    );
  }

  const auffaellig = [
    ...new Set(results.filter((r) => r.status === 'auffaellig').map((r) => r.id)),
  ];
  return {
    results,
    auffaellig,
    summary:
      auffaellig.length === 0
        ? TEXTS.rulesOk
        : fill(TEXTS.rulesAuffaellig, { ids: auffaellig.join(', ') }),
  };
}
