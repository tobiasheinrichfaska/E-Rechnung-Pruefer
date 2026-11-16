import { INVOICE } from './binding';
import type { GroupDef } from './binding';
import { checkPflichtangaben, displayValue, holds, modeOf, sentence } from './check';
import type { RowResult } from './check';
import type { InvoiceModel, ModelGroup } from './model';
import { MODES, PFLICHTANGABEN } from './pflichtangaben';
import type { Condition, Presence } from './pflichtangaben';
import { TEXTS } from './texts';

type Spec = { [key: string]: string | string[] | Spec[] };

/** { 'BT-1': 'R-1', 'BG-4': [{ 'BT-27': 'X' }] } → model group */
function group(bg: string, spec: Spec): ModelGroup {
  const result: ModelGroup = { bg: bg as ModelGroup['bg'], terms: {}, groups: {} };
  for (const [key, value] of Object.entries(spec)) {
    if (key.startsWith('BT-')) {
      const values = Array.isArray(value) ? (value as string[]) : [value as string];
      result.terms[key as `BT-${number}`] = values.map((v) => ({ value: v, raw: v }));
    } else {
      result.groups[key as ModelGroup['bg']] = (value as Spec[]).map((child) => group(key, child));
    }
  }
  return result;
}

const address = (prefix: [string, string, string, string]) => ({
  [prefix[0]]: 'Musterstraße 1',
  [prefix[1]]: '76131',
  [prefix[2]]: 'Karlsruhe',
  [prefix[3]]: 'DE',
});

/** A complete regular invoice: 2 positions, 19 % VAT, delivery date. */
const BASE: Spec = {
  'BT-1': 'R-2026-1',
  'BT-2': '2026-11-13',
  'BT-3': '380',
  'BT-5': 'EUR',
  'BG-4': [
    {
      'BT-27': 'Verkäufer GmbH',
      'BT-31': 'DE123456789',
      'BG-5': [address(['BT-35', 'BT-38', 'BT-37', 'BT-40'])],
    },
  ],
  'BG-7': [{ 'BT-44': 'Käufer AG', 'BG-8': [address(['BT-50', 'BT-53', 'BT-52', 'BT-55'])] }],
  'BG-13': [{ 'BT-72': '2026-11-10' }],
  'BG-22': [
    {
      'BT-106': '1000.00',
      'BT-109': '1000.00',
      'BT-110': '190.00',
      'BT-112': '1190.00',
      'BT-115': '1190.00',
    },
  ],
  'BG-23': [{ 'BT-116': '1000.00', 'BT-117': '190.00', 'BT-118': 'S', 'BT-119': '19' }],
  'BG-25': [
    {
      'BT-126': '1',
      'BT-129': '2',
      'BT-130': 'C62',
      'BT-131': '800.00',
      'BG-31': [{ 'BT-153': 'Bürostuhl' }],
    },
    {
      'BT-126': '2',
      'BT-129': '4',
      'BT-130': 'HUR',
      'BT-131': '200.00',
      'BG-31': [{ 'BT-153': 'Montage' }],
    },
  ],
};

const model = (over: Spec = {}): InvoiceModel => group('INVOICE', { ...BASE, ...over });
const row = (result: ReturnType<typeof checkPflichtangaben>, id: string): RowResult => {
  const found = result.rows.find((r) => r.row.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
};

describe('the Pflichtangaben table as data', () => {
  it('has unique ids, a norm, a source and a need for every mode', () => {
    const ids = PFLICHTANGABEN.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PFLICHTANGABEN) {
      expect(p.norm.length).toBeGreaterThan(5);
      expect(p.source.length).toBeGreaterThan(3);
      expect(Object.keys(p.needs).sort()).toEqual(['kleinbetrag', 'kleinunternehmer', 'regel']);
    }
  });

  it('only uses paths that exist in the binding', () => {
    const known = (path: string): boolean => {
      let def: GroupDef | undefined = INVOICE;
      const segments = path.split('/');
      for (const [i, segment] of segments.entries()) {
        if (!def) return false;
        if (i === segments.length - 1 && segment.startsWith('BT-')) {
          return def.terms.some((t) => t.bt === segment);
        }
        def = def.groups.find((g): boolean => g.bg === segment);
      }
      return def !== undefined;
    };
    const paths: string[] = [];
    const fromPresence = (p: Presence): void => {
      if (p.kind === 'any' || p.kind === 'text') paths.push(...p.paths);
      if (p.kind === 'address') paths.push(p.group);
      if (p.kind === 'equals') paths.push(p.path);
      if (p.kind === 'each') {
        paths.push(p.group, ...p.paths.map((x) => `${p.group}/${x}`));
        if (p.unless) paths.push(`${p.group}/${p.unless.path}`);
      }
      if (p.kind === 'some') {
        paths.push(p.group, ...p.paths.map((x) => `${p.group}/${x}`));
        if (p.where) paths.push(`${p.group}/${p.where.path}`);
      }
      if (p.kind === 'anyOf' || p.kind === 'allOf') p.of.forEach(fromPresence);
    };
    const fromCondition = (c: Condition): void => {
      if (c.kind === 'equals' || c.kind === 'present' || c.kind === 'atMost') paths.push(c.path);
      if (c.kind === 'differ') paths.push(c.a, c.b);
      if (c.kind === 'text') paths.push(...c.paths);
      if (c.kind === 'partial') paths.push(c.group, ...c.paths.map((x) => `${c.group}/${x}`));
      if (c.kind === 'all' || c.kind === 'any') c.of.forEach(fromCondition);
      if (c.kind === 'not') fromCondition(c.of);
    };
    for (const p of PFLICHTANGABEN) {
      paths.push(...p.show);
      for (const each of p.each ?? []) {
        paths.push(...each.paths.map((x) => `${each.group}/${x}`));
        if (each.where) paths.push(`${each.group}/${each.where.path}`);
      }
      fromPresence(p.presence);
      for (const need of Object.values(p.needs))
        if (need.kind === 'bedingt') fromCondition(need.when);
      for (const hint of p.hints ?? []) fromCondition(hint.when);
    }
    MODES.forEach((m) => fromCondition(m.when));
    expect(paths.filter((path) => !known(path))).toEqual([]);
  });
});

