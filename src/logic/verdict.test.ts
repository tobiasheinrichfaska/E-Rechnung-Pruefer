import type { Analysis, InvoicePart } from './analysis';
import { invoiceDetails } from './details';
import { TEXTS, fill } from './texts';
import {
  comparisonRows,
  differingLine,
  differingResults,
  differingTerms,
  pflichtModel,
  technicalLine,
  technicalParts,
  verdictOf,
  xmlCounts,
} from './verdict';

/** Stands for a read EN 16931 model (only its presence matters here). */
const MODEL = { bg: 'INVOICE', terms: {}, groups: {} } as unknown as NonNullable<
  InvoicePart['model']
>;

const part = (overrides: Partial<InvoicePart['header']> = {}, origin = 'a.xml'): InvoicePart => ({
  origin,
  syntax: 'cii',
  model: MODEL,
  header: {
    'BT-1': ['R-1'],
    'BT-2': ['20261113'],
    'BT-3': ['380'],
    'BT-5': ['EUR'],
    'BT-24': ['urn:cen.eu:en16931:2017'],
    'BT-27': ['Muster GmbH'],
    'BT-112': ['119.00'],
    ...overrides,
  },
});

const analysis = (over: Partial<Analysis>): Analysis => ({
  fileName: 'r.pdf',
  kind: 'pdf',
  invoices: [],
  others: [],
  ...over,
});

describe('verdictOf', () => {
  it('never says ordnungsgemäß or gültig in any text', () => {
    const all = JSON.stringify(TEXTS);
    expect(all).not.toMatch(/ordnungsgem|gültig/i);
  });

  it('shows the fixed notice with the Kanzlei hint', () => {
    expect(TEXTS.fixedNotice).toContain('keine steuerliche Prüfung');
    expect(TEXTS.fixedNotice).toContain('Maßgeblich sind die Daten in der XML');
  });

  it('every file problem has a headline and a tone', () => {
    for (const kind of Object.keys(TEXTS.fileProblems) as (keyof typeof TEXTS.fileProblems)[]) {
      const verdict = verdictOf(analysis({ problem: { kind, problems: [] } }));
      expect(verdict.headline.length).toBeGreaterThan(0);
      expect(['ok', 'warn', 'bad']).toContain(verdict.tone);
      expect(verdict.tone).not.toBe('ok');
    }
  });

  it('adds the line of the first problem', () => {
    const verdict = verdictOf(
      analysis({
        kind: 'xml',
        problem: { kind: 'xmlBroken', problems: [{ message: 'Ende fehlt', line: 7 }] },
      }),
    );
    expect(verdict.explanation).toContain('Technische Meldung (Zeile 7): Ende fehlt');
  });

  it('uses the attachment name for a hybrid PDF and XML wording for an XML file', () => {
    const pdf = verdictOf(analysis({ invoices: [part({}, 'factur-x.xml')] }));
    expect(pdf.explanation[0]).toContain('factur-x.xml');
    const file = verdictOf(analysis({ kind: 'xml', invoices: [part()] }));
    expect(file.explanation[0]).toBe(TEXTS.xmlFile);
  });

  it('does not judge a PDF whose only attachment cannot be read (QL-06)', () => {
    const verdict = verdictOf(
      analysis({ pdf: { pages: 1, unreadable: ['kaputt.xml'], truncated: false } }),
    );
    // it may hold the invoice data: "nicht vollständig geprüft", never "ohne Rechnungsdaten"
    expect(verdict.tone).toBe('warn');
    expect(verdict.headline).toBe(TEXTS.pdfNotChecked);
    expect(verdict.explanation).toEqual([
      fill(TEXTS.attachmentUnreadable, { name: 'kaputt.xml' }),
      TEXTS.notJudged,
    ]);
  });
});

describe('a PDF whose attachments hold no invoice data (audit QU-09)', () => {
  it('names them in quotes, one attachment in the singular', () => {
    const one = verdictOf(analysis({ others: [{ origin: 'lieferschein.txt', kind: 'notXml' }] }));
    expect(one.headline).toBe(TEXTS.pdfWithoutInvoiceData);
    expect(one.explanation[0]).toBe('Der Anhang „lieferschein.txt“ enthält keine Rechnungsdaten.');
    const two = verdictOf(
      analysis({
        others: [
          { origin: 'a.txt', kind: 'notXml' },
          { origin: 'b.xml', kind: 'otherXml', root: { name: 'Order', namespace: 'urn:x' } },
        ],
      }),
    );
    expect(two.explanation[0]).toBe(
      'Anhänge im PDF: „a.txt“, „b.xml“. Keiner davon enthält Rechnungsdaten.',
    );
  });
});

describe('differingTerms', () => {
  it('compares dates across formats and amounts by value', () => {
    const ubl = part({ 'BT-2': ['2026-11-13'], 'BT-112': ['119'] }, 'x.xml');
    expect(differingTerms([part(), ubl])).toEqual([]);
  });

  it('ignores case and spacing of the supplier name', () => {
    expect(differingTerms([part(), part({ 'BT-27': ['MUSTER   gmbh'] })])).toEqual([]);
  });

  it('names every differing term', () => {
    const other = part({ 'BT-1': ['R-2'], 'BT-5': ['CHF'], 'BT-112': ['119.01'] });
    expect(differingTerms([part(), other])).toEqual(['BT-1', 'BT-5', 'BT-112']);
  });

  it('shows the values of every part, dates and amounts in German (audit Bedienung, E-04)', () => {
    const other = part({ 'BT-1': ['R-2'], 'BT-2': ['2026-11-14'], 'BT-112': ['119.01'] });
    const parts = [part(), other];
    expect(differingLine(parts, differingTerms(parts))).toBe(
      'Unterschiedlich: Rechnungsnummer (R-1 / R-2); Rechnungsdatum (13.11.2026 / 14.11.2026); ' +
        'Gesamtbetrag mit Umsatzsteuer (119,00 / 119,01).',
    );
    expect(differingLine([part(), part({ 'BT-1': [] })], ['BT-1'])).toBe(
      'Unterschiedlich: Rechnungsnummer (R-1 / –).',
    );
  });
});

