// Step 3a: a selection of the EN 16931 calculation rules — the totals (BR-CO-10 … BR-CO-17) and the
// VAT breakdown per category and rate (BR-S-08 …). Computed as the CEN Schematron 1.3.17 does, per
// syntax: UBL after EN16931-UBL-model.sch, CII after EN16931-CII-model.sch (sums rounded with
// round(x * 100) div 100). Where the two differ — comparison, tolerance, rounded part sums, the
// BR-CO-15 alternative, the ids of L and M — the forms are data (RULE_FORMS), not branches (audit
// QL-03). FeRD EXTENDED has its own forms of these rules (BR-FXEXT-…, rulesExtended.ts). Hints only
// ("mögliche Auffälligkeit"), never an approval; no full validator (non-goal).
import {
  ZERO,
  abs,
  add,
  decimalEquals,
  formatAmount,
  germanNumber,
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
import type { SyntaxId } from './syntax';
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
  // the tolerance of BR-CO-17 and of the breakdown follows its form (TOLERANCE_LABEL)
  'BR-CO-17': 'Steuerbetrag (BT-117) = Bemessungsgrundlage (BT-116) × Steuersatz (BT-119)',
  BREAKDOWN:
    'Bemessungsgrundlage (BT-116) = Positionen + Zuschläge − Nachlässe dieser Kategorie und dieses Satzes',
  BREAKDOWN_CATEGORY:
    'Bemessungsgrundlage (BT-116) = Positionen + Zuschläge − Nachlässe dieser Kategorie',
  TOLERANCE_BELOW_1: 'Abweichung unter 1 erlaubt',
  TOLERANCE_UP_TO_1: 'Abweichung bis 1 erlaubt',
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

/** How a rule compares: exactly, |a − b| < 1, or |a − b| ≤ 1. */
export type Tolerance = 'exact' | 'below1' | 'upTo1';

/** The breakdown rule of one VAT category (BT-118), in the form of one Schematron. */
export interface BreakdownForm {
  id: string;
  /** S, L, M: one sum per rate (BT-119); the others: per category */
  perRate: boolean;
  tolerance: Tolerance;
  /** CII: each part sum (lines, charges, allowances) rounded before they are added; UBL: as is */
  roundParts: boolean;
  /** UBL BR-S-08: only where a line, charge or allowance of this category and rate exists */
  needsOwnPart: boolean;
}

/** Where EN16931-UBL-model.sch and EN16931-CII-model.sch (CEN 1.3.17) compute a rule differently. */
export interface RuleForms {
  /** BR-CO-13 without BT-107 and BT-108: CII rounds BT-106, UBL takes it as it is */
  co13RoundAlone: boolean;
  /** BR-CO-14 without a VAT breakdown: CII wants BT-110 = 0 (a sum of nothing), UBL skips it */
  co14WithoutBreakdown: boolean;
  /** BR-CO-15: CII also accepts BT-112 = BT-109 */
  co15NetAlone: boolean;
  /**
   * BR-CO-15: BT-112 = BT-109 + BT-110 only with exactly one VAT total in the document currency
   * (audit R2-L-03) — UBL `count(cac:TaxTotal/xs:decimal(cbc:TaxAmount[@currencyID=$Currency])) eq
   * 1`, CII `count(…/ram:TaxTotalAmount[@currencyID = $Currency]) = 1`; without it or with two the
   * rule fails, in CII unless BT-112 = BT-109 (co15NetAlone). Counted are the values of BT-110: in
   * CII also an amount without `currencyID` where none carries the invoice currency (binding.ts,
   * audit R3-L-02), so the tool counts one where CEN counts none. Without BT-5 the rule is not
   * checked (R3-L-01)
   */
  co15ExactlyOneTax: boolean;
  /** BR-CO-16: UBL rounds BT-112 − BT-113 and BT-115 − BT-114, CII computes exactly */
  co16Rounded: boolean;
  co17: Tolerance;
  breakdown: Readonly<Record<string, BreakdownForm>>;
}

const perRate = (id: string, tolerance: Tolerance, roundParts: boolean, needsOwnPart = false) => ({
  id,
  perRate: true,
  tolerance,
  roundParts,
  needsOwnPart,
});
const perCategory = (id: string, tolerance: Tolerance, roundParts: boolean) => ({
  id,
  perRate: false,
  tolerance,
  roundParts,
  needsOwnPart: false,
});

export const RULE_FORMS: Readonly<Record<'ubl' | 'cii', RuleForms>> = {
  ubl: {
    co13RoundAlone: false,
    co14WithoutBreakdown: false,
    co15NetAlone: false,
    co15ExactlyOneTax: true,
    co16Rounded: true,
    co17: 'below1',
    breakdown: {
      S: perRate('BR-S-08', 'below1', false, true),
      Z: perCategory('BR-Z-08', 'exact', false),
      E: perCategory('BR-E-08', 'exact', false),
      AE: perCategory('BR-AE-08', 'exact', false),
      K: perCategory('BR-IC-08', 'exact', false),
      G: perCategory('BR-G-08', 'exact', false),
      O: perCategory('BR-O-08', 'exact', false),
      L: perRate('BR-IG-08', 'below1', false),
      M: perRate('BR-IP-08', 'below1', false),
    },
  },
  cii: {
    co13RoundAlone: true,
    co14WithoutBreakdown: true,
    co15NetAlone: true,
    co15ExactlyOneTax: true,
    co16Rounded: false,
    co17: 'upTo1',
    breakdown: {
      S: perRate('BR-S-08', 'exact', true),
      Z: perCategory('BR-Z-08', 'below1', true),
      E: perCategory('BR-E-08', 'below1', true),
      AE: perCategory('BR-AE-08', 'below1', true),
      K: perCategory('BR-IC-08', 'below1', true),
      G: perCategory('BR-G-08', 'below1', true),
      O: perCategory('BR-O-08', 'exact', true),
      // L (BR-IP-08 in CII) and M (BR-IG-08 in CII — the ids are swapped against UBL) are left
      // out: the CII Schematron evaluates them on ram:ApplicableTradeTax, where
      // ../ram:RateApplicablePercent selects nothing, so they can never fail (the KoSIT validator
      // runs the same test). The tool says nothing the validator does not say.
    },
  },
};

/** The forms of the rules for a syntax: CII for CII, UBL for UBL and by default. */
export function ruleFormsOf(syntax: SyntaxId | undefined): RuleForms {
  return syntax === 'cii' ? RULE_FORMS.cii : RULE_FORMS.ubl;
}

const TOLERANCE_LABEL: Readonly<Record<Tolerance, string | undefined>> = {
  exact: undefined,
  below1: RULE_LABELS.TOLERANCE_BELOW_1,
  upTo1: RULE_LABELS.TOLERANCE_UP_TO_1,
};
const withTolerance = (label: string | undefined, tolerance: Tolerance) => {
  const suffix = TOLERANCE_LABEL[tolerance];
  return suffix ? `${label}, ${suffix}` : (label ?? '');
};

const ONE: Decimal = { units: 1n, scale: 0 };

function fits(a: Decimal, b: Decimal, tolerance: Tolerance): boolean {
  if (tolerance === 'exact') return decimalEquals(a, b);
  return within(a, b, ONE, tolerance === 'upTo1');
}
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

/**
 * The sum of part amounts: undefined when one is no number, null when one is missing — shown as
 * „keine Zahl“ and „nicht angegeben“, so the client looks for the right thing (audit R2-L-07).
 */
function sumOf(values: readonly (Decimal | null | undefined)[]): Decimal | null | undefined {
  if (values.some((v) => v === undefined)) return undefined;
  if (values.some((v) => v === null)) return null;
  return sum(values.filter((v): v is Decimal => v !== null && v !== undefined));
}

const round2 = (value: Decimal) => roundTo(value, 2);
/** "Gesamtbetrag ohne Umsatzsteuer (BT-109)": the name first, the number for experts */
const named = (bt: string) => `${termLabel(bt)} (${bt})`;
/** With a no-break space, as displayValue in check.ts (audit R3-U-10) */
const percent = (rate: Decimal) => `${germanNumber(rate)}\u00a0%`;
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
  /** The syntax of the invoice XML: CII is computed after the CII Schematron (RULE_FORMS) */
  syntax?: SyntaxId | undefined;
}

