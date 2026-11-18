import { readFileSync, readdirSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeFile } from '../../src/io/analyze';
import type { PdfJsLike } from '../../src/io/pdf';
import { checkPflichtangaben } from '../../src/logic/check';
import { checkRules } from '../../src/logic/rules';
import { TEXTS, fill } from '../../src/logic/texts';
import { rulesOf, verdictOf } from '../../src/logic/verdict';
import { encode, official, officialText, withSpecId } from '../support/fixtures';

// Step 3a against real files: every official example is valid under the EN 16931 rules (CEN, KoSIT
// check them), so the tool must not report a single possible irregularity on any of them.
const load = () => Promise.resolve(pdfjs as unknown as PdfJsLike);
const FILES = ['cen', 'kosit', 'kosit/paare'].flatMap((dir) =>
  readdirSync(new URL(`../fixtures/offiziell/${dir}/`, import.meta.url))
    .filter((name) => name.endsWith('.xml'))
    .map((name) => `${dir}/${name}`),
);

describe('calculation rules on the official files', () => {
  it('reports no possible irregularity on any official invoice', async () => {
    const found: string[] = [];
    let checked = 0;
    for (const path of FILES) {
      const analysis = await analyzeFile(path, official(path), load);
      for (const part of analysis.invoices) {
        if (!part.model) continue;
        // each syntax in the forms of its own CEN Schematron (audit QL-03)
        // XRechnung UBL with Extension: BR-DEX-09 in place of BR-CO-16 (audit R5-L-01)
        const rules = checkRules(part.model, {
          syntax: part.syntax,
          thirdPartyPayments: part.thirdPartyPayments,
        });
        checked += rules.results.filter((r) => r.status === 'passt').length;
        for (const r of rules.results.filter((x) => x.status === 'auffaellig')) {
          found.push(
            `${path} ${r.id} ${r.occurrence ?? ''} ${r.values.map((v) => `${v.label}=${v.value}`).join(' ')}`,
          );
        }
      }
    }
    expect(found).toEqual([]);
    expect(checked).toBeGreaterThan(500);
  });

  it('names a wrong total with the rule and the values that show it', async () => {
    const text = officialText('kosit/paare/01.01a-INVOICE_ubl.xml').replace(
      '<cbc:TaxInclusiveAmount currencyID="EUR">336.9</cbc:TaxInclusiveAmount>',
      '<cbc:TaxInclusiveAmount currencyID="EUR">346.9</cbc:TaxInclusiveAmount>',
    );
    const analysis = await analyzeFile('r.xml', encode(text), load);
    const model = analysis.invoices[0]?.model;
    if (!model) throw new Error('no model');
    const rules = checkRules(model);
    expect(rules.auffaellig).toEqual(['BR-CO-15', 'BR-CO-16']);
    expect(rules.summary).toBe('Mögliche Auffälligkeit: BR-CO-15, BR-CO-16.');
    // F23: only the gross and due amount — ask before paying, nothing on the input VAT
    expect(rules.advice).toEqual([
      'Sie könnten vor der Zahlung mit dem Lieferanten klären, welcher Betrag richtig ist.',
    ]);
    const co15 = rules.results.find((r) => r.id === 'BR-CO-15');
    // names first, and what the rule expects (audit Bedienung, V-04)
    expect(co15?.values).toEqual([
      { label: 'Gesamtbetrag ohne Umsatzsteuer (BT-109)', value: '314,86 EUR' },
      { label: 'Summe der Umsatzsteuer (BT-110)', value: '22,04 EUR' },
      { label: 'Gesamtbetrag mit Umsatzsteuer (BT-112)', value: '346,90 EUR' },
      { label: 'Nach der Regel erwartet', value: '336,90 EUR' },
    ]);
    expect(rules.results.find((r) => r.id === 'BR-CO-16')?.values.at(-1)).toEqual({
      label: 'Nach der Regel erwartet',
      value: '346,90 EUR',
    });
    const verdict = verdictOf(analysis);
    expect(verdict.tone).toBe('warn');
    expect(verdict.headline).toBe('E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen');
    expect(verdict.explanation.join(' ')).toContain('BR-CO-15, BR-CO-16');
  });
});

