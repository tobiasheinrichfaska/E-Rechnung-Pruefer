// The result of step 1 "Erkennen": is it an e-invoice, in which syntax and profile. Always hints,
// never an approval. Texts are data (texts.ts); this file only decides which apply.
import type { Analysis, InvoicePart, Problem } from './analysis';
import { termLabel } from './binding';
import { germanDate, isoDate } from './dates';
import { decimalEquals, formatAmount, parseDecimal } from './decimal';
import { first } from './model';
import type { BtId, InvoiceModel } from './model';
import { profileOf } from './profiles';
import { checkRules } from './rules';
import type { RulesResult } from './rules';
import type { Einordnung, ProfileMatch } from './profiles';
import { syntaxById } from './syntax';
import { TEXTS, fill } from './texts';

export type Tone = 'ok' | 'warn' | 'bad';

export interface InvoiceVerdict {
  part: InvoicePart;
  syntaxLabel: string;
  profile: ProfileMatch;
  einordnung: Einordnung;
  /** Short German label of the specification, e.g. "XRechnung 3.0" */
  specLabel: string;
}

export interface Verdict {
  tone: Tone;
  headline: string;
  explanation: string[];
  invoices: InvoiceVerdict[];
  /** Comparison of several invoice XML in one PDF */
  comparison?: { same: boolean; differing: BtId[] };
}

// BT-24 too: with equal header values but another specification (e.g. XRechnung and MINIMUM) the
// result would depend on the order of the attachments (audit 2026-11-14, L-03).
const COMPARED: readonly BtId[] = ['BT-1', 'BT-2', 'BT-5', 'BT-24', 'BT-27', 'BT-112'];

function judgeInvoice(part: InvoicePart): InvoiceVerdict {
  const syntax = syntaxById(part.syntax);
  // ZUGFeRD 1.0 is recognised by its namespace; its identifier only refines the label.
  const profile = profileOf(first(part.header, 'BT-24'));
  const einordnung: Einordnung = syntax.en16931 ? profile.einordnung : 'keineERechnung';
  const specLabel = syntax.en16931 ? (profile.entry?.label ?? TEXTS.specUnknown) : syntax.label;
  return { part, syntaxLabel: syntax.label, profile, einordnung, specLabel };
}

function comparable(part: InvoicePart, bt: BtId): string {
  const value = first(part.header, bt) ?? '';
  if (bt === 'BT-2') return isoDate(value) ?? value;
  if (bt === 'BT-27') return value.toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
  return value.trim();
}

/**
 * Which compared terms differ between the parts (amounts compared as decimals). A part without a
 * model (ZUGFeRD 1.0) holds only BT-24: its other values were never read, so they are not
 * compared (audit 2026-11-14, L-04).
 */
export function differingTerms(parts: readonly InvoicePart[]): BtId[] {
  return COMPARED.filter((bt) => {
    const [head, ...rest] = bt === 'BT-24' ? parts : parts.filter((p) => p.model !== undefined);
    if (!head) return false;
    return rest.some((part) => {
      if (bt === 'BT-112') {
        const a = parseDecimal(first(head.header, bt));
        const b = parseDecimal(first(part.header, bt));
        if (a && b) return !decimalEquals(a, b);
      }
      return comparable(head, bt) !== comparable(part, bt);
    });
  });
}

/** A compared value as the client reads it: German date and amount, "–" when missing. */
function shownValue(part: InvoicePart, bt: BtId): string {
  const value = first(part.header, bt)?.trim() ?? '';
  if (value === '') return '–';
  if (bt === 'BT-2') {
    const iso = isoDate(value);
    return iso ? germanDate(iso) : value;
  }
  if (bt === 'BT-112') {
    const amount = parseDecimal(value);
    return amount ? formatAmount(amount) : value;
  }
  return value;
}

