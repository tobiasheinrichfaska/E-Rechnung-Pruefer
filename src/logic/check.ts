// Evaluates the Pflichtangaben table (pflichtangaben.ts) against an invoice model: which list of
// minimum content applies, which rows are present, missing or only needed in individual cases,
// and the values to show. Hints only — the summary never says "ordnungsgemäß".
import { allDefinitions, termLabel } from './binding';
import type { TermKind } from './binding';
import { germanDate, isoDate } from './dates';
import { compareDecimal, formatAmount, germanNumber, normalize, parseDecimal } from './decimal';
import { firstValue, groupsOf, valuesOf } from './model';
import type { InvoiceModel, ModelGroup } from './model';
import { ADDRESS_PARTS, MODES, PFLICHTANGABEN } from './pflichtangaben';
import type { Condition, Mode, OccurrenceFilter, Pflichtangabe, Presence } from './pflichtangaben';
import { CATEGORY_LABELS, TEXTS, TYPE_CODES, UNIT_LABELS, fill, keepPercent } from './texts';

export type Status = 'vorhanden' | 'fehlt' | 'einzelfall';

export interface ShownValue {
  label: string;
  value: string;
}

export interface GroupDisplay {
  group: string;
  label: string;
  /** One list of values per occurrence (empty occurrences left out) */
  items: ShownValue[][];
}

export interface RowResult {
  row: Pflichtangabe;
  status: Status;
  /** Why only needed in individual cases */
  reason?: string;
  /** Missing parts, e.g. "Postleitzahl" or "Position 2: Menge" */
  missing: string[];
  /** Possible irregularities of this row (hints, not a status) */
  hints: string[];
  values: ShownValue[];
  groups: GroupDisplay[];
}

export interface PflichtResult {
  mode: Mode;
  modeText?: string;
  rows: RowResult[];
  missingLabels: string[];
  /** The missing rows as the summary names them: a partly present row with its missing parts */
  missingListed: string[];
  /** How many hints the rows carry (F22: they make the result yellow) */
  hintCount: number;
  summary: string;
}

const DEFS = allDefinitions();
const KIND = new Map<string, TermKind>(DEFS.terms.map((t) => [t.bt, t.kind]));
const GROUP_LABEL = new Map<string, string>(DEFS.groups.map((g) => [g.bg, g.label]));

const lastSegment = (path: string) => path.split('/').pop() ?? path;
const POSITION_NUMBER = termLabel('BT-126');
const has = (group: ModelGroup, path: string) => valuesOf(group, path).length > 0;

// --- display ------------------------------------------------------------------------------

/**
 * A value as the client reads it. Numbers by their value, not as written: "7" and "7.00", "1" and
 * "1.0000", "314.86" and "314.860" give the same text, so the same invoice in two XML reads the same
 * (audit R2-L-01); a text that is no number stays as written, an amount, rate or quantity marked
 * „– keine Zahl“ as in the rules (audit R4-U-01, R5-L-02): „336,90“ beside „336,90 EUR“ differed
 * only in „EUR“.
 */
export function displayValue(bt: string, value: string, currency: string | undefined): string {
  const kind = KIND.get(bt);
  if (kind === 'date') {
    const iso = isoDate(value);
    return iso ? germanDate(iso) : value;
  }
  if (kind === 'amount') {
    const amount = parseDecimal(value);
    return amount
      ? `${formatAmount(normalize(amount))}${currency ? ` ${currency}` : ''}`
      : `${value} ${TEXTS.ruleNoNumber}`;
  }
  if (kind === 'percent' || kind === 'quantity') {
    const number = parseDecimal(value);
    // a rate or quantity that is no number as written and marked, as an amount: no „%“ and no
    // comma for its point, which made „7,00“ read „7,00 %“ beside „7 %“ (audit R5-L-02)
    // „7 %“ as written keeps its no-break space, as in the box (collapse in verdict.ts, R6-U-02)
    if (!number) return `${keepPercent(value)} ${TEXTS.ruleNoNumber}`;
    const text = germanNumber(number);
    // a no-break space: „19“ and „%“ never on two lines (audit R3-U-10)
    return kind === 'percent' ? `${text}\u00a0%` : text;
  }
  if (bt === 'BT-118' || bt === 'BT-151' || bt === 'BT-95' || bt === 'BT-102') {
    const label = CATEGORY_LABELS[value.toUpperCase()];
    return label ? `${value} – ${label}` : value;
  }
  if (bt === 'BT-3') {
    const label = TYPE_CODES[value];
    return label ? `${value} – ${label}` : value;
  }
  if (bt === 'BT-130' || bt === 'BT-150') {
    const label = UNIT_LABELS[value.toUpperCase()];
    return label ? `${value} (${label})` : value;
  }
  return value;
}

