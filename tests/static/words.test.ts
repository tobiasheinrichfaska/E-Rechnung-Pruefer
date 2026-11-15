import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeFile } from '../../src/io/analyze';
import type { PdfJsLike } from '../../src/io/pdf';
import { miniPdf } from '../../src/build/minipdf';
import { allDefinitions } from '../../src/logic/binding';
import { invoiceDetails } from '../../src/logic/details';
import { PFLICHTANGABEN, MODES } from '../../src/logic/pflichtangaben';
import { PROFILES } from '../../src/logic/profiles';
import { RULE_LABELS } from '../../src/logic/rules';
import { CATEGORY_LABELS, TEXTS, TYPE_CODES, UNIT_LABELS } from '../../src/logic/texts';
import { verdictOf } from '../../src/logic/verdict';
import { official } from '../support/fixtures';

// Results are hints, never an approval: no text the tool shows may say "ordnungsgemäß" or
// "gültig" — not only TEXTS, but every table with German text and the sentences written in the UI
// components (audit 2026-11-14, L-10/T-07), the detail rows under a result and the labels of the
// binding, which the Pflichtangaben and the rules show (audit 2026-11-15, QT-08).
const APPROVAL = /ordnungsgem|gültig/i;

const load = () => Promise.resolve(pdfjs as unknown as PdfJsLike);

describe('texts shown to clients', () => {
  it('never sound like an approval', () => {
    const tables = JSON.stringify({
      TEXTS,
      PFLICHTANGABEN,
      MODES,
      PROFILES,
      TYPE_CODES,
      CATEGORY_LABELS,
      UNIT_LABELS,
      RULE_LABELS,
    });
    expect(tables).not.toMatch(APPROVAL);

    const { groups, terms } = allDefinitions();
    const labels = [...groups, ...terms].map((definition) => definition.label);
    expect(labels.length).toBeGreaterThan(100);
    expect(labels.filter((label) => APPROVAL.test(label))).toEqual([]);

    const ui = new URL('../../src/ui/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const shown = readdirSync(ui)
      .filter((name) => name.endsWith('.tsx'))
      .map((name) =>
        readFileSync(join(ui, name), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, ''),
      );
    expect(shown.length).toBeGreaterThan(3);
    expect(shown.filter((text) => APPROVAL.test(text))).toEqual([]);
  });

  it('never sound like an approval in the detail rows of an official invoice', async () => {
    const bytes = official('kosit/01.01a-INVOICE_ubl.xml');
    const pdf = miniPdf({
      attachments: [{ name: 'x.xml', bytes, mime: 'text/xml', relationship: 'Alternative' }],
    });
    const rows = [];
    for (const [name, file, inPdf] of [
      ['r.xml', bytes, false],
      ['r.pdf', pdf, true],
    ] as const) {
      for (const invoice of verdictOf(await analyzeFile(name, file, load)).invoices) {
        rows.push(...invoiceDetails(invoice, inPdf));
      }
    }
    expect(rows.length).toBeGreaterThan(15);
    expect(rows.filter((row) => APPROVAL.test(`${row.label} ${row.value}`))).toEqual([]);
  });
});
