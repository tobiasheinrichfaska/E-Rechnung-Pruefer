import type { InvoiceModel, ModelGroup } from './model';
import { RULE_LABELS, adviceFor, checkRules } from './rules';
import type { RulesOptions } from './rules';
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

/** 2 lines at 19 % (100 + 50), a charge of 10 and an allowance of 20 at 19 %. */
const BASE: Spec = {
  'BT-5': 'EUR',
  'BG-20': [{ 'BT-92': '20.00', 'BT-95': 'S', 'BT-96': '19' }],
  'BG-21': [{ 'BT-99': '10.00', 'BT-102': 'S', 'BT-103': '19' }],
  'BG-22': [
    {
      'BT-106': '150.00',
      'BT-107': '20.00',
      'BT-108': '10.00',
      'BT-109': '140.00',
      'BT-110': '26.60',
      'BT-112': '166.60',
      'BT-115': '166.60',
    },
  ],
  'BG-23': [{ 'BT-116': '140.00', 'BT-117': '26.60', 'BT-118': 'S', 'BT-119': '19' }],
  'BG-25': [
    { 'BT-131': '100.00', 'BG-30': [{ 'BT-151': 'S', 'BT-152': '19' }] },
    { 'BT-131': '50.00', 'BG-30': [{ 'BT-151': 'S', 'BT-152': '19.00' }] },
  ],
};

const rules = (over: Spec = {}, totals: Spec = {}, options: RulesOptions = {}) => {
  const base = BASE['BG-22'] as Spec[];
  const spec: Spec = { ...BASE, ...over, 'BG-22': [{ ...base[0], ...totals }] };
  return checkRules(group('INVOICE', spec) as InvoiceModel, options);
};
const status = (result: ReturnType<typeof checkRules>, id: string) =>
  result.results.filter((r) => r.id === id).map((r) => r.status);

