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
    expect(rows['Gesamtbetrag mit Umsatzsteuer (BT-112)']).toBe('1.000,00');
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
    expect(line).toBe(
      'Unterschiedlich: Steuernummer oder USt-IdNr. des leistenden Unternehmers ' +
        '(vorhanden: DE123456789 / fehlt); USt-IdNr. des leistenden Unternehmers und des ' +
        'Leistungsempfängers (nur im Einzelfall nötig: DE123456789 / nur im Einzelfall nötig).',
    );
    const rows = comparisonRows([a, b]).filter((row) => row.differs);
    expect(rows[0]).toEqual({
      label: 'Steuernummer oder USt-IdNr. des leistenden Unternehmers',
      values: ['vorhanden: DE123456789', 'fehlt'],
      differs: true,
    });
    expect(rows).toHaveLength(2);
    // with a differing header value only that is named, as before (E-04)
    expect(comparisonRows([a, { ...b, header: { ...b.header, 'BT-1': ['R-2'] } }])).toHaveLength(7);
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
      'BR-S-08 (Kategorie S, 19 %): nicht prüfbar',
      'BR-S-08 (Kategorie S, 7 %): nicht prüfbar',
    ]);
    // the result shared by both (BR-CO-10) is not repeated
    expect(rules?.values.join(' ')).not.toContain('BR-CO-10');
    expect(verdictOf(analysis({ invoices: [a, b] })).comparison).toEqual({
      same: false,
      differing: [],
    });
  });
});
