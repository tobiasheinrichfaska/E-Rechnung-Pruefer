import { readdirSync } from 'node:fs';
import { XmlXPath } from 'libxml2-wasm';
import { extractModel } from '../../src/io/extract';
import { readXml, rootOf, schemaProblems, xsdValidator } from '../../src/io/xml';
import { SCHEMA_ENTRIES, SCHEMA_FILES } from '../../src/io/schemas';
import { allDefinitions, pathFor } from '../../src/logic/binding';
import type { GroupDef, SyntaxFamily, TermDef } from '../../src/logic/binding';
import { decimalText, normalize as normalizeDecimal, parseDecimal } from '../../src/logic/decimal';
import { groupsOf, normalize, valuesOf } from '../../src/logic/model';
import type { InvoiceModel, ModelGroup, RawGroup } from '../../src/logic/model';
import { SYNTAXES, syntaxOf } from '../../src/logic/syntax';
import type { SyntaxId } from '../../src/logic/syntax';
import { official } from '../support/fixtures';

function modelOf(path: string): InvoiceModel {
  const read = readXml(official(path));
  if (!read.ok) throw new Error(`${path}: ${read.issue}`);
  try {
    const syntax = syntaxOf(rootOf(read.doc));
    if (!syntax) throw new Error(`${path}: no syntax`);
    const raw = extractModel(read.doc, syntax);
    if (!raw) throw new Error(`${path}: no model`);
    return normalize(raw, { ubl: syntax.id !== 'cii' });
  } finally {
    read.doc.dispose();
  }
}

const KIND = new Map(allDefinitions().terms.map((t) => [t.bt, t.kind]));

/**
 * "BG-25[1]/BG-31/BT-153=Bürostuhl" lines with numbers in canonical form, sorted. Zero document
 * totals are left out: CII files write "0.00" where the UBL files of a pair omit the amount.
 */
function flatten(group: ModelGroup, prefix = ''): string[] {
  const lines: string[] = [];
  for (const [bt, values] of Object.entries(group.terms)) {
    for (const v of values ?? []) {
      const kind = KIND.get(bt as TermDef['bt']);
      const number =
        kind === 'amount' || kind === 'percent' || kind === 'quantity'
          ? parseDecimal(v.value)
          : undefined;
      if (number && number.units === 0n && prefix.startsWith('BG-22')) continue;
      lines.push(`${prefix}${bt}=${number ? decimalText(normalizeDecimal(number)) : v.value}`);
    }
  }
  for (const [bg, children] of Object.entries(group.groups)) {
    (children ?? []).forEach((child, i) =>
      lines.push(...flatten(child, `${prefix}${bg}[${i + 1}]/`)),
    );
  }
  return lines.sort();
}

describe('binding', () => {
  const families: [SyntaxFamily, SyntaxId][] = [
    ['ubl', 'ubl-invoice'],
    ['ublCreditNote', 'ubl-creditnote'],
    ['cii', 'cii'],
  ];
  it.each(families)('every %s path compiles in libxml2', (family, syntaxId) => {
    const ns = SYNTAXES.find((s) => s.id === syntaxId)?.namespaces ?? {};
    const { terms, groups } = allDefinitions();
    const defs: (TermDef | GroupDef)[] = [...terms, ...groups];
    const broken = defs.flatMap((def) => {
      const path = pathFor(def, family);
      if (!path) return [];
      try {
        XmlXPath.compile(path, { ...ns }).dispose();
        return [];
      } catch (error) {
        return [`${'bt' in def ? def.bt : def.bg}: ${path} (${String(error)})`];
      }
    });
    expect(broken).toEqual([]);
  });
});

