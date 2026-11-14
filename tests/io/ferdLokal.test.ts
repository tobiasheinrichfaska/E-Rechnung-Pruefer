import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeFile } from '../../src/io/analyze';
import type { PdfJsLike } from '../../src/io/pdf';
import { checkPflichtangaben } from '../../src/logic/check';
import { rulesOf, verdictOf } from '../../src/logic/verdict';

// The official FeRD ZUGFeRD 2.5.2 sample invoices may not be redistributed (AWV copyright), so they
// live only in the gitignored tests/fixtures/lokal/ferd/. Where the folder is missing these tests
// are SKIPPED — and a skipped test is not a pass (report it as such).
const ROOT = new URL('../fixtures/lokal/ferd/', import.meta.url);
const root = decodeURIComponent(ROOT.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const present = existsSync(root);

function pdfs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'attachments' ? [] : pdfs(path);
    return name.endsWith('_fx.pdf') ? [path] : [];
  });
}

const load = () => Promise.resolve(pdfjs as unknown as PdfJsLike);
const files = present ? pdfs(root).map((path) => path.slice(root.length)) : [];

describe.skipIf(!present)('FeRD ZUGFeRD 2.5.2 sample invoices (local only)', () => {
  it('finds the samples', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files)('%s', async (file) => {
    const analysis = await analyzeFile(file, new Uint8Array(readFileSync(join(root, file))), load);
    const verdict = verdictOf(analysis);
    expect(analysis.problem).toBeUndefined();
    expect(analysis.invoices).toHaveLength(1);
    // Steps 2a/2b: valid against CII D16B (as KoSIT checks it), EXTENDED against its FeRD schema
    const schema = analysis.invoices[0]?.schema;
    expect(schema?.checked).toBe(true);
    expect({ file, problems: schema?.problems.slice(0, 3) ?? [] }).toEqual({ file, problems: [] });
    if (/^[01]\. /.test(file)) {
      // MINIMUM and BASIC WL: no e-invoice (BMF 15.10.2024 Rn. 25, 30)
      expect(verdict.tone).toBe('bad');
      expect(verdict.headline).toMatch(
        /^PDF mit Rechnungsdaten, Profil (MINIMUM|BASIC WL): keine E-Rechnung/,
      );
    } else {
      // an e-invoice; a hint on the Pflichtangaben may make it yellow (F22, e.g. X16)
      expect(verdict.tone).not.toBe('bad');
      expect(verdict.headline).toMatch(/^E-Rechnung erkannt/);
      const model = analysis.invoices[0]?.model;
      expect(model).toBeDefined();
      if (model) checkPflichtangaben(model);
      // Step 3a: no possible irregularity in the official samples; EXTENDED has its own forms of the
      // rules (BR-FXEXT-…, logistics charges in X11/X19), so only BR-CO-14 is checked there
      const first = verdict.invoices[0];
      if (file.startsWith('4. ') && first) {
        expect(rulesOf(first)?.results.map((r) => r.id)).toEqual(['BR-CO-14']);
      }
      expect({ file, auffaellig: first ? (rulesOf(first)?.auffaellig ?? []) : [] }).toEqual({
        file,
        auffaellig: [],
      });
    }
  });
});
