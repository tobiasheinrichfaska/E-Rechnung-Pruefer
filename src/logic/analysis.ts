// What the IO layer found in a file, as plain data. The logic layer judges it (verdict.ts); the
// UI shows both. Nothing here holds an XML document or a PDF — only values.
import type { HeaderValues, InvoiceModel } from './model';
import type { SyntaxId } from './syntax';

export interface Problem {
  message: string;
  line?: number;
  col?: number;
}

export type FileKind = 'pdf' | 'xml' | 'unknown';

export type FileProblemKind =
  'empty' | 'unsupportedType' | 'tooLarge' | 'password' | 'damaged' | 'xmlDoctype' | 'xmlBroken';

/** The check of an invoice XML against the official schema of its syntax (step 2b). */
export interface SchemaResult {
  /** e.g. "UN/CEFACT CII D16B" */
  schema: string;
  /** false: not checked, see `reason` */
  checked: boolean;
  reason?: string;
  /** The first problems (at most MAX_SCHEMA_PROBLEMS) */
  problems: Problem[];
  /** All problems the engine reported */
  count: number;
}

/** One invoice XML: the file itself or a PDF attachment. */
export interface InvoicePart {
  /** File name or attachment name */
  origin: string;
  syntax: SyntaxId;
  /** Core terms as written (recognition, comparison, details) */
  header: HeaderValues;
  /** The full EN 16931 model; missing for syntaxes outside EN 16931 (ZUGFeRD 1.0) */
  model?: InvoiceModel;
  /** The schema check; missing for syntaxes without a bundled schema (ZUGFeRD 1.0) */
  schema?: SchemaResult;
}

export type OtherPartKind = 'otherXml' | 'brokenXml' | 'doctypeXml' | 'tooLargeXml' | 'notXml';

/** A PDF attachment that is no invoice XML. */
export interface OtherPart {
  origin: string;
  kind: OtherPartKind;
  /** Root element of an XML that is no known invoice */
  root?: { name: string; namespace: string };
  problems?: Problem[];
}

export interface Analysis {
  fileName: string;
  kind: FileKind;
  problem?: { kind: FileProblemKind; problems: Problem[] };
  /** XML file that is no known invoice syntax */
  root?: { name: string; namespace: string };
  pdf?: { pages: number; unreadable: string[]; truncated: boolean };
  invoices: InvoicePart[];
  others: OtherPart[];
}