/**
 * "Unterschiedlich: Rechnungsnummer (PRG1502112 / PRG1502113)." — with the values of every part,
 * so the client sees what differs without scrolling to each part (audit Bedienung, E-04).
 */
export function differingLine(parts: readonly InvoicePart[], differing: readonly BtId[]): string {
  const items = differing.map((bt) =>
    fill(TEXTS.differingItem, {
      label: termLabel(bt),
      values: parts.map((part) => shownValue(part, bt)).join(' / '),
    }),
  );
  return fill(TEXTS.differingLine, { items: items.join('; ') });
}

/** "Technische Meldung (Zeile 4): …" — the parser's or the schema's own (English) message. */
export function technicalLine(problem: Problem): string {
  return problem.line
    ? fill(TEXTS.problemAtLine, { line: problem.line, message: problem.message })
    : fill(TEXTS.problemMessage, { message: problem.message });
}

/** The German prefix of a technical line, as a pattern ("Technische Meldung (Zeile 4): "). */
const TECHNICAL = [TEXTS.problemAtLine, TEXTS.problemMessage].map((template) => {
  const [prefix = ''] = template.split('{message}');
  const pattern = prefix.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&').replace('\\{line\\}', '\\d+');
  return new RegExp(`^(${pattern})([\\s\\S]+)$`);
});

/**
 * A line of `technicalLine` split into its German prefix and the engine's English message, so the
 * message can be marked as English for screen readers (WCAG 3.1.2, audit Bedienung Z-04).
 */
export function technicalParts(line: string): { prefix: string; message: string } | undefined {
  for (const pattern of TECHNICAL) {
    const match = pattern.exec(line);
    if (match?.[1] && match[2]) return { prefix: match[1], message: match[2] };
  }
  return undefined;
}

function problemLine(problem: Problem | undefined): string[] {
  return problem ? [technicalLine(problem)] : [];
}

/** Schema problems count only where the XML is what counts (not for "keine E-Rechnung", F19). */
function schemaFailed(invoice: InvoiceVerdict): boolean {
  return invoice.einordnung !== 'keineERechnung' && (invoice.part.schema?.count ?? 0) > 0;
}

/** Step 3a: the rule ids with a possible irregularity — only where the XML counts (F19). */
/** The rules of one invoice XML; for EXTENDED without the sums over the lines (B-02b). */
export function rulesOf(invoice: InvoiceVerdict): RulesResult | undefined {
  const model = pflichtModel(invoice);
  return model
    ? checkRules(model, { ownRules: invoice.profile.entry?.ownRules ?? false })
    : undefined;
}

function rulesFailed(invoice: InvoiceVerdict): string[] {
  return rulesOf(invoice)?.auffaellig ?? [];
}

function rulesLines(invoice: InvoiceVerdict, several: boolean): string[] {
  const ids = rulesFailed(invoice);
  if (ids.length === 0) return [];
  return [
    several
      ? fill(TEXTS.rulesHintIn, { name: invoice.part.origin, ids: ids.join(', ') })
      : fill(TEXTS.rulesHint, { ids: ids.join(', ') }),
  ];
}

/** How many technical schema messages the result itself shows (all are listed below it). */
const SCHEMA_LINES = 3;

function schemaLines(invoice: InvoiceVerdict, inPdf: boolean): string[] {
  const schema = invoice.part.schema;
  if (!schema || !schemaFailed(invoice)) return [];
  const shown = schema.problems.slice(0, SCHEMA_LINES);
  return [
    fill(inPdf ? TEXTS.schemaMismatchIn : TEXTS.schemaMismatch, {
      name: invoice.part.origin,
      schema: schema.schema,
      count: schema.count,
    }),
    ...shown.map(technicalLine),
    ...(schema.count > shown.length
      ? [fill(TEXTS.schemaMore, { count: schema.count - shown.length })]
      : []),
  ];
}

