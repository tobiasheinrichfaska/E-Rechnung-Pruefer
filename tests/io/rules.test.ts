import { readdirSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeFile } from '../../src/io/analyze';
import type { PdfJsLike } from '../../src/io/pdf';
import { checkRules } from '../../src/logic/rules';
import { verdictOf } from '../../src/logic/verdict';
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
        const rules = checkRules(part.model);
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
    expect(rules.summary).toBe(
      'Mögliche Auffälligkeit: BR-CO-15, BR-CO-16. Bitte prüfen Sie die Beträge.',
    );
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
    expect(verdict.headline).toBe('E-Rechnung erkannt (XRechnung 3.0)');
    expect(verdict.explanation.join(' ')).toContain('BR-CO-15, BR-CO-16');
  });
});
