import { readdirSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeFile } from '../../src/io/analyze';
import type { PdfJsLike } from '../../src/io/pdf';
import { checkRules } from '../../src/logic/rules';
import { rulesOf, verdictOf } from '../../src/logic/verdict';
import { encode, official, officialText } from '../support/fixtures';

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
        const rules = checkRules(part.model, { syntax: part.syntax });
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
// Schematrons report only BR-05, never BR-CO-15 — the tool checks neither BR-CO-14 nor BR-CO-15
// there and names the missing currency as the reason
describe('an invoice without the invoice currency (audit R3-L-01)', () => {
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
    },
  );
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