describe('UBL and CII of the same invoice give the same model (KoSIT testsuite pairs)', () => {
  const pairs = readdirSync(new URL('../fixtures/offiziell/kosit/paare/', import.meta.url))
    .filter((name) => name.endsWith('_ubl.xml'))
    .map((name) => name.replace('_ubl.xml', ''));

  it('has every pair of instances/standard in the testsuite', () => {
    expect(pairs.length).toBe(33);
  });

  // The two files of a pair are not always identical. Each difference below was checked in the
  // files by hand (2026-11-13; 03.01a and 03.07a on 2026-11-14); anything else is a mapping error.
  const DUMMY_ORDER = { onlyUbl: ['BT-13=Dummywert'], onlyCii: [] };
  const KNOWN: Record<string, { onlyUbl: string[]; onlyCii: string[] }> = {
    // UBL needs cac:OrderReference/cbc:ID when only the sales order (BT-14) is given
    '01.02a-INVOICE': DUMMY_ORDER,
    '01.08a-INVOICE': DUMMY_ORDER,
    '01.09a-INVOICE': DUMMY_ORDER,
    '01.10a-INVOICE': DUMMY_ORDER,
    '01.11a-INVOICE': DUMMY_ORDER,
    '01.12a-INVOICE': DUMMY_ORDER,
    '01.13a-INVOICE': DUMMY_ORDER,
    // different placeholder texts in the seller address
    '01.20a-INVOICE': {
      onlyUbl: ['BG-4[1]/BG-5[1]/BT-35=[Seller street]', 'BG-4[1]/BG-5[1]/BT-37=[Seller city]'],
      onlyCii: ['BG-4[1]/BG-5[1]/BT-35=[Street]', 'BG-4[1]/BG-5[1]/BT-37=[City]'],
    },
    // different seller VAT id and exemption reason in the two files
    '01.21a-INVOICE': {
      onlyUbl: [
        'BG-23[1]/BT-120=Umkehrung der Steuerschuldnerschaft',
        'BG-4[1]/BT-31=DE 123456789',
      ],
      onlyCii: ['BG-23[1]/BT-120=als gemeinnützig anerkannt', 'BG-4[1]/BT-31=DE152338654'],
    },
    // only the UBL file gives the buyer a trading name (cac:PartyName) — checked 2026-11-14
    '03.01a-INVOICE': { onlyUbl: ['BG-7[1]/BT-45=[Buyer name]'], onlyCii: [] },
    // only the CII file has two more seller identifiers (ram:ID) — checked 2026-11-14
    '03.07a-INVOICE': {
      onlyUbl: [],
      onlyCii: ['BG-4[1]/BT-29=748387437438', 'BG-4[1]/BT-29=9876543217894897438'],
    },
    // the UBL file has city and postcode swapped
    '03.06a-INVOICE': {
      onlyUbl: [
        'BG-4[1]/BG-5[1]/BT-37=12345',
        'BG-4[1]/BG-5[1]/BT-38=Testhausen',
        'BG-7[1]/BG-8[1]/BT-52=12345',
        'BG-7[1]/BG-8[1]/BT-53=Testhausen',
      ],
      onlyCii: [
        'BG-4[1]/BG-5[1]/BT-37=Testhausen',
        'BG-4[1]/BG-5[1]/BT-38=12345',
        'BG-7[1]/BG-8[1]/BT-52=Testhausen',
        'BG-7[1]/BG-8[1]/BT-53=12345',
      ],
    },
  };

  /** What `a` holds more often than `b` — a multiset, so a doubled value is a difference (T-06). */
  const minus = (a: string[], b: string[]) => {
    const left = new Map<string, number>();
    for (const line of b) left.set(line, (left.get(line) ?? 0) + 1);
    return a.filter((line) => {
      const n = left.get(line) ?? 0;
      if (n === 0) return true;
      left.set(line, n - 1);
      return false;
    });
  };

  it.each(pairs)('%s', (name) => {
    const ubl = flatten(modelOf(`kosit/paare/${name}_ubl.xml`));
    const cii = flatten(modelOf(`kosit/paare/${name}_uncefact.xml`));
    const onlyUbl = minus(ubl, cii);
    const onlyCii = minus(cii, ubl);
    expect({ onlyUbl, onlyCii }).toEqual(KNOWN[name] ?? { onlyUbl: [], onlyCii: [] });
  });

  it('compares a substantial part of each model', () => {
    const lines = pairs.map((name) => flatten(modelOf(`kosit/paare/${name}_ubl.xml`)).length);
    expect(Math.min(...lines)).toBeGreaterThan(30);
  });
});