describe('checkPflichtangaben – regular invoice', () => {
  it('finds every required statement in a complete invoice', () => {
    const result = checkPflichtangaben(model());
    expect(result.mode).toBe('regel');
    expect(result.missingLabels).toEqual([]);
    expect(result.summary).toBe(TEXTS.allPresent);
    expect(result.summary).not.toMatch(/ordnungsgem/i);
  });

  it('lists what is missing in the summary', () => {
    const result = checkPflichtangaben(model({ 'BT-1': [] as string[] }));
    expect(row(result, 'rechnungsnummer').status).toBe('fehlt');
    expect(result.summary).toBe('Es fehlt: Rechnungsnummer.');
  });

  it('names the missing parts of an address', () => {
    const result = checkPflichtangaben(
      model({
        'BG-7': [{ 'BT-44': 'Käufer AG', 'BG-8': [{ 'BT-52': 'Karlsruhe', 'BT-55': 'DE' }] }],
      }),
    );
    expect(row(result, 'anschrift-empfaenger')).toMatchObject({
      status: 'fehlt',
      missing: ['Postleitzahl oder Straße/Postfach'],
    });
  });

  it('accepts a trading name for the supplier and a tax number instead of a VAT id', () => {
    const result = checkPflichtangaben(
      model({
        'BG-4': [
          {
            'BT-28': 'Handelsname',
            'BT-32': '35/123/45678',
            'BG-5': [address(['BT-35', 'BT-38', 'BT-37', 'BT-40'])],
          },
        ],
      }),
    );
    expect(row(result, 'name-leistender').status).toBe('vorhanden');
    expect(row(result, 'steuernummer').status).toBe('vorhanden');
  });

  it('names the positions without quantity or description', () => {
    const result = checkPflichtangaben(
      model({
        'BG-25': [
          { 'BT-126': '1', 'BT-129': '1' },
          { 'BT-126': '2', 'BG-31': [{ 'BT-153': 'X' }] },
        ],
      }),
    );
    expect(row(result, 'menge-art').missing).toEqual([
      'Position 1: Bezeichnung',
      'Position 2: Menge',
    ]);
  });
});

describe('time of supply (§ 14 Abs. 4 Nr. 6 UStG, § 31 Abs. 4 UStDV)', () => {
  const withoutDate = { 'BG-13': [] as Spec[] };

  it('is missing without delivery date, period or note', () => {
    expect(row(checkPflichtangaben(model(withoutDate)), 'leistungszeitpunkt').status).toBe('fehlt');
  });

  it('accepts an invoicing period such as a calendar month', () => {
    const result = checkPflichtangaben(
      model({ ...withoutDate, 'BG-14': [{ 'BT-73': '2026-10-01', 'BT-74': '2026-10-31' }] }),
    );
    expect(row(result, 'leistungszeitpunkt').status).toBe('vorhanden');
  });

  it('accepts periods on every position and names the positions without one', () => {
    const lines = (both: boolean) => [
      {
        'BT-126': '1',
        'BT-129': '1',
        'BG-31': [{ 'BT-153': 'A' }],
        'BG-26': [{ 'BT-134': '2026-10-01' }],
      },
      {
        'BT-126': '2',
        'BT-129': '1',
        'BG-31': [{ 'BT-153': 'B' }],
        ...(both ? { 'BG-26': [{ 'BT-134': '2026-10-02' }] } : {}),
      },
    ];
    expect(
      row(
        checkPflichtangaben(model({ ...withoutDate, 'BG-25': lines(true) })),
        'leistungszeitpunkt',
      ).status,
    ).toBe('vorhanden');
    // F12: a period on some positions counts; the others get the Nebenleistung hint
    const partial = row(
      checkPflichtangaben(model({ ...withoutDate, 'BG-25': lines(false) })),
      'leistungszeitpunkt',
    );
    expect(partial.status).toBe('vorhanden');
    expect(partial.hints).toEqual([expect.stringContaining('Abschnitt 3.10 Abs. 5 UStAE')]);
    // all positions with a period, or a common date: no hint
    expect(
      row(
        checkPflichtangaben(model({ ...withoutDate, 'BG-25': lines(true) })),
        'leistungszeitpunkt',
      ).hints,
    ).toEqual([]);
    expect(
      row(checkPflichtangaben(model({ 'BG-25': lines(false) })), 'leistungszeitpunkt').hints,
    ).toEqual([]);
  });

  it.each([
    'Leistungsdatum entspricht Rechnungsdatum',
    'Das Lieferdatum entspricht dem Rechnungsdatum.',
    'Leistungszeitpunkt = Rechnungsdatum',
    'Rechnungsdatum entspricht dem Leistungsdatum',
    'Liefertag gleich Rechnungsdatum',
  ])('does not count the note "%s" in an e-invoice, but explains why (F15)', (note) => {
    const result = row(
      checkPflichtangaben(model({ ...withoutDate, 'BG-1': [{ 'BT-22': note }] })),
      'leistungszeitpunkt',
    );
    expect(result.status).toBe('fehlt');
    expect(result.hints).toEqual([expect.stringContaining('Abschnitt 14.5 Abs. 16')]);
  });

  it('gives no such hint when a structured date is there or the note is unrelated', () => {
    const note = { 'BG-1': [{ 'BT-22': 'Leistungsdatum entspricht Rechnungsdatum' }] };
    expect(row(checkPflichtangaben(model(note)), 'leistungszeitpunkt')).toMatchObject({
      status: 'vorhanden',
      hints: [],
    });
    const unrelated = row(
      checkPflichtangaben(
        model({
          ...withoutDate,
          'BG-1': [{ 'BT-22': 'Zahlbar bis zum Rechnungsdatum plus 14 Tage' }],
        }),
      ),
      'leistungszeitpunkt',
    );
    expect(unrelated).toMatchObject({ status: 'fehlt', hints: [] });
  });
});

