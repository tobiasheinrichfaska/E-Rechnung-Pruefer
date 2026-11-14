// Step 3a: a selection of the EN 16931 calculation rules — the totals (BR-CO-10 … BR-CO-17) and the
// VAT breakdown per category and rate (BR-S-08 …). Computed exactly as the CEN Schematron 1.3.17
// does (EN16931-UBL-model.sch): sums rounded with round(x * 100) div 100, a tolerance of 1 for
// BR-CO-17 and for the breakdown of S, L and M. FeRD EXTENDED has its own forms of these rules
// (BR-FXEXT-…); for it only BR-CO-14 is checked. Hints only ("mögliche Auffälligkeit"), never an
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
import type { ExtendedAmounts } from './analysis';
import { termLabel } from './binding';
import { checkExtendedRules } from './rulesExtended';
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
  /** How many rules could not be checked (a value missing or no number) */
  notChecked: number;
  /** F23: what the client could do, by the kind of the irregular rules (empty when none) */
  advice: string[];
  summary: string;
  /** Why only some rules are checked (FeRD EXTENDED) */
  note?: string;
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
    'Steuerbetrag (BT-117) = Bemessungsgrundlage (BT-116) × Steuersatz (BT-119), Abweichung bis 1 erlaubt',
  BREAKDOWN:
    'Bemessungsgrundlage (BT-116) = Positionen + Zuschläge − Nachlässe dieser Kategorie und dieses Satzes',
  // F29: the FeRD forms for Factur-X EXTENDED (lines without GROUP/INFORMATION, logistics charges)
  'BR-FXEXT-CO-10':
    'Summe der Nettobeträge (BT-106) = Summe der Positionen (BT-131), Abweichung bis 0,01 je Position',
  'BR-FXEXT-CO-11':
    'Summe der Nachlässe (BT-107) = Nachlässe auf Dokumentebene (BT-92), Abweichung bis 0,01 je Nachlass',
  'BR-FXEXT-CO-12':
    'Summe der Zuschläge (BT-108) = Zuschläge auf Dokumentebene (BT-99) + Logistikkosten, Abweichung bis 0,01 je Betrag',
  'BR-FXEXT-CO-13':
    'Gesamtbetrag ohne Umsatzsteuer (BT-109) = Positionen − Nachlässe + Zuschläge und Logistikkosten, Abweichung bis 0,01 je Betrag',
  'BR-FXEXT-CO-15':
    'Gesamtbetrag mit Umsatzsteuer (BT-112) = BT-109 + BT-110, Abweichung bis 0,01 je Betrag',
  'BR-FXEXT-CO-16':
    'Fälliger Betrag (BT-115) = BT-112 − Vorauszahlung (BT-113) + Rundung (BT-114) + Ausgleichsbeträge',
  'BR-FXEXT-S-09b':
    'Steuerbetrag (BT-117) = Bemessungsgrundlage (BT-116) × Steuersatz (BT-119), Abweichung bis 0,01 je Betrag',
  BREAKDOWN_EXTENDED:
    'Bemessungsgrundlage (BT-116) = Positionen + Zuschläge + Logistikkosten − Nachlässe dieser Kategorie und dieses Satzes, Abweichung bis 0,01 je Betrag',
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
/** "Gesamtbetrag ohne Umsatzsteuer (BT-109)": the name first, the number for experts */
const named = (bt: string) => `${termLabel(bt)} (${bt})`;
const percent = (rate: Decimal) => `${decimalText(normalize(rate)).replace('.', ',')} %`;
const code = (source: Source, path: string) =>
  valuesOf(source, path)[0]?.value.trim().toUpperCase();

export interface RulesOptions {
  /**
   * true for FeRD EXTENDED (Profile.ownRules): its Schematron has its own forms of the totals and
   * breakdown rules and no BR-CO-17 — with `extended` they are rebuilt (F29, Factur-X 1.09.2),
   * without it (ZUGFeRD 2.0 EXTENDED) only BR-CO-14, taken over unchanged, is checked.
   */
  ownRules?: boolean;
  /** Factur-X EXTENDED: line status, logistics charges, financial adjustments (InvoicePart) */
  extended?: ExtendedAmounts | undefined;
}

/** Names of the sums the FeRD rules compare (F29) */
const EXTENDED_VALUE_LABELS: Readonly<Record<string, string>> = {
  lineSum: TEXTS.ruleLineSumDetail,
  allowanceSum: TEXTS.ruleSumAllowances,
  chargeSum: TEXTS.ruleSumCharges,
  logisticsSum: TEXTS.ruleSumLogistics,
  adjustmentSum: TEXTS.ruleSumAdjustments,
};

/** The rules of this selection that the FeRD EXTENDED Schematron (Factur-X 1.09.2) keeps unchanged. */
const UNCHANGED_IN_EXTENDED: ReadonlySet<string> = new Set(['BR-CO-14']);