function shown(group: ModelGroup, paths: string[], currency: string | undefined): ShownValue[] {
  return paths.flatMap((path) =>
    valuesOf(group, path).map((v) => ({
      label: termLabel(lastSegment(path)),
      value: displayValue(lastSegment(path), v.value, currency),
    })),
  );
}

/**
 * The values that a text rule found (e.g. the note with "aufzubewahren"): shown as the row's value,
 * so a row is never "vorhanden" with "nicht in der XML". Values inside a group the row lists per
 * occurrence (`each`) are shown there already.
 */
function textMatches(
  model: InvoiceModel,
  presence: Presence,
  currency: string | undefined,
  skip: (path: string) => boolean,
): ShownValue[] {
  if (presence.kind === 'anyOf' || presence.kind === 'allOf') {
    return presence.of.flatMap((p) => textMatches(model, p, currency, skip));
  }
  if (presence.kind !== 'text') return [];
  const regex = new RegExp(presence.pattern, 'i');
  return presence.paths
    .filter((path) => !skip(path))
    .flatMap((path) =>
      valuesOf(model, path)
        .filter((v) => regex.test(v.value))
        .map((v) => ({
          label: termLabel(lastSegment(path)),
          value: displayValue(lastSegment(path), v.value, currency),
        })),
    );
}

// --- conditions and presence --------------------------------------------------------------

function categories(model: InvoiceModel): string[] {
  return [...valuesOf(model, 'BG-23/BT-118'), ...valuesOf(model, 'BG-25/BG-30/BT-151')].map((v) =>
    v.value.toUpperCase(),
  );
}

function matches(model: InvoiceModel, paths: string[], pattern: string): boolean {
  const regex = new RegExp(pattern, 'i');
  return paths.some((path) => valuesOf(model, path).some((v) => regex.test(v.value)));
}

export function holds(model: InvoiceModel, condition: Condition): boolean {
  switch (condition.kind) {
    case 'categoryIn':
      return categories(model).some((code) => condition.codes.includes(code));
    case 'equals':
      return valuesOf(model, condition.path).some((v) => condition.values.includes(v.value));
    case 'present':
      return has(model, condition.path);
    case 'differ': {
      const a = firstValue(model, condition.a);
      const b = firstValue(model, condition.b);
      return a !== undefined && b !== undefined && a.toUpperCase() !== b.toUpperCase();
    }
    case 'atMost': {
      const value = parseDecimal(firstValue(model, condition.path));
      const limit = parseDecimal(condition.limit);
      if (value === undefined || limit === undefined) return false;
      const compared =
        condition.absolute && value.units < 0n ? { ...value, units: -value.units } : value;
      return compareDecimal(compared, limit) <= 0;
    }
    case 'positive': {
      const zero = { units: 0n, scale: 0 };
      const above = (group: ModelGroup | InvoiceModel, path: string) =>
        valuesOf(group, path).some((v) => {
          const value = parseDecimal(v.value);
          return value !== undefined && compareDecimal(value, zero) > 0;
        });
      if (!condition.group) return above(model, condition.path);
      return groupsOf(model, condition.group)
        .filter((g) => matchesFilter(g, condition.where))
        .some((g) => above(g, condition.path));
    }
    case 'text':
      return matches(model, condition.paths, condition.pattern);
    case 'partial': {
      const filled = groupsOf(model, condition.group).map((group) =>
        condition.paths.some((path) => has(group, path)),
      );
      return filled.includes(true) && filled.includes(false);
    }
    case 'all':
      return condition.of.every((c) => holds(model, c));
    case 'any':
      return condition.of.some((c) => holds(model, c));
    case 'not':
      return !holds(model, condition.of);
  }
}

function occurrenceName(groupId: string, group: ModelGroup, index: number): string {
  if (groupId === 'BG-25') return `Position ${firstValue(group, 'BT-126') ?? index + 1}`;
  return `${GROUP_LABEL.get(groupId) ?? groupId} ${index + 1}`;
}