describe('invoiceDetails', () => {
  it('formats date, amount and type code for German readers', () => {
    const verdict = verdictOf(analysis({ invoices: [part({ 'BT-3': ['389'] })] }));
    const invoice = verdict.invoices[0];
    if (!invoice) throw new Error('no invoice');
    const rows = Object.fromEntries(invoiceDetails(invoice, true).map((r) => [r.label, r.value]));
    expect(rows['Anhang']).toBe('a.xml');
    expect(rows['Rechnungsdatum (BT-2)']).toBe('13.11.2026');
    expect(rows['Gesamtbetrag mit Umsatzsteuer (BT-112)']).toBe('119,00 EUR');
    // by its value, as the Pflichtangaben show it (audit R3-U-05)
    const zeros = verdictOf(analysis({ invoices: [part({ 'BT-112': ['336.900'] })] })).invoices[0];
    if (!zeros) throw new Error('no invoice');
    expect(
      invoiceDetails(zeros, true).find((r) => r.label === 'Gesamtbetrag mit Umsatzsteuer (BT-112)')
        ?.value,
    ).toBe('336,90 EUR');
    expect(rows['Art der Rechnung (BT-3)']).toBe(
      '389 – Gutschrift (vom Leistungsempfänger ausgestellt)',
    );
  });

  it('keeps the schema row technical for "keine E-Rechnung", as the result does (QL-09, QU-08)', () => {
    const schema = {
      schema: 'Factur-X 1.09.2 MINIMUM (FeRD)',
      checked: true,
      problems: [],
      count: 2,
    };
    const row = (overrides: Partial<InvoicePart['header']>) => {
      const verdict = verdictOf(analysis({ invoices: [{ ...part(overrides), schema }] }));
      const invoice = verdict.invoices[0];
      if (!invoice) throw new Error('no invoice');
      return invoiceDetails(invoice, true).find((r) => r.label === 'Schema (XSD)');
    };
    // F19: no format error for "keine E-Rechnung", so the count stays under "Technische Angaben"
    expect(row({ 'BT-24': ['urn:factur-x.eu:1p0:minimum'] })?.technical).toBe(true);
    // G-2: a format error of an e-invoice stays visible
    expect(row({})?.technical).toBe(false);
  });

  it('shows missing values and keeps unreadable values as written', () => {
    const verdict = verdictOf(
      analysis({
        invoices: [part({ 'BT-1': [], 'BT-2': ['13.11.2026'], 'BT-112': ['1.000,00'] })],
      }),
    );
    const invoice = verdict.invoices[0];
    if (!invoice) throw new Error('no invoice');
    const rows = Object.fromEntries(invoiceDetails(invoice, false).map((r) => [r.label, r.value]));
    expect(rows['Rechnungsnummer (BT-1)']).toBe('– (fehlt)');
    expect(rows['Rechnungsdatum (BT-2)']).toBe('13.11.2026');
    // as written, marked as in the Pflichtangaben and the rules (audit R4-U-01)
    expect(rows['Gesamtbetrag mit Umsatzsteuer (BT-112)']).toBe(`1.000,00 ${TEXTS.ruleNoNumber}`);
  });
});

describe('several invoice XML with another specification (audit 2026-11-14, L-03)', () => {
  it('compares BT-24 too, so the result does not depend on the order', () => {
    const xr = part(
      { 'BT-24': ['urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'] },
      'a.xml',
    );
    const min = part({ 'BT-24': ['urn:factur-x.eu:1p0:minimum'] }, 'b.xml');
    const one = verdictOf(analysis({ invoices: [xr, min] }));
    const other = verdictOf(analysis({ invoices: [min, xr] }));
    expect(one.headline).toBe(TEXTS.contradicting);
    expect(other.headline).toBe(TEXTS.contradicting);
    expect(one.comparison).toEqual({ same: false, differing: ['BT-24'] });
  });
});

describe('fill (audit 2026-11-14, L-11)', () => {
  it('fills only own keys, never names of Object.prototype', () => {
    expect(fill('{toString} {name}', { name: 'X' })).toBe('{toString} X');
  });
});

describe('decisions of 2026-11-14 (F17, F19)', () => {
  it('F17: ZUGFeRD 2.0 BASIC is an e-invoice with the hint on 2.0/2.0.1', () => {
    const zf2 = part({ 'BT-24': ['urn:cen.eu:en16931:2017#compliant#urn:zugferd.de:2p0:basic'] });
    const verdict = verdictOf(analysis({ invoices: [zf2] }));
    expect(verdict.headline).toMatch(/^E-Rechnung erkannt/);
    expect(verdict.explanation).toContain(TEXTS.zugferd20Hint);
  });

  it('F19: no Pflichtangaben and no "Maßgeblich ist die XML" for "keine E-Rechnung"', () => {
    const withModel = (p: InvoicePart): InvoicePart => ({ ...p, model: MODEL });
    const minimum = verdictOf(
      analysis({ invoices: [withModel(part({ 'BT-24': ['urn:factur-x.eu:1p0:minimum'] }))] }),
    );
    const notShown = minimum.invoices[0];
    if (!notShown) throw new Error('no invoice');
    expect(pflichtModel(notShown)).toBeUndefined();
    expect(xmlCounts(minimum)).toBe(false);
    const ok = verdictOf(analysis({ invoices: [withModel(part())] }));
    const shown = ok.invoices[0];
    if (!shown) throw new Error('no invoice');
    expect(pflichtModel(shown)).toBe(MODEL);
    expect(xmlCounts(ok)).toBe(true);
    expect(TEXTS.fixedNoticeGeneral).not.toContain('XML');
  });
});

