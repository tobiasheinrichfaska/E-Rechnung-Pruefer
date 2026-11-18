// The result of step 1 "Erkennen": is it an e-invoice, in which syntax and profile. Always hints,
// never an approval. Texts are data (texts.ts); this file only decides which apply.
import type { Analysis, InvoicePart, Problem, SchemaResult } from './analysis';
import { termLabel } from './binding';
import { germanDate, isoDate } from './dates';
import { decimalEquals, formatAmount, normalize, parseDecimal } from './decimal';
import { first } from './model';
import type { BtId, InvoiceModel } from './model';
import { checkPflichtangaben } from './check';
import type { RowResult, ShownValue } from './check';
import { profileOf } from './profiles';
import { adviceFor, checkRules } from './rules';
import type { RuleResult, RuleStatus, RulesResult } from './rules';
import type { Einordnung, ProfileMatch } from './profiles';
import { syntaxById } from './syntax';
import { TEXTS, fill, keepPercent } from './texts';
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
  /** Everything the result shows of it, by value and in any order: equal signatures, equal results */
  signature: string;
  /** Short, for the line "Unterschiedlich: …" and the comparison table (rows: see rowShown) */
  shown: string;
  /** Where the short texts agree, what differs is told from these (audit R2-L-02) */
  row?: RowResult;
  rules?: RulesResult;
  /** The terms a Pflichtangabe shows ("BT-1" for „Rechnungsnummer“), none for the rules */
  terms?: readonly string[];
}

const SHOWN_MAX = 120;
const STATUS_TEXT: Readonly<Record<RowResult['status'], string>> = {
  vorhanden: TEXTS.statusVorhanden,
  fehlt: TEXTS.statusFehlt,
  einzelfall: TEXTS.statusEinzelfall,
};
const RULE_STATUS_TEXT: Readonly<Record<RuleStatus, string>> = {
  passt: TEXTS.ruleStatusPasst,
  auffaellig: TEXTS.ruleStatusAuffaellig,
  nichtPruefbar: TEXTS.ruleStatusNichtPruefbar,
};

const shorten = (text: string) =>
  text.length > SHOWN_MAX ? `${text.slice(0, SHOWN_MAX - 1)}…` : text;

/**
 * Whitespace collapsed: two spaces are no other value (audit R3-L-03); the case is kept (G-22).
 * `\s` takes the no-break space too, so the one before „%“ (R3-U-10) is set again after — on every
 * part alike, so what compares equal stays the same (audit R4-L-02).
 */
const collapse = (text: string) => keepPercent(text.replace(/\s+/g, ' '));
const tidyValue = (v: ShownValue): ShownValue => ({ label: v.label, value: collapse(v.value) });
const tidyRow = (row: RowResult): RowResult => ({
  ...row,
  values: row.values.map(tidyValue),
  groups: row.groups.map((g) => ({ ...g, items: g.items.map((item) => item.map(tidyValue)) })),
});

const valueText = (v: ShownValue) => `${v.label}: ${v.value}`;
const itemText = (item: readonly ShownValue[]) => item.map(valueText).join(' · ');

/**
 * A row in short: its values with their names, so the same values in another order or another
 * amount of the row read apart (audit R3-L-04, R3-U-04), and its status only where the parts differ
 * in it ("vorhanden – USt-IdNr. des Lieferanten: DE123456789 / fehlt").
 */
function rowShown(row: RowResult, withStatus: boolean): string {
  const values = row.values.map(valueText).join(', ');
  const status = STATUS_TEXT[row.status];
  const head = withStatus ? (values ? `${status} – ${values}` : status) : values;
  const hints =
    row.hints.length === 0
      ? ''
      : `(${row.hints.length === 1 ? TEXTS.differingWithHint : fill(TEXTS.differingWithHints, { count: row.hints.length })})`;
  return shorten([head, hints].filter((text) => text !== '').join(' '));
}

