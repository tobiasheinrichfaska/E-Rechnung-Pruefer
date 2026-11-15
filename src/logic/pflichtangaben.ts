// The Pflichtangaben of an invoice as data: what the law asks for, where it sits in EN 16931 and
// how the tool decides "vorhanden". Assignment to BT/BG after KoSIT/FeRD „Empfehlungen zu
// Pflichtangaben in einer E-Rechnung, Teil I“ (Stand 25.07.2025, page in `source`), wording of the
// law from gesetze-im-internet.de (13.11.2026). Tax decisions are Tobias' (docs/offene-fragen.md).

/** Which list of minimum content applies. */
export type Mode = 'regel' | 'kleinbetrag' | 'kleinunternehmer';

/** How much a mode asks for a row. */
export type Need =
  | { kind: 'immer' }
  /** only when the condition holds; otherwise "nur im Einzelfall nötig" */
  | { kind: 'bedingt'; when: Condition; because: string }
  /** the tool cannot tell from the data whether the case applies */
  | { kind: 'einzelfall'; because: string }
  /** this list of minimum content does not ask for it */
  | { kind: 'nicht'; because: string };

/** Occurrences of a repeated group whose value at `path` is one of `values` (e.g. BT-118 = AE). */
export interface OccurrenceFilter {
  path: string;
  values: string[];
}

export type Presence =
  | { kind: 'any'; paths: string[] }
  | { kind: 'address'; group: string }
  /** every occurrence of `group` (at least one) has a value at every relative path */
  | { kind: 'each'; group: string; paths: string[]; unless?: OccurrenceFilter }
  /** at least one occurrence of `group` (only those matching `where`) has a value at a path */
  | { kind: 'some'; group: string; paths: string[]; where?: OccurrenceFilter }
  /** a value matches the pattern (case-insensitive) at one of the paths */
  | { kind: 'text'; paths: string[]; pattern: string }
  | { kind: 'equals'; path: string; values: string[] }
  | { kind: 'anyOf'; of: Presence[] }
  | { kind: 'allOf'; of: Presence[] };

export type Condition =
  | { kind: 'categoryIn'; codes: string[] }
  | { kind: 'equals'; path: string; values: string[] }
  | { kind: 'present'; path: string }
  | { kind: 'differ'; a: string; b: string }
  /** the first value at `path` is at most `limit`; `absolute`: its amount, sign ignored (F16) */
  | { kind: 'atMost'; path: string; limit: string; absolute?: boolean }
  /** a value at `path` is greater than 0 — in the occurrences of `group` matching `where` */
  | { kind: 'positive'; path: string; group?: string; where?: OccurrenceFilter }
  | { kind: 'text'; paths: string[]; pattern: string }
  /** some occurrences of `group` have a value at one of the paths, others have none */
  | { kind: 'partial'; group: string; paths: string[] }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition };

/** A possible irregularity shown with a row when its condition holds (never a status). */
export interface Hint {
  when: Condition;
  text: string;
  /** Only in these modes, e.g. a hint on a duty that a Kleinbetragsrechnung does not have */
  modes?: Mode[];
}

export interface Pflichtangabe {
  id: string;
  /** Where the law asks for it, per mode where it differs */
  norm: string;
  label: string;
  section: 'paragraph14' | 'besondere';
  /** Terms shown with their values (paths into the model) */
  show: string[];
  /** Per occurrence of a repeated group (positions, VAT breakdown …): what each shows */
  each?: { group: string; paths: string[]; where?: OccurrenceFilter }[];
  presence: Presence;
  needs: Record<Mode, Need>;
  /** Shown only in these modes (rows that exist for a special list of minimum content) */
  onlyFor?: Mode[];
  /** Law in force only from this day (ISO): shown for invoices issued (BT-2) on or after it */
  validFrom?: string;
  /** Possible irregularities shown with the row when their condition holds (never a status) */
  hints?: Hint[];
  /** Where the KoSIT/FeRD recommendation or the law names it */
  source: string;
}

/** Address parts per address group: street-like lines, postcode, city (country is shown only). */
export const ADDRESS_PARTS: Readonly<
  Record<string, { street: string[]; postcode: string; city: string }>
> = {
  'BG-5': { street: ['BT-35', 'BT-36', 'BT-162'], postcode: 'BT-38', city: 'BT-37' },
  'BG-8': { street: ['BT-50', 'BT-51', 'BT-163'], postcode: 'BT-53', city: 'BT-52' },
  'BG-12': { street: ['BT-64', 'BT-65', 'BT-164'], postcode: 'BT-67', city: 'BT-66' },
  'BG-15': { street: ['BT-75', 'BT-76', 'BT-165'], postcode: 'BT-78', city: 'BT-77' },
};

