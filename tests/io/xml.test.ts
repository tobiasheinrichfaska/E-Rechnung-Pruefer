import { readFileSync } from 'node:fs';
import { readXml, rootOf, schemaProblems, valuesAt, xsdValidator } from '../../src/io/xml';
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
    expect(schemaProblems(doc, xsdValidator(SCHEMA_ENTRIES.ciiD16B, SCHEMA_FILES))).toEqual([]);
    doc.dispose();
  });

  it('accepts the official UBL invoice and credit note (imports resolved in memory)', () => {
    const invoice = read(fixture('UBL_ubl-tc434-example1.xml'));
    expect(schemaProblems(invoice, xsdValidator(SCHEMA_ENTRIES.ublInvoice, SCHEMA_FILES))).toEqual(
      [],
    );
    invoice.dispose();
    const credit = read(fixture('UBL_ubl-tc434-creditnote1.xml'));
    expect(
      schemaProblems(credit, xsdValidator(SCHEMA_ENTRIES.ublCreditNote, SCHEMA_FILES)),
    ).toEqual([]);
    credit.dispose();
  });

  it('reports a schema violation with its line', () => {
    const text = new TextDecoder().decode(fixture('CII_example1.xml'));
    const broken = text.replace(/<ram:ID>/, '<ram:Unbekannt>x</ram:Unbekannt><ram:ID>');
    const doc = read(encode(broken));
    const problems = schemaProblems(doc, xsdValidator(SCHEMA_ENTRIES.ciiD16B, SCHEMA_FILES));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]?.message).toMatch(/Unbekannt/);
    expect(problems[0]?.line).toBeGreaterThan(0);
    doc.dispose();
  });
});