function rulesShown(rules: RulesResult): string {
  if (rules.auffaellig.length > 0) {
    return `${TEXTS.ruleStatusAuffaellig}: ${rules.auffaellig.join(', ')}`;
  }
  return rules.notChecked > 0
    ? `${TEXTS.ruleStatusPasst}, ${rules.notChecked} ${TEXTS.ruleStatusNichtPruefbar}`
    : TEXTS.ruleStatusPasst;
}

/** A list as a sorted multiset of texts: the same entries in another order compare equal. */
const multiset = (items: readonly unknown[]): string[] =>
  items.map((item) => JSON.stringify(item)).sort();

/**
 * A row as the result shows it, independent of the order of positions, breakdowns and values
 * (audit R2-L-01). The values are already shown by their value (displayValue), so "7" and "7.00"
 * or "1" and "1.0000" agree, and with their whitespace collapsed (tidyRow, audit R3-L-03).
 */
function rowSignature(row: RowResult, withReason = true): string {
  return JSON.stringify([
    row.status,
    withReason ? (row.reason ?? '') : '',
    multiset(row.missing),
    multiset(row.hints),
    multiset(row.values),
    row.groups.map((g) => [g.group, multiset(g.items.map(multiset))]),
  ]);
}

/**
 * The rule results that are not „passt“, in any order: a rule that only one part applies (e.g.
 * BR-CO-11 over a document allowance total of 0.00 that the other part leaves out) passes there,
 * so it says nothing apart (audit R2-L-01).
 */
const ruleEntry = (r: RuleResult) => [r.id, r.occurrence ?? '', r.status];
const notPassing = (rules: RulesResult) =>
  multiset(rules.results.filter((r) => r.status !== 'passt').map(ruleEntry));

/** What the result shows of one part beside its header: every Pflichtangabe and the rules. */
function outcomesOf(invoice: InvoiceVerdict): Outcome[] {
  const model = pflichtModel(invoice);
  if (!model) return [];
  const rows = checkPflichtangaben(model)
    .rows.map(tidyRow)
    .map((row) => ({
      key: row.row.id,
      label: row.row.label,
      signature: rowSignature(row),
      shown: rowShown(row, false),
      row,
      terms: row.row.show.map((path) => path.split('/').pop() ?? path),
    }));
  const rules = rulesOf(invoice);
  return rules
    ? [
        ...rows,
        {
          key: 'rules',
          label: TEXTS.differingRules,
          signature: JSON.stringify(notPassing(rules)),
          shown: rulesShown(rules),
          rules,
        },
      ]
    : rows;
}

/** Per list, what it holds beyond what every list holds (multisets, compared by `key`). */
function beyondCommon<T>(lists: readonly (readonly T[])[], key: (item: T) => string): T[][] {
  const counts = lists.map((list) => {
    const count = new Map<string, number>();
    for (const item of list) count.set(key(item), (count.get(key(item)) ?? 0) + 1);
    return count;
  });
  const common = new Map<string, number>();
  for (const k of new Set(counts.flatMap((c) => [...c.keys()]))) {
    common.set(k, Math.min(...counts.map((c) => c.get(k) ?? 0)));
  }
  return lists.map((list) => {
    const left = new Map(common);
    return [...list]
      .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
      .filter((item) => {
        const k = key(item);
        const shared = left.get(k) ?? 0;
        if (shared === 0) return true;
        left.set(k, shared - 1);
        return false;
      });
  });
}

/**
 * The occurrences (positions, breakdowns) one part has and another has not. Where each part has as
 * many, they are paired and each shows only what differs, after the first value as its anchor:
 * "Positionsnummer: 1 · Menge: 1" / "Positionsnummer: 1 · Menge: 5".
 */