describe('tax rate, tax amount and exemption (§ 14 Abs. 4 Nr. 7, 8 UStG)', () => {
  it('asks for rate and amount of taxable supplies', () => {
    const result = checkPflichtangaben(
      model({
        'BG-23': [{ 'BT-116': '1000.00', 'BT-118': 'S' }],
        'BG-22': [{ 'BT-112': '1190.00' }],
      }),
    );
    expect(row(result, 'steuersatz').missing).toEqual([
      'Aufschlüsselung der Umsatzsteuer 1: Umsatzsteuersatz',
    ]);
    expect(row(result, 'steuerbetrag').status).toBe('fehlt');
  });

  it('does not ask for rate and amount of a supply that is not taxable, but for the hint', () => {
    const notTaxable = model({
      'BG-23': [{ 'BT-116': '1000.00', 'BT-118': 'O' }],
      'BG-22': [{ 'BT-109': '1000.00', 'BT-112': '1000.00' }],
    });
    const result = checkPflichtangaben(notTaxable);
    expect(row(result, 'steuerbetrag').status).toBe('einzelfall');
    expect(row(result, 'steuersatz').status).toBe('vorhanden');
    expect(row(result, 'befreiung').status).toBe('fehlt');
  });

  it('accepts the exemption hint as reason, code or note', () => {
    const exempt = (extra: Spec) =>
      checkPflichtangaben(
        model({
          'BG-23': [{ 'BT-116': '100', 'BT-117': '0', 'BT-118': 'E', 'BT-119': '0', ...extra }],
        }),
      );
    expect(row(exempt({ 'BT-120': 'Steuerfrei nach § 4 Nr. 14 UStG' }), 'befreiung').status).toBe(
      'vorhanden',
    );
    expect(row(exempt({ 'BT-121': 'VATEX-EU-132' }), 'befreiung').status).toBe('vorhanden');
    const note = checkPflichtangaben(
      model({
        'BG-23': [{ 'BT-116': '100', 'BT-117': '0', 'BT-118': 'E', 'BT-119': '0' }],
        'BG-1': [{ 'BT-22': 'Die Leistung ist steuerfrei.' }],
      }),
    );
    expect(row(note, 'befreiung').status).toBe('vorhanden');
  });

  it('needs no exemption hint for taxable supplies only', () => {
    expect(row(checkPflichtangaben(model()), 'befreiung')).toMatchObject({
      status: 'einzelfall',
      reason: expect.stringContaining('steuerfreien') as unknown,
    });
  });

  it('asks for at least one VAT breakdown', () => {
    const result = checkPflichtangaben(model({ 'BG-23': [] as Spec[] }));
    expect(row(result, 'entgelt-aufgeschluesselt')).toMatchObject({
      status: 'fehlt',
      missing: ['keine Angabe „Aufschlüsselung der Umsatzsteuer“'],
    });
  });
});