/** No filter: every occurrence; otherwise its value at the path must be one of the codes. */
function matchesFilter(group: ModelGroup, filter: OccurrenceFilter | undefined): boolean {
  if (!filter) return true;
  return valuesOf(group, filter.path).some((v) => filter.values.includes(v.value.toUpperCase()));
}

/**
 * A missing term as a row names it. BT-110 is read only in the invoice currency (binding), so
 * without BT-5 the amount may be in the XML: then the gap is named as it is, the currency, not the
 * amount (audit R4-L-01). The status stays until F33 decides whether BT-5 is a Pflichtangabe.
 */
function gapName(model: InvoiceModel, path: string): string {
  const bt = lastSegment(path);
  return bt === 'BT-110' && !has(model, 'BT-5') ? TEXTS.taxTotalNoCurrency : termLabel(bt);
}

interface PresenceResult {
  ok: boolean;
  missing: string[];
  /** Some occurrences complete, others not (only for "each") */
  partial?: boolean;
}

export function present(model: InvoiceModel, presence: Presence): PresenceResult {
  switch (presence.kind) {
    case 'any':
      return { ok: presence.paths.some((path) => has(model, path)), missing: [] };
    case 'address': {
      const parts = ADDRESS_PARTS[lastSegment(presence.group)];
      const address = groupsOf(model, presence.group)[0];
      if (!parts) throw new Error(`No address parts for ${presence.group}`);
      if (!address) return { ok: false, missing: [] };
      // F10: any address under which the business can be reached is enough (§ 31 Abs. 2 UStDV,
      // Abschnitt 14.5 Abs. 2 UStAE): a city plus a postcode or a street line; a missing street
      // alone is a hint on the row, not a gap.
      const street = parts.street.some((bt) => has(address, bt));
      const missing = [
        has(address, parts.city) ? undefined : TEXTS.addressCity,
        street || has(address, parts.postcode) ? undefined : TEXTS.addressPostcodeOrStreet,
      ].filter((part): part is string => part !== undefined);
      return { ok: missing.length === 0, missing };
    }
    case 'some': {
      const groups = groupsOf(model, presence.group).filter((g) =>
        matchesFilter(g, presence.where),
      );
      return {
        ok: groups.some((group) => presence.paths.some((path) => has(group, path))),
        missing: [],
      };
    }
    case 'each': {
      const groups = groupsOf(model, presence.group);
      if (groups.length === 0) {
        return {
          ok: false,
          missing: [
            fill(TEXTS.noGroup, {
              group: GROUP_LABEL.get(lastSegment(presence.group)) ?? presence.group,
            }),
          ],
        };
      }
      const perGroup = groups.map((group, index) => {
        if (presence.unless && matchesFilter(group, presence.unless)) return [];
        return presence.paths
          .filter((path) => !has(group, path))
          .map(
            (path) =>
              `${occurrenceName(lastSegment(presence.group), group, index)}: ${termLabel(lastSegment(path))}`,
          );
      });
      const missing = perGroup.flat();
      return {
        ok: missing.length === 0,
        missing,
        partial: missing.length > 0 && perGroup.some((gaps) => gaps.length === 0),
      };
    }
    case 'text':
      return { ok: matches(model, presence.paths, presence.pattern), missing: [] };
    case 'equals':
      return {
        ok: valuesOf(model, presence.path).some((v) => presence.values.includes(v.value)),
        missing: [],
      };
    case 'anyOf': {
      const results = presence.of.map((p) => present(model, p));
      if (results.some((r) => r.ok)) return { ok: true, missing: [] };
      // Name the gaps of the alternative that came closest (e.g. the positions without a date),
      // but only if it was partly met — "no line has a period" says nothing helpful.
      const partial = results
        .filter((r) => r.partial === true)
        .sort((a, b) => a.missing.length - b.missing.length)[0];
      return { ok: false, missing: partial?.missing ?? [] };
    }
    case 'allOf': {
      const results = presence.of.map((p) => present(model, p));
      // A part without own details (one term) is named itself, so the list of gaps is complete
      const missing = results.flatMap((r, i) => {
        const part = presence.of[i];
        if (r.ok) return [];
        if (r.missing.length > 0) return r.missing;
        if (part?.kind === 'any' && part.paths.length === 1 && part.paths[0]) {
          return [gapName(model, part.paths[0])];
        }
        if (part?.kind === 'address')
          return [GROUP_LABEL.get(lastSegment(part.group)) ?? part.group];
        return [];
      });
      return { ok: results.every((r) => r.ok), missing };
    }
  }
}