function differingItems(extras: readonly (readonly ShownValue[][])[]): string[][] {
  const [head] = extras;
  const paired = head !== undefined && extras.every((list) => list.length === head.length);
  if (!paired) return extras.map((list) => list.map(itemText));
  return extras.map((list, part) =>
    list.map((item, index) => {
      const pair = extras.map((other) => other[index] ?? []);
      const labels = [...new Set(pair.flatMap((other) => other.map((v) => v.label)))];
      const of = (values: readonly ShownValue[], label: string) =>
        values
          .filter((v) => v.label === label)
          .map((v) => v.value)
          .join(', ');
      const differing = labels.filter((label) => new Set(pair.map((o) => of(o, label))).size > 1);
      const [anchor] = item;
      const own = pair[part] ?? [];
      return [
        ...(anchor && !differing.includes(anchor.label) ? [valueText(anchor)] : []),
        ...differing.map((label) => `${label}: ${of(own, label) || '–'}`),
      ].join(' · ');
    }),
  );
}

/** What differs between the rows of the parts whose short texts agree (audit R2-L-02). */
function rowDetails(rows: readonly (RowResult | undefined)[]): string[] {
  const of = <T>(pick: (row: RowResult) => readonly T[]) => rows.map((r) => (r ? pick(r) : []));
  const values = beyondCommon(
    of((r) => r.values),
    (v) => JSON.stringify(v),
  );
  const missing = beyondCommon(
    of((r) => r.missing),
    (m) => m,
  );
  const hints = beyondCommon(
    of((r) => r.hints),
    (h) => h,
  );
  const groupCount = Math.max(...rows.map((r) => r?.groups.length ?? 0));
  const items = Array.from({ length: groupCount }, (_, g) =>
    differingItems(
      beyondCommon(
        of((r) => r.groups[g]?.items ?? []),
        (item) => JSON.stringify(item),
      ),
    ),
  );
  return rows.map((_, part) => {
    const gaps = missing[part] ?? [];
    return [
      ...(values[part] ?? []).map(valueText),
      ...items.flatMap((group) => group[part] ?? []),
      ...(gaps.length > 0
        ? [`${gaps.length === 1 ? TEXTS.missingPart : TEXTS.missingParts} ${gaps.join('; ')}`]
        : []),
      ...(hints[part] ?? []).map((hint) => `${TEXTS.rowHintLabel} ${hint}`),
    ].join(', ');
  });
}

/** The rule results apart from „passt“ that one part has and the others have not. */
function rulesDetails(results: readonly (RulesResult | undefined)[]): string[] {
  const extras = beyondCommon(
    results.map((r) => (r ? r.results.filter((x) => x.status !== 'passt') : [])),
    (r) => JSON.stringify(ruleEntry(r)),
  );
  return extras.map((list) =>
    list
      .map(
        (r) => `${r.id}${r.occurrence ? ` (${r.occurrence})` : ''}: ${RULE_STATUS_TEXT[r.status]}`,
      )
      .join(', '),
  );
}

/** The header values the Kleinbetrag mode (§ 33 UStDV) depends on, and with it the rows' reasons */
const MODE_TERMS: readonly BtId[] = ['BT-5', 'BT-112'];

/**
 * F27: two invoice XML are the same invoice only if the result says the same of each — the
 * compared header values, and also the missing Pflichtangaben, the hints, the values of every row
 * and the rule results (audit QL-01), each by its value and in any order (audit R2-L-01). Not the
 * whole model: the same invoice in UBL and CII differs in documented details
 * (tests/io/extract.test.ts). One item per row or rule that differs; where its short texts agree,
 * the values that differ are shown instead (audit R2-L-02).
 */
