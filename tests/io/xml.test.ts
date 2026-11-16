import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { XmlLibError } from 'libxml2-wasm';
import type { XmlDocument, XsdValidator } from 'libxml2-wasm';
import {
  ENGINE_VERSION,
  readXml,
  rootOf,
  schemaProblems,
  valuesAt,
  xsdValidator,
} from '../../src/io/xml';
import type { XmlProblem } from '../../src/io/xml';
import { SCHEMA_ENTRIES, SCHEMA_FILES } from '../../src/io/schemas';

const CEN = new URL('../fixtures/offiziell/cen/', import.meta.url);
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(name, CEN)));
const encode = (text: string) => new TextEncoder().encode(text);

const CII_NS = {
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
};
const UBL_NS = {
  inv: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
};

function read(bytes: Uint8Array) {
  const result = readXml(bytes);
  if (!result.ok) throw new Error(`not read: ${result.issue}`);
  return result.doc;
}

describe('readXml', () => {
  it('reads an official CII example and evaluates XPath with namespaces', () => {
    const doc = read(fixture('CII_example1.xml'));
    expect(rootOf(doc)).toEqual({ name: 'CrossIndustryInvoice', namespace: CII_NS.rsm });
    expect(
      valuesAt(doc, '/rsm:CrossIndustryInvoice/rsm:ExchangedDocument/ram:ID', CII_NS),
    ).toHaveLength(1);
    expect(valuesAt(doc, 'count(//ram:IncludedSupplyChainTradeLineItem)', CII_NS)[0]).not.toBe('0');
    doc.dispose();
  });

  it('reads an official UBL example', () => {
    const doc = read(fixture('UBL_ubl-tc434-example1.xml'));
    expect(rootOf(doc)).toEqual({ name: 'Invoice', namespace: UBL_NS.inv });
    expect(valuesAt(doc, '/inv:Invoice/cbc:ID', UBL_NS)).toEqual(['12115118']);
    doc.dispose();
  });

  it('refuses a document type declaration before the engine sees it', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "xxxxxxxxxx">]><a>&x;</a>';
    expect(readXml(encode(bomb))).toMatchObject({ ok: false, issue: 'doctype' });
    const external = '<!DOCTYPE a SYSTEM "file:///etc/passwd"><a/>';
    expect(readXml(encode(external))).toMatchObject({ ok: false, issue: 'doctype' });
  });

  it('refuses a DOCTYPE that hides from the prolog scan behind another encoding (S-03)', () => {
    // ISO-2022-JP switches with ESC sequences; read as UTF-8 the scan sees no DOCTYPE
    const esc = String.fromCharCode(27);
    const text =
      `<?xml version="1.0" encoding="ISO-2022-JP"?><?pi ${esc}$B?><a${esc}(B ?>\n` +
      '<!DOCTYPE a [<!ENTITY nr "AUS-ENTITY">]><a>&nr;</a>';
    expect(readXml(encode(text))).toMatchObject({ ok: false, issue: 'doctype' });
  });

  it('reads a text node over 10 MB, e.g. an embedded attachment (S-02)', () => {
    const doc = read(encode(`<?xml version="1.0"?><a>${'QUJD'.repeat(2_700_000)}</a>`));
    expect(valuesAt(doc, 'string-length(/a)', {})).toEqual(['10800000']);
    doc.dispose();
  });

  it('reports broken XML with the line', () => {
    const result = readXml(encode('<?xml version="1.0"?>\n<a>\n<b></a>'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue).toBe('notWellFormed');
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.problems[0]?.line).toBeGreaterThanOrEqual(2);
  });

  it('refuses text that is no XML at all', () => {
    expect(readXml(encode('%PDF-1.7 ...'))).toMatchObject({ ok: false, issue: 'noXml' });
    expect(readXml(encode(''))).toMatchObject({ ok: false, issue: 'noXml' });
  });
});