describe('every path finds a value in an official file (audit 2026-11-14, T-06)', () => {
  const FILES = ['cen', 'kosit', 'kosit/paare'].flatMap((dir) =>
    readdirSync(new URL(`../fixtures/offiziell/${dir}/`, import.meta.url))
      .filter((name) => name.endsWith('.xml'))
      .map((name) => `${dir}/${name}`),
  );
  const FAMILY: Partial<Record<SyntaxId, SyntaxFamily>> = {
    'ubl-invoice': 'ubl',
    'ubl-creditnote': 'ublCreditNote',
    cii: 'cii',
  };
  const found: Record<SyntaxFamily, Set<string>> = {
    ubl: new Set(),
    ublCreditNote: new Set(),
    cii: new Set(),
  };
  const collect = (family: SyntaxFamily, group: RawGroup) => {
    found[family].add(group.bg);
    for (const [bt, values] of Object.entries(group.terms)) {
      if ((values ?? []).length > 0) found[family].add(bt);
    }
    for (const children of Object.values(group.groups)) {
      for (const child of children ?? []) collect(family, child);
    }
  };
  beforeAll(() => {
    for (const path of FILES) {
      const read = readXml(official(path));
      if (!read.ok) continue;
      try {
        const syntax = syntaxOf(rootOf(read.doc));
        const family = syntax ? FAMILY[syntax.id] : undefined;
        const raw = syntax && family ? extractModel(read.doc, syntax) : undefined;
        if (family && raw) collect(family, raw);
      } finally {
        read.doc.dispose();
      }
    }
  });

  /** Paths no official file fills; each is shown working on a derived file below. */
  const NOT_IN_FILES: Record<SyntaxFamily, string[]> = {
    ubl: [],
    cii: ['BT-8'],
    // one official credit note: only the paths of its own are checked here
    ublCreditNote: ['BT-9'],
  };

  it.each(['ubl', 'cii', 'ublCreditNote'] as const)('%s', (family) => {
    const { terms, groups } = allDefinitions();
    const defs: (TermDef | GroupDef)[] = [...terms, ...groups];
    const own = (def: TermDef | GroupDef) =>
      family !== 'ublCreditNote' || pathFor(def, 'ublCreditNote') !== pathFor(def, 'ubl');
    const missing = defs
      .filter((def) => pathFor(def, family) && own(def))
      .map((def) => ('bt' in def ? def.bt : def.bg))
      .filter((id) => !found[family].has(id));
    expect(missing).toEqual(NOT_IN_FILES[family]);
  });

  /** An official file with one change, valid against the official schema, read through the binding. */
  function derived(path: string, from: string, to: string, entry: string): InvoiceModel {
    const text = new TextDecoder().decode(official(path));
    if (!text.includes(from)) throw new Error(`${path}: ${from} not found`);
    const read = readXml(new TextEncoder().encode(text.replace(from, to)));
    if (!read.ok) throw new Error(`${path}: ${read.issue}`);
    try {
      expect(schemaProblems(read.doc, xsdValidator(entry, SCHEMA_FILES))).toEqual({
        problems: [],
        count: 0,
      });
      const syntax = syntaxOf(rootOf(read.doc));
      const raw = syntax ? extractModel(read.doc, syntax) : undefined;
      if (!syntax || !raw) throw new Error(`${path}: no model`);
      return normalize(raw, { ubl: syntax.id !== 'cii' });
    } finally {
      read.doc.dispose();
    }
  }

  it('reads BT-8 in CII (KoSIT 01.01a with a DueDateTypeCode)', () => {
    const model = derived(
      'kosit/paare/01.01a-INVOICE_uncefact.xml',
      '<ram:CategoryCode>S</ram:CategoryCode>\r\n                <ram:RateApplicablePercent>',
      // the file has CRLF line ends (kept byte-identical)
      '<ram:CategoryCode>S</ram:CategoryCode>\r\n                <ram:DueDateTypeCode>72</ram:DueDateTypeCode>\r\n                <ram:RateApplicablePercent>',
      SCHEMA_ENTRIES.ciiD16B,
    );
    expect(valuesOf(model, 'BT-8').map((v) => v.value)).toEqual(['72']);
  });

  it('reads BT-9 in a UBL credit note (CEN example with a PaymentDueDate)', () => {
    const model = derived(
      'cen/UBL_ubl-tc434-creditnote1.xml',
      '<cbc:PaymentMeansCode>1</cbc:PaymentMeansCode>',
      '<cbc:PaymentMeansCode>1</cbc:PaymentMeansCode>\n\t\t<cbc:PaymentDueDate>2026-12-01</cbc:PaymentDueDate>',
      SCHEMA_ENTRIES.ublCreditNote,
    );
    expect(valuesOf(model, 'BT-9').map((v) => v.value)).toEqual(['2026-12-01']);
  });
});

describe('values of one official invoice', () => {
  it('reads seller, buyer, totals, VAT breakdown and lines of KoSIT 01.01a (UBL)', () => {
    const model = modelOf('kosit/01.01a-INVOICE_ubl.xml');
    expect(valuesOf(model, 'BT-1').map((v) => v.value)).toEqual(['123456XX']);
    expect(valuesOf(model, 'BT-2').map((v) => v.value)).toEqual(['2016-04-04']);
    expect(valuesOf(model, 'BG-4/BT-27').length).toBe(1);
    expect(valuesOf(model, 'BG-4/BG-5/BT-40').map((v) => v.value)).toEqual(['DE']);
    expect(groupsOf(model, 'BG-25').length).toBeGreaterThan(0);
    expect(groupsOf(model, 'BG-23').length).toBeGreaterThan(0);
    expect(valuesOf(model, 'BG-22/BT-112').length).toBe(1);
  });

  it('reads the lines of a UBL credit note', () => {
    const model = modelOf('cen/UBL_ubl-tc434-creditnote1.xml');
    expect(valuesOf(model, 'BT-3').map((v) => v.value)).toEqual(['381']);
    expect(groupsOf(model, 'BG-25').length).toBeGreaterThan(0);
    expect(valuesOf(model, 'BG-25/BT-129').length).toBe(groupsOf(model, 'BG-25').length);
  });

  it('turns CII dates (format 102) into ISO dates and keeps the raw text', () => {
    const model = modelOf('kosit/01.01a-INVOICE_uncefact.xml');
    expect(valuesOf(model, 'BT-2')).toEqual([{ value: '2016-04-04', raw: '20160404' }]);
  });
});