export function differingResults(
  parts: readonly InvoicePart[],
  header: readonly BtId[] = [],
): { label: string; values: string[] }[] {
  // a Pflichtangabe that only shows a header value already named apart says nothing new
  // („Rechnungsnummer“ beside BT-1, audit R5-U-02)
  const mirrors = (o: Outcome | undefined) =>
    o?.terms !== undefined &&
    o.terms.length > 0 &&
    o.terms.every((term) => (header as readonly string[]).includes(term));
  const outcomes = parts.map((part) => {
    const map = new Map<string, Outcome>();
    for (const outcome of outcomesOf(judgeInvoice(part))) map.set(outcome.key, outcome);
    return map;
  });
  const keys = [...new Set(outcomes.flatMap((map) => [...map.keys()]))];
  return mergeSameValues(
    keys.flatMap((key) => {
      const each = outcomes.map((map) => map.get(key));
      if (new Set(each.map((o) => o?.signature ?? '')).size === 1) return [];
      if (each.some(mirrors)) return [];
      const label = each.find((o) => o !== undefined)?.label ?? key;
      // the status is named only where it differs between the parts (audit R3-U-04)
      const rows = each.map((o) => o?.row);
      // only the reason differs (the Kleinbetrag mode in one part only): beside a differing value
      // the mode depends on it says nothing new, else the reason is what the row shows, never
      // „– / –“ (audit R6-L-01)
      if (
        key !== 'rules' &&
        rows.every((r) => r !== undefined) &&
        new Set(rows.map((r) => rowSignature(r, false))).size === 1
      ) {
        if (MODE_TERMS.some((bt) => header.includes(bt))) return [];
        return [{ label, values: rows.map((r) => (r.reason ? shorten(r.reason) : '–')) }];
      }
      if (key !== 'rules' && new Set(rows.map((r) => r?.status ?? '')).size > 1) {
        return [{ label, values: rows.map((r) => (r ? rowShown(r, true) : '–')) }];
      }
      const shown = each.map((o) => o?.shown ?? '–');
      if (new Set(shown).size > 1 && !shown.includes('')) return [{ label, values: shown }];
      const details = key === 'rules' ? rulesDetails(each.map((o) => o?.rules)) : rowDetails(rows);
      return [{ label, values: details.map((text) => (text ? shorten(text) : '–')) }];
    }),
  );
}

/**
 * Rows that differ in the same values are named once, all their labels together: three
 * Pflichtangaben showing one VAT breakdown name one differing rate once (audit R3-U-03).
 */
function mergeSameValues(
  items: readonly { label: string; values: string[] }[],
): { label: string; values: string[] }[] {
  const merged = new Map<string, { labels: string[]; values: string[] }>();
  for (const item of items) {
    const key = JSON.stringify(item.values);
    const found = merged.get(key);
    if (found) found.labels.push(item.label);
    else merged.set(key, { labels: [item.label], values: item.values });
  }
  return [...merged.values()].map(({ labels, values }) => ({ label: labelList(labels), values }));
}

/** One label as it is; several in quotes, as their own labels hold commas and „und“ */
const labelList = (labels: readonly string[]): string =>
  labels.length === 1 ? (labels[0] ?? '') : quotedNames(labels);

/**
 * A compared value as the client reads it: German date, the amount by its value ("336.900" as
 * "336,90", audit R3-U-05) and one that is no number marked ("336,90 – keine Zahl", audit
 * R3-L-04), "–" when missing.
 */
function shownValue(part: InvoicePart, bt: BtId): string {
  const value = first(part.header, bt)?.trim() ?? '';
  if (value === '') return '–';
  if (bt === 'BT-2') {
    const iso = isoDate(value);
    return iso ? germanDate(iso) : value;
  }
  if (bt === 'BT-112') {
    const amount = parseDecimal(value);
    return amount ? formatAmount(normalize(amount)) : `${value} ${TEXTS.ruleNoNumber}`;
  }
  return value;
}

/**
 * "Unterschiedlich: Rechnungsnummer (PRG1502112 / PRG1502113)." — with the values of every part,
 * so the client sees what differs without scrolling to each part (audit Bedienung, E-04). With
 * the same header the differing Pflichtangaben and rules are named instead (audit QL-01). Beside a
 * differing header value they are only counted, in one sentence that points to the comparison
 * table, where they stand (audit R5-U-02): two different invoices differ in a dozen rows.
 */
export function differingLine(parts: readonly InvoicePart[], differing: readonly BtId[]): string {
  const items =
    differing.length > 0
      ? differing.map((bt) => ({
          label: termLabel(bt),
          values: parts.map((part) => shownValue(part, bt)),
        }))
      : differingResults(parts);
  const line = fill(TEXTS.differingLine, {
    items: items
      .map((item) =>
        fill(TEXTS.differingItem, { label: item.label, values: item.values.join(' / ') }),
      )
      .join('; '),
  });
  if (differing.length === 0) return line;
  const more = differingResults(parts, differing).length;
  if (more === 0) return line;
  return `${line} ${more === 1 ? TEXTS.differingMoreOne : fill(TEXTS.differingMore, { count: more })}`;
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
    // what differs beside the header (audit QL-01), also beside a differing header value, without
    // the Pflichtangaben that only repeat it (audit R5-U-02)
    ...differingResults(parts, [...differing]).map((item) => ({ ...item, differs: true })),
  ];
}