describe('a ZUGFeRD 1.0 part next to an EN 16931 part (audit 2026-11-14, L-04)', () => {
  it('compares only the specification, not values that were never read', () => {
    const zf1: InvoicePart = {
      origin: 'ZUGFeRD-invoice.xml',
      syntax: 'zugferd1',
      header: { 'BT-24': ['urn:ferd:CrossIndustryDocument:invoice:1p0:comfort'] },
    };
    const en = part({}, 'factur-x.xml');
    expect(differingTerms([zf1, en])).toEqual(['BT-24']);
    expect(differingTerms([en, zf1])).toEqual(['BT-24']);
  });
});

describe('technicalParts (audit Bedienung, Z-04)', () => {
  it('splits the German prefix from the English message', () => {
    const atLine = technicalLine({ line: 93, message: "'336,90' is not a valid value." });
    expect(technicalParts(atLine)).toEqual({
      prefix: 'Technische Meldung (Zeile 93): ',
      message: "'336,90' is not a valid value.",
    });
    expect(technicalParts(technicalLine({ message: 'Invalid PDF structure.' }))).toEqual({
      prefix: 'Technische Meldung: ',
      message: 'Invalid PDF structure.',
    });
    // with the attachment it belongs to (audit R4-U-02)
    expect(
      technicalParts(technicalLine({ line: 8, message: 'Not expected.' }, 'a (1).xml')),
    ).toEqual({
      prefix: 'Technische Meldung, Anhang „a (1).xml“ (Zeile 8): ',
      message: 'Not expected.',
    });
    expect(technicalParts(technicalLine({ message: 'Not expected.' }, 'b.xml'))).toEqual({
      prefix: 'Technische Meldung, Anhang „b.xml“: ',
      message: 'Not expected.',
    });
  });

  it('leaves German lines alone', () => {
    expect(technicalParts(TEXTS.formatError)).toBeUndefined();
    expect(technicalParts('Technische Meldung (Zeile x): y')).toBeUndefined();
  });
});

/** A model with the given dates: invoice date, delivery date, end of the invoicing period. */
function dated(
  invoice: string,
  delivery?: string,
  periodEnd?: string,
): NonNullable<InvoicePart['model']> {
  const term = (value: string) => [{ value, raw: value }];
  const groups: Record<string, unknown[]> = {};
  if (delivery) groups['BG-13'] = [{ bg: 'BG-13', terms: { 'BT-72': term(delivery) }, groups: {} }];
  if (periodEnd)
    groups['BG-14'] = [{ bg: 'BG-14', terms: { 'BT-74': term(periodEnd) }, groups: {} }];
  return {
    bg: 'INVOICE',
    terms: { 'BT-2': term(invoice) },
    groups,
  } as unknown as NonNullable<InvoicePart['model']>;
}

const MINIMUM = { 'BT-24': ['urn:factur-x.eu:1p0:minimum'] };

describe('decisions of 2026-11-14, dialogue (F22–F27, G-3, G-7, G-10)', () => {
  it('F22/G-3: missing Pflichtangaben make an e-invoice yellow, with a line and the hint (F23)', () => {
    // the stub model holds nothing, so every Pflichtangabe is missing
    const verdict = verdictOf(analysis({ kind: 'xml', invoices: [part()] }));
    expect(verdict.tone).toBe('warn');
    expect(verdict.headline).toBe('E-Rechnung erkannt (EN 16931) – mit Hinweisen');
    expect(verdict.explanation.some((l) => l.startsWith('Es fehlen Pflichtangaben: '))).toBe(true);
    expect(verdict.explanation).toContain(TEXTS.supplierComplete);
  });

  it('F26: "keine E-Rechnung" with readable dates gets the sentence by date', () => {
    const at = (model: NonNullable<InvoicePart['model']>) =>
      verdictOf(analysis({ kind: 'xml', invoices: [{ ...part(MINIMUM), model }] })).explanation;
    expect(at(dated('2026-03-01', '2026-02-27'))).toContain(TEXTS.regimeAllowed);
    expect(at(dated('2027-03-01', '2027-02-27'))).toContain(TEXTS.regimeTurnover);
    expect(at(dated('2027-01-04', undefined, '2026-12-31'))).toContain(TEXTS.regimeRequired);
    expect(at(dated('2028-01-10', '2028-01-05'))).toContain(TEXTS.regimeRequired);
    // no supply date: the general sentence (F23), never the invoice date (F15)
    expect(at(dated('2026-03-01'))).toContain(TEXTS.regimeGeneral);
    // delivery and period lead to different sentences: a hint and the general sentence
    const apart = at(dated('2027-01-05', '2027-01-02', '2026-12-31'));
    expect(apart).toEqual(expect.arrayContaining([TEXTS.datesApart, TEXTS.regimeGeneral]));
    // F30: a supply before 2025 needs no E-Rechnung, also when invoiced in 2027 (BMF Rn. 50)
    expect(at(dated('2027-03-01', '2024-11-28'))).toEqual(
      expect.arrayContaining([TEXTS.regimeBefore2025]),
    );
    expect(at(dated('2027-03-01', '2024-11-28'))).not.toContain(TEXTS.regimeGeneral);
  });

  it('F23: a plain PDF and an unknown XML say whom to ask', () => {
    expect(verdictOf(analysis({})).explanation).toContain(TEXTS.regimeGeneral);
    const other = verdictOf(analysis({ kind: 'xml', root: { name: 'Order', namespace: 'urn:x' } }));
    expect(other.explanation).toContain(TEXTS.kanzleiJudges);
  });

  it('QU-12: an unknown XML names its root element last, as a technical detail', () => {
    const other = verdictOf(analysis({ kind: 'xml', root: { name: 'Order', namespace: 'urn:x' } }));
    expect(other.explanation).toEqual([
      TEXTS.otherFormats,
      TEXTS.kanzleiJudges,
      'Technische Angabe: Wurzelelement Order (Namensraum urn:x).',
    ]);
    const bare = verdictOf(analysis({ kind: 'xml', root: { name: 'Order', namespace: '' } }));
    expect(bare.explanation.at(-1)).toBe('Technische Angabe: Wurzelelement Order (Namensraum –).');
  });

  it('G-10/F24: a broken XML says the German sentences first, the engine message last', () => {
    const verdict = verdictOf(
      analysis({
        kind: 'xml',
        problem: { kind: 'xmlBroken', problems: [{ message: 'Ende fehlt', line: 7 }] },
      }),
    );
    expect(verdict.explanation).toEqual([
      TEXTS.formatError,
      TEXTS.supplierMendFile,
      TEXTS.regimeGeneral,
      'Technische Meldung (Zeile 7): Ende fehlt',
    ]);
  });

  it('F27: the same data twice is an e-invoice with the hint on the standard', () => {
    const verdict = verdictOf(analysis({ invoices: [part({}, 'a.xml'), part({}, 'b.xml')] }));
    expect(verdict.comparison?.same).toBe(true);
    expect(verdict.headline).toBe('E-Rechnung erkannt (EN 16931) – mit Hinweisen');
    expect(verdict.explanation.join(' ')).toContain(
      'Nach dem Standard ist nur eine Rechnungs-XML je PDF zulässig.',
    );
  });

  it('F27: different data is a format error; the XML is then not what counts', () => {
    const verdict = verdictOf(
      analysis({ invoices: [part({}, 'a.xml'), part({ 'BT-1': ['R-2'] }, 'b.xml')] }),
    );
    expect(verdict.tone).toBe('bad');
    expect(verdict.headline).toBe(TEXTS.contradicting);
    expect(xmlCounts(verdict)).toBe(false);
  });

  it('G-7: ZUGFeRD 1.0 is named as a version, in a PDF and as XML', () => {
    const zf1 = part({ 'BT-24': ['urn:ferd:CrossIndustryDocument:invoice:1p0:comfort'] });
    expect(verdictOf(analysis({ invoices: [zf1] })).headline).toBe(TEXTS.zugferd1Pdf);
    expect(verdictOf(analysis({ kind: 'xml', invoices: [zf1] })).headline).toBe(TEXTS.zugferd1Xml);
  });
});

