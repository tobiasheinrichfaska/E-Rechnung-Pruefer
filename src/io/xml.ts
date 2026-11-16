// The XML engine: libxml2 compiled to WebAssembly (libxml2-wasm). One engine for reading, XPath
// and XSD validation, so the view of the data and the schema check never disagree. The schemas
// are bundled and served to libxml2 from memory; nothing is loaded from outside.
import {
  ParseOption,
  XmlBufferInputProvider,
  XmlDocument,
  XmlLibError,
  XsdValidator,
  xmlRegisterInputProvider,
} from 'libxml2-wasm';
import type { ErrorDetail, XmlNode } from 'libxml2-wasm';
// Internals of libxml2-wasm, for the schema messages only (schemaProblems below). The version is
// pinned exactly (package.json); tests/io/xml.test.ts fails on another version and compares the
// result with the public XsdValidator.validate on every official file and broken variants of them.
import * as engine from 'libxml2-wasm/lib/libxml2.mjs';
import { scanProlog, textOf } from '../logic/prolog';

export const MAX_XML_BYTES = 20 * 1024 * 1024;

/**
 * No network, no external entities, no entity substitution — untrusted input. HUGE lifts libxml2's
 * limit of 10 MB per text node: an XRechnung may embed an attachment (BG-24) of that size as base64
 * (audit 2026-11-14, S-02). The file limit MAX_XML_BYTES and the entity amplification limit stay.
 */
const SAFE_PARSE =
  ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_XXE | ParseOption.XML_PARSE_HUGE;

export interface XmlProblem {
  message: string;
  line?: number;
  col?: number;
}

export type XmlRead =
  | { ok: true; doc: XmlDocument }
  | {
      ok: false;
      issue: 'tooLarge' | 'doctype' | 'noXml' | 'notWellFormed';
      problems: XmlProblem[];
    };

function problemsOf(details: readonly ErrorDetail[]): XmlProblem[] {
  return details.map((d) => ({
    message: d.message.trim(),
    ...(d.line > 0 ? { line: d.line } : {}),
    ...(d.col > 0 ? { col: d.col } : {}),
  }));
}

/** Reads untrusted bytes as XML. The caller disposes the document. */
export function readXml(bytes: Uint8Array): XmlRead {
  if (bytes.byteLength > MAX_XML_BYTES) return { ok: false, issue: 'tooLarge', problems: [] };
  const prolog = scanProlog(textOf(bytes.subarray(0, 256 * 1024)));
  if (prolog.kind === 'doctype') return { ok: false, issue: 'doctype', problems: [] };
  if (prolog.kind === 'noRoot') return { ok: false, issue: 'noXml', problems: [] };
  try {
    const doc = XmlDocument.fromBuffer(bytes, { option: SAFE_PARSE });
    // The prolog scan reads the start as UTF-8, libxml2 the declared encoding (e.g. ISO-2022-JP):
    // a DOCTYPE can hide from the scan (audit 2026-11-14, S-03). The parsed document tells surely.
    if (doc.dtd) {
      doc.dispose();
      return { ok: false, issue: 'doctype', problems: [] };
    }
    return { ok: true, doc };
  } catch (error) {
    if (error instanceof XmlLibError) {
      return { ok: false, issue: 'notWellFormed', problems: problemsOf(error.details) };
    }
    throw error;
  }
}

export type Namespaces = Readonly<Record<string, string>>;

/** The text of every node an XPath selects (a string, number or boolean result as one value). */
export function valuesAt(context: XmlDocument | XmlNode, xpath: string, ns: Namespaces): string[] {
  const result = context.eval(xpath, { ...ns });
  if (Array.isArray(result)) return result.map((node) => node.content);
  return [String(result)];
}

/** The root element's local name and namespace URI. */
export function rootOf(doc: XmlDocument): { name: string; namespace: string } {
  return { name: doc.root.name, namespace: doc.root.namespaceUri };
}

// --- XSD -----------------------------------------------------------------------------------