/**
 * A sum of one VAT breakdown, named apart from the document total of the same name (BR-CO-10 …
 * -12): "Summe der Positionen mit diesem Satz (BT-131)" — per rate or per category (audit R3-U-07).
 */
const ofBreakdown = (label: string, perRate: boolean) =>
  label.replace(' (', ` ${perRate ? TEXTS.ruleOfRate : TEXTS.ruleOfCategory} (`);

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
  const forms = ruleFormsOf(options.syntax);
  const currency = valuesOf(model, 'BT-5')[0]?.value;
  const money = (value: Decimal | null | undefined) =>
    value === null
      ? TEXTS.ruleMissing
      : value === undefined
        ? TEXTS.ruleNoNumber
        : `${formatAmount(normalize(value))}${currency ? ` ${currency}` : ''}`;
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
  const lineSum = sumOf(lines.map((line) => one(line, 'BT-131')));
  add_(
    'BR-CO-10',
    lines.length > 0 && lineSum && bt106 ? decimalEquals(bt106, round2(lineSum)) : undefined,
    [
      { label: TEXTS.ruleLineSum, value: money(lineSum) },
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
    const partSum = sumOf(parts.map((p) => one(p, path)));
    add_(
      id,
      partSum === undefined || partSum === null || value === undefined
        ? undefined
        : value !== null && decimalEquals(value, round2(partSum)),
      [
        { label: sumLabel, value: money(partSum) },
        // named like every other value (audit R2-L-08)
        { label: named(bt), value: money(value) },
      ],
    );
  }

  // BR-CO-13: BT-109 = round(BT-106 + BT-108 − BT-107); without both: BT-109 = BT-106 (CII: rounded)
  {
    const expected =
      bt106 && known(bt107, bt108)
        ? bt107 === null && bt108 === null
          ? forms.co13RoundAlone
            ? round2(bt106)
            : bt106
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

  // Without the invoice currency (BT-5) the tool cannot tell which amount is BT-110 (it reads it
  // only in BT-5). The CEN Schematrons differ there: BR-CO-15 holds over nothing in both (`every
  // $Currency in <BT-5> satisfies …`), and so does BR-CO-14 in CII (context `TaxTotalAmount` with
  // `@currencyID` = BT-5) — they report only BR-05. UBL computes BR-CO-14 without BT-5 too, in the
  // context `$Tax_Total` (every `cac:TaxTotal`, EN16931-UBL-model.sch), and reports a wrong sum.
  // The tool checks neither BR-CO-14 nor BR-CO-15 there and says why: less than CEN for UBL
  // BR-CO-14, never a false hint. A BT-110 not read is not shown (audit R3-L-01, R4-L-01)
  const noCurrency: RuleValue[] = currency
    ? []
    : [{ label: TEXTS.ruleCurrency, value: TEXTS.ruleMissing }];
  const taxTotal: RuleValue[] =
    currency || bt110 !== null ? [{ label: named('BT-110'), value: money(bt110) }] : [];

  // BR-CO-14: BT-110 = round(Σ BT-117) — where BT-110 is given: the CEN Schematron checks it in the
  // context of BT-110, so without one it does not apply (three official examples without VAT, e.g.
  // CEN CII_example7, showed it as "nicht prüfbar"); UBL also needs a VAT breakdown, CII does not.
  // Without BT-5 a VAT breakdown is reason enough: its BT-110 may be there, unread (R3-L-01)
  const breakdowns = groupsOf(model, 'BG-23');
  const given = bt110 !== null || (!currency && breakdowns.length > 0);
  if ((breakdowns.length > 0 || forms.co14WithoutBreakdown) && given) {
    const taxes = decimals(model, 'BG-23/BT-117');
    const taxSum = taxes ? sum(taxes) : undefined;
    add_(
      'BR-CO-14',
      currency && taxSum && bt110 ? decimalEquals(bt110, round2(taxSum)) : undefined,
      [
        { label: TEXTS.ruleSumTaxes, value: taxSum ? money(taxSum) : TEXTS.ruleNoNumber },
        ...taxTotal,
        ...noCurrency,
      ],
    );
  }

  // BR-CO-15: BT-112 = round(BT-109 + BT-110) with exactly one BT-110 in the document currency;
  // CII: or BT-112 = BT-109 (then BT-110 may be missing). Without one or with two the sum fails,
  // as both CEN Schematrons count them where BT-5 is given (audit R2-L-03, R3-L-01). In CII an
  // amount without `currencyID` counts as well, where none carries the invoice currency (binding of
  // BT-110, D16B allows it): then BR-CO-15 can pass where CEN reports it for the missing attribute
  {
    const taxes = valuesOf(model, 'BG-22/BT-110').map((v) => parseDecimal(v.value));
    const notOneTax = forms.co15ExactlyOneTax && taxes.length !== 1;
    const netAlone = Boolean(forms.co15NetAlone && bt109 && bt112 && decimalEquals(bt112, bt109));
    let sumFits: boolean | undefined;
    let expected: Decimal | undefined;
    if (!currency) {
      // not checked (R3-L-01): neither passes nor fails
    } else if (notOneTax) {
      sumFits = false;
      // the net amount is what CII accepts without BT-110; with two it is no expected gross amount,
      // the count says why (audit R3-U-02)
      expected = forms.co15NetAlone && bt109 && taxes.length === 0 ? bt109 : undefined;
    } else if (bt109 && bt110 !== undefined) {
      expected = forms.co15NetAlone && bt110 === null ? bt109 : round2(add(bt109, bt110 ?? ZERO));
      sumFits = bt112 ? decimalEquals(bt112, expected) : undefined;
    }
    const ok = currency ? netAlone || sumFits : undefined;
    add_('BR-CO-15', ok, [
      { label: named('BT-109'), value: money(bt109) },
      ...(taxes.length > 1
        ? [{ label: named('BT-110'), value: taxes.map(money).join(TEXTS.ruleAnd) }]
        : taxTotal),
      { label: named('BT-112'), value: money(bt112) },
      ...expectedValue(expected),
      // why the sum cannot fit: none (UBL) or more than one VAT total
      ...(currency && notOneTax && ok !== true && (taxes.length > 1 || !forms.co15NetAlone)
        ? [
            {
              label: TEXTS.ruleTaxTotals,
              value: fill(TEXTS.ruleTaxTotalsCount, { count: taxes.length }),
            },
          ]
        : []),
      ...noCurrency,
    ]);
  }

  // BR-CO-16: BT-115 (minus rounding BT-114) = BT-112 minus prepaid BT-113 (UBL rounds both
  // differences, CII computes BT-115 = BT-112 − BT-113 + BT-114 exactly)
  {
    let ok: boolean | undefined;
    const exactDue =
      bt112 && known(bt113, bt114) ? add(subtract(bt112, bt113 ?? ZERO), bt114 ?? ZERO) : undefined;
    if (bt115 && bt112 && known(bt113, bt114)) {
      if (forms.co16Rounded) {
        const due = bt114 ? round2(subtract(bt115, bt114)) : bt115;
        const expected = bt113 ? round2(subtract(bt112, bt113)) : bt112;
        ok = decimalEquals(due, expected);
      } else if (exactDue) {
        ok = decimalEquals(bt115, exactDue);
      }
    }
    // shown as the amount due the rule expects: BT-112 − BT-113 + BT-114
    const expectedDue =
      bt112 && known(bt113, bt114)
        ? forms.co16Rounded
          ? add(bt113 ? round2(subtract(bt112, bt113)) : bt112, bt114 ?? ZERO)
          : exactDue
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

    // BR-CO-17: no rate or rate 0 → tax 0; else |BT-117| within 1 of round(|BT-116| × rate / 100),
    // below 1 (UBL) or up to 1 (CII)
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
        co17 = fits(abs(tax), expectedTax, forms.co17);
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
      withTolerance(RULE_LABELS['BR-CO-17'], forms.co17),
    );

    const rule = forms.breakdown[category];
    if (!rule) continue;
    // Per rate, a rate that is missing in the breakdown or no number in a part of this category
    // cannot be compared: the part would drop out of the sum unseen (audit QL-02)
    const rateUnknown = rule.perRate && (rate === null || rate === undefined);
    const ofThis = (groupPath: string, categoryPath: string, ratePath: string) => {
      const groups = groupsOf(model, groupPath).filter((g) => code(g, categoryPath) === category);
      if (!rule.perRate) return groups;
      if (rateUnknown || groups.some((g) => one(g, ratePath) === undefined)) return undefined;
      return groups.filter((g) => {
        const own = one(g, ratePath);
        return Boolean(own && rate && decimalEquals(own, rate));
      });
    };
    const theLines = ofThis('BG-25', 'BG-30/BT-151', 'BG-30/BT-152');
    const theCharges = ofThis('BG-21', 'BT-102', 'BT-103');
    const theAllowances = ofThis('BG-20', 'BT-95', 'BT-96');
    const amountsOf = (groups: ModelGroup[] | undefined, path: string) =>
      groups ? sumOf(groups.map((g) => one(g, path))) : undefined;
    const lineSum = amountsOf(theLines, 'BT-131');
    const chargeSum = amountsOf(theCharges, 'BT-99');
    const allowanceSum = amountsOf(theAllowances, 'BT-92');
    // CII rounds each part sum before adding them (round(Σ) + round(Σ) − round(Σ))
    const partSum = (value: Decimal | null | undefined) =>
      value && rule.roundParts ? round2(value) : value;
    const [linesPart, chargesPart, allowancesPart] = [lineSum, chargeSum, allowanceSum].map(
      partSum,
    );
    const expected =
      linesPart && chargesPart && allowancesPart
        ? subtract(add(linesPart, chargesPart), allowancesPart)
        : undefined;
    const ownParts =
      (theLines?.length ?? 0) + (theCharges?.length ?? 0) + (theAllowances?.length ?? 0);
    let ok: boolean | undefined;
    if (expected && base) {
      ok = (!rule.needsOwnPart || ownParts > 0) && fits(base, expected, rule.tolerance);
    }
    // a part of the category whose rate is no number: that rate is named, not the sum (R2-L-07)
    const partShown = (
      groups: ModelGroup[] | undefined,
      label: string,
      rateLabel: string,
      value: Decimal | null | undefined,
    ): RuleValue =>
      groups === undefined
        ? { label: rateLabel, value: TEXTS.ruleNoNumber }
        : { label, value: money(value) };
    // UBL BR-S-08 without a line, charge or allowance of its rate: the values say why (R2-L-05)
    const noOwnPart =
      rule.needsOwnPart && ownParts === 0 && theLines && theCharges && theAllowances
        ? [{ label: TEXTS.ruleOwnParts, value: TEXTS.ruleOwnPartsNone }]
        : [];
    add_(
      rule.id,
      ok,
      // without a rate of the breakdown there are no sums per rate: the rate is shown instead
      rateUnknown
        ? [
            { label: named('BT-116'), value: money(base) },
            { label: named('BT-119'), value: money(rate) },
          ]
        : [
            partShown(
              theLines,
              ofBreakdown(TEXTS.ruleLineSum, rule.perRate),
              TEXTS.ruleLineRate,
              linesPart,
            ),
            partShown(
              theCharges,
              ofBreakdown(TEXTS.ruleSumCharges, rule.perRate),
              TEXTS.ruleChargeRate,
              chargesPart,
            ),
            partShown(
              theAllowances,
              ofBreakdown(TEXTS.ruleSumAllowances, rule.perRate),
              TEXTS.ruleAllowanceRate,
              allowancesPart,
            ),
            { label: named('BT-116'), value: money(base) },
            ...expectedValue(expected),
            ...noOwnPart,
          ],
      occurrence,
      withTolerance(
        rule.perRate ? RULE_LABELS.BREAKDOWN : RULE_LABELS.BREAKDOWN_CATEGORY,
        rule.tolerance,
      ),
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
        ...c.values.map(([key, value]) => {
          const sumLabel = EXTENDED_VALUE_LABELS[key];
          return {
            label: sumLabel
              ? c.breakdown
                ? ofBreakdown(sumLabel, c.breakdown.perRate)
                : sumLabel
              : named(key),
            value: key === 'BT-119' && value ? percent(value) : money(value),
          };
        }),
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