/** F23 (Tobias 2026-11-14): the tax amount, the Entgelt, or only the gross/due amount. */
const TAX_RULES: ReadonlySet<string> = new Set(['BR-CO-14', 'BR-CO-17', 'BR-FXEXT-S-09b']);
const GROSS_RULES: ReadonlySet<string> = new Set([
  'BR-CO-15',
  'BR-CO-16',
  'BR-FXEXT-CO-15',
  'BR-FXEXT-CO-16',
]);

/**
 * What the client could do about irregular rules: ask the supplier which amount is right (before
 * paying, where the gross or due amount is concerned), and what that means for the input VAT.
 */
export function adviceFor(ids: readonly string[]): string[] {
  if (ids.length === 0) return [];
  const tax = ids.some((id) => TAX_RULES.has(id));
  const gross = ids.some((id) => GROSS_RULES.has(id));
  const net = ids.some((id) => !TAX_RULES.has(id) && !GROSS_RULES.has(id));
  return [
    gross ? TEXTS.adviceAmountBeforePayment : TEXTS.adviceAmount,
    ...(tax ? [TEXTS.adviceTax] : []),
    ...(net ? [TEXTS.adviceNet] : []),
  ];
}

export function checkRules(model: InvoiceModel, options: RulesOptions = {}): RulesResult {
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
  const expectedValue = (value: Decimal | undefined): RuleValue[] =>
    value ? [{ label: TEXTS.ruleExpected, value: money(value) }] : [];

  // BR-CO-10: BT-106 = round(Σ BT-131)
  const lines = groupsOf(model, 'BG-25');
  const lineAmounts = lines.map((line) => one(line, 'BT-131'));
  const lineSum = lineAmounts.every((a): a is Decimal => a !== null && a !== undefined)
    ? sum(lineAmounts)
    : undefined;
  add_(
    'BR-CO-10',
    lines.length > 0 && lineSum && bt106 ? decimalEquals(bt106, round2(lineSum)) : undefined,
    [
      { label: TEXTS.ruleLineSum, value: lineSum ? money(lineSum) : TEXTS.ruleNoNumber },
      { label: named('BT-106'), value: money(bt106) },
    ],
  );

  // BR-CO-11 / BR-CO-12: document level allowances and charges (only where any is given)
  for (const [id, group, path, bt, value, sumLabel] of [
    ['BR-CO-11', 'BG-20', 'BT-92', 'BT-107', bt107, TEXTS.ruleSumAllowances],
    ['BR-CO-12', 'BG-21', 'BT-99', 'BT-108', bt108, TEXTS.ruleSumCharges],
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
        { label: sumLabel, value: partSum ? money(partSum) : TEXTS.ruleNoNumber },
        { label: bt, value: money(value) },
      ],
    );
  }

  // BR-CO-13: BT-109 = round(BT-106 + BT-108 − BT-107); without both: BT-109 = BT-106
  {
    const expected =
      bt106 && known(bt107, bt108)
        ? bt107 === null && bt108 === null
          ? bt106
          : round2(subtract(add(bt106, bt108 ?? ZERO), bt107 ?? ZERO))
        : undefined;
    const ok = bt109 && expected ? decimalEquals(bt109, expected) : undefined;
    add_('BR-CO-13', ok, [
      { label: named('BT-106'), value: money(bt106) },
      { label: named('BT-107'), value: money(bt107) },
      { label: named('BT-108'), value: money(bt108) },
      { label: named('BT-109'), value: money(bt109) },
      ...expectedValue(expected),
    ]);
  }

  // BR-CO-14: BT-110 = round(Σ BT-117) — where a VAT breakdown and BT-110 are given: the CEN
  // Schematron checks it in the context of BT-110, so without one it does not apply (three official
  // examples without VAT, e.g. CEN CII_example7, showed it as "nicht prüfbar")
  const breakdowns = groupsOf(model, 'BG-23');
  if (breakdowns.length > 0 && bt110 !== null) {
    const taxes = decimals(model, 'BG-23/BT-117');
    const taxSum = taxes ? sum(taxes) : undefined;
    add_('BR-CO-14', taxSum && bt110 ? decimalEquals(bt110, round2(taxSum)) : undefined, [
      { label: TEXTS.ruleSumTaxes, value: taxSum ? money(taxSum) : TEXTS.ruleNoNumber },
      { label: named('BT-110'), value: money(bt110) },
    ]);
  }

  // BR-CO-15: BT-112 = round(BT-109 + BT-110)
  {
    const expected = bt109 && bt110 !== undefined ? round2(add(bt109, bt110 ?? ZERO)) : undefined;
    add_('BR-CO-15', bt112 && expected ? decimalEquals(bt112, expected) : undefined, [
      { label: named('BT-109'), value: money(bt109) },
      { label: named('BT-110'), value: money(bt110) },
      { label: named('BT-112'), value: money(bt112) },
      ...expectedValue(expected),
    ]);
  }

  // BR-CO-16: BT-115 (minus rounding BT-114) = BT-112 minus prepaid BT-113
  {
    let ok: boolean | undefined;
    if (bt115 && bt112 && known(bt113, bt114)) {
      const due = bt114 ? round2(subtract(bt115, bt114)) : bt115;
      const expected = bt113 ? round2(subtract(bt112, bt113)) : bt112;
      ok = decimalEquals(due, expected);
    }
    // shown as the amount due the rule expects: BT-112 − BT-113 + BT-114
    const expectedDue =
      bt112 && known(bt113, bt114)
        ? add(bt113 ? round2(subtract(bt112, bt113)) : bt112, bt114 ?? ZERO)
        : undefined;
    add_('BR-CO-16', ok, [
      { label: named('BT-112'), value: money(bt112) },
      { label: named('BT-113'), value: money(bt113) },
      { label: named('BT-114'), value: money(bt114) },
      { label: named('BT-115'), value: money(bt115) },
      ...expectedValue(expectedDue),
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
    const noRate = rate === null || (rate !== undefined && roundTo(rate, 0).units === 0n);
    const expectedTax = noRate
      ? ZERO
      : rate && base
        ? round2(multiply(abs(base), multiply(rate, PERCENT)))
        : undefined;
    if (tax && rate !== undefined && base !== undefined) {
      if (noRate) {
        co17 = roundTo(tax, 0).units === 0n;
      } else if (base && expectedTax) {
        co17 = within(abs(tax), expectedTax, ONE);
      }
    }
    add_(
      'BR-CO-17',
      co17,
      [
        { label: named('BT-116'), value: money(base) },
        { label: named('BT-119'), value: rate ? percent(rate) : money(rate) },
        { label: named('BT-117'), value: money(tax) },
        ...expectedValue(expectedTax),
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
    if (expected && base) {
      ok = rule.perRate
        ? theLines.length + theCharges.length > 0 && within(base, expected, ONE)
        : decimalEquals(base, expected);
    }
    add_(
      rule.id,
      ok,
      [
        { label: TEXTS.ruleLineSum, value: lineSum ? money(lineSum) : TEXTS.ruleNoNumber },
        { label: TEXTS.ruleSumCharges, value: chargeSum ? money(chargeSum) : TEXTS.ruleNoNumber },
        {
          label: TEXTS.ruleSumAllowances,
          value: allowanceSum ? money(allowanceSum) : TEXTS.ruleNoNumber,
        },
        { label: named('BT-116'), value: money(base) },
        ...expectedValue(expected),
      ],
      occurrence,
      RULE_LABELS.BREAKDOWN,
    );
  }

  const unchanged = results.filter((r) => UNCHANGED_IN_EXTENDED.has(r.id));
  let checked = results;
  if (options.ownRules && options.extended) {
    // F29: the FeRD rules, BR-CO-14 after the sums of the document as in the Schematron
    const extended = checkExtendedRules(model, options.extended).map((c): RuleResult => ({
      id: c.id,
      label: RULE_LABELS[c.id] ?? RULE_LABELS.BREAKDOWN_EXTENDED ?? c.id,
      ...(c.breakdown
        ? {
            occurrence: fill(TEXTS.ruleOccurrence, {
              category: c.breakdown.category || '–',
              rate: c.breakdown.rate ? percent(c.breakdown.rate) : '–',
            }),
          }
        : {}),
      status: c.ok === undefined ? 'nichtPruefbar' : c.ok ? 'passt' : 'auffaellig',
      values: [
        ...c.values.map(([key, value]) => ({
          label: EXTENDED_VALUE_LABELS[key] ?? named(key),
          value: key === 'BT-119' && value ? percent(value) : money(value),
        })),
        ...(c.expected ? [{ label: TEXTS.ruleExpected, value: money(c.expected) }] : []),
      ],
    }));
    const documentLevel = extended.filter((r) => /^BR-FXEXT-CO-1[0-3]$/.test(r.id));
    checked = [
      ...documentLevel,
      ...unchanged,
      ...extended.filter((r) => !documentLevel.includes(r)),
    ];
  } else if (options.ownRules) {
    checked = unchanged;
  }
  const auffaellig = [
    ...new Set(checked.filter((r) => r.status === 'auffaellig').map((r) => r.id)),
  ];
  // "passen zusammen" must not hide what could not be checked (audit Bedienung, V-05)
  const notChecked = checked.filter((r) => r.status === 'nichtPruefbar').length;
  const unchecked =
    notChecked === 0
      ? ''
      : ` ${notChecked === 1 ? TEXTS.rulesOneNotChecked : fill(TEXTS.rulesSomeNotChecked, { count: notChecked })}`;
  return {
    results: checked,
    auffaellig,
    advice: adviceFor(auffaellig),
    ...(options.ownRules
      ? { note: options.extended ? TEXTS.rulesFerdRules : TEXTS.rulesOwnRules }
      : {}),
    notChecked,
    summary:
      checked.length === 0
        ? TEXTS.rulesNone
        : auffaellig.length === 0
          ? `${TEXTS.rulesOk}${unchecked}`
          : fill(TEXTS.rulesAuffaellig, { ids: auffaellig.join(', ') }),
  };
}