function singleVerdict(analysis: Analysis, invoice: InvoiceVerdict, withSchema = true): Verdict {
  const inPdf = analysis.kind === 'pdf';
  const profileName = invoice.profile.entry?.profile ?? invoice.specLabel;
  const schema = withSchema ? schemaLines(invoice, inPdf) : [];
  const rules = withSchema ? rulesLines(invoice, false) : [];
  switch (invoice.einordnung) {
    case 'eRechnung': {
      const source = inPdf
        ? [fill(TEXTS.hybridSource, { name: invoice.part.origin }), TEXTS.xmlCounts]
        : [TEXTS.xmlFile];
      const hint = invoice.profile.entry?.hint ? [invoice.profile.entry.hint] : [];
      if (schema.length > 0) {
        // Step 2b: the XML does not match the official schema — F4: "Formatfehler, gem. Rn. 6a
        // ggf. keine E-Rechnung"
        return {
          tone: 'bad',
          headline: fill(TEXTS.schemaErrorHeadline, { spec: invoice.specLabel }),
          explanation: [...source, ...hint, ...schema, TEXTS.formatError, ...rules],
          invoices: [invoice],
        };
      }
      // Step 3a: a possible irregularity in the amounts is a hint (warn), not a format error
      return {
        tone: rules.length > 0 ? 'warn' : 'ok',
        headline: fill(TEXTS.eRechnung, { spec: invoice.specLabel }),
        explanation: [...source, ...hint, ...rules],
        invoices: [invoice],
      };
    }
    case 'keineERechnung':
      return {
        tone: 'bad',
        headline: fill(inPdf ? TEXTS.keineERechnungPdf : TEXTS.keineERechnungXml, {
          profile: profileName,
        }),
        explanation: [
          invoice.part.syntax === 'zugferd1' || invoice.profile.entry?.profile === 'ZUGFeRD 1.0'
            ? TEXTS.zugferd1Reason
            : TEXTS.minimumReason,
        ],
        invoices: [invoice],
      };
    case 'nichtBeurteilt':
      return {
        tone: 'warn',
        headline: TEXTS.nichtBeurteilt,
        explanation: [
          invoice.profile.id
            ? fill(TEXTS.unknownSpec, { id: invoice.profile.id })
            : TEXTS.missingSpec,
          TEXTS.shownAnyway,
          ...(schema.length > 0 ? [...schema, TEXTS.formatError] : []),
          ...rules,
        ],
        invoices: [invoice],
      };
  }
}

function fileProblemVerdict(analysis: Analysis): Verdict | undefined {
  const problem = analysis.problem;
  if (!problem) return undefined;
  const text = TEXTS.fileProblems[problem.kind];
  const technical = problemLine(problem.problems[0]);
  return {
    tone: text.tone,
    headline: text.headline,
    // the technical message before "Formatfehler …", as for a broken XML inside a PDF (U-07)
    explanation:
      problem.kind === 'xmlBroken'
        ? [...technical, ...text.explanation]
        : [...text.explanation, ...technical],
    invoices: [],
  };
}

/**
 * The model whose Pflichtangaben are shown: not for "keine E-Rechnung" — there the readable invoice
 * counts, not the XML (F19, Tobias 2026-11-14).
 */
export function pflichtModel(invoice: InvoiceVerdict): InvoiceModel | undefined {
  return invoice.einordnung === 'keineERechnung' ? undefined : invoice.part.model;
}

/** Whether the XML is what counts: at least one invoice XML is an e-invoice (fixed notice, F19). */
export function xmlCounts(verdict: Verdict): boolean {
  return verdict.invoices.some((invoice) => invoice.einordnung === 'eRechnung');
}