describe('the same invoice XML twice (audit 2026-11-15)', () => {
  const schema = {
    schema: 'UN/CEFACT CII D16B',
    checked: true,
    problems: [{ message: "Element 'ram:Unbekannt': This element is not expected.", line: 9 }],
    count: 1,
  };
  const unknown = { 'BT-24': ['urn:example:unbekannt'] };
  const twice = (overrides: Partial<InvoicePart['header']>, withSchema = true) =>
    verdictOf(
      analysis({
        invoices: ['a.xml', 'b.xml'].map((origin) => ({
          ...part(overrides, origin),
          ...(withSchema ? { schema } : {}),
        })),
      }),
    );

  it('keeps headline and tone of one XML for "nicht beurteilt", each line once (QL-07)', () => {
    const one = verdictOf(analysis({ invoices: [{ ...part(unknown), schema }] }));
    const verdict = twice(unknown);
    expect(verdict.comparison?.same).toBe(true);
    expect(verdict.tone).toBe(one.tone);
    expect(verdict.headline).toBe(TEXTS.nichtBeurteilt);
    expect(new Set(verdict.explanation).size).toBe(verdict.explanation.length);
    const at = (line: string) => verdict.explanation.indexOf(line);
    const same = verdict.explanation.findIndex((l) => l.startsWith('Dieselbe Rechnung'));
    expect(same).toBeGreaterThan(-1);
    // "Dieselbe Rechnung …" before the format error, the engine's messages last (G-10)
    expect(same).toBeLessThan(at(TEXTS.formatError));
    expect(at(TEXTS.formatError)).toBeLessThan(at(TEXTS.kanzleiJudges));
    expect(verdict.explanation.at(-1)).toMatch(/^Technische Meldung \(Zeile 9\): /);
    // the German schema sentence names each part once
    expect(verdict.explanation.filter((l) => l.includes('„a.xml“ weicht'))).toHaveLength(1);
    expect(verdict.explanation.filter((l) => l.includes('„b.xml“ weicht'))).toHaveLength(1);
  });

  it('keeps headline and lines of "keine E-Rechnung" (QL-07)', () => {
    const one = verdictOf(analysis({ invoices: [part(MINIMUM)] }));
    const verdict = twice(MINIMUM, false);
    expect(verdict.tone).toBe('bad');
    expect(verdict.headline).toBe(one.headline);
    expect(verdict.explanation.slice(0, one.explanation.length)).toEqual(one.explanation);
    expect(verdict.explanation).toHaveLength(one.explanation.length + 1);
  });
});

// Audit R4-U-02: with several parts the box counted the messages beyond the third „below“ for each
// part, and „Zeile 8“ belonged to no attachment where two parts had other messages
describe('schema messages of several invoice XML (audit R4-U-02)', () => {
  const problems = (count: number, from: number) =>
    Array.from({ length: count }, (_, i) => ({ message: `Problem ${from + i}.`, line: from + i }));
  const schemaOf = (count: number, from: number) => ({
    schema: 'UN/CEFACT CII D16B',
    checked: true,
    problems: problems(count, from),
    count,
  });
  const parts = (a: number, b: number, other: Partial<InvoicePart['header']> = {}) =>
    [
      { ...part({}, 'a.xml'), ...(a > 0 ? { schema: schemaOf(a, 1) } : {}) },
      { ...part(other, 'b.xml'), ...(b > 0 ? { schema: schemaOf(b, 101) } : {}) },
    ] satisfies InvoicePart[];
  const technical = (verdict: ReturnType<typeof verdictOf>) =>
    verdict.explanation.filter(
      (line) => line.startsWith('Technische Meldung') || line.startsWith('Weitere'),
    );

  it('names the attachment of each line where two parts have other messages', () => {
    for (const other of [{}, { 'BT-1': ['R-2'] }]) {
      const verdict = verdictOf(analysis({ invoices: parts(5, 4, other) }));
      expect(technical(verdict)).toEqual([
        'Technische Meldung, Anhang „a.xml“ (Zeile 1): Problem 1.',
        'Technische Meldung, Anhang „a.xml“ (Zeile 2): Problem 2.',
        'Technische Meldung, Anhang „a.xml“ (Zeile 3): Problem 3.',
        fill(TEXTS.schemaMoreIn, { name: 'a.xml', count: 2 }),
        'Technische Meldung, Anhang „b.xml“ (Zeile 101): Problem 101.',
        'Technische Meldung, Anhang „b.xml“ (Zeile 102): Problem 102.',
        'Technische Meldung, Anhang „b.xml“ (Zeile 103): Problem 103.',
        fill(TEXTS.schemaMoreIn, { name: 'b.xml', count: 1 }),
      ]);
    }
  });

  it('keeps the short lines where only one part has messages', () => {
    const verdict = verdictOf(analysis({ invoices: parts(0, 4) }));
    expect(verdict.comparison?.same).toBe(true);
    expect(technical(verdict)).toEqual([
      'Technische Meldung (Zeile 101): Problem 101.',
      'Technische Meldung (Zeile 102): Problem 102.',
      'Technische Meldung (Zeile 103): Problem 103.',
      fill(TEXTS.schemaMore, { count: 1 }),
    ]);
  });
});