describe('calculation rules (step 3a)', () => {
  it('finds nothing in a consistent invoice and checks every rule of it', () => {
    const result = rules();
    expect(result.auffaellig).toEqual([]);
    expect(result.summary).toBe('Die geprüften Beträge passen zusammen.');
    expect(result.results.map((r) => r.id)).toEqual([
      'BR-CO-10',
      'BR-CO-11',
      'BR-CO-12',
      'BR-CO-13',
      'BR-CO-14',
      'BR-CO-15',
      'BR-CO-16',
      'BR-CO-17',
      'BR-S-08',
    ]);
    expect(result.results.every((r) => r.status === 'passt')).toBe(true);
  });

  it.each([
    ['BR-CO-10', {}, { 'BT-106': '151.00', 'BT-109': '141.00' }],
    ['BR-CO-11', {}, { 'BT-107': '25.00' }],
    ['BR-CO-12', {}, { 'BT-108': '11.00' }],
    ['BR-CO-13', {}, { 'BT-109': '141.00' }],
    ['BR-CO-14', {}, { 'BT-110': '26.70' }],
    ['BR-CO-15', {}, { 'BT-112': '166.70', 'BT-115': '166.70' }],
    ['BR-CO-16', {}, { 'BT-115': '160.00' }],
  ] as const)('finds a wrong value for %s', (id, over, totals) => {
    expect(rules(over, totals).auffaellig).toContain(id);
  });

  it('BR-CO-16 takes prepaid and rounding amounts into account', () => {
    expect(status(rules({}, { 'BT-113': '66.60', 'BT-115': '100.00' }), 'BR-CO-16')).toEqual([
      'passt',
    ]);
    expect(
      status(rules({}, { 'BT-113': '66.60', 'BT-114': '0.40', 'BT-115': '100.40' }), 'BR-CO-16'),
    ).toEqual(['passt']);
  });

  it('BR-CO-17 and BR-S-08 allow a difference below 1 (as the CEN Schematron does)', () => {
    const near = {
      'BG-23': [{ 'BT-116': '140.99', 'BT-117': '27.59', 'BT-118': 'S', 'BT-119': '19' }],
    };
    expect(status(rules(near), 'BR-CO-17')).toEqual(['passt']);
    expect(status(rules(near), 'BR-S-08')).toEqual(['passt']);
    const far = {
      'BG-23': [{ 'BT-116': '141.00', 'BT-117': '27.50', 'BT-118': 'S', 'BT-119': '19' }],
    };
    expect(status(rules(far), 'BR-CO-17')).toEqual(['passt']);
    expect(status(rules(far), 'BR-S-08')).toEqual(['auffaellig']);
    const wrongTax = {
      'BG-23': [{ 'BT-116': '140.00', 'BT-117': '25.00', 'BT-118': 'S', 'BT-119': '19' }],
    };
    expect(status(rules(wrongTax), 'BR-CO-17')).toEqual(['auffaellig']);
  });

  it('BR-CO-17 wants no tax at a rate of 0', () => {
    const zero = (tax: string) => ({
      'BG-23': [{ 'BT-116': '140.00', 'BT-117': tax, 'BT-118': 'E', 'BT-119': '0' }],
    });
    expect(status(rules(zero('0.00')), 'BR-CO-17')).toEqual(['passt']);
    expect(status(rules(zero('0.60')), 'BR-CO-17')).toEqual(['auffaellig']);
  });

  it('checks the breakdown of other categories exactly, per category', () => {
    const exempt = {
      'BG-20': [],
      'BG-21': [],
      'BG-23': [{ 'BT-116': '150.00', 'BT-117': '0', 'BT-118': 'E', 'BT-119': '0' }],
      'BG-25': [
        { 'BT-131': '100.00', 'BG-30': [{ 'BT-151': 'E', 'BT-152': '0' }] },
        { 'BT-131': '50.00', 'BG-30': [{ 'BT-151': 'E', 'BT-152': '0' }] },
      ],
    };
    expect(status(rules(exempt), 'BR-E-08')).toEqual(['passt']);
    const off = { ...exempt, 'BG-23': [{ 'BT-116': '150.50', 'BT-117': '0', 'BT-118': 'E' }] };
    expect(status(rules(off), 'BR-E-08')).toEqual(['auffaellig']);
  });

  it('cannot check what is not a number — and says so in the summary (V-05)', () => {
    const result = rules({}, { 'BT-115': '166,60' });
    expect(status(result, 'BR-CO-16')).toEqual(['nichtPruefbar']);
    expect(result.notChecked).toBe(1);
    expect(result.summary).toBe(
      'Die geprüften Beträge passen zusammen. Eine Regel ließ sich nicht prüfen (siehe unten).',
    );
    const two = rules({}, { 'BT-115': '166,60', 'BT-112': '166,60' });
    expect(two.summary).toMatch(/ \d Regeln ließen sich nicht prüfen \(siehe unten\)\.$/);
  });

  it('cannot check a breakdown per rate whose rates are missing or no number (QL-02)', () => {
    const lines = BASE['BG-25'] as Spec[];
    const s08 = (over: Spec) => {
      const result = rules(over).results.find((r) => r.id === 'BR-S-08');
      return { status: result?.status, values: result?.values ?? [] };
    };
    // a line of the category whose rate is no number: never left out silently (was "0,00 EUR")
    const lineRate = s08({
      'BG-25': [
        lines[0] ?? {},
        { 'BT-131': '50.00', 'BG-30': [{ 'BT-151': 'S', 'BT-152': '19,00' }] },
      ],
    });
    expect(lineRate.status).toBe('nichtPruefbar');
    expect(lineRate.values).toContainEqual({ label: TEXTS.ruleLineSum, value: TEXTS.ruleNoNumber });
    // the rate of the breakdown is no number, or missing
    const breakdown = (rate?: string) => ({
      'BG-23': [
        {
          'BT-116': '140.00',
          'BT-117': '26.60',
          'BT-118': 'S',
          ...(rate ? { 'BT-119': rate } : {}),
        },
      ],
    });
    expect(s08(breakdown('19,00')).status).toBe('nichtPruefbar');
    expect(s08(breakdown()).status).toBe('nichtPruefbar');
    expect(s08(breakdown()).values).toContainEqual({
      label: 'Umsatzsteuersatz (BT-119)',
      value: TEXTS.ruleMissing,
    });
    // an allowance or a charge of the category whose rate is no number
    expect(s08({ 'BG-20': [{ 'BT-92': '20.00', 'BT-95': 'S', 'BT-96': '19%' }] }).status).toBe(
      'nichtPruefbar',
    );
    expect(s08({ 'BG-21': [{ 'BT-99': '10.00', 'BT-102': 'S', 'BT-103': 'x' }] }).status).toBe(
      'nichtPruefbar',
    );
    // a rate that is no number in another category does not matter
    const other = {
      'BG-21': [
        { 'BT-99': '10.00', 'BT-102': 'S', 'BT-103': '19' },
        { 'BT-99': '0', 'BT-102': 'E', 'BT-103': 'x' },
      ],
    };
    expect(s08(other).status).toBe('passt');
  });

  it('applies BR-CO-14 only where BT-110 is given, as the CEN Schematron does', () => {
    const base = BASE['BG-22'] as Spec[];
    const withoutVat = Object.fromEntries(
      Object.entries(base[0] as Spec).filter(([key]) => key !== 'BT-110'),
    );
    const model = group('INVOICE', { ...BASE, 'BG-22': [withoutVat] }) as InvoiceModel;
    expect(status(checkRules(model), 'BR-CO-14')).toEqual([]);
    // with nothing left to check (EXTENDED takes over only BR-CO-14) the summary says so
    const extended = checkRules(model, { ownRules: true });
    expect(extended.results).toEqual([]);
    expect(extended.summary).toBe(
      'Keine der ausgewählten Regeln lässt sich auf diese Rechnung anwenden.',
    );
  });

  it('names the values and shows what the rule expects (V-04)', () => {
    const co15 = rules({}, { 'BT-112': '170.00' }).results.find((r) => r.id === 'BR-CO-15');
    expect(co15?.values).toEqual([
      { label: 'Gesamtbetrag ohne Umsatzsteuer (BT-109)', value: '140,00 EUR' },
      { label: 'Summe der Umsatzsteuer (BT-110)', value: '26,60 EUR' },
      { label: 'Gesamtbetrag mit Umsatzsteuer (BT-112)', value: '170,00 EUR' },
      { label: 'Nach der Regel erwartet', value: '166,60 EUR' },
    ]);
    const co17 = rules().results.find((r) => r.id === 'BR-CO-17');
    expect(co17?.values.at(-1)).toEqual({ label: 'Nach der Regel erwartet', value: '26,60 EUR' });
    const s08 = rules().results.find((r) => r.id === 'BR-S-08');
    expect(s08?.values.at(-1)).toEqual({ label: 'Nach der Regel erwartet', value: '140,00 EUR' });
  });
});

