import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeFile } from '../../src/io/analyze';
import type { PdfJsLike } from '../../src/io/pdf';
import { checkPflichtangaben } from '../../src/logic/check';
import { verdictOf } from '../../src/logic/verdict';

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
    if (/^[01]\. /.test(file)) {
      // MINIMUM and BASIC WL: no e-invoice (BMF 15.10.2024 Rn. 25, 30)
      expect(verdict.tone).toBe('bad');
      expect(verdict.headline).toMatch(
        /^PDF mit Rechnungsdaten, Profil (MINIMUM|BASIC WL): keine E-Rechnung/,
      );
    } else {
      expect(verdict.tone).toBe('ok');
      expect(verdict.headline).toMatch(/^E-Rechnung erkannt/);
      const model = analysis.invoices[0]?.model;
      expect(model).toBeDefined();
      if (model) checkPflichtangaben(model);
    }
  });
});
