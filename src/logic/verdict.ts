// The result of step 1 "Erkennen": is it an e-invoice, in which syntax and profile. Always hints,
// never an approval. Texts are data (texts.ts); this file only decides which apply.
import type { Analysis, InvoicePart, Problem } from './analysis';
import { termLabel } from './binding';
import { germanDate, isoDate } from './dates';
import { decimalEquals, formatAmount, parseDecimal } from './decimal';
import { first } from './model';
import type { BtId, InvoiceModel } from './model';
import { checkPflichtangaben } from './check';
import type { RowResult } from './check';
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

/** A part's Pflichtangaben row or rule results as the client reads them, to compare the parts. */
interface Outcome {
  key: string;
  label: string;
  /** Everything the result shows of it: equal signatures, equal results */
  signature: string;
  /** Short, for the line "Unterschiedlich: …" and the comparison table */
  shown: string;
}

const SHOWN_MAX = 120;
const STATUS_TEXT: Readonly<Record<RowResult['status'], string>> = {
  vorhanden: TEXTS.statusVorhanden,
  fehlt: TEXTS.statusFehlt,
  einzelfall: TEXTS.statusEinzelfall,
};

function rowShown(row: RowResult): string {
  const values = row.values.map((v) => v.value).join(', ');
  const hints =
    row.hints.length === 0
      ? ''
      : ` (${row.hints.length === 1 ? TEXTS.differingWithHint : fill(TEXTS.differingWithHints, { count: row.hints.length })})`;
  const text = `${STATUS_TEXT[row.status]}${values ? `: ${values}` : ''}${hints}`;
  return text.length > SHOWN_MAX ? `${text.slice(0, SHOWN_MAX - 1)}…` : text;
}

function rulesShown(rules: RulesResult): string {
  if (rules.auffaellig.length > 0) {
    return `${TEXTS.ruleStatusAuffaellig}: ${rules.auffaellig.join(', ')}`;
  }
  return rules.notChecked > 0
    ? `${TEXTS.ruleStatusPasst}, ${rules.notChecked} ${TEXTS.ruleStatusNichtPruefbar}`
    : TEXTS.ruleStatusPasst;
}

/** What the result shows of one part beside its header: every Pflichtangabe and the rules. */
function outcomesOf(invoice: InvoiceVerdict): Outcome[] {
  const model = pflichtModel(invoice);
  if (!model) return [];
  const rows = checkPflichtangaben(model).rows.map((row) => ({
    key: row.row.id,
    label: row.row.label,
    signature: JSON.stringify([
      row.status,
      row.reason ?? '',
      row.missing,
      row.hints,
      row.values,
      row.groups,
    ]),
    shown: rowShown(row),
  }));
  const rules = rulesOf(invoice);
  return rules
    ? [
        ...rows,
        {
          key: 'rules',
          label: TEXTS.differingRules,
          signature: JSON.stringify(rules.results.map((r) => [r.id, r.occurrence ?? '', r.status])),
          shown: rulesShown(rules),
        },
      ]
    : rows;
}

/**
 * F27: two invoice XML are the same invoice only if the result says the same of each — the
 * compared header values, and also the missing Pflichtangaben, the hints, the values of every row
 * and the rule results (audit QL-01). Not the whole model: the same invoice in UBL and CII differs
 * in documented details (tests/io/extract.test.ts). One item per row or rule that differs.
 */