describe('XSD validation from bundled schemas', () => {
  it('bundles the UBL 2.1 and CII D16B schemas', () => {
    expect(Object.keys(SCHEMA_FILES)).toEqual(
      expect.arrayContaining(Object.values(SCHEMA_ENTRIES)),
    );
  });

  it('accepts the official CII example against CII D16B', () => {
    const doc = read(fixture('CII_example1.xml'));
    expect(schemaProblems(doc, xsdValidator(SCHEMA_ENTRIES.ciiD16B, SCHEMA_FILES))).toEqual({
      problems: [],
      count: 0,
    });
    doc.dispose();
  });

  it('accepts the official UBL invoice and credit note (imports resolved in memory)', () => {
    const invoice = read(fixture('UBL_ubl-tc434-example1.xml'));
    expect(schemaProblems(invoice, xsdValidator(SCHEMA_ENTRIES.ublInvoice, SCHEMA_FILES))).toEqual({
      problems: [],
      count: 0,
    });
    invoice.dispose();
    const credit = read(fixture('UBL_ubl-tc434-creditnote1.xml'));
    expect(
      schemaProblems(credit, xsdValidator(SCHEMA_ENTRIES.ublCreditNote, SCHEMA_FILES)),
    ).toEqual({ problems: [], count: 0 });
    credit.dispose();
  });

  it('reports a schema violation with its line', () => {
    const text = new TextDecoder().decode(fixture('CII_example1.xml'));
    const broken = text.replace(/<ram:ID>/, '<ram:Unbekannt>x</ram:Unbekannt><ram:ID>');
    const doc = read(encode(broken));
    const { problems, count } = schemaProblems(
      doc,
      xsdValidator(SCHEMA_ENTRIES.ciiD16B, SCHEMA_FILES),
    );
    expect(count).toBeGreaterThan(0);
    expect(problems[0]?.message).toMatch(/Unbekannt/);
    expect(problems[0]?.line).toBeGreaterThan(0);
    doc.dispose();
  });

  // Without XML_PARSE_BIG_LINES libxml2 keeps an element's line as at most 65535, so every schema
  // message behind it named „Zeile 65535“ (audit 2026-11-15, R2-S-02). A formatted CII invoice
  // passes that line from about 2 500 positions on, far below the file limit.
  it('names the real line of a schema message behind line 65535', () => {
    const text = new TextDecoder().decode(fixture('UBL_ubl-tc434-example1.xml'));
    const broken = text.replace(/<cbc:IssueDate>/, `${'\n'.repeat(70_000)}<cbc:Bad>x</cbc:Bad>$&`);
    const line = broken.slice(0, broken.indexOf('<cbc:Bad>')).split('\n').length;
    expect(line).toBeGreaterThan(70_000);
    const doc = read(encode(broken));
    const { problems } = schemaProblems(doc, xsdValidator(SCHEMA_ENTRIES.ublInvoice, SCHEMA_FILES));
    doc.dispose();
    expect(problems[0]?.message).toMatch(/Bad/);
    expect(problems.map((problem) => problem.line)).toEqual([line]);
    // a message about well-formedness at the same place counts its lines itself
    const notWellFormed = readXml(encode(broken.replace('<cbc:Bad>x</cbc:Bad>', '<cbc:Bad>')));
    expect(notWellFormed.ok).toBe(false);
    if (!notWellFormed.ok) expect(notWellFormed.problems[0]?.line).toBeGreaterThan(65_535);
  });
});