const NOTES = ['BG-1/BT-22'];
const EXEMPTION_TEXT = ['BG-23/BT-120', 'BG-23/BT-121', ...NOTES];
const REASON = ['BT-120', 'BT-121'];
// An exemption reason belongs to its VAT category: the AE reason is the § 13b note, not an
// exemption, and an O/E reason is no § 13b note (KoSIT 01.04a, 01.21a).
const EXEMPT: OccurrenceFilter = { path: 'BT-118', values: ['E', 'K', 'G', 'O'] };
const REVERSE: OccurrenceFilter = { path: 'BT-118', values: ['AE'] };
const EXEMPTION_WORDS =
  'steuerfrei|steuerbefrei|befreit|befreiung|§\\s*4\\s*nr|nicht steuerbar|nicht im inland steuerbar|innergemeinschaftlich|ausfuhr|vatex';
/** § 19 UStG or the word Kleinunternehmer — "§ 195 BGB" is no hint (audit 2026-11-14, L-02). */
const SECTION_19 = '§\\s*19(?!\\d)|kleinunternehmer';
/** The invoice shows VAT: category S with a rate above 0 or a VAT total above 0. */
const TAX_SHOWN: Condition = {
  kind: 'any',
  of: [
    { kind: 'positive', path: 'BG-22/BT-110' },
    { kind: 'positive', group: 'BG-23', path: 'BT-119', where: { path: 'BT-118', values: ['S'] } },
  ],
};
/** F18 (Tobias 2026-11-14): a Kleinunternehmer note on an invoice that shows VAT. */
const KU_WITH_TAX_HINT =
  'Die Rechnung nennt die Kleinunternehmerregelung (§ 19 UStG), weist aber Umsatzsteuer aus. Das passt nicht zusammen (unberechtigter Steuerausweis, § 14c UStG). Das Tool prüft deshalb die vollen Pflichtangaben. Bitte klären Sie das mit dem Lieferanten.';
/** Words of a hint on an agreed reduction (Abschnitt 14.5 Abs. 19 UStAE: Boni, Skonti, Rabatte). */
const REDUCTION_WORDS =
  'skonto|rabatt|bonus|boni\\b|entgeltminderung|nachlass|rückvergütung|konditionsvereinbarung';
/**
 * F20 (Tobias 2026-11-14): a negated mention ("ohne Skonto", "Kein Abzug von Skonto") is no hint on
 * a reduction — "ohne", "kein…" or "nicht" up to two words before the keyword.
 */
const REDUCTION_HINT = `(?<!\\b(?:ohne|kein\\w*|nicht)\\s+(?:\\S+\\s+){0,2})(?:${REDUCTION_WORDS})`;
const IMMER: Need = { kind: 'immer' };
const NICHT_KB: Need = {
  kind: 'nicht',
  because: 'Bei einer Kleinbetragsrechnung bis 250 Euro nicht vorgeschrieben (§ 33 UStDV).',
};
const NICHT_KU: Need = {
  kind: 'nicht',
  because: 'Bei einer Rechnung eines Kleinunternehmers nicht vorgeschrieben (§ 34a UStDV).',
};

export const SMALL_AMOUNT_LIMIT = '250';

/** A note like "Leistungsdatum entspricht Rechnungsdatum" (F15: not enough in an e-invoice). */
const SAME_DATE_NOTE =
  '(leistungs|liefer)(datum|zeitpunkt|tag)[^.\\n]{0,40}(entspricht|gleich|=|identisch)[^.\\n]{0,25}rechnungsdatum|rechnungsdatum[^.\\n]{0,25}(entspricht|gleich|=|identisch)[^.\\n]{0,25}(leistungs|liefer)(datum|zeitpunkt|tag)';

/** Every place a time of supply can sit in the structured data. */
const NO_DATE_AT_ALL = [
  'BG-13/BT-72',
  'BG-14/BT-73',
  'BG-14/BT-74',
  'BG-25/BG-26/BT-134',
  'BG-25/BG-26/BT-135',
];

/**
 * F10 (Tobias 2026-11-13, research): any address under which the business can be reached is
 * enough, also a P.O. box or a Großkundenadresse — so a missing street is a hint, not a gap.
 * `modes`: only where the address is required at all (audit QL-08, as L-06 for the F15 hint).
 */
function noStreetHint(
  group: string,
  street: string[],
  city: string,
  postcode: string,
  who: string,
  modes?: Mode[],
): Hint {
  return {
    ...(modes ? { modes } : {}),
    when: {
      kind: 'all',
      of: [
        // with city and postcode the address is complete (F10); without a postcode the row says
        // "fehlt" and the hint would contradict it (audit 2026-11-14, L-06)
        { kind: 'present', path: `${group}/${city}` },
        { kind: 'present', path: `${group}/${postcode}` },
        ...street.map((bt): Condition => ({
          kind: 'not',
          of: { kind: 'present', path: `${group}/${bt}` },
        })),
      ],
    },
    text: `Ohne Straße oder Postfach. Das genügt, wenn ${who} unter dieser Anschrift erreichbar ist (z. B. eine Großkundenadresse; § 31 Abs. 2 UStDV, Abschnitt 14.5 Abs. 2 UStAE).`,
  };
}