/**
 * "Technische Meldung (Zeile 4): …" — the parser's or the schema's own (English) message; with
 * `name` the attachment it belongs to, where several parts have other messages (audit R4-U-02).
 */
export function technicalLine(problem: Problem, name?: string): string {
  if (name !== undefined) {
    return problem.line
      ? fill(TEXTS.problemAtLineIn, { name, line: problem.line, message: problem.message })
      : fill(TEXTS.problemMessageIn, { name, message: problem.message });
  }
  return problem.line
    ? fill(TEXTS.problemAtLine, { line: problem.line, message: problem.message })
    : fill(TEXTS.problemMessage, { message: problem.message });
}

/** The German prefix of a technical line, as a pattern ("Technische Meldung (Zeile 4): "). */
const TECHNICAL = [
  TEXTS.problemAtLineIn,
  TEXTS.problemMessageIn,
  TEXTS.problemAtLine,
  TEXTS.problemMessage,
].map((template) => {
  const [prefix = ''] = template.split('{message}');
  const pattern = prefix
    .replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
    .replace('\\{line\\}', '\\d+')
    .replace('\\{name\\}', '.+?');
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
 * its own forms of the rules (Profile.ownRules), XRechnung UBL with Extension BR-DEX-09 in place of
 * BR-CO-16 (Profile.thirdPartyPayments, audit R5-L-01).
 */
export function rulesOf(invoice: InvoiceVerdict): RulesResult | undefined {
  const model = pflichtModel(invoice);
  return model
    ? checkRules(model, {
        ownRules: invoice.profile.entry?.ownRules ?? false,
        extended: invoice.part.extended,
        thirdPartyPayments: invoice.part.thirdPartyPayments,
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
          // the missing parts of a partly present row, as the section names them (audit QU-03)
          fill(TEXTS.pflichtMissingLine, { list: result.missingListed.join('; ') }),
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

/** The engine's messages of one part as the result box shows them: the first three, then a count */
function technicalLines(schema: SchemaResult, name?: string): string[] {
  const shown = schema.problems.slice(0, SCHEMA_LINES);
  const more = schema.count - shown.length;
  return [
    ...shown.map((problem) => technicalLine(problem, name)),
    ...(more > 0
      ? [
          name === undefined
            ? fill(TEXTS.schemaMore, { count: more })
            : fill(TEXTS.schemaMoreIn, { name, count: more }),
        ]
      : []),
  ];
}

/** The German sentence of a schema mismatch, and the engine's messages (G-10: shown last). */
function schemaParts(
  invoices: readonly InvoiceVerdict[],
  inPdf: boolean,
): { german: string[]; technical: string[] } {
  const failed = invoices.filter((invoice) => invoice.part.schema && schemaFailed(invoice));
  // Parts with other messages: each line names its attachment, else „Zeile 8“ belongs to none
  // (audit R4-U-02); the same messages of two parts are shown once (audit QL-07)
  const named =
    new Set(
      failed.map((invoice) =>
        JSON.stringify(invoice.part.schema ? technicalLines(invoice.part.schema) : []),
      ),
    ).size > 1;
  const german: string[] = [];
  const technical: string[] = [];
  for (const invoice of failed) {
    const schema = invoice.part.schema;
    if (!schema) continue;
    german.push(
      fill(inPdf ? TEXTS.schemaMismatchIn : TEXTS.schemaMismatch, {
        name: invoice.part.origin,
        schema: schema.schema,
        count: schema.count,
      }),
    );
    technical.push(...technicalLines(schema, named ? invoice.part.origin : undefined));
  }
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

/** „„a.xml“ und „b.xml““ — the names of several attachments, in quotes */
export function quotedNames(names: readonly string[]): string {
  const quoted = names.map((name) => `„${name}“`);
  return quoted.length < 2
    ? (quoted[0] ?? '')
    : `${quoted.slice(0, -1).join(', ')}${TEXTS.labelsAnd}${quoted.at(-1) ?? ''}`;
}

/** Where the data come from: with the same data in several parts, each of them (R3-U-09, G-8) */
function sourceLines(invoices: readonly InvoiceVerdict[], inPdf: boolean): string[] {
  if (!inPdf) return [TEXTS.xmlFile];
  const [only, ...more] = invoices;
  return [
    more.length === 0
      ? fill(TEXTS.hybridSource, { name: only?.part.origin ?? '' })
      : fill(TEXTS.hybridSourceSeveral, { names: quotedNames(invoices.map((i) => i.part.origin)) }),
    TEXTS.xmlCounts,
  ];
}

/**
 * QL-06: attachments the tool did not read beside an invoice XML — one of them may be a second
 * invoice XML (F27), so the result is at least yellow and names them. An attachment that is no
 * XML or a known other XML was read. `beside`: an invoice XML was read, and a sentence says what
 * that means for it (audit R2-U-08); without one the caller says that nothing is judged.
 */
function unreadLines(analysis: Analysis, beside: boolean): string[] {
  const named = (template: string, name: string) => fill(template, { name });
  const attachments = [
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
  ];
  const truncated = analysis.pdf?.truncated ? [TEXTS.attachmentsTruncated] : [];
  const lines = [...attachments, ...truncated];
  if (!beside || lines.length === 0) return lines;
  const one = attachments.length === 1 && truncated.length === 0;
  return [...lines, one ? TEXTS.unreadOne : TEXTS.unreadSeveral];
}

/** What the verdict of one invoice reads beside the invoice itself. */
interface Context {
  /** Every invoice XML with these data: one, or the same data several times (F27) */
  invoices: InvoiceVerdict[];
  /** F27: "Dieselbe Rechnung ist 2-mal eingebettet …" — after the head lines, before the rest */
  same: string[];
}

/**
 * The verdict of one invoice — also of the same data embedded several times (F27): then headline
 * and tone are those of one XML, the schema result of every part is named, each line once
 * (audit QL-07).
 */
function singleVerdict(
  analysis: Analysis,
  invoice: InvoiceVerdict,
  context: Context = { invoices: [invoice], same: [] },
): Verdict {
  const inPdf = analysis.kind === 'pdf';
  const profileName = invoice.profile.entry?.profile ?? invoice.specLabel;
  // the schema result of every part, never only of the first (cf. L-03)
  const format = formatErrorLines(context.invoices, inPdf);
  // the same data give the same rule results (differingResults), so they are named once
  const rules = rulesLines([invoice]);
  const { same } = context;
  // attachments not read beside it (QL-06): after the German lines, before the technical ones
  const unread = unreadLines(analysis, true);
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
            ...sourceLines(context.invoices, inPdf),
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
          ...sourceLines(context.invoices, inPdf),
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
    // the names in quotes, as everywhere else (audit R2-U-09)
    const names = analysis.invoices.map((p) => `„${p.origin}“`).join(', ');
    const format = formatErrorLines(invoices, true);
    if (differing.length === 0 && differingResults(analysis.invoices).length === 0) {
      // F27: the same data twice — one part is shown, with a hint on the standard
      const same = [fill(TEXTS.sameSeveral, { count: invoices.length, names })];
      return {
        ...singleVerdict(analysis, only, { invoices, same }),
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
        ...unreadLines(analysis, true),
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
        TEXTS.otherFormats,
        TEXTS.kanzleiJudges,
        ...(analysis.root
          ? [
              fill(TEXTS.rootIs, {
                name: analysis.root.name,
                namespace: analysis.root.namespace || '–',
              }),
            ]
          : []),
      ],
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
  const unread = unreadLines(analysis, false);
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