describe('special cases (§ 14a, § 22c UStG)', () => {
  it('asks for "Steuerschuldnerschaft des Leistungsempfängers" with category AE', () => {
    const ae = (extra: Spec) =>
      checkPflichtangaben(
        model({
          'BG-23': [{ 'BT-116': '100', 'BT-117': '0', 'BT-118': 'AE', 'BT-119': '0', ...extra }],
        }),
      );
    expect(row(ae({}), 'reverse-charge').status).toBe('fehlt');
    expect(row(ae({ 'BT-121': 'VATEX-EU-AE' }), 'reverse-charge').status).toBe('vorhanden');
    // both parties in Germany: § 13b at home, no VAT ids needed
    expect(row(ae({}), 'ust-id-beide').status).toBe('einzelfall');
  });

  it('takes an exemption reason as reverse-charge note only from an AE breakdown, and back', () => {
    // KoSIT 01.04a: category O "als gemeinnützig anerkannt" is no note on § 13b UStG
    const notTaxable = checkPflichtangaben(
      model({
        'BG-23': [
          { 'BT-116': '100', 'BT-117': '0', 'BT-118': 'O', 'BT-120': 'als gemeinnützig anerkannt' },
        ],
      }),
    );
    expect(row(notTaxable, 'reverse-charge').status).toBe('einzelfall');
    expect(row(notTaxable, 'reverse-charge').groups[0]?.items).toEqual([]);
    expect(row(notTaxable, 'befreiung').status).toBe('vorhanden');

    // KoSIT 01.21a: the AE reason "Umkehrung der Steuerschuldnerschaft" is no exemption hint
    const reverse = checkPflichtangaben(
      model({
        'BG-23': [
          { 'BT-116': '100', 'BT-117': '19', 'BT-118': 'S', 'BT-119': '19' },
          {
            'BT-116': '50',
            'BT-117': '0',
            'BT-118': 'AE',
            'BT-119': '0',
            'BT-120': 'Umkehrung der Steuerschuldnerschaft',
          },
        ],
      }),
    );
    expect(row(reverse, 'reverse-charge').status).toBe('vorhanden');
    expect(row(reverse, 'reverse-charge').groups[0]?.items).toHaveLength(1);
    expect(row(reverse, 'befreiung').status).toBe('einzelfall');
    expect(row(reverse, 'befreiung').groups[0]?.items).toEqual([]);
  });

  it('asks for both VAT ids for an intra-Community supply', () => {
    const result = checkPflichtangaben(
      model({
        'BG-23': [
          {
            'BT-116': '100',
            'BT-117': '0',
            'BT-118': 'K',
            'BT-119': '0',
            'BT-120': 'Steuerfreie innergemeinschaftliche Lieferung',
          },
        ],
      }),
    );
    expect(row(result, 'ust-id-beide').status).toBe('fehlt');
    expect(row(result, 'befreiung').status).toBe('vorhanden');
  });

  it('asks for the VAT ids when the recipient of a reverse-charge service is in another country', () => {
    const result = checkPflichtangaben(
      model({
        'BG-7': [
          {
            'BT-44': 'Acheteur SA',
            'BT-48': 'FR12345678901',
            'BG-8': [{ 'BT-50': 'Rue 1', 'BT-53': '75001', 'BT-52': 'Paris', 'BT-55': 'FR' }],
          },
        ],
        'BG-23': [
          {
            'BT-116': '100',
            'BT-117': '0',
            'BT-118': 'AE',
            'BT-119': '0',
            'BT-120': 'Steuerschuldnerschaft des Leistungsempfängers',
          },
        ],
      }),
    );
    expect(row(result, 'ust-id-beide').status).toBe('vorhanden');
  });

  it('asks for the tax representative completely once one is named', () => {
    const result = checkPflichtangaben(model({ 'BG-11': [{ 'BT-62': 'Vertreter GmbH' }] }));
    expect(row(result, 'fiskalvertreter').status).toBe('fehlt');
    expect(row(checkPflichtangaben(model()), 'fiskalvertreter').status).toBe('einzelfall');
  });

  it('shows "Gutschrift" as present for type code 389 and as individual case otherwise (F2)', () => {
    expect(row(checkPflichtangaben(model({ 'BT-3': '389' })), 'gutschrift').status).toBe(
      'vorhanden',
    );
    expect(row(checkPflichtangaben(model({ 'BT-3': '381' })), 'gutschrift').status).toBe(
      'einzelfall',
    );
  });
});

describe('reduced lists of minimum content (F1)', () => {
  const small: Spec = {
    'BG-22': [{ 'BT-109': '100.00', 'BT-110': '19.00', 'BT-112': '119.00' }],
    'BG-23': [{ 'BT-116': '100.00', 'BT-117': '19.00', 'BT-118': 'S', 'BT-119': '19' }],
  };

  it('treats a total up to 250 EUR as Kleinbetragsrechnung (§ 33 UStDV)', () => {
    const result = checkPflichtangaben(
      model({ ...small, 'BT-1': [] as string[], 'BG-7': [] as Spec[], 'BG-13': [] as Spec[] }),
    );
    expect(result.mode).toBe('kleinbetrag');
    expect(result.modeText).toContain('§ 33 UStDV');
    expect(result.missingLabels).toEqual([]);
    expect(row(result, 'rechnungsnummer')).toMatchObject({
      status: 'einzelfall',
      reason: expect.stringContaining('§ 33 UStDV') as unknown,
    });
    expect(row(result, 'summe').status).toBe('vorhanden');
  });

  it('counts exactly 250 EUR as small amount and 250.01 EUR not', () => {
    const at = (amount: string) => modeOf(model({ 'BG-22': [{ 'BT-112': amount }] })).mode;
    expect(at('250.00')).toBe('kleinbetrag');
    expect(at('250')).toBe('kleinbetrag');
    expect(at('250.01')).toBe('regel');
  });

  it('does not apply § 33 UStDV to other currencies or to §§ 6a, 13b cases', () => {
    expect(modeOf(model({ ...small, 'BT-5': 'CHF' })).mode).toBe('regel');
    expect(modeOf(model({ ...small, 'BG-23': [{ 'BT-116': '100', 'BT-118': 'K' }] })).mode).toBe(
      'regel',
    );
    expect(modeOf(model({ ...small, 'BG-23': [{ 'BT-116': '100', 'BT-118': 'AE' }] })).mode).toBe(
      'regel',
    );
  });

  it('recognises a Kleinunternehmer by the hint on § 19 UStG (§ 34a UStDV)', () => {
    const ku = model({
      'BT-1': [] as string[],
      'BG-13': [] as Spec[],
      'BG-22': [{ 'BT-109': '500.00', 'BT-112': '500.00' }],
      'BG-23': [
        {
          'BT-116': '500.00',
          'BT-117': '0',
          'BT-118': 'E',
          'BT-119': '0',
          'BT-120': 'Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG',
        },
      ],
    });
    const result = checkPflichtangaben(ku);
    expect(result.mode).toBe('kleinunternehmer');
    expect(row(result, 'kleinunternehmer').status).toBe('vorhanden');
    expect(row(result, 'rechnungsnummer').status).toBe('einzelfall');
    expect(row(result, 'leistungszeitpunkt').status).toBe('einzelfall');
    expect(result.rows.some((r) => r.row.id === 'befreiung')).toBe(false);
    expect(result.missingLabels).toEqual([]);
  });

  it('hides the rows of the reduced lists in a regular invoice', () => {
    const ids = checkPflichtangaben(model()).rows.map((r) => r.row.id);
    expect(ids).not.toContain('summe');
    expect(ids).not.toContain('kleinunternehmer');
  });
});

