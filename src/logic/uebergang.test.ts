import type { InvoiceModel, ModelGroup } from './model';
import { commonTransition, regimeOf, transitionOf } from './uebergang';

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

const model = (spec: Spec) => group('INVOICE', spec) as InvoiceModel;

describe('§ 27 Abs. 38 UStG by supply and invoice date (F26)', () => {
  it('allows another invoice for a supply in 2025/2026 invoiced by 31.12.2026', () => {
    expect(regimeOf('2025-01-01', '2025-01-02')).toBe('zulaessig');
    expect(regimeOf('2026-12-31', '2026-12-31')).toBe('zulaessig');
  });

  it('needs an e-invoice for a supply in 2026 invoiced from 2027 (Nr. 1 ends with the transmission)', () => {
    expect(regimeOf('2026-12-15', '2027-01-04')).toBe('pflicht');
  });

  it('allows it in 2027 only with the turnover limit, invoiced by 31.12.2027', () => {
    expect(regimeOf('2027-06-30', '2027-07-01')).toBe('nur800k');
    expect(regimeOf('2027-12-31', '2028-01-02')).toBe('pflicht');
  });

  it('needs an e-invoice for a supply from 2028', () => {
    expect(regimeOf('2028-01-01', undefined)).toBe('pflicht');
  });

  it('needs no E-Rechnung for a supply before 2025, whatever the invoice date (F30)', () => {
    expect(regimeOf('2024-12-31', '2025-01-10')).toBe('vor2025');
    expect(regimeOf('2018-03-01', '2027-06-30')).toBe('vor2025');
    expect(regimeOf('2024-12-31', '2028-01-02')).toBe('vor2025');
    expect(regimeOf('2024-12-31', undefined)).toBe('vor2025');
  });

  it('assumes nothing without an invoice date where it matters', () => {
    expect(regimeOf('2026-05-01', undefined)).toBe('unbekannt');
    expect(regimeOf('2027-05-01', undefined)).toBe('unbekannt');
  });
});

describe('the supply date (F26)', () => {
  it('takes the delivery date, else the end of the invoicing period', () => {
    expect(
      transitionOf(model({ 'BT-2': '2026-03-01', 'BG-13': [{ 'BT-72': '2026-02-27' }] })),
    ).toEqual({ regime: 'zulaessig' });
    expect(
      transitionOf(
        model({
          'BT-2': '2027-01-10',
          'BG-14': [{ 'BT-73': '2026-12-01', 'BT-74': '2026-12-31' }],
        }),
      ),
    ).toEqual({ regime: 'pflicht' });
  });

  it('uses both where they lead to the same sentence, else a hint and no date', () => {
    const same = model({
      'BT-2': '2026-05-02',
      'BG-13': [{ 'BT-72': '2026-04-10' }],
      'BG-14': [{ 'BT-74': '2026-04-30' }],
    });
    expect(transitionOf(same)).toEqual({ regime: 'zulaessig' });
    const apart = model({
      'BT-2': '2027-01-05',
      'BG-13': [{ 'BT-72': '2027-01-02' }],
      'BG-14': [{ 'BT-74': '2026-12-31' }],
    });
    expect(transitionOf(apart)).toEqual({ regime: 'unbekannt', conflict: 'lieferungUndZeitraum' });
  });

  it('falls back to the line periods; lines apart give a hint', () => {
    const line = (end: string) => ({ 'BT-131': '1', 'BG-26': [{ 'BT-135': end }] });
    expect(
      transitionOf(
        model({ 'BT-2': '2028-02-01', 'BG-25': [line('2028-01-10'), line('2028-01-31')] }),
      ),
    ).toEqual({ regime: 'pflicht' });
    expect(
      transitionOf(
        model({ 'BT-2': '2027-01-15', 'BG-25': [line('2026-12-20'), line('2027-01-10')] }),
      ),
    ).toEqual({ regime: 'unbekannt', conflict: 'positionen' });
  });

  it('never takes the invoice date as the supply date (F15)', () => {
    expect(transitionOf(model({ 'BT-2': '2026-03-01' }))).toEqual({ regime: 'unbekannt' });
  });

  it('agrees across several XML only when every part does', () => {
    expect(commonTransition([{ regime: 'pflicht' }, { regime: 'pflicht' }])).toEqual({
      regime: 'pflicht',
    });
    expect(commonTransition([{ regime: 'pflicht' }, { regime: 'zulaessig' }])).toEqual({
      regime: 'unbekannt',
    });
    expect(commonTransition([])).toEqual({ regime: 'unbekannt' });
  });
});