// Audit R2-T-01: the result of the app takes the forms of the part's own syntax (QL-03) only
// through rulesOf — tested there, not only on checkRules
describe('the forms of the syntax in the result (audit R2-T-01)', () => {
  // KoSIT 01.01a in CII with the VAT amount 1.00 above round(314.86 × 7 %) = 22.04, the totals
  // after it: BR-CO-17 passes in the CII form (≤ 1), not in the UBL form (< 1)
  const raised = officialText('kosit/01.01a-INVOICE_uncefact.xml')
    .replace('<ram:CalculatedAmount>22.04<', '<ram:CalculatedAmount>23.04<')
    .replace(
      '<ram:TaxTotalAmount currencyID="EUR">22.04<',
      '<ram:TaxTotalAmount currencyID="EUR">23.04<',
    )
    .replace('<ram:GrandTotalAmount>336.9<', '<ram:GrandTotalAmount>337.9<')
    .replace('<ram:DuePayableAmount>336.9<', '<ram:DuePayableAmount>337.9<');

  it('judges a CII file in the CII forms', async () => {
    for (const changed of ['>23.04<', '>337.9<']) {
      expect(raised.split(changed).length - 1).toBe(2);
    }
    const analysis = await analyzeFile('r.xml', encode(raised), load);
    const verdict = verdictOf(analysis);
    const [invoice] = verdict.invoices;
    if (!invoice) throw new Error('no invoice');
    expect(invoice.part.syntax).toBe('cii');
    expect(invoice.part.schema?.count).toBe(0);
    expect(rulesOf(invoice)?.auffaellig).toEqual([]);
    expect(verdict.explanation.join(' ')).not.toContain('BR-CO-17');
    // the same model in the UBL form would name BR-CO-17
    const model = invoice.part.model;
    if (!model) throw new Error('no model');
    expect(checkRules(model, { syntax: 'ubl-invoice' }).auffaellig).toEqual(['BR-CO-17']);
  });
});