describe('display', () => {
  it('formats dates, amounts, rates, categories and units for German readers', () => {
    expect(displayValue('BT-2', '2026-11-13', undefined)).toBe('13.11.2026');
    expect(displayValue('BT-112', '1190.5', 'EUR')).toBe('1.190,50 EUR');
    expect(displayValue('BT-119', '7.5', undefined)).toBe('7,5 %');
    expect(displayValue('BT-118', 'AE', undefined)).toBe(
      'AE – Steuerschuldnerschaft des Leistungsempfängers',
    );
    expect(displayValue('BT-130', 'HUR', undefined)).toBe('HUR (Stunde)');
    expect(displayValue('BT-130', 'XYZ', undefined)).toBe('XYZ');
    expect(displayValue('BT-27', 'Muster', undefined)).toBe('Muster');
  });

  // Audit R2-L-01: the same value written another way reads the same — so two XML of one invoice
  // compare equal; a text that is no number stays as written
  it('shows rates, quantities and amounts by their value', () => {
    expect(displayValue('BT-119', '7.00', undefined)).toBe('7 %');
    expect(displayValue('BT-119', '19', undefined)).toBe('19 %');
    expect(displayValue('BT-152', '7.50', undefined)).toBe('7,5 %');
    expect(displayValue('BT-129', '1.0000', undefined)).toBe('1');
    expect(displayValue('BT-129', '30.00000000000', undefined)).toBe('30');
    expect(displayValue('BT-129', '245.11', undefined)).toBe('245,11');
    expect(displayValue('BT-109', '314.860', 'EUR')).toBe('314,86 EUR');
    expect(displayValue('BT-109', '100.004', 'EUR')).toBe('100,004 EUR');
    expect(displayValue('BT-119', '19,00', undefined)).toBe('19,00 %');
    expect(displayValue('BT-129', 'eins', undefined)).toBe('eins');
  });

  it('shows the values of each VAT breakdown and each position', () => {
    const result = checkPflichtangaben(model());
    const lines = row(result, 'menge-art').groups[0];
    expect(lines?.items).toHaveLength(2);
    expect(lines?.items[0]).toEqual(
      expect.arrayContaining([
        { label: 'Bezeichnung', value: 'Bürostuhl' },
        { label: 'Einheit', value: 'C62 (Stück)' },
      ]),
    );
    expect(row(result, 'steuerbetrag').values).toEqual([
      { label: 'Summe der Umsatzsteuer', value: '190,00 EUR' },
    ]);
  });
});

describe('complete address (F10: any address under which the business can be reached)', () => {
  const seller = (address: Spec) =>
    checkPflichtangaben(
      model({ 'BG-4': [{ 'BT-27': 'V GmbH', 'BT-31': 'DE123456789', 'BG-5': [address] }] }),
    );

  it('accepts postcode and city without a street (e.g. a Großkundenadresse) with a hint', () => {
    const result = row(
      seller({ 'BT-38': '76127', 'BT-37': 'Karlsruhe', 'BT-40': 'DE' }),
      'anschrift-leistender',
    );
    expect(result.status).toBe('vorhanden');
    expect(result.hints).toEqual([expect.stringContaining('Abschnitt 14.5 Abs. 2 UStAE')]);
  });

  it('accepts a P.O. box line and city without a hint', () => {
    const result = row(
      seller({ 'BT-35': 'Postfach 1234', 'BT-37': 'Karlsruhe' }),
      'anschrift-leistender',
    );
    expect(result).toMatchObject({ status: 'vorhanden', hints: [] });
  });

  it('asks for the city and for postcode or street', () => {
    expect(row(seller({ 'BT-38': '76127', 'BT-40': 'DE' }), 'anschrift-leistender')).toMatchObject({
      status: 'fehlt',
      missing: ['Ort'],
    });
  });
});