/** Virtual folder libxml2 reads the bundled schemas from (relative imports resolve inside it). */
export const SCHEMA_BASE = '/schemas/';

let registered: XmlBufferInputProvider | undefined;
const validators = new Map<string, XsdValidator>();

/**
 * Hands the bundled schema files to libxml2 (once). Keys are paths below `schemas/`, e.g.
 * `ubl-2.1/maindoc/UBL-Invoice-2.1.xsd`.
 */
export function provideSchemas(files: Readonly<Record<string, string>>): void {
  const encoder = new TextEncoder();
  if (!registered) {
    registered = new XmlBufferInputProvider({});
    xmlRegisterInputProvider(registered);
  }
  for (const [path, text] of Object.entries(files)) {
    registered.addBuffer(SCHEMA_BASE + path, encoder.encode(text));
  }
}

/** The validator for an entry schema (a path below `schemas/`), compiled once. */
export function xsdValidator(entry: string, files: Readonly<Record<string, string>>): XsdValidator {
  const cached = validators.get(entry);
  if (cached) return cached;
  const text = files[entry];
  if (text === undefined) throw new Error(`Unknown schema: ${entry}`);
  provideSchemas(files);
  const schemaDoc = XmlDocument.fromString(text, { url: SCHEMA_BASE + entry });
  try {
    const validator = XsdValidator.fromDoc(schemaDoc);
    validators.set(entry, validator);
    return validator;
  } finally {
    schemaDoc.dispose();
  }
}

export interface SchemaProblems {
  /** The first problems, at most `keep`, in the order libxml2 reports them */
  problems: XmlProblem[];
  /** How many there are in all */
  count: number;
}

/** The version of libxml2-wasm whose internals schemaProblems relies on (pinned exactly). */
export const ENGINE_VERSION = '0.7.2';

// The public XsdValidator.validate collects every message with the XPath of its node, and
// computing that path counts the node's preceding siblings: 80 000 messages took 38 s, and the page
// shows 20 of them (audit 2026-11-15, QS-02). This collector keeps the first messages with line and
// column, counts the others, and asks for no path.
interface Sink {
  problems: XmlProblem[];
  count: number;
  keep: number;
}
let sink: Sink | undefined;
let collector: number | undefined;
const { addFunction } = engine as unknown as {
  addFunction: (fn: (index: number, error: number) => void, signature: string) => number;
};
const pointerOf = (object: XmlDocument | XsdValidator) =>
  (object as unknown as { _ptr: number })._ptr;

function schemaCollector(): number {
  collector ??= addFunction((_index, error) => {
    if (!sink) return;
    sink.count += 1;
    if (sink.problems.length >= sink.keep) return;
    const line = engine.XmlErrorStruct.line(error);
    const col = engine.XmlErrorStruct.col(error);
    sink.problems.push({
      message: engine.XmlErrorStruct.message(error).trim(),
      ...(line > 0 ? { line } : {}),
      ...(col > 0 ? { col } : {}),
    });
  }, 'vii');
  return collector;
}

/**
 * Schema problems of a document — none when it is valid: the first `keep` with their line, and how
 * many there are. The same messages, lines and count as XsdValidator.validate gives.
 */
export function schemaProblems(
  doc: XmlDocument,
  validator: XsdValidator,
  keep = Number.POSITIVE_INFINITY,
): SchemaProblems {
  const context = engine.xmlSchemaNewValidCtxt(pointerOf(validator));
  if (context === 0) throw new Error('libxml2: no schema validation context');
  const collected: Sink = { problems: [], count: 0, keep };
  sink = collected;
  try {
    engine.xmlSchemaSetValidStructuredErrors(context, schemaCollector(), 0);
    const result = engine.xmlSchemaValidateDoc(context, pointerOf(doc));
    if (result < 0) throw new Error('libxml2: invalid input or internal error');
    if (result === 0) return { problems: [], count: 0 };
    return { problems: collected.problems, count: collected.count };
  } finally {
    sink = undefined;
    engine.xmlSchemaFreeValidCtxt(context);
  }
}