export function differingResults(
  parts: readonly InvoicePart[],
): { label: string; values: string[] }[] {
  const outcomes = parts.map((part) => {
    const map = new Map<string, Outcome>();
    for (const outcome of outcomesOf(judgeInvoice(part))) map.set(outcome.key, outcome);
    return map;
  });
  const keys = [...new Set(outcomes.flatMap((map) => [...map.keys()]))];
  return keys.flatMap((key) => {
    const each = outcomes.map((map) => map.get(key));
    if (new Set(each.map((o) => o?.signature ?? '')).size === 1) return [];
    const label = each.find((o) => o !== undefined)?.label ?? key;
    return [{ label, values: each.map((o) => o?.shown ?? '–') }];
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
 * so the client sees what differs without scrolling to each part (audit Bedienung, E-04). With
 * the same header the differing Pflichtangaben and rules are named instead (audit QL-01).
 */
export function differingLine(parts: readonly InvoicePart[], differing: readonly BtId[]): string {
  const items =
    differing.length > 0
      ? differing.map((bt) => ({
          label: termLabel(bt),
          values: parts.map((part) => shownValue(part, bt)),
        }))
      : differingResults(parts);
  return fill(TEXTS.differingLine, {
    items: items
      .map((item) =>
        fill(TEXTS.differingItem, { label: item.label, values: item.values.join(' / ') }),
      )
      .join('; '),
  });
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
    // the same header: what differs beside it (audit QL-01)
    ...(differing.size === 0
      ? differingResults(parts).map((item) => ({ ...item, differs: true }))
      : []),
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

/**
 * Schema problems count only where the XML is what counts (not for "keine E-Rechnung", F19) — the
 * result box and the detail row "Schema (XSD)" ask the same (audit QL-09).
 */
export function schemaFailed(invoice: InvoiceVerdict): boolean {
  return invoice.einordnung !== 'keineERechnung' && (invoice.part.schema?.count ?? 0) > 0;
}

/**
 * Step 3a in the forms of the CEN Schematron of the part's syntax (audit QL-03); FeRD EXTENDED has
 * its own forms of the rules (Profile.ownRules).
 */
export function rulesOf(invoice: InvoiceVerdict): RulesResult | undefined {
  const model = pflichtModel(invoice);
  return model
    ? checkRules(model, {
        ownRules: invoice.profile.entry?.ownRules ?? false,
        extended: invoice.part.extended,
        syntax: invoice.part.syntax,
      })
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
    case 'vor2025':
      return [TEXTS.regimeBefore2025];
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
  // the same message of two parts is shown once (audit QL-07)
  return { german, technical: [...new Set(technical)] };
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

/**
 * QL-06: attachments the tool did not read beside an invoice XML — one of them may be a second
 * invoice XML (F27), so the result is at least yellow and names them. An attachment that is no
 * XML or a known other XML was read.
 */
function unreadLines(analysis: Analysis): string[] {
  const named = (template: string, name: string) => fill(template, { name });
  return [
    ...analysis.others.flatMap((o) =>
      o.kind === 'brokenXml'
        ? [named(TEXTS.attachmentBroken, o.origin)]
        : o.kind === 'doctypeXml'
          ? [named(TEXTS.attachmentDoctype, o.origin)]
          : o.kind === 'tooLargeXml'
            ? [named(TEXTS.attachmentTooLarge, o.origin)]
            : [],
    ),
    ...(analysis.pdf?.unreadable ?? []).map((name) => named(TEXTS.attachmentUnreadable, name)),
    ...(analysis.pdf?.truncated ? [TEXTS.attachmentsTruncated] : []),
  ];
}

/** What the verdict of one invoice reads beside the invoice itself. */
interface Context {
  /** Every invoice XML with these data: one, or the same data several times (F27) */
  invoices: InvoiceVerdict[];
  /** F27: "Dieselbe Rechnung ist 2-mal eingebettet …" — after the head lines, before the rest */
  same: string[];
  /** Attachments not read beside them (QL-06): after the German lines, before the technical */
  unread: string[];
}

/**
 * The verdict of one invoice — also of the same data embedded several times (F27): then headline
 * and tone are those of one XML, the schema result of every part is named, each line once
 * (audit QL-07).
 */
function singleVerdict(
  analysis: Analysis,
  invoice: InvoiceVerdict,
  context: Context = { invoices: [invoice], same: [], unread: unreadLines(analysis) },
): Verdict {
  const inPdf = analysis.kind === 'pdf';
  const profileName = invoice.profile.entry?.profile ?? invoice.specLabel;
  // the schema result of every part, never only of the first (cf. L-03)
  const format = formatErrorLines(context.invoices, inPdf);
  // the same data give the same rule results (differingResults), so they are named once
  const rules = rulesLines([invoice]);
  const { same, unread } = context;
  switch (invoice.einordnung) {
    case 'eRechnung': {
      const hint = invoice.profile.entry?.hint ? [invoice.profile.entry.hint] : [];
      if (format.german.length > 0) {
        // Step 2b: the XML does not match the official schema (F24)
        const failed = context.invoices.find(schemaFailed) ?? invoice;
        return {
          tone: 'bad',
          headline: fill(TEXTS.schemaErrorHeadline, { spec: failed.specLabel }),
          explanation: [
            ...sourceLines(invoice, inPdf),
            ...hint,
            ...same,
            ...format.german,
            ...rules,
            ...unread,
            ...format.technical,
          ],
          invoices: [invoice],
        };
      }
      // F22: missing Pflichtangaben and hints make an e-invoice yellow, as do calculation
      // irregularities (step 3a), the same data twice (F27) and attachments not read (QL-06);
      // G-3: the headline says so
      const pflicht = pflichtLines(invoice);
      const warn = [rules, pflicht, same, unread].some((lines) => lines.length > 0);
      return {
        tone: warn ? 'warn' : 'ok',
        headline: fill(warn ? TEXTS.eRechnungHints : TEXTS.eRechnung, { spec: invoice.specLabel }),
        explanation: [
          ...sourceLines(invoice, inPdf),
          ...hint,
          ...same,
          ...pflicht,
          ...rules,
          ...unread,
        ],
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
          ...same,
          ...unread,
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
          ...same,
          ...format.german,
          ...rules,
          ...unread,
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
    const format = formatErrorLines(invoices, true);
    if (differing.length === 0 && differingResults(analysis.invoices).length === 0) {
      // F27: the same data twice — one part is shown, with a hint on the standard
      const same = [fill(TEXTS.sameSeveral, { count: invoices.length, names })];
      return {
        ...singleVerdict(analysis, only, { invoices, same, unread: unreadLines(analysis) }),
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
        ...unreadLines(analysis),
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
  // An XML the tool does not read (DOCTYPE, over its size limit), an attachment it cannot take out
  // of the PDF, or attachments beyond the first 50: not judged — as a single XML with a DOCTYPE,
  // never "Formatfehler" (audit 2026-11-14, U-06) nor "ohne Rechnungsdaten" (audit QL-06).
  const unread = unreadLines(analysis);
  if (unread.length > 0) {
    return {
      tone: 'warn',
      headline: TEXTS.pdfNotChecked,
      explanation: [...unread, TEXTS.notJudged],
      invoices: [],
    };
  }
  const [single, ...more] = analysis.others;
  if (single) {
    // QU-09: the names in quotes, so the list below can see that the result names them (E-08a)
    return {
      tone: 'bad',
      headline: TEXTS.pdfWithoutInvoiceData,
      explanation: [
        more.length === 0
          ? fill(TEXTS.attachmentNoInvoice, { name: single.origin })
          : fill(TEXTS.attachmentsNoInvoice, {
              names: analysis.others.map((o) => `„${o.origin}“`).join(', '),
            }),
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