describe('§ 14 Abs. 4 Satz 1 Nr. 6a UStG from 1 January 2028 (F7)', () => {
  const ids = (issued: string | string[]) =>
    checkPflichtangaben(model({ 'BT-2': issued })).rows.map((r) => r.row.id);

  it('appears only for invoices issued on or after 1 January 2028', () => {
    expect(ids('2027-12-31')).not.toContain('ist-versteuerung');
    expect(ids('2028-01-01')).toContain('ist-versteuerung');
    expect(ids([] as string[])).not.toContain('ist-versteuerung');
  });

  it('is only needed in individual cases and finds the wording in a note', () => {
    const plain = row(checkPflichtangaben(model({ 'BT-2': '2028-03-01' })), 'ist-versteuerung');
    expect(plain.status).toBe('einzelfall');
    const noted = checkPflichtangaben(
      model({
        'BT-2': '2028-03-01',
        'BG-1': [{ 'BT-22': 'Versteuerung nach vereinnahmten Entgelten' }],
      }),
    );
    expect(row(noted, 'ist-versteuerung').status).toBe('vorhanden');
  });
});

describe('hint on a "Gutschrift" that is no Gutschrift (F11)', () => {
  const note = { 'BG-1': [{ 'BT-22': 'Gutschrift zu Rechnung R-1' }] };

  it('points out a Rechnungskorrektur named "Gutschrift"', () => {
    const result = checkPflichtangaben(model({ 'BT-3': '381', ...note }));
    expect(row(result, 'gutschrift').hints).toEqual([
      expect.stringContaining('Eine Rechnungskorrektur (z. B. 381) ist keine Gutschrift'),
    ]);
    // a hint is no status: the row stays "nur im Einzelfall nötig", nothing is "missing"
    expect(row(result, 'gutschrift').status).toBe('einzelfall');
    expect(result.missingLabels).toEqual([]);
  });

  it('says nothing for a real Gutschrift or without the word', () => {
    expect(row(checkPflichtangaben(model({ 'BT-3': '389', ...note })), 'gutschrift').hints).toEqual(
      [],
    );
    expect(row(checkPflichtangaben(model({ 'BT-3': '381' })), 'gutschrift').hints).toEqual([]);
  });

  // Audit R2-U-06: the page puts „Hinweis:“ before every row hint, the word the box and the summary
  // use — so no hint brings a label of its own (the credit-note hint once began „Mögliche
  // Auffälligkeit:“, the word of the calculation rules)
  it('brings no label of its own, as no hint does', () => {
    const texts = PFLICHTANGABEN.flatMap((p) => (p.hints ?? []).map((h) => h.text));
    expect(texts.length).toBeGreaterThan(5);
    for (const text of texts) {
      expect(text).not.toMatch(/^[\p{L}-]+(?: [\p{L}-]+)?:\s/u);
      expect(text.toLowerCase()).not.toContain(TEXTS.ruleStatusAuffaellig.toLowerCase());
    }
  });
});

describe('a note found by its wording is shown as the value', () => {
  it('shows the note that makes a row "vorhanden" instead of "nicht in der XML"', () => {
    const note = 'Der Leistungsempfänger hat diese Rechnung zwei Jahre aufzubewahren.';
    const found = row(checkPflichtangaben(model({ 'BG-1': [{ 'BT-22': note }] })), 'aufbewahrung');
    expect(found.status).toBe('vorhanden');
    expect(found.values).toEqual([{ label: 'Bemerkung', value: note }]);
  });

  it('shows only the matching note, not every note', () => {
    const result = checkPflichtangaben(
      model({
        'BG-1': [
          { 'BT-22': 'Vielen Dank für Ihren Auftrag.' },
          { 'BT-22': 'Sonderregelung für Reisebüros' },
        ],
      }),
    );
    expect(row(result, 'sonderregelung').values.map((v) => v.value)).toEqual([
      'Sonderregelung für Reisebüros',
    ]);
    expect(row(result, 'aufbewahrung').values).toEqual([]);
  });
});

describe('agreed reductions of the price (§ 14 Abs. 4 Nr. 7 UStG, F8)', () => {
  const minderung = (over: Spec) => row(checkPflichtangaben(model(over)), 'minderungen');

  it('takes payment terms as the hint only when they name a reduction (Skonto, Rabatt, Bonus …)', () => {
    expect(minderung({ 'BT-20': 'Zahlbar innerhalb von 14 Tagen ohne Abzug.' }).status).toBe(
      'einzelfall',
    );
    expect(minderung({ 'BT-20': '2 % Skonto bei Zahlung bis 24.11.2026' }).status).toBe(
      'vorhanden',
    );
    // "Boni" as a word, not inside "Bonität"
    expect(minderung({ 'BT-20': 'Es gelten die vereinbarten Boni.' }).status).toBe('vorhanden');
    expect(minderung({ 'BT-20': 'Zahlung nach Prüfung der Bonität.' }).status).toBe('einzelfall');
  });

  it('takes a note of the invoice (BG-1) as the hint, as the KoSIT/FeRD recommendation does', () => {
    const found = minderung({
      'BG-1': [{ 'BT-22': 'Es bestehen Rabatt- oder Bonusvereinbarungen.' }],
    });
    expect(found.status).toBe('vorhanden');
    expect(found.values.map((v) => v.value)).toContain(
      'Es bestehen Rabatt- oder Bonusvereinbarungen.',
    );
  });

  it('takes a structured allowance with amount or reason', () => {
    const line = (allowance: Spec) => ({
      'BG-25': [{ 'BT-126': '1', 'BT-129': '1', 'BT-131': '90.00', 'BG-27': [allowance] }],
    });
    expect(minderung(line({ 'BT-136': '10.00' })).status).toBe('vorhanden');
    expect(minderung(line({ 'BT-139': 'Treuerabatt' })).status).toBe('vorhanden');
    expect(minderung({ 'BG-20': [{ 'BT-92': '5.00', 'BT-97': 'Rabatt' }] }).status).toBe(
      'vorhanden',
    );
  });
});

