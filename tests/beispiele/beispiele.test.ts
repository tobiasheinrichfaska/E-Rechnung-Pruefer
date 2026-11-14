import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { BEISPIELE, NICHT_ALS_BEISPIEL, buildFolder } from '../../src/build/beispiele';
import type { BuiltFile } from '../../src/build/beispiele';
import { analyzeFile } from '../../src/io/analyze';
import { readPdfAttachments } from '../../src/io/pdf';
import type { PdfJsLike } from '../../src/io/pdf';
import { SCHEMA_ENTRIES, SCHEMA_FILES } from '../../src/io/schemas';
import { readXml, rootOf, schemaProblems, xsdValidator } from '../../src/io/xml';
import { checkPflichtangaben } from '../../src/logic/check';
import type { PflichtResult } from '../../src/logic/check';
import { MODES, PFLICHTANGABEN } from '../../src/logic/pflichtangaben';
import { TEXTS } from '../../src/logic/texts';
import { pflichtModel, verdictOf } from '../../src/logic/verdict';
import type { Verdict } from '../../src/logic/verdict';

// The samples for testers in beispiele/ are generated (npm run beispiele = this test in mode
// "schreiben"); normally the test only compares the folder with a fresh build.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FOLDER = join(ROOT, 'beispiele');
const KOSIT = join(ROOT, 'tests', 'fixtures', 'offiziell', 'kosit');
const WRITE = import.meta.env.MODE === 'schreiben';

const read = (path: string) => readFileSync(join(KOSIT, path), 'utf8');
const load = () => Promise.resolve(pdfjs as unknown as PdfJsLike);

interface Checked {
  datei: string;
  verdict: Verdict;
  pflicht?: PflichtResult;
}

let built: BuiltFile[] = [];
let checked: Checked[] = [];

beforeAll(async () => {
  built = await buildFolder(read, read('LICENSE-Apache-2.0.txt'));
  checked = await Promise.all(
    BEISPIELE.map(async (b) => {
      const file = built.find((f) => f.name === b.datei);
      if (!file) throw new Error(`not built: ${b.datei}`);
      const analysis = await analyzeFile(b.datei, file.bytes, load);
      const verdict = verdictOf(analysis);
      // as the page shows it: no Pflichtangaben for "keine E-Rechnung" (F19)
      const first = verdict.invoices[0];
      const model = first ? pflichtModel(first) : undefined;
      return {
        datei: b.datei,
        verdict,
        ...(model ? { pflicht: checkPflichtangaben(model) } : {}),
      };
    }),
  );
}, 60_000);