describe('FeRD EXTENDED (own forms of the rules)', () => {
  // FeRD samples X11/X19: a logistics charge counts into BT-108 (BR-FXEXT-CO-12), not into Σ BT-99
  const base = BASE['BG-22'] as Spec[];
  const logistics = group('INVOICE', {
    ...BASE,
    'BG-22': [{ ...base[0], 'BT-106': '999.00', 'BT-108': '25.00' }],
  }) as InvoiceModel;

  it('checks only BR-CO-14, which the EXTENDED Schematron takes over unchanged', () => {
    const result = checkRules(logistics, { ownRules: true });
    expect(result.results.map((r) => r.id)).toEqual(['BR-CO-14']);
    expect(result.auffaellig).toEqual([]);
    expect(result.note).toBe(TEXTS.rulesOwnRules);
  });

  it('still names a VAT sum that does not add up', () => {
    const wrongTax = group('INVOICE', {
      ...BASE,
      'BG-22': [{ ...base[0], 'BT-110': '30.00' }],
    }) as InvoiceModel;
    expect(checkRules(wrongTax, { ownRules: true }).auffaellig).toEqual(['BR-CO-14']);
  });

  it('applies all rules and no note for the other profiles', () => {
    const result = checkRules(logistics);
    expect(result.auffaellig).toEqual(expect.arrayContaining(['BR-CO-10', 'BR-CO-12']));
    expect(result.note).toBeUndefined();
  });
});

describe('what the client could do, by the kind of rule (F23)', () => {
  it('names the input VAT for the tax amount and the Entgelt, the payment for the gross amount', () => {
    expect(adviceFor([])).toEqual([]);
    expect(adviceFor(['BR-CO-17'])).toEqual([TEXTS.adviceAmount, TEXTS.adviceTax]);
    expect(adviceFor(['BR-S-08'])).toEqual([TEXTS.adviceAmount, TEXTS.adviceNet]);
    expect(adviceFor(['BR-CO-15', 'BR-CO-16'])).toEqual([TEXTS.adviceAmountBeforePayment]);
    expect(adviceFor(['BR-CO-13', 'BR-CO-14', 'BR-CO-15'])).toEqual([
      TEXTS.adviceAmountBeforePayment,
      TEXTS.adviceTax,
      TEXTS.adviceNet,
    ]);
  });
});

