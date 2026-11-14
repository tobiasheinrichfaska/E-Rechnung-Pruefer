// One file → what is in it (logic/analysis.ts). The file type is taken from the content, never
// from the name; XML among PDF attachments as well. Every XML document is disposed right after
// its values are read.
import type { XmlDocument } from 'libxml2-wasm';
import type {
  Analysis,
  FileKind,
  InvoicePart,
  OtherPart,
  Problem,
  SchemaResult,
} from '../logic/analysis';
import { coreValues, first, normalize } from '../logic/model';
import { profileOf } from '../logic/profiles';
import { looksLikeXml } from '../logic/prolog';
import { syntaxOf } from '../logic/syntax';
import type { SyntaxEntry } from '../logic/syntax';
import { TEXTS } from '../logic/texts';
import { SCHEMA_ENTRIES, SCHEMA_FILES } from './schemas';
import { extractModel } from './extract';
import { MAX_PDF_BYTES, readPdfAttachments } from './pdf';
import type { PdfJsLike } from './pdf';
import { MAX_XML_BYTES, readXml, rootOf, schemaProblems, valuesAt, xsdValidator } from './xml';

/** How many schema problems are kept for the display (all are counted). */
export const MAX_SCHEMA_PROBLEMS = 20;

/**
 * Step 2b: the invoice XML against the official schema of its syntax — the same XSD the KoSIT
 * validator uses. A profile with a schema of its own (FeRD EXTENDED) is left out until that schema
 * is bundled, so a valid file never gets a false "Formatfehler".
 */
function schemaCheck(
  doc: XmlDocument,
  syntax: SyntaxEntry,
  specId: string | undefined,
): SchemaResult | undefined {
  if (!syntax.schema) return undefined;
  const schema = syntax.schema.label;
  if (profileOf(specId).entry?.ownSchema) {
    return { schema, checked: false, reason: TEXTS.schemaOwnProfile, problems: [], count: 0 };
  }
  const validator = xsdValidator(SCHEMA_ENTRIES[syntax.schema.entry], SCHEMA_FILES);
  const problems = schemaProblems(doc, validator);
  return {
    schema,
    checked: true,
    problems: problems.slice(0, MAX_SCHEMA_PROBLEMS),
    count: problems.length,
  };
}

/** Above this size a file is not even read into memory (the larger of the two limits). */
export const MAX_FILE_BYTES = Math.max(MAX_PDF_BYTES, MAX_XML_BYTES);

/** The result for a file above MAX_FILE_BYTES, decided from its size alone (audit S-04). */
export function tooLargeFile(fileName: string): Analysis {
  return {
    fileName,
    kind: 'unknown',
    invoices: [],
    others: [],
    problem: { kind: 'tooLarge', problems: [] },
  };
}

const PDF_MAGIC = '%PDF-';

/** PDF when "%PDF-" appears in the first KB (as viewers accept), XML by its prolog. */
export function fileKindOf(bytes: Uint8Array): FileKind {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (head.includes(PDF_MAGIC)) return 'pdf';
  if (looksLikeXml(bytes)) return 'xml';
  return 'unknown';
}

type XmlOutcome =
  | { kind: 'invoice'; part: InvoicePart }
  | { kind: 'other'; root: { name: string; namespace: string } }
  | { kind: 'doctype' }
  | { kind: 'tooLarge' }
  | { kind: 'broken'; problems: Problem[] };

function readInvoiceXml(origin: string, bytes: Uint8Array): XmlOutcome {
  const read = readXml(bytes);
  if (!read.ok) {
    if (read.issue === 'doctype') return { kind: 'doctype' };
    if (read.issue === 'tooLarge') return { kind: 'tooLarge' };
    return { kind: 'broken', problems: read.problems };
  }
  const doc = read.doc;
  try {
    const root = rootOf(doc);
    const syntax = syntaxOf(root);
    if (!syntax) return { kind: 'other', root };
    const raw = extractModel(doc, syntax);
    if (!raw) {
      // ZUGFeRD 1.0: no EN 16931 model, only its specification identifier
      const specId = syntax.specIdPath ? valuesAt(doc, syntax.specIdPath, syntax.namespaces) : [];
      return { kind: 'invoice', part: { origin, syntax: syntax.id, header: { 'BT-24': specId } } };
    }
    const model = normalize(raw, { ubl: syntax.id !== 'cii' });
    const header = coreValues(model);
    const schema = schemaCheck(doc, syntax, first(header, 'BT-24'));
    return {
      kind: 'invoice',
      part: { origin, syntax: syntax.id, header, model, ...(schema ? { schema } : {}) },
    };
  } finally {
    doc.dispose();
  }
}

export async function analyzeFile(
  fileName: string,
  bytes: Uint8Array,
  loadPdfJs: () => Promise<PdfJsLike>,
): Promise<Analysis> {
  const base = { fileName, invoices: [], others: [] };
  if (bytes.byteLength === 0) {
    return { ...base, kind: 'unknown', problem: { kind: 'empty', problems: [] } };
  }
  const kind = fileKindOf(bytes);

  if (kind === 'xml') {
    const outcome = readInvoiceXml(fileName, bytes);
    switch (outcome.kind) {
      case 'invoice':
        return { ...base, kind, invoices: [outcome.part] };
      case 'other':
        return { ...base, kind, root: outcome.root };
      case 'doctype':
        return { ...base, kind, problem: { kind: 'xmlDoctype', problems: [] } };
      case 'tooLarge':
        return { ...base, kind, problem: { kind: 'tooLarge', problems: [] } };
      case 'broken':
        return { ...base, kind, problem: { kind: 'xmlBroken', problems: outcome.problems } };
    }
  }

  if (kind === 'pdf') {
    const read = await readPdfAttachments(await loadPdfJs(), bytes);
    if (!read.ok) {
      return {
        ...base,
        kind,
        problem: {
          kind: read.issue,
          problems: read.detail ? [{ message: read.detail }] : [],
        },
      };
    }
    const invoices: InvoicePart[] = [];
    const others: OtherPart[] = [];
    for (const attachment of read.attachments) {
      if (!looksLikeXml(attachment.bytes)) {
        others.push({ origin: attachment.name, kind: 'notXml' });
        continue;
      }
      const outcome = readInvoiceXml(attachment.name, attachment.bytes);
      if (outcome.kind === 'invoice') invoices.push(outcome.part);
      else if (outcome.kind === 'other') {
        others.push({ origin: attachment.name, kind: 'otherXml', root: outcome.root });
      } else if (outcome.kind === 'doctype') {
        others.push({ origin: attachment.name, kind: 'doctypeXml' });
      } else if (outcome.kind === 'tooLarge') {
        // The tool's own limit, no fault of the invoice (audit 2026-11-14, S-05)
        others.push({ origin: attachment.name, kind: 'tooLargeXml' });
      } else {
        others.push({ origin: attachment.name, kind: 'brokenXml', problems: outcome.problems });
      }
    }
    return {
      ...base,
      kind,
      pdf: { pages: read.pages, unreadable: read.unreadable, truncated: read.truncated },
      invoices,
      others,
    };
  }

  return { ...base, kind, problem: { kind: 'unsupportedType', problems: [] } };
}