export function verdictOf(analysis: Analysis): Verdict {
  const fileProblem = fileProblemVerdict(analysis);
  if (fileProblem) return fileProblem;

  const invoices = analysis.invoices.map(judgeInvoice);
  const [only] = invoices;
  if (invoices.length === 1 && only) return singleVerdict(analysis, only);

  if (invoices.length > 1) {
    const differing = differingTerms(analysis.invoices);
    const names = analysis.invoices.map((p) => p.origin).join(', ');
    // the schema result of every part, never only of the first (cf. L-03)
    const failed = invoices.filter(schemaFailed);
    const schema =
      failed.length > 0 ? [...failed.flatMap((i) => schemaLines(i, true)), TEXTS.formatError] : [];
    const rules = invoices.flatMap((i) => rulesLines(i, true));
    if (differing.length === 0 && only) {
      const base = singleVerdict(analysis, only, false);
      const [firstFailed] = failed;
      return {
        ...base,
        tone: failed.length > 0 ? 'bad' : base.tone === 'ok' ? 'warn' : base.tone,
        headline: firstFailed
          ? fill(TEXTS.schemaErrorHeadline, { spec: firstFailed.specLabel })
          : base.headline,
        explanation: [
          ...base.explanation,
          fill(TEXTS.sameSeveral, { count: invoices.length, names }),
          ...schema,
          ...rules,
        ],
        invoices,
        comparison: { same: true, differing },
      };
    }
    return {
      tone: failed.length > 0 ? 'bad' : 'warn',
      headline: TEXTS.contradicting,
      explanation: [
        fill(TEXTS.contradictingWhy, { count: invoices.length, names }),
        TEXTS.askSupplier,
        ...schema,
        ...rules,
      ],
      invoices,
      comparison: { same: false, differing },
    };
  }

  // No invoice XML at all.
  if (analysis.kind === 'xml') {
    return {
      tone: 'warn',
      headline: TEXTS.otherXml,
      explanation: [
        analysis.root
          ? fill(TEXTS.rootIs, {
              name: analysis.root.name,
              namespace: analysis.root.namespace || '–',
            })
          : '',
        TEXTS.otherFormats,
      ].filter((line) => line.length > 0),
      invoices: [],
    };
  }
  const broken = analysis.others.find((o) => o.kind === 'brokenXml');
  if (broken) {
    return {
      tone: 'bad',
      headline: TEXTS.pdfBrokenXml,
      explanation: [
        fill(TEXTS.attachmentBroken, { name: broken.origin }),
        ...problemLine(broken.problems?.[0]),
        TEXTS.formatError,
      ],
      invoices: [],
    };
  }
  // An XML the tool does not read (DOCTYPE, over its size limit) or attachments beyond the first
  // 50: not judged — as a single XML with a DOCTYPE, never "Formatfehler" (audit 2026-11-14, U-06).
  const unread = analysis.others.filter((o) => o.kind === 'doctypeXml' || o.kind === 'tooLargeXml');
  if (unread.length > 0 || analysis.pdf?.truncated) {
    return {
      tone: 'warn',
      headline: TEXTS.pdfNotChecked,
      explanation: [
        ...unread.map((o) =>
          fill(o.kind === 'doctypeXml' ? TEXTS.attachmentDoctype : TEXTS.attachmentTooLarge, {
            name: o.origin,
          }),
        ),
        ...(analysis.pdf?.truncated ? [TEXTS.attachmentsTruncated] : []),
        TEXTS.notJudged,
      ],
      invoices: [],
    };
  }
  if (analysis.others.length > 0 || (analysis.pdf?.unreadable.length ?? 0) > 0) {
    const names = [...analysis.others.map((o) => o.origin), ...(analysis.pdf?.unreadable ?? [])];
    return {
      tone: 'bad',
      headline: TEXTS.pdfWithoutInvoiceData,
      explanation: [
        fill(TEXTS.attachmentsNoInvoice, { names: names.join(', ') }),
        TEXTS.plainPdfWhy,
      ],
      invoices: [],
    };
  }
  return { tone: 'bad', headline: TEXTS.plainPdf, explanation: [TEXTS.plainPdfWhy], invoices: [] };
}