describe('the forms of the CEN Schematron per syntax (audit QL-03)', () => {
  const UBL: RulesOptions = { syntax: 'ubl-invoice' };
  const CII: RulesOptions = { syntax: 'cii' };
  const both = (over: Spec, totals: Spec, id: string) => ({
    ubl: status(rules(over, totals, UBL), id),
    cii: status(rules(over, totals, CII), id),
  });

  it('BR-CO-17: a difference of exactly 1 passes in CII (≤), not in UBL (<)', () => {
    const one = {
      'BG-23': [{ 'BT-116': '140.00', 'BT-117': '27.60', 'BT-118': 'S', 'BT-119': '19' }],
    };
    expect(both(one, {}, 'BR-CO-17')).toEqual({ ubl: ['auffaellig'], cii: ['passt'] });
    // without a syntax the UBL form, as before
    expect(status(rules(one), 'BR-CO-17')).toEqual(['auffaellig']);
    const label = (options: RulesOptions) =>
      rules({}, {}, options).results.find((r) => r.id === 'BR-CO-17')?.label;
    expect(label(UBL)).toBe(`${RULE_LABELS['BR-CO-17']}, Abweichung unter 1 erlaubt`);
    expect(label(CII)).toBe(`${RULE_LABELS['BR-CO-17']}, Abweichung bis 1 erlaubt`);
  });

  it('BR-CO-17 compares the amount of a correction invoice with negative amounts (QT-02)', () => {
    const negative = {
      'BG-23': [{ 'BT-116': '-140.00', 'BT-117': '-26.60', 'BT-118': 'S', 'BT-119': '19' }],
    };
    expect(both(negative, {}, 'BR-CO-17')).toEqual({ ubl: ['passt'], cii: ['passt'] });
    const wrong = {
      'BG-23': [{ 'BT-116': '-140.00', 'BT-117': '-28.60', 'BT-118': 'S', 'BT-119': '19' }],
    };
    expect(both(wrong, {}, 'BR-CO-17')).toEqual({ ubl: ['auffaellig'], cii: ['auffaellig'] });
  });

  it('BR-S-08: UBL allows a difference below 1, CII wants the rounded part sums exactly', () => {
    const off = {
      'BG-23': [{ 'BT-116': '140.50', 'BT-117': '26.70', 'BT-118': 'S', 'BT-119': '19' }],
    };
    expect(both(off, {}, 'BR-S-08')).toEqual({ ubl: ['passt'], cii: ['auffaellig'] });
    // CII rounds each sum first: round(100.004 + 50.001) + 10 − 20 = 140.01
    const parts = {
      'BG-23': [{ 'BT-116': '140.01', 'BT-117': '26.60', 'BT-118': 'S', 'BT-119': '19' }],
      'BG-25': [
        { 'BT-131': '100.004', 'BG-30': [{ 'BT-151': 'S', 'BT-152': '19' }] },
        { 'BT-131': '50.001', 'BG-30': [{ 'BT-151': 'S', 'BT-152': '19' }] },
      ],
    };
    expect(both(parts, {}, 'BR-S-08')).toEqual({ ubl: ['passt'], cii: ['passt'] });
    const s08 = rules(parts, {}, CII).results.find((r) => r.id === 'BR-S-08');
    expect(s08?.values).toContainEqual({ label: TEXTS.ruleLineSum, value: '150,01 EUR' });
    expect(s08?.label).toBe(RULE_LABELS.BREAKDOWN);
  });

  it('BR-S-08 in UBL also counts a breakdown that only an allowance of its rate explains', () => {
    const allowanceOnly = {
      'BG-20': [
        { 'BT-92': '20.00', 'BT-95': 'S', 'BT-96': '19' },
        { 'BT-92': '5.00', 'BT-95': 'S', 'BT-96': '7' },
      ],
      'BG-23': [
        { 'BT-116': '140.00', 'BT-117': '26.60', 'BT-118': 'S', 'BT-119': '19' },
        { 'BT-116': '-5.00', 'BT-117': '-0.35', 'BT-118': 'S', 'BT-119': '7' },
      ],
    };
    expect(both(allowanceOnly, {}, 'BR-S-08')).toEqual({
      ubl: ['passt', 'passt'],
      cii: ['passt', 'passt'],
    });
  });

  const exempt = (base: string, category = 'E') => ({
    'BG-20': [],
    'BG-21': [],
    'BG-23': [{ 'BT-116': base, 'BT-117': '0', 'BT-118': category, 'BT-119': '0' }],
    'BG-25': [
      { 'BT-131': '100.00', 'BG-30': [{ 'BT-151': category, 'BT-152': '0' }] },
      { 'BT-131': '50.00', 'BG-30': [{ 'BT-151': category, 'BT-152': '0' }] },
    ],
  });

  it('BR-E-08 …: UBL exactly, CII with a difference below 1; BR-O-08 exactly in both', () => {
    expect(both(exempt('150.50'), {}, 'BR-E-08')).toEqual({ ubl: ['auffaellig'], cii: ['passt'] });
    expect(both(exempt('151.00'), {}, 'BR-E-08')).toEqual({
      ubl: ['auffaellig'],
      cii: ['auffaellig'],
    });
    expect(both(exempt('150.50', 'O'), {}, 'BR-O-08')).toEqual({
      ubl: ['auffaellig'],
      cii: ['auffaellig'],
    });
    const e08 = (options: RulesOptions) =>
      rules(exempt('150.00'), {}, options).results.find((r) => r.id === 'BR-E-08')?.label;
    expect(e08(UBL)).toBe(RULE_LABELS.BREAKDOWN_CATEGORY);
    expect(e08(CII)).toBe(`${RULE_LABELS.BREAKDOWN_CATEGORY}, Abweichung unter 1 erlaubt`);
  });

  it('BR-CO-15: CII also accepts BT-112 = BT-109', () => {
    expect(both({}, { 'BT-112': '140.00', 'BT-115': '140.00' }, 'BR-CO-15')).toEqual({
      ubl: ['auffaellig'],
      cii: ['passt'],
    });
  });

  it('BR-CO-13 and BR-CO-16: CII rounds BT-106 alone, and computes the amount due exactly', () => {
    // no document allowances and charges: BT-109 = BT-106 (UBL), = round(BT-106) (CII)
    const base = BASE['BG-22'] as Spec[];
    const net = Object.fromEntries(
      Object.entries(base[0] as Spec).filter(([key]) => key !== 'BT-107' && key !== 'BT-108'),
    );
    const alone = group('INVOICE', {
      ...BASE,
      'BG-20': [],
      'BG-21': [],
      'BG-22': [{ ...net, 'BT-106': '150.004', 'BT-109': '150.00' }],
    }) as InvoiceModel;
    expect(status(checkRules(alone, UBL), 'BR-CO-13')).toEqual(['auffaellig']);
    expect(status(checkRules(alone, CII), 'BR-CO-13')).toEqual(['passt']);
    // UBL: round(166.605 − 66.60) = 100.01; CII: 166.605 − 66.60 = 100.005
    expect(
      both({}, { 'BT-112': '166.605', 'BT-113': '66.60', 'BT-115': '100.01' }, 'BR-CO-16'),
    ).toEqual({ ubl: ['passt'], cii: ['auffaellig'] });
  });

  it('BR-CO-14 without a VAT breakdown: CII wants no VAT, UBL does not apply the rule', () => {
    expect(both({ 'BG-23': [] }, {}, 'BR-CO-14')).toEqual({ ubl: [], cii: ['auffaellig'] });
    expect(both({ 'BG-23': [] }, { 'BT-110': '0.00' }, 'BR-CO-14')).toEqual({
      ubl: [],
      cii: ['passt'],
    });
  });

  it('L and M: UBL checks BR-IG-08 and BR-IP-08; in CII their test can never fail', () => {
    const island = (category: string) => ({
      'BG-20': [],
      'BG-21': [],
      'BG-23': [{ 'BT-116': '151.00', 'BT-117': '10.57', 'BT-118': category, 'BT-119': '7' }],
      'BG-25': [
        { 'BT-131': '100.00', 'BG-30': [{ 'BT-151': category, 'BT-152': '7' }] },
        { 'BT-131': '50.00', 'BG-30': [{ 'BT-151': category, 'BT-152': '7' }] },
      ],
    });
    const ids = (over: Spec, options: RulesOptions) =>
      rules(over, {}, options)
        .results.filter((r) => /^BR-I[GP]-08$/.test(r.id))
        .map((r) => `${r.id} ${r.status}`);
    expect(ids(island('L'), UBL)).toEqual(['BR-IG-08 auffaellig']);
    expect(ids(island('M'), UBL)).toEqual(['BR-IP-08 auffaellig']);
    expect(ids(island('L'), CII)).toEqual([]);
    expect(ids(island('M'), CII)).toEqual([]);
  });
});