// Audit R3-L-01: without the invoice currency (BT-5, optional in UBL 2.1 and CII D16B) the CEN
// Schematrons report BR-05 and never BR-CO-15; on these files, whose sums fit, also no BR-CO-14
// (UBL computes it without BT-5 too, R4-L-01) — the tool checks neither BR-CO-14 nor BR-CO-15
// there and names the missing currency as the reason. The Pflichtangabe „Steuerbetrag“ stays
// „fehlt“ (F33 open), but names the currency as the gap, not the amount that is in the XML
// (audit R4-L-01); a change of that answer shows here as a deliberate change of the test.
describe('an invoice without the invoice currency (audit R3-L-01)', () => {
  const STEUERBETRAG = 'Auf das Entgelt entfallender Steuerbetrag';
  const cases = [
    ['kosit/01.01a-INVOICE_ubl.xml', '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>'],
    ['kosit/01.01a-INVOICE_uncefact.xml', '<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>'],
  ] as const;

  it.each(cases)(
    '%s: no possible irregularity in the amounts, BR-CO-14/-15 not checked',
    async (path, currency) => {
      const text = officialText(path);
      expect(text.split(currency).length - 1).toBe(1);
      const analysis = await analyzeFile('r.xml', encode(text.replace(currency, '')), load);
      const verdict = verdictOf(analysis);
      const [invoice] = verdict.invoices;
      if (!invoice) throw new Error('no invoice');
      expect(invoice.part.schema?.count).toBe(0);
      const rules = rulesOf(invoice);
      expect(rules?.auffaellig).toEqual([]);
      for (const id of ['BR-CO-14', 'BR-CO-15']) {
        const rule = rules?.results.find((r) => r.id === id);
        expect(rule?.status, id).toBe('nichtPruefbar');
        expect(rule?.values.at(-1), id).toEqual({
          label: 'Rechnungswährung (BT-5)',
          value: '– nicht angegeben',
        });
        expect(rule?.values.map((v) => v.label).join(' '), id).not.toContain('erwartet');
      }
      expect(verdict.explanation.join(' ')).not.toContain('BR-CO-15');

      // the Pflichtangaben: „fehlt“ and the regular list as before (F33), the gap named as it is
      const model = invoice.part.model;
      if (!model) throw new Error('no model');
      const result = checkPflichtangaben(model);
      expect(result.mode).toBe('regel');
      expect(result.missingLabels).toEqual([STEUERBETRAG]);
      const row = result.rows.find((r) => r.row.id === 'steuerbetrag');
      expect(row?.status).toBe('fehlt');
      expect(row?.missing).toEqual([TEXTS.taxTotalNoCurrency]);
      // the box: yellow with the same gap and the sentence on the input VAT, as before
      expect(verdict.tone).toBe('warn');
      expect(verdict.explanation).toContain(
        fill(TEXTS.pflichtMissingLine, {
          list: `${STEUERBETRAG} (${TEXTS.missingPart} ${TEXTS.taxTotalNoCurrency})`,
        }),
      );
      expect(verdict.explanation).toContain(TEXTS.supplierComplete);
      expect(verdict.explanation.join(' ')).not.toContain('fehlt: Summe der Umsatzsteuer)');
    },
  );

  // F33 open: a CII amount without `currencyID` is read as BT-110 where none carries the invoice
  // currency (R3-L-02), so there the same invoice without BT-5 reads as with it, no gap in the
  // box — today's state, kept until Tobias decides
  it('a CII VAT total without currencyID: the Pflichtangabe present, the box as with BT-5 (F33 open)', async () => {
    const currency = '<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>';
    const total = '<ram:TaxTotalAmount currencyID="EUR">22.04</ram:TaxTotalAmount>';
    const text = officialText('kosit/01.01a-INVOICE_uncefact.xml');
    expect(text.split(total).length - 1).toBe(1);
    const changed = text
      .replace(currency, '')
      .replace(total, '<ram:TaxTotalAmount>22.04</ram:TaxTotalAmount>');
    const verdict = verdictOf(await analyzeFile('r.xml', encode(changed), load));
    const [invoice] = verdict.invoices;
    if (!invoice?.part.model) throw new Error('no invoice');
    expect(invoice.part.schema?.count).toBe(0);
    const row = checkPflichtangaben(invoice.part.model).rows.find(
      (r) => r.row.id === 'steuerbetrag',
    );
    expect(row?.status).toBe('vorhanden');
    const before = verdictOf(await analyzeFile('r.xml', encode(text), load));
    expect([verdict.tone, verdict.explanation]).toEqual([before.tone, before.explanation]);
  });
});

// Audit R4-U-01: sample 29 has the due amount with a comma, a frequent real format error. The rule
// showed „Fälliger Betrag (BT-115): – keine Zahl“ under „Nach der Regel erwartet: 336,90 EUR“;
// now the value as written, as the comparison of two XML shows it
it('shows the due amount of sample 29 as written, marked as no number', async () => {
  const bytes = readFileSync(
    new URL('../../beispiele/29_XRechnung_mit_Formatfehler.xml', import.meta.url),
  );
  const [invoice] = verdictOf(await analyzeFile('29.xml', new Uint8Array(bytes), load)).invoices;
  if (!invoice) throw new Error('no invoice');
  const rule = rulesOf(invoice)?.results.find((r) => r.id === 'BR-CO-16');
  expect(rule?.status).toBe('nichtPruefbar');
  expect(rule?.values).toContainEqual({
    label: 'Fälliger Betrag (BT-115)',
    value: `336,90 ${TEXTS.ruleNoNumber}`,
  });
});