describe('the same header but other data in two invoice XML (audit QL-01)', () => {
  const term = (value: string) => [{ value, raw: value }];
  /** The header of `part()` as a model, with or without the seller's VAT id (BT-31). */
  const withSeller = (vat?: string): NonNullable<InvoicePart['model']> =>
    ({
      bg: 'INVOICE',
      terms: { 'BT-1': term('R-1'), 'BT-2': term('2026-11-13'), 'BT-5': term('EUR') },
      groups: {
        'BG-4': [
          {
            bg: 'BG-4',
            terms: { 'BT-27': term('Muster GmbH'), ...(vat ? { 'BT-31': term(vat) } : {}) },
            groups: {},
          },
        ],
      },
    }) as unknown as NonNullable<InvoicePart['model']>;
  const a = { ...part({}, 'a.xml'), model: withSeller('DE123456789') };
  const b = { ...part({}, 'b.xml'), model: withSeller() };

  it('are no longer "dieselbe Rechnung", whatever the order', () => {
    for (const invoices of [
      [a, b],
      [b, a],
    ]) {
      const verdict = verdictOf(analysis({ invoices }));
      expect(verdict.comparison).toEqual({ same: false, differing: [] });
      expect(verdict.headline).toBe(TEXTS.contradicting);
      expect(verdict.tone).toBe('bad');
    }
    // the same data stay the same
    const twice = verdictOf(analysis({ invoices: [a, { ...a, origin: 'b.xml' }] }));
    expect(twice.comparison).toEqual({ same: true, differing: [] });
  });

  it('names what differs, with the value of each part', () => {
    const line = differingLine([a, b], []);
    // the values with their names, the status only where it differs (audit R3-U-04)
    expect(line).toBe(
      'Unterschiedlich: Steuernummer oder USt-IdNr. des leistenden Unternehmers ' +
        '(vorhanden – USt-IdNr. des Lieferanten: DE123456789 / fehlt); USt-IdNr. des leistenden ' +
        'Unternehmers und des Leistungsempfängers (USt-IdNr. des Lieferanten: DE123456789 / –).',
    );
    const rows = comparisonRows([a, b]).filter((row) => row.differs);
    expect(rows[0]).toEqual({
      label: 'Steuernummer oder USt-IdNr. des leistenden Unternehmers',
      values: ['vorhanden – USt-IdNr. des Lieferanten: DE123456789', 'fehlt'],
      differs: true,
    });
    expect(rows).toHaveLength(2);
  });

  // Audit R5-U-02: a differing header value hid every other difference
  it('names what else differs beside a differing header value, without repeating it', () => {
    const numbered = (number: string, vat?: string) => {
      const model = withSeller(vat);
      return { ...model, terms: { ...model.terms, 'BT-1': term(number) } } as typeof model;
    };
    const first = { ...part({}, 'a.xml'), model: numbered('R-1', 'DE123456789') };
    const second = {
      ...part({ 'BT-1': ['R-2'] }, 'b.xml'),
      model: numbered('R-2'),
    };
    const differing = differingTerms([first, second]);
    expect(differing).toEqual(['BT-1']);
    // the box names the header value and counts the rest, pointing to the table
    expect(differingLine([first, second], differing)).toBe(
      `Unterschiedlich: Rechnungsnummer (R-1 / R-2). ${fill(TEXTS.differingMore, { count: 2 })}`,
    );
    const rows = comparisonRows([first, second]).filter((row) => row.differs);
    expect(rows.map((row) => row.label)).toEqual([
      'Rechnungsnummer (BT-1)',
      'Steuernummer oder USt-IdNr. des leistenden Unternehmers',
      'USt-IdNr. des leistenden Unternehmers und des Leistungsempfängers',
    ]);
    // the Pflichtangabe „Rechnungsnummer“ differs too, but only repeats BT-1
    expect(differingResults([first, second]).map((item) => item.label)).toContain(
      'Rechnungsnummer',
    );
    // with nothing beside the header value, the line stays as it was (E-04)
    const alone = { ...first, origin: 'b.xml', header: { ...first.header, 'BT-1': ['R-2'] } };
    const aloneModel = { ...alone, model: numbered('R-2', 'DE123456789') };
    expect(differingLine([first, aloneModel], ['BT-1'])).toBe(
      'Unterschiedlich: Rechnungsnummer (R-1 / R-2).',
    );
    expect(comparisonRows([first, aloneModel]).filter((row) => row.differs)).toHaveLength(1);
    // one more is said in the singular: two rows with the same differing VAT id count once
    const one = { ...part({ 'BT-1': ['R-2'] }, 'b.xml'), model: withSeller('DE987654321') };
    expect(differingLine([a, one], ['BT-1'])).toBe(
      `Unterschiedlich: Rechnungsnummer (R-1 / R-2). ${TEXTS.differingMoreOne}`,
    );
  });

  // Audit R3-U-03: two rows that show the same differing value are named once, together
  it('names the same differing values of several rows once', () => {
    const other = { ...part({}, 'b.xml'), model: withSeller('DE987654321') };
    const pair = 'USt-IdNr. des Lieferanten: DE123456789 / USt-IdNr. des Lieferanten: DE987654321';
    expect(differingLine([a, other], [])).toBe(
      'Unterschiedlich: „Steuernummer oder USt-IdNr. des leistenden Unternehmers“ und ' +
        `„USt-IdNr. des leistenden Unternehmers und des Leistungsempfängers“ (${pair}).`,
    );
    const rows = comparisonRows([a, other]).filter((row) => row.differs);
    expect(rows).toHaveLength(1);
  });

  // Audit R3-L-03: a doubled space is no other name; another case stays apart (question G-22)
  it('collapses whitespace in the values it compares, and keeps their case', () => {
    const named = (name: string) =>
      ({
        ...withSeller('DE123456789'),
        groups: { 'BG-4': [{ bg: 'BG-4', terms: { 'BT-27': term(name) }, groups: {} }] },
      }) as unknown as NonNullable<InvoicePart['model']>;
    const one = { ...part({}, 'a.xml'), model: named('Muster GmbH') };
    const spaced = { ...part({}, 'b.xml'), model: named('Muster \n  GmbH') };
    expect(differingResults([one, spaced])).toEqual([]);
    expect(verdictOf(analysis({ invoices: [one, spaced] })).comparison?.same).toBe(true);
    const upper = { ...part({}, 'b.xml'), model: named('MUSTER GMBH') };
    expect(differingResults([one, upper])).toEqual([
      {
        label: 'Name des leistenden Unternehmers',
        values: ['Name des Lieferanten: Muster GmbH', 'Name des Lieferanten: MUSTER GMBH'],
      },
    ]);
    // a no-break space in one copy only is no other name either (audit R4-L-02)
    const unbroken = { ...part({}, 'b.xml'), model: named('Muster\u00a0GmbH') };
    expect(differingResults([one, unbroken])).toEqual([]);
    expect(verdictOf(analysis({ invoices: [one, unbroken] })).comparison?.same).toBe(true);
  });

  // Audit R4-L-02: collapsing the whitespace (R3-L-03) took the no-break space before „%“
  // (R3-U-10), so „7“ and „%“ could stand on two lines in the comparison
  it('keeps the no-break space before „%“ in the values it shows', () => {
    const rated = (rate: string) => {
      const seller = withSeller('DE123456789');
      return {
        ...seller,
        groups: {
          ...seller.groups,
          'BG-23': [
            {
              bg: 'BG-23',
              terms: {
                'BT-116': term('100.00'),
                'BT-117': term('7.00'),
                'BT-118': term('S'),
                'BT-119': term(rate),
              },
              groups: {},
            },
          ],
        },
      } as unknown as NonNullable<InvoicePart['model']>;
    };
    const parts = [
      { ...part({}, 'a.xml'), model: rated('7') },
      { ...part({}, 'b.xml'), model: rated('7.5') },
    ];
    const line = differingLine(parts, []);
    expect(line).toContain('Umsatzsteuersatz: 7\u00a0%');
    expect(line).toContain('Umsatzsteuersatz: 7,5\u00a0%');
    expect(line).not.toMatch(/\d %/);
    const shown = comparisonRows(parts)
      .filter((row) => row.differs)
      .flatMap((row) => row.values);
    expect(shown.join(' / ')).toContain('Umsatzsteuersatz: 7,5\u00a0%');
    expect(shown.filter((value) => / %/.test(value))).toEqual([]);
  });
});