describe('wording of the result (screenshot review 2026-11-13)', () => {
  it('ends the summary with one full stop when the last label ends with "USt-IdNr."', () => {
    expect(sentence('Es fehlt: Fiskalvertreter: Name, Anschrift und USt-IdNr..')).toBe(
      'Es fehlt: Fiskalvertreter: Name, Anschrift und USt-IdNr.',
    );
    expect(sentence('a.')).toBe('a.');
  });

  it('names only the missing parts of a partly present row (audit 2026-11-14, U-02)', () => {
    const result = checkPflichtangaben(model({ 'BG-11': [{ 'BT-62': 'Vertreter GmbH' }] }));
    // QU-03: "davon fehlen", never "nur …", which reads as "only this is there"
    expect(result.summary).toBe(
      'Es fehlt: Fiskalvertreter: Name, Anschrift und USt-IdNr. (davon fehlen: USt-IdNr. des Fiskalvertreters; Anschrift).',
    );
    expect(result.missingLabels).toEqual(['Fiskalvertreter: Name, Anschrift und USt-IdNr.']);
    // the result box takes the same list (QU-03)
    expect(result.missingListed).toEqual([
      'Fiskalvertreter: Name, Anschrift und USt-IdNr. (davon fehlen: USt-IdNr. des Fiskalvertreters; Anschrift)',
    ]);
    const one = checkPflichtangaben(
      model({ 'BG-11': [{ 'BT-62': 'Vertreter GmbH', 'BT-63': 'DE111111111' }] }),
    );
    expect(one.missingListed).toEqual([
      'Fiskalvertreter: Name, Anschrift und USt-IdNr. (davon fehlt: Anschrift)',
    ]);
  });

  it('leaves out positions that would only show their number', () => {
    // BASE has no line periods: the time-of-supply row must not list "Positionsnummer: 1"
    expect(row(checkPflichtangaben(model()), 'leistungszeitpunkt').groups[0]?.items).toEqual([]);
    expect(
      row(checkPflichtangaben(model()), 'minderungen').groups.every((g) => g.items.length === 0),
    ).toBe(true);
  });
});

describe('conditions', () => {
  it('compares countries case-insensitively and needs both values', () => {
    const m = model();
    expect(holds(m, { kind: 'differ', a: 'BG-4/BG-5/BT-40', b: 'BG-7/BG-8/BT-55' })).toBe(false);
    expect(holds(m, { kind: 'differ', a: 'BG-4/BG-5/BT-40', b: 'BG-11/BT-62' })).toBe(false);
  });
});

describe('audit 2026-11-14', () => {
  const notes = (text: string) => ({ 'BG-1': [{ 'BT-22': text }] });

  /** No VAT shown: exempt, 0 %, no tax amount (else F18 keeps the regular list). */
  const noTax = {
    'BG-22': [{ 'BT-106': '500.00', 'BT-109': '500.00', 'BT-112': '500.00', 'BT-115': '500.00' }],
    'BG-23': [{ 'BT-116': '500.00', 'BT-117': '0', 'BT-118': 'E', 'BT-119': '0' }],
  };

  it('does not take "§ 195 BGB" for the Kleinunternehmer rule (L-02)', () => {
    const bgb = model({ ...noTax, ...notes('Es gilt die Verjährungsfrist nach § 195 BGB.') });
    expect(modeOf(bgb).mode).toBe('regel');
    const ku = model({ ...noTax, ...notes('Gemäß §19 UStG wird keine Umsatzsteuer berechnet.') });
    expect(modeOf(ku).mode).toBe('kleinunternehmer');
  });

  it('gives the street hint only for a complete address and names the party (L-06, U-09)', () => {
    const cityOnly = checkPflichtangaben(
      model({
        'BG-7': [{ 'BT-44': 'Käufer AG', 'BG-8': [{ 'BT-52': 'Karlsruhe', 'BT-55': 'DE' }] }],
      }),
    );
    expect(row(cityOnly, 'anschrift-empfaenger').status).toBe('fehlt');
    expect(row(cityOnly, 'anschrift-empfaenger').hints).toEqual([]);
    const noStreet = checkPflichtangaben(
      model({
        'BG-7': [
          {
            'BT-44': 'Käufer AG',
            'BG-8': [{ 'BT-52': 'Karlsruhe', 'BT-53': '76131', 'BT-55': 'DE' }],
          },
        ],
      }),
    );
    expect(row(noStreet, 'anschrift-empfaenger').hints.join(' ')).toContain(
      'wenn der Leistungsempfänger unter dieser Anschrift erreichbar ist',
    );
  });

  it('gives the F15 hint only where the date is required (L-06)', () => {
    const small = checkPflichtangaben(
      model({
        ...notes('Leistungsdatum entspricht Rechnungsdatum'),
        'BG-13': [],
        'BG-22': [
          {
            'BT-106': '100.00',
            'BT-109': '100.00',
            'BT-110': '19.00',
            'BT-112': '119.00',
            'BT-115': '119.00',
          },
        ],
      }),
    );
    expect(small.mode).toBe('kleinbetrag');
    expect(row(small, 'leistungszeitpunkt').hints).toEqual([]);
  });

  it('shows the type code with its label and the whole address of the tax representative (U-11, B-08)', () => {
    expect(displayValue('BT-3', '389', undefined)).toBe(
      '389 – Gutschrift (vom Leistungsempfänger ausgestellt)',
    );
    const result = checkPflichtangaben(
      model({
        'BG-11': [
          {
            'BT-62': 'Vertreter GmbH',
            'BT-63': 'DE111111111',
            'BG-12': [
              { 'BT-64': 'Hauptstr. 1', 'BT-67': '10115', 'BT-66': 'Berlin', 'BT-69': 'DE' },
            ],
          },
        ],
      }),
    );
    const shown = row(result, 'fiskalvertreter').values.map((v) => v.value);
    expect(shown).toEqual(expect.arrayContaining(['Hauptstr. 1', '10115', 'Berlin']));
  });

  it('recognises "§ 14b" and "vereinnahmte Entgelte" in notes (L-09)', () => {
    const result = checkPflichtangaben(
      model(notes('Bitte bewahren Sie diese Rechnung zwei Jahre auf (§ 14b Abs. 1 Satz 5 UStG).')),
    );
    expect(row(result, 'aufbewahrung').status).toBe('vorhanden');
  });
});

