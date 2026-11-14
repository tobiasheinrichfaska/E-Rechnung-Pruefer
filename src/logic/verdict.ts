// The result of step 1 "Erkennen": is it an e-invoice, in which syntax and profile. Always hints,
// never an approval. Texts are data (texts.ts); this file only decides which apply.
import type { Analysis, InvoicePart, Problem } from './analysis';
import { termLabel } from './binding';
import { germanDate, isoDate } from './dates';
import { decimalEquals, formatAmount, parseDecimal } from './decimal';
import { first } from './model';
import type { BtId, InvoiceModel } from './model';
import { checkPflichtangaben } from './check';
import { profileOf } from './profiles';
import { adviceFor, checkRules } from './rules';
import type { RulesResult } from './rules';
import type { Einordnung, ProfileMatch } from './profiles';
import { syntaxById } from './syntax';
import { TEXTS, fill } from './texts';
import { commonTransition, transitionOf } from './uebergang';
import type { Transition } from './uebergang';

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

export interface ComparisonRow {
  label: string;
  /** One value per invoice XML, as the client reads it */
  values: string[];
  differs: boolean;
}

/**
 * F27/G-8: two invoice XML with different data are not shown in full — only the compared values
 * side by side, the differing ones marked.
 */
export function comparisonRows(parts: readonly InvoicePart[]): ComparisonRow[] {
  const differing = new Set(differingTerms(parts));
  return [
    { label: 'Anhang', values: parts.map((p) => p.origin), differs: false },
    ...COMPARED.map((bt) => ({
      label: `${termLabel(bt)} (${bt})`,
      values: parts.map((part) => shownValue(part, bt)),
      differs: differing.has(bt),
    })),
  ];
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

/** Step 3a; FeRD EXTENDED has its own forms of the rules (Profile.ownRules). */
export function rulesOf(invoice: InvoiceVerdict): RulesResult | undefined {
  const model = pflichtModel(invoice);
  return model
    ? checkRules(model, { ownRules: invoice.profile.entry?.ownRules ?? false })
    : undefined;
}

function rulesFailed(invoice: InvoiceVerdict): string[] {
  return rulesOf(invoice)?.auffaellig ?? [];
}

/** The rule ids of each part, then once what the client could do about them (F23). */
function rulesLines(invoices: readonly InvoiceVerdict[]): string[] {
  const several = invoices.length > 1;
  const lines = invoices.flatMap((invoice) => {
    const ids = rulesFailed(invoice);
    if (ids.length === 0) return [];
    return [
      several
        ? fill(TEXTS.rulesHintIn, { name: invoice.part.origin, ids: ids.join(', ') })
        : fill(TEXTS.rulesHint, { ids: ids.join(', ') }),
    ];
  });
  return [...lines, ...adviceFor(invoices.flatMap(rulesFailed))];
}

/** F22/F23: missing Pflichtangaben and the hints of the rows, for the result box. */
function pflichtLines(invoice: InvoiceVerdict): string[] {
  const model = pflichtModel(invoice);
  if (!model) return [];
  const result = checkPflichtangaben(model);
  return [
    ...(result.missingLabels.length > 0
      ? [
          fill(TEXTS.pflichtMissingLine, { list: result.missingLabels.join('; ') }),
          TEXTS.supplierComplete,
        ]
      : []),
    ...(result.hintCount === 1
      ? [TEXTS.pflichtHintLine]
      : result.hintCount > 1
        ? [fill(TEXTS.pflichtHintsLine, { count: result.hintCount })]
        : []),
  ];
}

/** F26: the transition sentence of the parts (one only where all parts agree). */
function transitionFor(invoices: readonly InvoiceVerdict[]): Transition {
  return commonTransition(
    invoices.map((i) => (i.part.model ? transitionOf(i.part.model) : { regime: 'unbekannt' })),
  );
}

/**
 * F23/F26: the sentence by the date of supply and invoice; without a readable date the general
 * one. `mendFile`: a format error, where the supplier could mend the file.
 */
function transitionLines(transition: Transition, mendFile: boolean): string[] {
  switch (transition.regime) {
    case 'zulaessig':
      return [TEXTS.regimeAllowed];
    case 'nur800k':
      return [TEXTS.regimeTurnover];
    case 'pflicht':
      return [TEXTS.regimeRequired];
    case 'unbekannt':
      return [
        ...(transition.conflict === 'lieferungUndZeitraum'
          ? [TEXTS.datesApart]
          : transition.conflict === 'positionen'
            ? [TEXTS.linePeriodsApart]
            : []),
        ...(mendFile ? [TEXTS.supplierMendFile] : []),
        TEXTS.regimeGeneral,
      ];
  }
}

/** How many technical schema messages the result itself shows (all are listed below it). */
const SCHEMA_LINES = 3;

/** The German sentence of a schema mismatch, and the engine's messages (G-10: shown last). */
function schemaParts(
  invoices: readonly InvoiceVerdict[],
  inPdf: boolean,
): { german: string[]; technical: string[] } {
  const german: string[] = [];
  const technical: string[] = [];
  for (const invoice of invoices) {
    const schema = invoice.part.schema;
    if (!schema || !schemaFailed(invoice)) continue;
    german.push(
      fill(inPdf ? TEXTS.schemaMismatchIn : TEXTS.schemaMismatch, {
        name: invoice.part.origin,
        schema: schema.schema,
        count: schema.count,
      }),
    );
    const shown = schema.problems.slice(0, SCHEMA_LINES);
    technical.push(
      ...shown.map(technicalLine),
      ...(schema.count > shown.length
        ? [fill(TEXTS.schemaMore, { count: schema.count - shown.length })]
        : []),
    );
  }
  return { german, technical };
}

/** A format error: what is wrong, the F24 sentence, the transition sentence — technique last. */
function formatErrorLines(
  invoices: readonly InvoiceVerdict[],
  inPdf: boolean,
): { german: string[]; technical: string[] } {
  const { german, technical } = schemaParts(invoices, inPdf);
  if (german.length === 0) return { german, technical };
  return {
    german: [...german, TEXTS.formatError, ...transitionLines(transitionFor(invoices), true)],
    technical,
  };
}

function sourceLines(invoice: InvoiceVerdict, inPdf: boolean): string[] {
  return inPdf
    ? [fill(TEXTS.hybridSource, { name: invoice.part.origin }), TEXTS.xmlCounts]
    : [TEXTS.xmlFile];
}

function singleVerdict(analysis: Analysis, invoice: InvoiceVerdict): Verdict {
  const inPdf = analysis.kind === 'pdf';
  const profileName = invoice.profile.entry?.profile ?? invoice.specLabel;
  const format = formatErrorLines([invoice], inPdf);
  const rules = rulesLines([invoice]);
  switch (invoice.einordnung) {
    case 'eRechnung': {
      const hint = invoice.profile.entry?.hint ? [invoice.profile.entry.hint] : [];
      if (format.german.length > 0) {
        // Step 2b: the XML does not match the official schema (F24)
        return {
          tone: 'bad',
          headline: fill(TEXTS.schemaErrorHeadline, { spec: invoice.specLabel }),
          explanation: [
            ...sourceLines(invoice, inPdf),
            ...hint,
            ...format.german,
            ...rules,
            ...format.technical,
          ],
          invoices: [invoice],
        };
      }
      // F22: missing Pflichtangaben and hints make an e-invoice yellow, as do calculation
      // irregularities (step 3a); G-3: the headline says so
      const pflicht = pflichtLines(invoice);
      const warn = rules.length > 0 || pflicht.length > 0;
      return {
        tone: warn ? 'warn' : 'ok',
        headline: fill(warn ? TEXTS.eRechnungHints : TEXTS.eRechnung, { spec: invoice.specLabel }),
        explanation: [...sourceLines(invoice, inPdf), ...hint, ...pflicht, ...rules],
        invoices: [invoice],
      };
    }
    case 'keineERechnung': {
      // G-7: ZUGFeRD 1.0 is a version, not a profile
      const zugferd1 =
        invoice.part.syntax === 'zugferd1' || invoice.profile.entry?.profile === 'ZUGFeRD 1.0';
      return {
        tone: 'bad',
        headline: zugferd1
          ? inPdf
            ? TEXTS.zugferd1Pdf
            : TEXTS.zugferd1Xml
          : fill(inPdf ? TEXTS.keineERechnungPdf : TEXTS.keineERechnungXml, {
              profile: profileName,
            }),
        explanation: [
          zugferd1 ? TEXTS.zugferd1Reason : TEXTS.minimumReason,
          // F26: with readable dates the sentence by date, else the general one (F23)
          ...transitionLines(transitionFor([invoice]), false),
        ],
        invoices: [invoice],
      };
    }
    case 'nichtBeurteilt':
      return {
        tone: 'warn',
        headline: TEXTS.nichtBeurteilt,
        explanation: [
          invoice.profile.id
            ? fill(TEXTS.unknownSpec, { id: invoice.profile.id })
            : TEXTS.missingSpec,
          TEXTS.shownAnyway,
          ...format.german,
          ...rules,
          TEXTS.kanzleiJudges,
          ...format.technical,
        ],
        invoices: [invoice],
      };
  }
}

function fileProblemVerdict(analysis: Analysis): Verdict | undefined {
  const problem = analysis.problem;
  if (!problem) return undefined;
  const text = TEXTS.fileProblems[problem.kind];
  // G-10: the German sentences first, the engine's message last; a broken XML is a format error
  // whose dates cannot be read (F23: the supplier hint and the general sentence)
  const transition =
    problem.kind === 'xmlBroken' ? transitionLines({ regime: 'unbekannt' }, true) : [];
  return {
    tone: text.tone,
    headline: text.headline,
    explanation: [...text.explanation, ...transition, ...problemLine(problem.problems[0])],
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
  if (verdict.comparison && !verdict.comparison.same) return false;
  return verdict.invoices.some((invoice) => invoice.einordnung === 'eRechnung');
}

export function verdictOf(analysis: Analysis): Verdict {
  const fileProblem = fileProblemVerdict(analysis);
  if (fileProblem) return fileProblem;

  const invoices = analysis.invoices.map(judgeInvoice);
  const [only] = invoices;
  if (invoices.length === 1 && only) return singleVerdict(analysis, only);

  if (invoices.length > 1 && only) {
    const differing = differingTerms(analysis.invoices);
    const names = analysis.invoices.map((p) => p.origin).join(', ');
    // the schema result of every part, never only of the first (cf. L-03)
    const format = formatErrorLines(invoices, true);
    if (differing.length === 0) {
      // F27: the same data twice — one part is shown, with a hint on the standard
      const base = singleVerdict(analysis, only);
      const failed = format.german.length > 0;
      const firstFailed = invoices.find(schemaFailed);
      const eRechnung = only.einordnung === 'eRechnung';
      return {
        tone: failed ? 'bad' : base.tone === 'bad' ? 'bad' : 'warn',
        headline: firstFailed
          ? fill(TEXTS.schemaErrorHeadline, { spec: firstFailed.specLabel })
          : eRechnung
            ? fill(TEXTS.eRechnungHints, { spec: only.specLabel })
            : base.headline,
        explanation: [
          ...(eRechnung ? sourceLines(only, true) : base.explanation),
          ...(eRechnung && only.profile.entry?.hint ? [only.profile.entry.hint] : []),
          fill(TEXTS.sameSeveral, { count: invoices.length, names }),
          ...format.german,
          ...(eRechnung && !failed ? pflichtLines(only) : []),
          ...rulesLines(invoices),
          ...format.technical,
        ],
        invoices,
        comparison: { same: true, differing },
      };
    }
    // F27: different data — a format error: no unambiguous extraction (BMF 15.10.2025 Rn. 6a),
    // and the standard allows one invoice XML per PDF; only the values are compared
    return {
      tone: 'bad',
      headline: TEXTS.contradicting,
      explanation: [
        fill(TEXTS.contradictingWhy, { count: invoices.length, names }),
        TEXTS.oneXmlOnly,
        TEXTS.formatError,
        TEXTS.askSupplier,
        ...transitionLines(transitionFor(invoices), false),
        ...schemaParts(invoices, true).german,
        ...format.technical,
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
        TEXTS.kanzleiJudges,
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
        TEXTS.formatError,
        ...transitionLines({ regime: 'unbekannt' }, true),
        ...problemLine(broken.problems?.[0]),
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
        TEXTS.regimeGeneral,
      ],
      invoices: [],
    };
  }
  return {
    tone: 'bad',
    headline: TEXTS.plainPdf,
    explanation: [TEXTS.plainPdfWhy, TEXTS.regimeGeneral],
    invoices: [],
  };
}