// Audit R3-L-04, R3-U-05: the compared total by its value, and marked where it is no number
describe('the compared total (audit R3-L-04, R3-U-05)', () => {
  it('shows a total by its value and marks one that is no number', () => {
    const parts = [part({ 'BT-112': ['336.900'] }), part({ 'BT-112': ['336,90'] }, 'b.xml')];
    expect(differingLine(parts, differingTerms(parts))).toBe(
      'Unterschiedlich: Gesamtbetrag mit Umsatzsteuer (336,90 / 336,90 – keine Zahl).',
    );
    const total = comparisonRows(parts).find(
      (row) => row.label === 'Gesamtbetrag mit Umsatzsteuer (BT-112)',
    );
    expect(total?.values).toEqual(['336,90', '336,90 – keine Zahl']);
  });
});

describe('attachments not read next to an invoice XML (audit QL-06)', () => {
  /** An invoice XML without a model: alone it is a plain green "E-Rechnung erkannt". */
  const bare = (origin = 'factur-x.xml'): InvoicePart => {
    const plain = part({}, origin);
    delete plain.model;
    return plain;
  };
  const pdf = { pages: 1, unreadable: [] as string[], truncated: false };

  it('makes an e-invoice yellow and names each of them', () => {
    expect(verdictOf(analysis({ invoices: [bare()] })).tone).toBe('ok');
    const cases: [Partial<Analysis>, string][] = [
      [
        { others: [{ origin: 'x.xml', kind: 'brokenXml', problems: [] }] },
        fill(TEXTS.attachmentBroken, { name: 'x.xml' }),
      ],
      [
        { others: [{ origin: 'x.xml', kind: 'doctypeXml' }] },
        fill(TEXTS.attachmentDoctype, { name: 'x.xml' }),
      ],
      [
        { others: [{ origin: 'x.xml', kind: 'tooLargeXml' }] },
        fill(TEXTS.attachmentTooLarge, { name: 'x.xml' }),
      ],
      [
        { pdf: { ...pdf, unreadable: ['x.xml'] } },
        fill(TEXTS.attachmentUnreadable, { name: 'x.xml' }),
      ],
      [{ pdf: { ...pdf, truncated: true } }, TEXTS.attachmentsTruncated],
    ];
    for (const [over, line] of cases) {
      const verdict = verdictOf(analysis({ invoices: [bare()], ...over }));
      expect(verdict.tone).toBe('warn');
      expect(verdict.headline).toBe('E-Rechnung erkannt (EN 16931) – mit Hinweisen');
      expect(verdict.explanation).toContain(line);
    }
    // an attachment that is no XML or no invoice is no reason
    const other = verdictOf(
      analysis({ invoices: [bare()], others: [{ origin: 'a.txt', kind: 'notXml' }] }),
    );
    expect(other.tone).toBe('ok');
  });

  it('keeps a format error red and names them before the technical lines', () => {
    const schema = {
      schema: 'X',
      checked: true,
      problems: [{ message: 'bad', line: 3 }],
      count: 1,
    };
    const verdict = verdictOf(
      analysis({
        invoices: [{ ...bare(), schema }],
        others: [{ origin: 'x.xml', kind: 'doctypeXml' }],
      }),
    );
    expect(verdict.tone).toBe('bad');
    const doctype = verdict.explanation.indexOf(fill(TEXTS.attachmentDoctype, { name: 'x.xml' }));
    expect(doctype).toBeGreaterThan(-1);
    expect(doctype).toBeLessThan(verdict.explanation.length - 1);
    expect(verdict.explanation.at(-1)).toBe('Technische Meldung (Zeile 3): bad');
  });

  it('names them for several invoice XML too', () => {
    const others = [{ origin: 'x.xml', kind: 'tooLargeXml' as const }];
    const same = verdictOf(analysis({ invoices: [bare('a.xml'), bare('b.xml')], others }));
    expect(same.explanation).toContain(fill(TEXTS.attachmentTooLarge, { name: 'x.xml' }));
    // values are compared only where a model was read (L-04), so these parts have one
    const apart = verdictOf(
      analysis({ invoices: [part({}, 'a.xml'), part({ 'BT-1': ['R-2'] }, 'b.xml')], others }),
    );
    expect(apart.headline).toBe(TEXTS.contradicting);
    expect(apart.explanation).toContain(fill(TEXTS.attachmentTooLarge, { name: 'x.xml' }));
  });
});