describe('beispiele/', () => {
  it('holds exactly the built files (regenerate with npm run beispiele)', () => {
    if (WRITE) {
      mkdirSync(FOLDER, { recursive: true });
      for (const name of readdirSync(FOLDER)) {
        if (!built.some((f) => f.name === name)) rmSync(join(FOLDER, name));
      }
      for (const file of built) writeFileSync(join(FOLDER, file.name), file.bytes);
    }
    expect(existsSync(FOLDER)).toBe(true);
    expect(readdirSync(FOLDER).sort()).toEqual(built.map((f) => f.name).sort());
    const stale = built.filter(
      (file) => !Buffer.from(readFileSync(join(FOLDER, file.name))).equals(Buffer.from(file.bytes)),
    );
    expect(stale.map((f) => f.name)).toEqual([]);
  });

  it('builds the same bytes twice (no dates, no random parts)', async () => {
    const again = await buildFolder(read, read('LICENSE-Apache-2.0.txt'));
    expect(again.map((f) => Buffer.from(f.bytes).toString('base64'))).toEqual(
      built.map((f) => Buffer.from(f.bytes).toString('base64')),
    );
  });

  it.each(BEISPIELE.map((b) => [b.datei, b] as const))('%s shows its result', (datei, b) => {
    const result = checked.find((c) => c.datei === datei);
    expect(result?.verdict.tone).toBe(b.erwartet.ton);
    expect(result?.verdict.headline).toBe(b.erwartet.ueberschrift);
    expect(result?.pflicht?.summary).toBe(b.erwartet.pflicht);
  });

  it('keeps every sample XML meant as invoice valid against the official schema', async () => {
    // KoSIT-based XML: the XML files themselves and the ones embedded in the sample PDFs (T-09)
    const toCheck: { name: string; bytes: Uint8Array }[] = [];
    for (const file of built) {
      const b = BEISPIELE.find((x) => x.datei === file.name);
      if (b?.quelle.art === 'kosit' && !b.quelle.xml.schemafehler) toCheck.push(file);
      if (b?.quelle.art !== 'pdf') continue;
      const meant = new Set(
        b.quelle.xml.filter((part) => typeof part.xml !== 'string').map((part) => part.name),
      );
      // the password sample cannot be opened (that is what it shows)
      if (meant.size === 0 || b.quelle.kennwort) continue;
      const read = await readPdfAttachments(await load(), file.bytes);
      if (!read.ok) throw new Error(`${file.name}: ${read.issue}`);
      for (const a of read.attachments.filter((x) => meant.has(x.name))) {
        toCheck.push({ name: `${file.name}/${a.name}`, bytes: a.bytes });
      }
    }
    expect(toCheck.filter((f) => f.name.includes('.pdf/')).length).toBeGreaterThanOrEqual(8);
    const invalid: string[] = [];
    for (const file of toCheck) {
      const result = readXml(file.bytes);
      if (!result.ok) {
        invalid.push(`${file.name}: not readable`);
        continue;
      }
      const root = rootOf(result.doc);
      const entry =
        root.name === 'CrossIndustryInvoice'
          ? SCHEMA_ENTRIES.ciiD16B
          : root.name === 'CreditNote'
            ? SCHEMA_ENTRIES.ublCreditNote
            : SCHEMA_ENTRIES.ublInvoice;
      const problems = schemaProblems(result.doc, xsdValidator(entry, SCHEMA_FILES));
      result.doc.dispose();
      if (problems.length > 0) invalid.push(`${file.name}: ${problems[0]?.message ?? ''}`);
    }
    expect(invalid).toEqual([]);
  });
});

describe('coverage: every text of the tool appears in a sample', () => {
  const pattern = (template: string) =>
    new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+')}$`);
  const HEADLINES = [
    TEXTS.eRechnung,
    TEXTS.keineERechnungPdf,
    TEXTS.keineERechnungXml,
    TEXTS.nichtBeurteilt,
    TEXTS.contradicting,
    TEXTS.otherXml,
    TEXTS.plainPdf,
    TEXTS.pdfWithoutInvoiceData,
    TEXTS.pdfBrokenXml,
    TEXTS.pdfNotChecked,
    TEXTS.schemaErrorHeadline,
    ...Object.values(TEXTS.fileProblems).map((p) => p.headline),
  ];

  it('every result headline (except the listed ones)', () => {
    const seen = checked.map((c) => c.verdict.headline);
    const missing = HEADLINES.filter((h) => !(h in NICHT_ALS_BEISPIEL)).filter(
      (h) => !seen.some((s) => pattern(h).test(s)),
    );
    expect(missing).toEqual([]);
    expect(Object.keys(NICHT_ALS_BEISPIEL).filter((h) => !HEADLINES.includes(h))).toEqual([]);
  });

  it('every case text (Kleinbetrag, Kleinunternehmer)', () => {
    const seen = new Set(checked.map((c) => c.pflicht?.modeText));
    expect(MODES.map((m) => m.text).filter((t) => !seen.has(t))).toEqual([]);
  });

  it('every hint of the Pflichtangaben', () => {
    const seen = new Set(checked.flatMap((c) => c.pflicht?.rows.flatMap((r) => r.hints) ?? []));
    const all = new Set(PFLICHTANGABEN.flatMap((p) => (p.hints ?? []).map((h) => h.text)));
    expect([...all].filter((t) => !seen.has(t))).toEqual([]);
  });
});