/**
 * § 14 Abs. 4 Satz 1 Nr. 8 UStG: rate and tax amount for taxable supplies; for exempt or not
 * taxable ones (E, AE, K, G, O) a hint is enough (§ 14a Abs. 5 Satz 2 for AE). Without any VAT
 * breakdown the tool cannot tell and asks for both.
 */
const TAXABLE: Condition = {
  kind: 'any',
  of: [
    { kind: 'categoryIn', codes: ['S', 'Z', 'L', 'M'] },
    { kind: 'not', of: { kind: 'present', path: 'BG-23/BT-118' } },
  ],
};
const TAXABLE_BECAUSE =
  'Nur nötig bei steuerpflichtigen Umsätzen; bei einer Steuerbefreiung genügt ein Hinweis.';

export const PFLICHTANGABEN: readonly Pflichtangabe[] = [
  {
    id: 'name-leistender',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 1 UStG',
    label: 'Name des leistenden Unternehmers',
    section: 'paragraph14',
    show: ['BG-4/BT-27', 'BG-4/BT-28'],
    presence: { kind: 'any', paths: ['BG-4/BT-27', 'BG-4/BT-28'] },
    needs: { regel: IMMER, kleinbetrag: IMMER, kleinunternehmer: IMMER },
    source: 'KoSIT/FeRD S. 2: BG-4, BT-27, BT-28',
  },
  {
    id: 'anschrift-leistender',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 1 UStG',
    label: 'Anschrift des leistenden Unternehmers',
    section: 'paragraph14',
    show: [
      'BG-4/BG-5/BT-35',
      'BG-4/BG-5/BT-36',
      'BG-4/BG-5/BT-162',
      'BG-4/BG-5/BT-38',
      'BG-4/BG-5/BT-37',
      'BG-4/BG-5/BT-39',
      'BG-4/BG-5/BT-40',
    ],
    presence: { kind: 'address', group: 'BG-4/BG-5' },
    needs: { regel: IMMER, kleinbetrag: IMMER, kleinunternehmer: IMMER },
    hints: [
      noStreetHint('BG-4/BG-5', ['BT-35', 'BT-36', 'BT-162'], 'BT-37', 'BT-38', 'der Unternehmer'),
    ],
    source:
      'KoSIT/FeRD S. 2: BG-5, BT-35 – BT-40, BT-162; § 31 Abs. 2 UStDV, Abschnitt 14.5 Abs. 2 UStAE (F10)',
  },
  {
    id: 'name-empfaenger',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 1 UStG',
    label: 'Name des Leistungsempfängers',
    section: 'paragraph14',
    show: ['BG-7/BT-44', 'BG-7/BT-45'],
    presence: { kind: 'any', paths: ['BG-7/BT-44', 'BG-7/BT-45'] },
    needs: { regel: IMMER, kleinbetrag: NICHT_KB, kleinunternehmer: IMMER },
    source: 'KoSIT/FeRD S. 2: BG-7, BT-44, BT-45',
  },
  {
    id: 'anschrift-empfaenger',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 1 UStG',
    label: 'Anschrift des Leistungsempfängers',
    section: 'paragraph14',
    show: [
      'BG-7/BG-8/BT-50',
      'BG-7/BG-8/BT-51',
      'BG-7/BG-8/BT-163',
      'BG-7/BG-8/BT-53',
      'BG-7/BG-8/BT-52',
      'BG-7/BG-8/BT-54',
      'BG-7/BG-8/BT-55',
    ],
    presence: { kind: 'address', group: 'BG-7/BG-8' },
    needs: { regel: IMMER, kleinbetrag: NICHT_KB, kleinunternehmer: IMMER },
    hints: [
      noStreetHint(
        'BG-7/BG-8',
        ['BT-50', 'BT-51', 'BT-163'],
        'BT-52',
        'BT-53',
        'der Leistungsempfänger',
        // § 33 UStDV does not ask for the recipient's address (NICHT_KB)
        ['regel', 'kleinunternehmer'],
      ),
    ],
    source:
      'KoSIT/FeRD S. 2: BG-8, BT-50 – BT-55, BT-163; § 31 Abs. 2 UStDV, Abschnitt 14.5 Abs. 2 UStAE (F10)',
  },
  {
    id: 'steuernummer',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 2 UStG',
    label: 'Steuernummer oder USt-IdNr. des leistenden Unternehmers',
    section: 'paragraph14',
    show: ['BG-4/BT-31', 'BG-4/BT-32'],
    presence: { kind: 'any', paths: ['BG-4/BT-31', 'BG-4/BT-32'] },
    needs: { regel: IMMER, kleinbetrag: NICHT_KB, kleinunternehmer: IMMER },
    source: 'KoSIT/FeRD S. 2: BT-31 oder BT-32',
  },
  {
    id: 'ausstellungsdatum',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 3 UStG',
    label: 'Ausstellungsdatum',
    section: 'paragraph14',
    show: ['BT-2'],
    presence: { kind: 'any', paths: ['BT-2'] },
    needs: { regel: IMMER, kleinbetrag: IMMER, kleinunternehmer: IMMER },
    source: 'KoSIT/FeRD S. 3: BT-2',
  },
  {
    id: 'rechnungsnummer',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 4 UStG',
    label: 'Rechnungsnummer',
    section: 'paragraph14',
    show: ['BT-1'],
    presence: { kind: 'any', paths: ['BT-1'] },
    needs: { regel: IMMER, kleinbetrag: NICHT_KB, kleinunternehmer: NICHT_KU },
    source: 'KoSIT/FeRD S. 3: BT-1',
  },
  {
    id: 'menge-art',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 5 UStG',
    label: 'Menge und Art der Lieferung oder Umfang und Art der Leistung',
    section: 'paragraph14',
    show: [],
    each: [
      { group: 'BG-25', paths: ['BT-126', 'BT-129', 'BT-130', 'BG-31/BT-153', 'BG-31/BT-154'] },
    ],
    presence: { kind: 'each', group: 'BG-25', paths: ['BT-129', 'BG-31/BT-153'] },
    needs: { regel: IMMER, kleinbetrag: IMMER, kleinunternehmer: IMMER },
    source: 'KoSIT/FeRD S. 3: BG-25, BT-129, BG-31',
  },
  {
    id: 'leistungszeitpunkt',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 6 UStG, § 31 Abs. 4 UStDV',
    label: 'Zeitpunkt der Lieferung oder Leistung (Kalendermonat genügt)',
    section: 'paragraph14',
    show: ['BG-13/BT-72', 'BG-14/BT-73', 'BG-14/BT-74'],
    each: [{ group: 'BG-25', paths: ['BT-126', 'BG-26/BT-134', 'BG-26/BT-135'] }],
    presence: {
      kind: 'anyOf',
      of: [
        { kind: 'any', paths: ['BG-13/BT-72', 'BG-14/BT-73', 'BG-14/BT-74'] },
        // Tobias 2026-11-13 (F12): periods on some positions count; positions without one get a
        // hint (a Nebenleistung shares the time of the Hauptleistung, Abschnitt 3.10 Abs. 5 UStAE)
        { kind: 'some', group: 'BG-25', paths: ['BG-26/BT-134', 'BG-26/BT-135'] },
        // Tobias 2026-11-13 (F15, replaces F3): a note "Leistungsdatum = Rechnungsdatum" does NOT
        // count in an e-invoice (Abschnitt 14.5 Abs. 16 Sätze 3–4 UStAE) — it only gets a hint.
      ],
    },
    needs: { regel: IMMER, kleinbetrag: NICHT_KB, kleinunternehmer: NICHT_KU },
    hints: [
      {
        when: {
          kind: 'all',
          of: [
            { kind: 'text', paths: NOTES, pattern: SAME_DATE_NOTE },
            ...NO_DATE_AT_ALL.map((path): Condition => ({
              kind: 'not',
              of: { kind: 'present', path },
            })),
          ],
        },
        text: 'Die Rechnung nennt den Leistungszeitpunkt nur als Vermerk („Leistungsdatum entspricht Rechnungsdatum“). Das genügt nur bei sonstigen Rechnungen; in einer E-Rechnung muss die Angabe im strukturierten Datenformat stehen (Abschnitt 14.5 Abs. 16 Sätze 3–4 UStAE).',
        // §§ 33, 34a UStDV do not require the date at all (audit 2026-11-14, L-06)
        modes: ['regel'],
      },
      {
        when: {
          kind: 'all',
          of: [
            { kind: 'not', of: { kind: 'present', path: 'BG-13/BT-72' } },
            { kind: 'not', of: { kind: 'present', path: 'BG-14/BT-73' } },
            { kind: 'not', of: { kind: 'present', path: 'BG-14/BT-74' } },
            { kind: 'partial', group: 'BG-25', paths: ['BG-26/BT-134', 'BG-26/BT-135'] },
          ],
        },
        modes: ['regel'],
        text: 'Nicht jede Position hat einen eigenen Leistungszeitraum, und die Rechnung nennt keinen gemeinsamen Leistungszeitpunkt. Eine Nebenleistung (z. B. Porto oder Versand) wird umsatzsteuerlich wie die Hauptleistung behandelt (Abschnitt 3.10 Abs. 5 UStAE). Bitte prüfen Sie, ob die Positionen ohne Zeitraum solche Nebenleistungen sind.',
      },
    ],
    source: 'KoSIT/FeRD S. 3–4: BT-72, BG-14, BG-26',
  },
  {
    id: 'ist-versteuerung',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 6a UStG (ab 01.01.2028, Art. 27 JStG 2024)',
    label: 'Angabe „Versteuerung nach vereinnahmten Entgelten“',
    section: 'paragraph14',
    show: [],
    validFrom: '2028-01-01',
    presence: { kind: 'text', paths: NOTES, pattern: 'vereinnahmten? entgelte' },
    needs: {
      regel: {
        kind: 'einzelfall',
        because:
          'Nur nötig, wenn der leistende Unternehmer die Steuer nach vereinnahmten Entgelten berechnet (§ 20 UStG).',
      },
      kleinbetrag: {
        kind: 'einzelfall',
        because:
          'Nur nötig, wenn der leistende Unternehmer die Steuer nach vereinnahmten Entgelten berechnet (§ 33 Satz 1 Nr. 3a UStDV ab 01.01.2028).',
      },
      kleinunternehmer: NICHT_KU,
    },
    source:
      'KoSIT/FeRD S. 4: BG-1 (BT-7, BT-8); BGBl. 2024 I Nr. 387 Art. 27 Nr. 1, Art. 56 Abs. 12 (F7)',
  },
  {
    id: 'vereinnahmung',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 6, Abs. 5 Satz 1 UStG',
    label: 'Zeitpunkt der Vereinnahmung (Anzahlung vor Ausstellung der Rechnung)',
    section: 'paragraph14',
    show: ['BT-7'],
    presence: { kind: 'any', paths: ['BT-7'] },
    needs: {
      regel: {
        kind: 'einzelfall',
        because: 'Nur nötig, wenn das Entgelt vor dem Ausstellungsdatum vereinnahmt wurde.',
      },
      kleinbetrag: NICHT_KB,
      kleinunternehmer: NICHT_KU,
    },
    source: 'KoSIT/FeRD S. 4: BT-7',
  },
  {
    id: 'entgelt-aufgeschluesselt',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 7 UStG',
    label: 'Entgelt, aufgeschlüsselt nach Steuersätzen und Steuerbefreiungen',
    section: 'paragraph14',
    show: ['BG-22/BT-109'],
    each: [{ group: 'BG-23', paths: ['BT-118', 'BT-119', 'BT-116'] }],
    presence: { kind: 'each', group: 'BG-23', paths: ['BT-116', 'BT-118'] },
    needs: {
      regel: IMMER,
      kleinbetrag: {
        kind: 'nicht',
        because:
          'Bei einer Kleinbetragsrechnung genügen Entgelt und Steuer in einer Summe (§ 33 UStDV).',
      },
      kleinunternehmer: {
        kind: 'nicht',
        because: 'Bei einem Kleinunternehmer genügt das Entgelt in einer Summe (§ 34a UStDV).',
      },
    },
    source: 'KoSIT/FeRD S. 5: BG-23, BT-116 (und BG-22, BG-25)',
  },
  {
    id: 'summe',
    norm: '§ 33 Satz 1 Nr. 4 bzw. § 34a Satz 1 Nr. 5 UStDV',
    label: 'Entgelt und Steuerbetrag in einer Summe',
    section: 'paragraph14',
    show: ['BG-22/BT-112'],
    presence: { kind: 'any', paths: ['BG-22/BT-112'] },
    needs: {
      regel: {
        kind: 'nicht',
        because: 'Im Regelfall gelten Entgelt und Steuerbetrag getrennt (Nr. 7 und 8).',
      },
      kleinbetrag: IMMER,
      kleinunternehmer: IMMER,
    },
    onlyFor: ['kleinbetrag', 'kleinunternehmer'],
    source: 'Gesetzestext; BT-112',
  },
  {
    id: 'minderungen',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 7 UStG',
    label: 'Im Voraus vereinbarte Minderungen des Entgelts (z. B. Skonto, Rabatte, Boni)',
    section: 'paragraph14',
    show: ['BT-20'],
    each: [
      { group: 'BG-20', paths: ['BT-92', 'BT-97'] },
      { group: 'BG-25', paths: ['BT-126', 'BG-27/BT-136', 'BG-27/BT-139'] },
    ],
    // F8: the hint sits in the payment terms (BT-20) or a note (BG-1) and names the agreement, or
    // the reduction is structured (amount BT-92/BT-136, reason BT-97/BT-139); payment terms
    // without a reduction ("14 Tage netto") are no hint. KoSIT/FeRD p. 6 names BT-139 "amount" —
    // in EN 16931 it is the reason; both are taken.
    presence: {
      kind: 'anyOf',
      of: [
        { kind: 'text', paths: ['BT-20', ...NOTES], pattern: REDUCTION_HINT },
        {
          kind: 'any',
          paths: ['BG-20/BT-92', 'BG-20/BT-97', 'BG-25/BG-27/BT-136', 'BG-25/BG-27/BT-139'],
        },
      ],
    },
    needs: {
      regel: {
        kind: 'einzelfall',
        because:
          'Nur nötig, wenn eine Minderung vereinbart ist, die nicht schon im Entgelt steckt.',
      },
      kleinbetrag: NICHT_KB,
      kleinunternehmer: NICHT_KU,
    },
    source: 'KoSIT/FeRD S. 6: BT-20, BG-20 (BT-92, BT-97), BG-27 (BT-136, BT-139 – F8)',
  },
  {
    id: 'steuersatz',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 8 UStG',
    label: 'Anzuwendender Steuersatz',
    section: 'paragraph14',
    show: [],
    each: [{ group: 'BG-23', paths: ['BT-118', 'BT-119'] }],
    presence: {
      kind: 'each',
      group: 'BG-23',
      paths: ['BT-119'],
      unless: { path: 'BT-118', values: ['O'] },
    },
    needs: {
      regel: { kind: 'bedingt', when: TAXABLE, because: TAXABLE_BECAUSE },
      kleinbetrag: { kind: 'bedingt', when: TAXABLE, because: TAXABLE_BECAUSE },
      kleinunternehmer: {
        kind: 'nicht',
        because: 'Ein Kleinunternehmer weist keine Steuer aus (§ 34a UStDV).',
      },
    },
    source: 'KoSIT/FeRD S. 6: BT-118, BT-119 (BT-152, BT-96)',
  },
  {
    id: 'steuerbetrag',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 8 UStG',
    label: 'Auf das Entgelt entfallender Steuerbetrag',
    section: 'paragraph14',
    show: ['BG-22/BT-110'],
    hints: [
      {
        when: {
          kind: 'all',
          of: [{ kind: 'text', paths: EXEMPTION_TEXT, pattern: SECTION_19 }, TAX_SHOWN],
        },
        text: KU_WITH_TAX_HINT,
      },
    ],
    each: [{ group: 'BG-23', paths: ['BT-118', 'BT-119', 'BT-117'] }],
    presence: {
      kind: 'allOf',
      of: [
        { kind: 'any', paths: ['BG-22/BT-110'] },
        { kind: 'each', group: 'BG-23', paths: ['BT-117'] },
      ],
    },
    needs: {
      regel: { kind: 'bedingt', when: TAXABLE, because: TAXABLE_BECAUSE },
      kleinbetrag: {
        kind: 'nicht',
        because:
          'Bei einer Kleinbetragsrechnung genügen Entgelt und Steuer in einer Summe (§ 33 UStDV).',
      },
      kleinunternehmer: {
        kind: 'nicht',
        because: 'Ein Kleinunternehmer weist keine Steuer aus (§ 34a UStDV).',
      },
    },
    source: 'KoSIT/FeRD S. 7: BG-23, BT-110',
  },
  {
    id: 'befreiung',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 8 UStG',
    label: 'Hinweis auf eine Steuerbefreiung',
    section: 'paragraph14',
    show: [],
    each: [{ group: 'BG-23', paths: ['BT-118', ...REASON], where: EXEMPT }],
    presence: {
      kind: 'anyOf',
      of: [
        { kind: 'some', group: 'BG-23', paths: REASON, where: EXEMPT },
        { kind: 'text', paths: NOTES, pattern: EXEMPTION_WORDS },
      ],
    },
    needs: {
      regel: {
        kind: 'bedingt',
        when: { kind: 'categoryIn', codes: ['E', 'K', 'G', 'O'] },
        because:
          'Nur nötig bei einer steuerfreien oder nicht steuerbaren Leistung (Kategorie E, K, G oder O).',
      },
      kleinbetrag: {
        kind: 'bedingt',
        when: { kind: 'categoryIn', codes: ['E', 'K', 'G', 'O'] },
        because:
          'Nur nötig bei einer steuerfreien oder nicht steuerbaren Leistung (§ 33 Satz 1 Nr. 4 UStDV).',
      },
      kleinunternehmer: {
        kind: 'nicht',
        because: 'Dafür gilt der Hinweis auf die Kleinunternehmerregelung.',
      },
    },
    onlyFor: ['regel', 'kleinbetrag'],
    source: 'KoSIT/FeRD S. 7: BT-120, BT-121, BG-1',
  },
  {
    id: 'kleinunternehmer',
    norm: '§ 34a Satz 1 Nr. 5 UStDV',
    label: 'Hinweis auf die Steuerbefreiung für Kleinunternehmer (§ 19 UStG)',
    section: 'paragraph14',
    show: [],
    each: [{ group: 'BG-23', paths: ['BT-118', 'BT-120', 'BT-121'] }],
    presence: { kind: 'text', paths: EXEMPTION_TEXT, pattern: SECTION_19 },
    needs: {
      regel: { kind: 'nicht', because: 'Nur bei Kleinunternehmern.' },
      kleinbetrag: { kind: 'nicht', because: 'Nur bei Kleinunternehmern.' },
      kleinunternehmer: IMMER,
    },
    onlyFor: ['kleinunternehmer'],
    source: 'Gesetzestext',
  },
  {
    id: 'aufbewahrung',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 9 UStG',
    label:
      'Hinweis auf die Aufbewahrungspflicht des Leistungsempfängers (§ 14b Abs. 1 Satz 5 UStG)',
    section: 'paragraph14',
    show: [],
    presence: { kind: 'text', paths: NOTES, pattern: 'aufbewahr|aufzubewahr|§\\s*14b' },
    needs: {
      regel: {
        kind: 'einzelfall',
        because:
          'Nur nötig bei bestimmten Leistungen im Zusammenhang mit einem Grundstück an Nichtunternehmer.',
      },
      kleinbetrag: NICHT_KB,
      kleinunternehmer: NICHT_KU,
    },
    source: 'KoSIT/FeRD S. 7: BG-1',
  },
  {
    id: 'gutschrift',
    norm: '§ 14 Abs. 4 Satz 1 Nr. 10 UStG (§ 34a Satz 1 Nr. 6 UStDV)',
    label: 'Angabe „Gutschrift“ (Rechnung vom Leistungsempfänger ausgestellt)',
    section: 'paragraph14',
    show: ['BT-3'],
    // KoSIT/FeRD: BT-3 = 389 with cardinality 1, the note "Gutschrift" 0..1 – the code counts.
    presence: { kind: 'equals', path: 'BT-3', values: ['389'] },
    needs: {
      regel: {
        kind: 'einzelfall',
        because: 'Nur nötig, wenn der Leistungsempfänger die Rechnung ausstellt (Typcode 389).',
      },
      kleinbetrag: {
        kind: 'nicht',
        because: 'Bei einer Kleinbetragsrechnung nicht vorgeschrieben (§ 33 UStDV).',
      },
      kleinunternehmer: {
        kind: 'einzelfall',
        because: 'Nur nötig, wenn der Leistungsempfänger die Rechnung ausstellt (Typcode 389).',
      },
    },
    // Tobias 2026-11-13 (F11): a Rechnungskorrektur called "Gutschrift" is no Gutschrift
    hints: [
      {
        when: {
          kind: 'all',
          of: [
            { kind: 'text', paths: NOTES, pattern: 'gutschrift' },
            { kind: 'not', of: { kind: 'equals', path: 'BT-3', values: ['389'] } },
          ],
        },
        text: 'Mögliche Auffälligkeit: In einer Bemerkung steht „Gutschrift“, die Art der Rechnung ist aber nicht 389. Eine Gutschrift im Sinne des § 14 Abs. 2 Satz 2 UStG stellt der Leistungsempfänger aus (Typcode 389). Eine Rechnungskorrektur (z. B. 381) ist keine Gutschrift in diesem Sinne.',
      },
    ],
    source: 'KoSIT/FeRD S. 7: BT-3 = 389, BG-1 (F2)',
  },
  {
    id: 'endrechnung',
    norm: '§ 14 Abs. 5 Satz 2 UStG',
    label: 'Endrechnung: abgesetzte Teilentgelte und Steuerbeträge',
    section: 'besondere',
    show: ['BG-22/BT-113', 'BG-22/BT-115', 'BG-24/BT-122'],
    presence: { kind: 'any', paths: ['BG-22/BT-113'] },
    needs: {
      regel: {
        kind: 'einzelfall',
        because: 'Nur nötig in einer Endrechnung nach Anzahlungsrechnungen.',
      },
      kleinbetrag: NICHT_KB,
      kleinunternehmer: NICHT_KU,
    },
    source: 'KoSIT/FeRD S. 7: BG-1, BG-24, BT-113, BT-115',
  },
  {
    id: 'reverse-charge',
    norm: '§ 14a Abs. 1 Satz 1, Abs. 5 Satz 1 UStG',
    label: 'Angabe „Steuerschuldnerschaft des Leistungsempfängers“',
    section: 'besondere',
    show: [],
    each: [{ group: 'BG-23', paths: ['BT-118', ...REASON], where: REVERSE }],
    presence: {
      kind: 'anyOf',
      of: [
        { kind: 'some', group: 'BG-23', paths: REASON, where: REVERSE },
        {
          kind: 'text',
          paths: NOTES,
          pattern: 'steuerschuldnerschaft des leistungsempf|reverse.?charge',
        },
      ],
    },
    needs: {
      regel: {
        kind: 'bedingt',
        when: { kind: 'categoryIn', codes: ['AE'] },
        because: 'Nur nötig, wenn der Leistungsempfänger die Steuer schuldet (Kategorie AE).',
      },
      kleinbetrag: {
        kind: 'bedingt',
        when: { kind: 'categoryIn', codes: ['AE'] },
        because: 'Nur nötig, wenn der Leistungsempfänger die Steuer schuldet (Kategorie AE).',
      },
      kleinunternehmer: { kind: 'nicht', because: 'Nicht bei Kleinunternehmern.' },
    },
    source: 'KoSIT/FeRD S. 8–9: BT-120, BT-121',
  },
  {
    id: 'ust-id-beide',
    norm: '§ 14a Abs. 1 Satz 3, Abs. 3 Satz 2 UStG',
    label: 'USt-IdNr. des leistenden Unternehmers und des Leistungsempfängers',
    section: 'besondere',
    show: ['BG-4/BT-31', 'BG-7/BT-48'],
    presence: {
      kind: 'allOf',
      of: [
        { kind: 'any', paths: ['BG-4/BT-31'] },
        { kind: 'any', paths: ['BG-7/BT-48'] },
      ],
    },
    needs: {
      regel: {
        kind: 'bedingt',
        when: {
          kind: 'any',
          of: [
            { kind: 'categoryIn', codes: ['K'] },
            {
              kind: 'all',
              of: [
                { kind: 'categoryIn', codes: ['AE'] },
                { kind: 'differ', a: 'BG-4/BG-5/BT-40', b: 'BG-7/BG-8/BT-55' },
              ],
            },
          ],
        },
        because:
          'Nur nötig bei einer innergemeinschaftlichen Lieferung (Kategorie K) oder einer Leistung an einen Empfänger in einem anderen Mitgliedstaat, der die Steuer schuldet.',
      },
      kleinbetrag: {
        kind: 'nicht',
        because:
          'Für diese Fälle gibt es die Erleichterungen für Kleinbetragsrechnungen nicht (§ 33 Satz 3 UStDV). Das Tool prüft deshalb alle Angaben wie bei einer normalen Rechnung.',
      },
      kleinunternehmer: { kind: 'nicht', because: 'Nicht bei Kleinunternehmern.' },
    },
    source: 'KoSIT/FeRD S. 9: BT-31, BT-48',
  },
  {
    id: 'sonderregelung',
    norm: '§ 14a Abs. 6 UStG',
    label: 'Angabe „Sonderregelung für Reisebüros“ oder Differenzbesteuerung',
    section: 'besondere',
    show: [],
    presence: { kind: 'text', paths: NOTES, pattern: 'sonderregelung' },
    needs: {
      regel: {
        kind: 'einzelfall',
        because:
          'Nur nötig bei Reiseleistungen (§ 25 UStG) oder Differenzbesteuerung (§ 25a UStG).',
      },
      kleinbetrag: NICHT_KB,
      kleinunternehmer: NICHT_KU,
    },
    source: 'KoSIT/FeRD S. 10: BG-1',
  },
  {
    id: 'dreiecksgeschaeft',
    norm: '§ 14a Abs. 7 UStG',
    label: 'Hinweis auf ein innergemeinschaftliches Dreiecksgeschäft',
    section: 'besondere',
    show: [],
    presence: { kind: 'text', paths: NOTES, pattern: 'dreiecksgesch' },
    needs: {
      regel: {
        kind: 'einzelfall',
        because: 'Nur nötig bei einem innergemeinschaftlichen Dreiecksgeschäft.',
      },
      kleinbetrag: NICHT_KB,
      kleinunternehmer: NICHT_KU,
    },
    source: 'KoSIT/FeRD S. 10: BG-1, BT-31, BT-48',
  },
  {
    id: 'fiskalvertreter',
    norm: '§ 22c UStG',
    label: 'Fiskalvertreter: Name, Anschrift und USt-IdNr.',
    section: 'besondere',
    // The whole address is checked, so all of it is shown (audit 2026-11-14, B-08)
    show: [
      'BG-11/BT-62',
      'BG-11/BT-63',
      'BG-11/BG-12/BT-64',
      'BG-11/BG-12/BT-65',
      'BG-11/BG-12/BT-164',
      'BG-11/BG-12/BT-67',
      'BG-11/BG-12/BT-66',
      'BG-11/BG-12/BT-69',
    ],
    presence: {
      kind: 'allOf',
      of: [
        { kind: 'any', paths: ['BG-11/BT-62'] },
        { kind: 'any', paths: ['BG-11/BT-63'] },
        { kind: 'address', group: 'BG-11/BG-12' },
      ],
    },
    needs: {
      regel: {
        kind: 'bedingt',
        when: { kind: 'present', path: 'BG-11/BT-62' },
        because: 'Nur nötig, wenn ein Fiskalvertreter handelt.',
      },
      kleinbetrag: NICHT_KB,
      kleinunternehmer: NICHT_KU,
    },
    source: 'KoSIT/FeRD S. 10: BG-11, BT-62, BG-12, BT-63',
  },
];

