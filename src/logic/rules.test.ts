import type { InvoiceModel, ModelGroup } from './model';
import { checkRules } from './rules';
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

const rules = (over: Spec = {}, totals: Spec = {}) => {
  const base = BASE['BG-22'] as Spec[];
  const spec: Spec = { ...BASE, ...over, 'BG-22': [{ ...base[0], ...totals }] };
  return checkRules(group('INVOICE', spec) as InvoiceModel);
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

  it('cannot check what is not a number', () => {
    expect(status(rules({}, { 'BT-115': '166,60' }), 'BR-CO-16')).toEqual(['nichtPruefbar']);
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