// --- rows ---------------------------------------------------------------------------------

export function modeOf(model: InvoiceModel): { mode: Mode; text?: string } {
  const found = MODES.find((m) => holds(model, m.when));
  return found ? { mode: found.mode, text: found.text } : { mode: 'regel' };
}

function evaluateRow(model: InvoiceModel, row: Pflichtangabe, mode: Mode): RowResult {
  const currency = firstValue(model, 'BT-5');
  const { ok, missing } = present(model, row.presence);
  const need = row.needs[mode];
  const required = need.kind === 'immer' || (need.kind === 'bedingt' && holds(model, need.when));
  const status: Status = ok ? 'vorhanden' : required ? 'fehlt' : 'einzelfall';
  const groups: GroupDisplay[] = (row.each ?? []).map(({ group, paths, where }) => ({
    group,
    label: GROUP_LABEL.get(lastSegment(group)) ?? group,
    // An occurrence that shows only its own number (e.g. a position without a period) says
    // nothing for this row and is left out.
    items: groupsOf(model, group)
      .filter((occurrence) => matchesFilter(occurrence, where))
      .map((occurrence) => shown(occurrence, paths, currency))
      .filter((items) => items.some((item) => item.label !== POSITION_NUMBER)),
  }));
  const inEach = (path: string) => (row.each ?? []).some((e) => path.startsWith(`${e.group}/`));
  const listed = shown(model, row.show, currency);
  const found = ok
    ? textMatches(model, row.presence, currency, inEach).filter(
        (m) => !listed.some((v) => v.label === m.label && v.value === m.value),
      )
    : [];
  const values = [...listed, ...found];
  return {
    row,
    status,
    ...(status === 'einzelfall' && need.kind !== 'immer' ? { reason: need.because } : {}),
    missing: status === 'fehlt' ? missing : [],
    hints: (row.hints ?? [])
      .filter((hint) => (!hint.modes || hint.modes.includes(mode)) && holds(model, hint.when))
      .map((hint) => hint.text),
    values,
    groups,
  };
}

export function checkPflichtangaben(model: InvoiceModel): PflichtResult {
  const { mode, text } = modeOf(model);
  const issued = isoDate(firstValue(model, 'BT-2'));
  const rows = PFLICHTANGABEN.filter((row) => !row.onlyFor || row.onlyFor.includes(mode))
    // A rule in force only later applies to invoices issued on or after that day (ISO compare)
    .filter((row) => !row.validFrom || (issued !== undefined && issued >= row.validFrom))
    .map((row) => evaluateRow(model, row, mode));
  const missingRows = rows.filter((r) => r.status === 'fehlt');
  const hintCount = rows.reduce((count, r) => count + r.hints.length, 0);
  const missingLabels = missingRows.map((r) => r.row.label);
  // A partly present row names what is missing, not the whole row (audit 2026-11-14, U-02); the
  // result box takes the same list (audit QU-03). A row checked per occurrence has what is there in
  // its groups (e.g. the other positions), not in its values (audit R2-L-04)
  const partlyThere = (r: RowResult) =>
    r.values.length > 0 || r.groups.some((g) => g.items.length > 0);
  const listed = missingRows.map((r) =>
    partlyThere(r) && r.missing.length > 0 && r.missing.length <= 3
      ? `${r.row.label} (${r.missing.length === 1 ? TEXTS.missingPart : TEXTS.missingParts} ${r.missing.join('; ')})`
      : r.row.label,
  );
  return {
    mode,
    ...(text ? { modeText: text } : {}),
    rows,
    missingLabels,
    missingListed: listed,
    hintCount,
    summary:
      missingLabels.length > 0
        ? sentence(fill(TEXTS.missingList, { list: listed.join('; ') }))
        : hintCount === 0
          ? TEXTS.allPresent
          : // F22: the F21 sentence names the hints below (Tobias 2026-11-14)
            `${TEXTS.allPresent} ${hintCount === 1 ? TEXTS.hintBelow : fill(TEXTS.hintsBelow, { count: hintCount })}`,
  };
}

/** One full stop at the end, also when the last label ends with an abbreviation ("USt-IdNr."). */
export function sentence(text: string): string {
  return text.replace(/\.\.$/, '.');
}