// Audit R3-L-02: CII D16B allows `ram:TaxTotalAmount` without `currencyID`. Such an amount counts
// as BT-110 only where none carries the invoice currency (CEN counts only those that carry it)
describe('a CII VAT total without currencyID (audit R3-L-02)', () => {
  const PATH = 'kosit/01.01a-INVOICE_uncefact.xml';
  const WITH = '<ram:TaxTotalAmount currencyID="EUR">22.04</ram:TaxTotalAmount>';
  const WITHOUT = '<ram:TaxTotalAmount>22.04</ram:TaxTotalAmount>';
  const read = async (replacement: string) => {
    const text = officialText(PATH);
    expect(text.split(WITH).length - 1).toBe(1);
    const analysis = await analyzeFile('r.xml', encode(text.replace(WITH, replacement)), load);
    const [invoice] = verdictOf(analysis).invoices;
    if (!invoice) throw new Error('no invoice');
    expect(invoice.part.schema?.count).toBe(0);
    return invoice;
  };
  const co15 = (invoice: Awaited<ReturnType<typeof read>>) =>
    rulesOf(invoice)?.results.find((r) => r.id === 'BR-CO-15');

  it('is left out beside an amount in the invoice currency (b)', async () => {
    const invoice = await read(`${WITH}${WITHOUT}`);
    expect(invoice.part.model?.groups['BG-22']?.[0]?.terms['BT-110']).toHaveLength(1);
    expect(co15(invoice)?.status).toBe('passt');
    expect(rulesOf(invoice)?.auffaellig).toEqual([]);
  });

  it('counts where it is the only one, as documented (a)', async () => {
    const invoice = await read(WITHOUT);
    expect(invoice.part.model?.groups['BG-22']?.[0]?.terms['BT-110']).toHaveLength(1);
    expect(co15(invoice)?.status).toBe('passt');
    // two without the attribute are two VAT totals
    expect(co15(await read(`${WITHOUT}${WITHOUT}`))?.status).toBe('auffaellig');
  });
});

