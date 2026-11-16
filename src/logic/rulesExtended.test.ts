import type { ExtendedAmounts } from './analysis';
import type { InvoiceModel, ModelGroup } from './model';
import { checkRules } from './rules';
import { checkExtendedRules } from './rulesExtended';
import { TEXTS } from './texts';

type Spec = { [key: string]: string | Spec[] };

function group(bg: string, spec: Spec): ModelGroup {
  const result: ModelGroup = { bg: bg as ModelGroup['bg'], terms: {}, groups: {} };
  for (const [key, value] of Object.entries(spec)) {
    if (key.startsWith('BT-')) {
      result.terms[key as `BT-${number}`] = [{ value: value as string, raw: value as string }];
    } else {
      result.groups[key as ModelGroup['bg']] = (value as Spec[]).map((child) => group(key, child));
    }
  }
  return result;
}

/**
 * Like FeRD sample X11: a GROUP line with the subtotal of its two DETAIL lines (100 + 50), a
 * logistics charge of 15 and an allowance of 20, all at 19 %.
 */
const LINE = (amount: string) => ({
  'BT-131': amount,
  'BG-30': [{ 'BT-151': 'S', 'BT-152': '19' }],
});
const BASE: Spec = {
  'BT-5': 'EUR',
  'BG-20': [{ 'BT-92': '20.00', 'BT-95': 'S', 'BT-96': '19' }],
  'BG-22': [
    {
      'BT-106': '150.00',
      'BT-107': '20.00',
      'BT-108': '15.00',
      'BT-109': '145.00',
      'BT-110': '27.55',
      'BT-112': '172.55',
      'BT-115': '172.55',
    },
  ],
  'BG-23': [{ 'BT-116': '145.00', 'BT-117': '27.55', 'BT-118': 'S', 'BT-119': '19' }],
  'BG-25': [LINE('150.00'), LINE('100.00'), LINE('50.00')],
};
const EXT: ExtendedAmounts = {
  lineStatus: ['GROUP', 'DETAIL', ''],
  logistics: [{ amount: '15.00', category: 'S', rate: '19' }],
  adjustments: [],
};

const model = (totals: Spec = {}, over: Spec = {}) => {
  const base = BASE['BG-22'] as Spec[];
  return group('INVOICE', {
    ...BASE,
    ...over,
    'BG-22': [{ ...base[0], ...totals }],
  }) as InvoiceModel;
};
const statusOf = (m: InvoiceModel, ext: ExtendedAmounts = EXT) =>
  Object.fromEntries(checkExtendedRules(m, ext).map((c) => [c.id, c.ok]));