// schemaProblems collects the messages itself, through internals of libxml2-wasm, because the
// public XsdValidator.validate computes the XPath of every message's node — quadratic in the number
// of messages (audit 2026-11-15, QS-02). These tests fail loudly when the library changes.
describe('schemaProblems (own collector of the schema messages)', () => {
  const FIXTURES = new URL('../fixtures/', import.meta.url).pathname.replace(
    /^\/([A-Za-z]:)/,
    '$1',
  );
  const PROFILES = [
    'ciiD16B',
    'facturxMinimum',
    'facturxBasicWl',
    'facturxBasic',
    'facturxEn16931',
    'facturxExtended',
  ] as const;

  /** What the public API reports, in the form schemaProblems gives. */
  function reference(doc: XmlDocument, validator: XsdValidator): XmlProblem[] {
    try {
      validator.validate(doc);
      return [];
    } catch (error) {
      if (!(error instanceof XmlLibError)) throw error;
      return error.details.map((d) => ({
        message: d.message.trim(),
        ...(d.line > 0 ? { line: d.line } : {}),
        ...(d.col > 0 ? { col: d.col } : {}),
      }));
    }
  }

  function xmlFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return xmlFiles(path);
      return /\.xml$/i.test(name) ? [path] : [];
    });
  }

  /** The file and broken forms of it: comma amounts, a wrong date, an unknown element. */
  function variants(text: string): string[] {
    const amount = /(Amount[^>]*>-?\d+)\.(\d+<)/;
    return [
      text,
      text.replace(amount, '$1,$2'),
      text.replace(new RegExp(amount.source, 'g'), '$1,$2'),
      text.replace(/(<(?:cbc:IssueDate|udt:DateTimeString[^>]*)>)\d{4}-?\d{2}/, '$1xx'),
      text.replace(/(<ram:ID>|<cbc:ID>)/, '<ram:Unbekannt/>$1'),
    ];
  }

  it(`runs on libxml2-wasm ${ENGINE_VERSION}, the version whose internals it uses`, () => {
    const installed = JSON.parse(
      readFileSync(
        new URL('../../node_modules/libxml2-wasm/package.json', import.meta.url),
        'utf8',
      ),
    ) as { version: string };
    const pinned = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as {
      dependencies: Record<string, string>;
    };
    // another version: re-check src/io/xml.ts (schemaProblems) against the library's own collector
    expect(installed.version).toBe(ENGINE_VERSION);
    expect(pinned.dependencies['libxml2-wasm']).toBe(ENGINE_VERSION);
  });

  // A test of correctness, not of time: it runs about 2.4 s alone, and parallel Vitest runs pushed
  // it past the default 5 s (audit 2026-11-16, R3-T-05). The time limit of the collector is the
  // test "collects 80 000 messages in linear time" below.
  it('gives the messages, lines and count of XsdValidator.validate on every official file and broken forms of it', () => {
    const files = [
      ...xmlFiles(join(FIXTURES, 'offiziell')),
      // the FeRD samples where the private repo is attached
      ...xmlFiles(join(FIXTURES, 'lokal', 'ferd')),
    ];
    let compared = 0;
    let withProblems = 0;
    const differing: string[] = [];
    for (const path of files) {
      for (const [v, text] of variants(readFileSync(path, 'utf8')).entries()) {
        const result = readXml(encode(text));
        if (!result.ok) continue;
        const root = rootOf(result.doc).name;
        const entries =
          root === 'CrossIndustryInvoice'
            ? PROFILES.map((p) => SCHEMA_ENTRIES[p])
            : root === 'Invoice'
              ? [SCHEMA_ENTRIES.ublInvoice]
              : root === 'CreditNote'
                ? [SCHEMA_ENTRIES.ublCreditNote]
                : [];
        for (const entry of entries) {
          const validator = xsdValidator(entry, SCHEMA_FILES);
          const all = reference(result.doc, validator);
          const own = schemaProblems(result.doc, validator, 20);
          compared += 1;
          if (all.length > 0) withProblems += 1;
          const expected = { problems: all.slice(0, 20), count: all.length };
          if (JSON.stringify(own) !== JSON.stringify(expected)) {
            differing.push(`${path.slice(FIXTURES.length)} #${v} ${entry}`);
          }
        }
        result.doc.dispose();
      }
    }
    expect(differing).toEqual([]);
    expect(compared).toBeGreaterThan(1000);
    expect(withProblems).toBeGreaterThan(500);
  }, 60_000);

  it('keeps every message without a limit, and counts beyond it', () => {
    const text = new TextDecoder().decode(fixture('CII_example1.xml'));
    const doc = read(encode(text.replaceAll('<ram:ID>', '<ram:Unbekannt/><ram:ID>')));
    const validator = xsdValidator(SCHEMA_ENTRIES.facturxBasic, SCHEMA_FILES);
    const all = reference(doc, validator);
    expect(all.length).toBeGreaterThan(20);
    expect(schemaProblems(doc, validator)).toEqual({ problems: all, count: all.length });
    expect(schemaProblems(doc, validator, 3)).toEqual({
      problems: all.slice(0, 3),
      count: all.length,
    });
    doc.dispose();
  });

  // 80 000 messages took 38 s through the public API (the node path per message), about 0.2 s here
  it('collects 80 000 messages in linear time', () => {
    const text = new TextDecoder().decode(fixture('CII_example1.xml'));
    const lines =
      /<ram:IncludedSupplyChainTradeLineItem>[\s\S]*<\/ram:IncludedSupplyChainTradeLineItem>/;
    const doc = read(
      encode(text.replace(lines, '<ram:IncludedSupplyChainTradeLineItem/>'.repeat(80_000))),
    );
    const started = performance.now();
    const result = schemaProblems(doc, xsdValidator(SCHEMA_ENTRIES.ciiD16B, SCHEMA_FILES), 20);
    const seconds = (performance.now() - started) / 1000;
    doc.dispose();
    expect(result.count).toBe(80_000);
    expect(result.problems).toHaveLength(20);
    expect(seconds).toBeLessThan(4);
  });
});