describe('decisions of 2026-11-14 (F16–F21)', () => {
  const notes = (text: string) => ({ 'BG-1': [{ 'BT-22': text }] });
  const totals = (amount: string) => ({
    'BG-22': [
      { 'BT-106': amount, 'BT-109': amount, 'BT-110': '0', 'BT-112': amount, 'BT-115': amount },
    ],
  });

  it('F16: the amount of BT-112 counts for a Kleinbetragsrechnung', () => {
    expect(modeOf(model(totals('-119.00'))).mode).toBe('kleinbetrag');
    expect(modeOf(model(totals('-250.00'))).mode).toBe('kleinbetrag');
    expect(modeOf(model(totals('-250.01'))).mode).toBe('regel');
    expect(modeOf(model(totals('-10555.30'))).mode).toBe('regel');
    expect(modeOf(model(totals('250.00'))).mode).toBe('kleinbetrag');
  });

  it('F18: a Kleinunternehmer note on an invoice with VAT keeps the full list and gives a hint', () => {
    const result = checkPflichtangaben(model(notes('Kleinunternehmer gemäß § 19 UStG')));
    expect(result.mode).toBe('regel');
    expect(row(result, 'steuerbetrag').hints.join(' ')).toContain('§ 14c UStG');
    const withoutNote = checkPflichtangaben(model());
    expect(row(withoutNote, 'steuerbetrag').hints).toEqual([]);
  });

  it('F20: a negated reduction is no hint on a reduction', () => {
    const status = (text: string) =>
      row(checkPflichtangaben(model(notes(text))), 'minderungen').status;
    expect(status('Zahlbar sofort ohne Skonto.')).toBe('einzelfall');
    expect(status('Kein Abzug von Skonto zulässig.')).toBe('einzelfall');
    expect(status('2 % Skonto bei Zahlung binnen 10 Tagen, ohne Abzug 30 Tage netto.')).toBe(
      'vorhanden',
    );
  });

  it('F21: the summary of a complete invoice names the cases "nur im Einzelfall nötig"', () => {
    expect(checkPflichtangaben(model()).summary).toBe(
      'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    );
  });
});

describe('audit 2026-11-15', () => {
  const recipientWithoutStreet = {
    'BG-7': [
      { 'BT-44': 'Käufer AG', 'BG-8': [{ 'BT-52': 'Karlsruhe', 'BT-53': '76131', 'BT-55': 'DE' }] },
    ],
  };
  const small = {
    'BG-22': [{ 'BT-106': '100.00', 'BT-109': '100.00', 'BT-110': '19.00', 'BT-112': '119.00' }],
  };
  const noTax = {
    'BG-1': [{ 'BT-22': 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' }],
    'BG-22': [{ 'BT-106': '500.00', 'BT-109': '500.00', 'BT-112': '500.00', 'BT-115': '500.00' }],
    'BG-23': [{ 'BT-116': '500.00', 'BT-117': '0', 'BT-118': 'E', 'BT-119': '0' }],
  };

  it('gives the street hint of the recipient only where his address is required (QL-08)', () => {
    const kleinbetrag = checkPflichtangaben(model({ ...recipientWithoutStreet, ...small }));
    expect(kleinbetrag.mode).toBe('kleinbetrag');
    // § 33 UStDV does not ask for the recipient's address at all
    expect(row(kleinbetrag, 'anschrift-empfaenger').hints).toEqual([]);
    expect(kleinbetrag.hintCount).toBe(0);
    // § 34a UStDV does (the row is "immer"), so the hint stays
    const ku = checkPflichtangaben(model({ ...recipientWithoutStreet, ...noTax }));
    expect(ku.mode).toBe('kleinunternehmer');
    expect(row(ku, 'anschrift-empfaenger').hints).toHaveLength(1);
    // the supplier's address is required in every mode, so its hint stays in each
    const supplier = {
      'BG-4': [
        {
          'BT-27': 'Verkäufer GmbH',
          'BT-31': 'DE123456789',
          'BG-5': [{ 'BT-37': 'Karlsruhe', 'BT-38': '76131', 'BT-40': 'DE' }],
        },
      ],
    };
    const smallSupplier = checkPflichtangaben(model({ ...supplier, ...small }));
    expect(row(smallSupplier, 'anschrift-leistender').hints).toHaveLength(1);
  });
});