// Audit R5-L-01: XRechnung 3.0 with Extension (UBL Invoice) adds the payments of third parties
// (BG-DEX-09) to the amount due. KoSIT lowers BR-CO-16 to „information“ there and checks BR-DEX-09
// (XRechnung-UBL-validation.xsl 3.0.2); its positive instance 05.01a has two such payments.
describe('payments of third parties in XRechnung with Extension (audit R5-L-01)', () => {
  const EXT_0501 = 'kosit/05.01a-INVOICE_ubl.xml';
  const EXTENSION =
    'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0#conformant#urn:xeinkauf.de:kosit:extension:xrechnung_3.0';
  const rulesFor = async (text: string) => {
    const verdict = verdictOf(await analyzeFile('r.xml', encode(text), load));
    const [invoice] = verdict.invoices;
    if (!invoice) throw new Error('no invoice');
    return { verdict, invoice, rules: rulesOf(invoice) };
  };
  const ids = (rules: ReturnType<typeof rulesOf>) => rules?.results.map((r) => r.id) ?? [];

  it('05.01a: BR-DEX-09 passes with both payments, no BR-CO-16', async () => {
    const { invoice, rules } = await rulesFor(officialText(EXT_0501));
    expect(invoice.part.thirdPartyPayments).toEqual(['19.96', '10.00']);
    expect(invoice.part.schema?.count).toBe(0);
    expect(rules?.auffaellig).toEqual([]);
    expect(ids(rules)).not.toContain('BR-CO-16');
    // the rule of XRechnung in place of one of EN 16931 is said in a note (audit R6-U-01)
    expect(rules?.note).toBe(TEXTS.rulesThirdParty);
    const dex = rules?.results.find((r) => r.id === 'BR-DEX-09');
    expect(dex?.status).toBe('passt');
    expect(dex?.values).toEqual([
      { label: 'Gesamtbetrag mit Umsatzsteuer (BT-112)', value: '336,90 EUR' },
      { label: 'Vorausgezahlter Betrag (BT-113)', value: '– nicht angegeben' },
      { label: TEXTS.ruleThirdParty, value: '29,96 EUR' },
      { label: 'Rundungsbetrag (BT-114)', value: '– nicht angegeben' },
      { label: 'Fälliger Betrag (BT-115)', value: '366,86 EUR' },
      { label: 'Nach der Regel erwartet', value: '366,86 EUR' },
    ]);
  });

  it('04.01a: without payments BR-DEX-09 is BR-CO-16, every other rule unchanged', async () => {
    const { invoice, rules } = await rulesFor(officialText('kosit/04.01a-INVOICE_ubl.xml'));
    expect(invoice.part.thirdPartyPayments).toEqual([]);
    expect(rules?.auffaellig).toEqual([]);
    const model = invoice.part.model;
    if (!model) throw new Error('no model');
    const plain = checkRules(model, { syntax: 'ubl-invoice' });
    expect(ids(rules)).toEqual(ids(plain).map((id) => (id === 'BR-CO-16' ? 'BR-DEX-09' : id)));
    expect(rules?.results.map((r) => r.status)).toEqual(plain.results.map((r) => r.status));
  });

  it('a wrong sum of the payments is a possible irregularity before payment', async () => {
    const text = officialText(EXT_0501);
    const paid = '<cbc:PaidAmount currencyID="EUR">10.00</cbc:PaidAmount>';
    expect(text.split(paid).length - 1).toBe(1);
    const { verdict, rules } = await rulesFor(
      text.replace(paid, '<cbc:PaidAmount currencyID="EUR">11.00</cbc:PaidAmount>'),
    );
    expect(rules?.auffaellig).toEqual(['BR-DEX-09']);
    expect(rules?.results.find((r) => r.id === 'BR-DEX-09')?.values.at(-1)).toEqual({
      label: 'Nach der Regel erwartet',
      value: '367,86 EUR',
    });
    expect(rules?.advice).toEqual([TEXTS.adviceAmountBeforePayment]);
    expect(verdict.tone).toBe('warn');
    expect(verdict.explanation.join(' ')).toContain('BR-DEX-09');
  });

  it('CII and other profiles keep BR-CO-16', async () => {
    // the KoSIT CII scenario keeps BR-CO-16 and knows no BR-DEX-09
    const cii = await rulesFor(
      withSpecId(officialText('kosit/01.01a-INVOICE_uncefact.xml'), EXTENSION),
    );
    expect(cii.invoice.profile.entry?.label).toBe('XRechnung 3.0 mit Extension');
    expect(cii.invoice.part.thirdPartyPayments).toBeUndefined();
    expect(ids(cii.rules)).toContain('BR-CO-16');
    expect(ids(cii.rules)).not.toContain('BR-DEX-09');
    expect(cii.rules?.note).toBeUndefined();
    // a UBL credit note has no Extension scenario at KoSIT: its prepaid payment is not added, even
    // where it carries the Extension identifier (audit R6-T-02)
    const taxTotal = '\t<cac:TaxTotal>';
    const creditNote = officialText('cen/UBL_ubl-tc434-creditnote1.xml');
    expect(creditNote.split(taxTotal)).toHaveLength(2);
    const credit = await rulesFor(
      withSpecId(creditNote, EXTENSION).replace(
        taxTotal,
        '\t<cac:PrepaidPayment><cbc:PaidAmount currencyID="EUR">10.00</cbc:PaidAmount></cac:PrepaidPayment>\n' +
          taxTotal,
      ),
    );
    expect(credit.invoice.part.syntax).toBe('ubl-creditnote');
    expect(credit.invoice.profile.entry?.label).toBe('XRechnung 3.0 mit Extension');
    expect(credit.invoice.part.thirdPartyPayments).toBeUndefined();
    expect(ids(credit.rules)).toContain('BR-CO-16');
    expect(ids(credit.rules)).not.toContain('BR-DEX-09');
    expect(credit.rules?.auffaellig).toEqual([]);
    // 05.01a as plain XRechnung: its payments are not added, BR-CO-16 reports them
    const plain = await rulesFor(
      withSpecId(
        officialText(EXT_0501),
        'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
      ),
    );
    expect(plain.invoice.part.thirdPartyPayments).toBeUndefined();
    expect(plain.rules?.auffaellig).toEqual(['BR-CO-16']);
  });
});
