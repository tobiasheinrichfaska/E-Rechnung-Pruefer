import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyzeFile } from '../../src/io/analyze';
import type { PdfJsLike } from '../../src/io/pdf';
import { TEXTS } from '../../src/logic/texts';
import { verdictOf } from '../../src/logic/verdict';

// The official FeRD ZUGFeRD 1.0 sample invoices (2014) and two of their XML as Mustang keeps them,
// AWV copyright like the 2.5.2 samples: only in the gitignored tests/fixtures/lokal/zugferd-1.0/
// (private repo, origin and checksums in its QUELLEN.tsv). Where the folder is missing these tests
// are SKIPPED — and a skipped test is not a pass (report it as such).
const ROOT = new URL('../fixtures/lokal/zugferd-1.0/', import.meta.url);
const root = decodeURIComponent(ROOT.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const present = existsSync(root);

const load = () => Promise.resolve(pdfjs as unknown as PdfJsLike);
const inFolder = (folder: string, ending: string) =>
  present
    ? readdirSync(join(root, folder))
        .filter((name) => name.endsWith(ending))
        .map((name) => `${folder}/${name}`)
    : [];
const samples = inFolder('ferd-1.0-beispiele', '.pdf');
const PROFILE = /_1p0_(BASIC|COMFORT|EXTENDED)_/;

async function check(file: string) {
  const analysis = await analyzeFile(file, new Uint8Array(readFileSync(join(root, file))), load);
  return { analysis, verdict: verdictOf(analysis) };
}

describe.skipIf(!present)('FeRD ZUGFeRD 1.0 sample invoices (local only)', () => {
  it('finds all twelve samples', () => {
    expect(samples).toHaveLength(12);
  });

  it.each(samples)('%s', async (file) => {
    const { analysis, verdict } = await check(file);
    expect(analysis.problem).toBeUndefined();
    // the attachment name of § 7.2 of the specification, found by content (never by name)
    expect(analysis.invoices.map((part) => [part.origin, part.syntax])).toEqual([
      ['ZUGFeRD-invoice.xml', 'zugferd1'],
    ]);
    // the identifier of § 6.3: urn:ferd:CrossIndustryDocument:invoice:1p0:<profile>
    const profile = PROFILE.exec(file)?.[1]?.toLowerCase();
    expect(verdict.invoices[0]?.profile.id).toBe(
      `urn:ferd:CrossIndustryDocument:invoice:1p0:${profile}`,
    );
    expect(verdict.tone).toBe('bad');
    expect(verdict.headline).toBe(TEXTS.zugferd1Pdf);
    // no schema check for ZUGFeRD 1.0 (Known Limitations)
    expect(analysis.invoices[0]?.schema).toBeUndefined();
  });

  it('recognises a ZUGFeRD 1.0 PDF of another producer (PDFlib, kept by Mustang)', async () => {
    const { analysis, verdict } = await check('mustang/zugferd_invoice.pdf');
    expect(analysis.invoices.map((part) => [part.origin, part.syntax])).toEqual([
      ['ZUGFeRD-invoice.xml', 'zugferd1'],
    ]);
    expect(verdict.invoices[0]?.profile.id).toBe(
      'urn:ferd:CrossIndustryDocument:invoice:1p0:basic',
    );
    expect(verdict.headline).toBe(TEXTS.zugferd1Pdf);
  });

  it.each(inFolder('mustang', '.xml'))('%s as a plain XML file', async (file) => {
    const { analysis, verdict } = await check(file);
    expect(analysis.invoices[0]?.syntax).toBe('zugferd1');
    expect(verdict.headline).toBe(TEXTS.zugferd1Xml);
  });
});