// Audit R2-U-08: beside an invoice XML the box says what an attachment not read means for it
describe('what attachments not read mean for the result (audit R2-U-08)', () => {
  const bare = (origin = 'factur-x.xml'): InvoicePart => {
    const plain = part({}, origin);
    delete plain.model;
    return plain;
  };
  const pdf = { pages: 1, unreadable: [] as string[], truncated: false };
  const doctype = { origin: 'x.xml', kind: 'doctypeXml' as const };

  it('follows the attachments not read with one sentence, after them', () => {
    const one = verdictOf(analysis({ invoices: [bare()], others: [doctype] }));
    expect(one.explanation.slice(-2)).toEqual([
      fill(TEXTS.attachmentDoctype, { name: 'x.xml' }),
      TEXTS.unreadOne,
    ]);
    const several = verdictOf(
      analysis({ invoices: [bare()], others: [doctype], pdf: { ...pdf, unreadable: ['y.xml'] } }),
    );
    expect(several.explanation.at(-1)).toBe(TEXTS.unreadSeveral);
    expect(several.explanation).not.toContain(TEXTS.unreadOne);
    const truncated = verdictOf(analysis({ invoices: [bare()], pdf: { ...pdf, truncated: true } }));
    expect(truncated.explanation.slice(-2)).toEqual([
      TEXTS.attachmentsTruncated,
      TEXTS.unreadSeveral,
    ]);
    // for "keine E-Rechnung" and for two different invoice XML too
    const minimum = verdictOf(analysis({ invoices: [part(MINIMUM)], others: [doctype] }));
    expect(minimum.explanation.at(-1)).toBe(TEXTS.unreadOne);
    const apart = verdictOf(
      analysis({
        invoices: [part({}, 'a.xml'), part({ 'BT-1': ['R-2'] }, 'b.xml')],
        others: [doctype],
      }),
    );
    expect(apart.explanation).toContain(TEXTS.unreadOne);
  });

  it('keeps „kann das Tool deshalb nicht sagen“ alone where no invoice XML was read', () => {
    const verdict = verdictOf(analysis({ others: [doctype] }));
    expect(verdict.headline).toBe(TEXTS.pdfNotChecked);
    expect(verdict.explanation).toEqual([
      fill(TEXTS.attachmentDoctype, { name: 'x.xml' }),
      TEXTS.notJudged,
    ]);
  });

  it('adds nothing where every attachment was read', () => {
    const verdict = verdictOf(
      analysis({ invoices: [bare()], others: [{ origin: 'a.txt', kind: 'notXml' }] }),
    );
    expect(verdict.explanation).not.toContain(TEXTS.unreadOne);
    expect(verdict.explanation).not.toContain(TEXTS.unreadSeveral);
  });
});

// Audit R2-U-09: the names of the attachments in quotes, as everywhere else
describe('the names of several invoice XML (audit R2-U-09)', () => {
  it('puts each name in quotes, for the same and for different data', () => {
    const same = verdictOf(
      analysis({ invoices: [part({}, 'factur-x.xml'), part({}, 'zugferd-invoice.xml')] }),
    );
    expect(same.explanation).toContain(
      'Dieselbe Rechnung ist 2-mal eingebettet („factur-x.xml“, „zugferd-invoice.xml“). ' +
        'Nach dem Standard ist nur eine Rechnungs-XML je PDF zulässig.',
    );
    const apart = verdictOf(
      analysis({
        invoices: [part({}, 'factur-x.xml'), part({ 'BT-1': ['R-2'] }, 'zugferd-invoice.xml')],
      }),
    );
    expect(apart.explanation[0]).toBe(
      'Das PDF enthält 2 Rechnungs-XML mit unterschiedlichen Daten („factur-x.xml“, ' +
        '„zugferd-invoice.xml“). Unklar ist, welche gilt.',
    );
  });
});

