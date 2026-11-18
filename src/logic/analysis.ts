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
  | 'empty'
  | 'unreadable'
  | 'unsupportedType'
  | 'tooLarge'
  | 'password'
  | 'damaged'
  | 'xmlDoctype'
  | 'xmlBroken';

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
/** FeRD EXTENDED (CII): amounts outside EN 16931 that its calculation rules use (F29). */
export interface ExtendedAmounts {
  /** LineStatusReasonCode per line, in the order of the lines (BG-25); '' where none */
  lineStatus: string[];
  /** Logistics service charges (BT-X-272) with their VAT category and rate, as written */
  logistics: { amount: string; category: string; rate: string }[];
  /** Financial adjustments (SpecifiedFinancialAdjustment/ActualAmount), as written */
  adjustments: string[];
}

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
  /** Factur-X EXTENDED only: what its own calculation rules need beyond EN 16931 (F29) */
  extended?: ExtendedAmounts;
  /**
   * XRechnung 3.0 with Extension, UBL Invoice only: the payments of third parties (BG-DEX-09,
   * BT-DEX-002 `cac:PrepaidPayment/cbc:PaidAmount`) as written, for BR-DEX-09 (audit R5-L-01);
   * empty where the invoice has none
   */
  thirdPartyPayments?: string[];
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