describe('FeRD rules for Factur-X EXTENDED (F29)', () => {
  it('passes a consistent invoice with a GROUP line and a logistics charge', () => {
    expect(statusOf(model())).toEqual({
      'BR-FXEXT-CO-10': true,
      'BR-FXEXT-CO-11': true,
      'BR-FXEXT-CO-12': true,
      'BR-FXEXT-CO-13': true,
      'BR-FXEXT-CO-15': true,
      'BR-FXEXT-CO-16': true,
      'BR-FXEXT-S-09b': true,
      'BR-FXEXT-S08b': true,
    });
  });

  it('counts the GROUP line once it is a DETAIL line (sums twice)', () => {
    const asDetail = { ...EXT, lineStatus: ['DETAIL', 'DETAIL', 'DETAIL'] };
    expect(statusOf(model(), asDetail)['BR-FXEXT-CO-10']).toBe(false);
  });

  it('needs the logistics charge in BT-108 (the CEN rule BR-CO-12 would not)', () => {
    expect(statusOf(model(), { ...EXT, logistics: [] })['BR-FXEXT-CO-12']).toBe(false);
  });

  it('allows 0.01 per amount involved, inclusive', () => {
    // three DETAIL-relevant counts for CO-15: 2 lines + 1 allowance + 1 logistics = 4 → 0.04
    expect(statusOf(model({ 'BT-112': '172.59' }))['BR-FXEXT-CO-15']).toBe(true);
    expect(statusOf(model({ 'BT-112': '172.60' }))['BR-FXEXT-CO-15']).toBe(false);
  });

  it('adds the financial adjustments to the amount due', () => {
    const adjusted = { ...EXT, adjustments: ['-2.55'] };
    expect(statusOf(model({ 'BT-115': '170.00' }), adjusted)['BR-FXEXT-CO-16']).toBe(true);
    expect(statusOf(model({ 'BT-115': '170.00' }))['BR-FXEXT-CO-16']).toBe(false);
  });

  it('cannot check the lines when their status does not match them', () => {
    const short = { ...EXT, lineStatus: ['GROUP'] };
    expect(statusOf(model(), short)['BR-FXEXT-CO-10']).toBeUndefined();
  });

  it('leaves breakdowns that only the exemption reason tells apart unchecked', () => {
    const twice = model(
      {},
      {
        'BG-23': [
          { 'BT-116': '145.00', 'BT-117': '27.55', 'BT-118': 'S', 'BT-119': '19' },
          { 'BT-116': '0.00', 'BT-117': '0.00', 'BT-118': 'S', 'BT-119': '19' },
        ],
      },
    );
    const results = checkExtendedRules(twice, EXT).filter((c) => c.id === 'BR-FXEXT-S08b');
    expect(results.map((c) => c.ok)).toEqual([undefined, undefined]);
  });

  it('replaces the CEN rules in checkRules, keeps BR-CO-14 and says so', () => {
    const result = checkRules(model(), { ownRules: true, extended: EXT });
    expect(result.results.map((r) => r.id)).toEqual([
      'BR-FXEXT-CO-10',
      'BR-FXEXT-CO-11',
      'BR-FXEXT-CO-12',
      'BR-FXEXT-CO-13',
      'BR-CO-14',
      'BR-FXEXT-CO-15',
      'BR-FXEXT-CO-16',
      'BR-FXEXT-S-09b',
      'BR-FXEXT-S08b',
    ]);
    expect(result.auffaellig).toEqual([]);
    expect(result.note).toBe(TEXTS.rulesFerdRules);
    const co12 = result.results.find((r) => r.id === 'BR-FXEXT-CO-12');
    expect(co12?.values).toContainEqual({
      label: 'Summe der Logistikkosten (BT-X-272)',
      value: '15,00 EUR',
    });
    // the sums of a breakdown are named apart from the document totals (audit R3-U-07)
    const s08 = result.results.find((r) => r.id === 'BR-FXEXT-S08b');
    expect(s08?.values.slice(0, 4).map((v) => v.label)).toEqual([
      'Summe der Positionen mit diesem Satz (BT-131, ohne Gruppen- und Infozeilen)',
      'Summe der Zuschläge auf Dokumentebene mit diesem Satz (BT-99)',
      'Summe der Logistikkosten mit diesem Satz (BT-X-272)',
      'Summe der Nachlässe auf Dokumentebene mit diesem Satz (BT-92)',
    ]);
    const co10 = result.results.find((r) => r.id === 'BR-FXEXT-CO-10');
    expect(co10?.values[0]?.label).toBe(TEXTS.ruleLineSumDetail);
    const notTaxable = checkRules(
      model(
        {},
        { 'BG-23': [{ 'BT-116': '0.00', 'BT-117': '0.00', 'BT-118': 'O', 'BT-119': '0' }] },
      ),
      { ownRules: true, extended: EXT },
    ).results.find((r) => r.id === 'BR-FXEXT-O-08b');
    expect(notTaxable?.values[0]?.label).toBe(
      'Summe der Positionen dieser Kategorie (BT-131, ohne Gruppen- und Infozeilen)',
    );
    // without the extension amounts (ZUGFeRD 2.0 EXTENDED) only BR-CO-14, as before
    const zf20 = checkRules(model(), { ownRules: true });
    expect(zf20.results.map((r) => r.id)).toEqual(['BR-CO-14']);
    expect(zf20.note).toBe(TEXTS.rulesOwnRules);
  });
});