// Audit R2-L-02: where the short texts of the parts agree, what differs is shown
describe('what differs where the short texts agree (audit R2-L-02)', () => {
  const term = (value: string) => [{ value, raw: value }];
  const line = (id: string, rate: string, amount?: string) => ({
    bg: 'BG-25',
    terms: { 'BT-126': term(id), ...(amount ? { 'BT-131': term(amount) } : {}) },
    groups: {
      'BG-30': [{ bg: 'BG-30', terms: { 'BT-151': term('S'), 'BT-152': term(rate) }, groups: {} }],
    },
  });
  /** Two positions at 19 and 7 %; the one without its amount (BT-131) cannot be checked */
  const withLines = (missing: 1 | 2): NonNullable<InvoicePart['model']> =>
    ({
      bg: 'INVOICE',
      terms: { 'BT-5': term('EUR') },
      groups: {
        'BG-22': [
          {
            bg: 'BG-22',
            terms: {
              'BT-106': term('150.00'),
              'BT-109': term('150.00'),
              'BT-110': term('22.50'),
              'BT-112': term('172.50'),
              'BT-115': term('172.50'),
            },
            groups: {},
          },
        ],
        'BG-23': [
          ['100.00', '19.00', '19'],
          ['50.00', '3.50', '7'],
        ].map(([base = '', tax = '', rate = '']) => ({
          bg: 'BG-23',
          terms: {
            'BT-116': term(base),
            'BT-117': term(tax),
            'BT-118': term('S'),
            'BT-119': term(rate),
          },
          groups: {},
        })),
        'BG-25': [
          line('1', '19', missing === 1 ? undefined : '100.00'),
          line('2', '7', missing === 2 ? undefined : '50.00'),
        ],
      },
    }) as unknown as NonNullable<InvoicePart['model']>;
  const a = { ...part({}, 'a.xml'), model: withLines(1) };
  const b = { ...part({}, 'b.xml'), model: withLines(2) };

  it('names the rule results apart from „passt“ that differ, not „passt, 2 nicht prüfbar“ twice', () => {
    const rules = differingResults([a, b]).find((item) => item.label === TEXTS.differingRules);
    expect(rules?.values).toEqual([
      'BR-S-08 (Kategorie S, 19\u00a0%): nicht prüfbar',
      'BR-S-08 (Kategorie S, 7\u00a0%): nicht prüfbar',
    ]);
    // the result shared by both (BR-CO-10) is not repeated
    expect(rules?.values.join(' ')).not.toContain('BR-CO-10');
    expect(verdictOf(analysis({ invoices: [a, b] })).comparison).toEqual({
      same: false,
      differing: [],
    });
  });
});

// Audit R3-U-09 (G-8): the same data in two parts — every place names both, and a technical row in
// which they differ (UBL and CII) is shown for each part
describe('the same data in two parts (audit R3-U-09)', () => {
  const cii = part({}, 'factur-x.xml');
  const ubl = { ...part({}, 'ubl.xml'), syntax: 'ubl-invoice' as const };
  const schema = (name: string, count = 0) => ({
    schema: name,
    checked: true,
    problems: [],
    count,
  });

  it('names both attachments in the source sentence', () => {
    const verdict = verdictOf(analysis({ invoices: [cii, ubl] }));
    expect(verdict.comparison?.same).toBe(true);
    expect(verdict.explanation[0]).toBe(
      'Das PDF enthält Rechnungsdaten als XML (Anhänge „factur-x.xml“ und „ubl.xml“).',
    );
    // one part: as before
    expect(verdictOf(analysis({ invoices: [cii] })).explanation[0]).toBe(
      'Das PDF enthält Rechnungsdaten als XML (Anhang „factur-x.xml“).',
    );
  });

  it('names both in the row „Anhänge“ and shows a differing technical row per part', () => {
    const ciiPart = { ...cii, schema: schema('UN/CEFACT CII D16B') };
    const parts = [ciiPart, { ...ubl, schema: schema('UBL 2.1 (Invoice)') }];
    const verdict = verdictOf(analysis({ invoices: parts }));
    const [first] = verdict.invoices;
    if (!first) throw new Error('no invoice');
    const rows = invoiceDetails(first, true, verdict.invoices);
    expect(rows[0]).toEqual({ label: 'Anhänge', value: 'factur-x.xml und ubl.xml' });
    expect(rows.filter((r) => r.technical).map((r) => `${r.label}: ${r.value}`)).toEqual([
      'Syntax, Anhang „factur-x.xml“: UN/CEFACT CII (Cross Industry Invoice)',
      'Syntax, Anhang „ubl.xml“: UBL 2.1 (Invoice)',
      'Spezifikation: EN 16931 (bei ZUGFeRD/Factur-X: Profil EN 16931, früher COMFORT)',
      'Kennung (BT-24): urn:cen.eu:en16931:2017',
      'Schema (XSD), Anhang „factur-x.xml“: keine Abweichung vom Schema UN/CEFACT CII D16B',
      'Schema (XSD), Anhang „ubl.xml“: keine Abweichung vom Schema UBL 2.1 (Invoice)',
    ]);
    // the same syntax and schema: each row once
    const twice = verdictOf(analysis({ invoices: [ciiPart, { ...ciiPart, origin: 'b.xml' }] }));
    const [one] = twice.invoices;
    if (!one) throw new Error('no invoice');
    expect(invoiceDetails(one, true, twice.invoices).map((r) => r.label)).toEqual([
      'Anhänge',
      'Art der Rechnung (BT-3)',
      'Rechnungsnummer (BT-1)',
      'Rechnungsdatum (BT-2)',
      'Lieferant (BT-27)',
      'Gesamtbetrag mit Umsatzsteuer (BT-112)',
      'Syntax',
      'Spezifikation',
      'Kennung (BT-24)',
      'Schema (XSD)',
    ]);
  });

  it('keeps the schema row of a part with a format error visible (G-2)', () => {
    const failed = { ...ubl, schema: schema('UBL 2.1 (Invoice)', 1) };
    const verdict = verdictOf(
      analysis({ invoices: [{ ...cii, schema: schema('UN/CEFACT CII D16B') }, failed] }),
    );
    const [first] = verdict.invoices;
    if (!first) throw new Error('no invoice');
    const schemaRows = invoiceDetails(first, true, verdict.invoices).filter((r) =>
      r.label.startsWith('Schema (XSD)'),
    );
    expect(schemaRows.map((r) => r.technical)).toEqual([true, false]);
  });
});