/** When a list of minimum content other than the general one applies (first match wins). */
export const MODES: readonly { mode: Exclude<Mode, 'regel'>; when: Condition; text: string }[] = [
  {
    mode: 'kleinunternehmer',
    // F18: not when the invoice shows VAT — then the regular list and a hint on the row Steuerbetrag
    when: {
      kind: 'all',
      of: [
        { kind: 'text', paths: EXEMPTION_TEXT, pattern: SECTION_19 },
        { kind: 'not', of: TAX_SHOWN },
      ],
    },
    text: 'Hinweis auf die Kleinunternehmerregelung gefunden: Es gelten die verringerten Angaben nach § 34a UStDV.',
  },
  {
    mode: 'kleinbetrag',
    when: {
      kind: 'all',
      of: [
        { kind: 'equals', path: 'BT-5', values: ['EUR'] },
        // F16 (Tobias 2026-11-14): the amount counts, so a cancellation of a small invoice
        // (−119,00) stays small, one over −250,00 does not
        { kind: 'atMost', path: 'BG-22/BT-112', limit: SMALL_AMOUNT_LIMIT, absolute: true },
        // § 33 Satz 3 UStDV: not for §§ 6a (intra-Community supply) and 13b UStG
        { kind: 'not', of: { kind: 'categoryIn', codes: ['K', 'AE'] } },
      ],
    },
    text: 'Gesamtbetrag bis 250 Euro: Es gelten die verringerten Angaben einer Kleinbetragsrechnung nach § 33 UStDV.',
  },
];
