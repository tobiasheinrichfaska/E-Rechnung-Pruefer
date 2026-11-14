// Specification identifiers (BT-24) → what the tool says about them. Hybrid formats (ZUGFeRD from
// 2.0.1, Factur-X) count as e-invoices except the profiles MINIMUM and BASIC WL (BMF 15.10.2024
// Rn. 25, 30; Abschnitt 14.1 Abs. 14 UStAE). Unknown identifiers are not judged (F5, Tobias
// 2026-11-13). Sources per entry; `checked: false` = not backed by an official sample file.

import { TEXTS } from './texts';

export type Einordnung = 'eRechnung' | 'keineERechnung' | 'nichtBeurteilt';

export interface ProfileEntry {
  id: string;
  match: 'exact' | 'prefix';
  /** German label, e.g. "ZUGFeRD/Factur-X, Profil BASIC" */
  label: string;
  /** Short profile name for "Profil MINIMUM" in headlines */
  profile?: string;
  einordnung: Einordnung;
  /** For a prefix: what may follow it, e.g. only a version number (audit 2026-11-14, L-08) */
  rest?: RegExp;
  /** Added to the label in the details, not in the headline */
  note?: string;
  /** A sentence added to the explanation of the result */
  hint?: string;
  /**
   * The profile's own schema instead of the one of its syntax (FeRD EXTENDED goes beyond CII D16B).
   * `entry` is a key of SCHEMA_ENTRIES (src/io/schemas.ts); without one the profile needs a schema
   * the tool does not have, and the check is left out instead of risking a false "Formatfehler".
   */
  ownSchema?: { entry?: 'facturxExtended'; label: string };
  /** Lines may form a hierarchy with group subtotals (EXTENDED, audit B-02b): no sums over lines */
  hierarchicalLines?: boolean;
  source: string;
  checked: boolean;
}

/** A version number such as 3.0 or 3.0.2 — nothing else after the prefix. */
const VERSION = /^\d+(\.\d+)*$/;

const CEN = 'urn:cen.eu:en16931:2017';
const FEX = 'urn:factur-x.eu:1p0';
const ZF2 = 'urn:zugferd.de:2p0';
const KOSIT = 'urn:xeinkauf.de:kosit';

export const PROFILES: readonly ProfileEntry[] = [
  {
    id: `${FEX}:minimum`,
    match: 'exact',
    label: 'ZUGFeRD/Factur-X, Profil MINIMUM',
    profile: 'MINIMUM',
    einordnung: 'keineERechnung',
    source: 'FeRD ZUGFeRD 2.5.2 Musterrechnungen (Infopaket vom 04.08.2026)',
    checked: true,
  },
  {
    id: `${FEX}:basicwl`,
    match: 'exact',
    label: 'ZUGFeRD/Factur-X, Profil BASIC WL',
    profile: 'BASIC WL',
    einordnung: 'keineERechnung',
    source: 'FeRD ZUGFeRD 2.5.2 Musterrechnungen (Infopaket vom 04.08.2026)',
    checked: true,
  },
  // ZUGFeRD 2.0/2.0.1 identifiers, still allowed by code list 1 of the FeRD package 2.5.2. MINIMUM
  // and BASIC WL are no e-invoice in any version (F5). 2.0 and 2.0.1 cannot be told apart in the
  // file (same identifiers, byte-identical sample files): BASIC and EXTENDED count as e-invoice with
  // a hint (F17, Tobias 2026-11-14). The upper-case "EN16931" of the 2.0 appendix stays unknown.
  {
    id: `${ZF2}:minimum`,
    match: 'exact',
    label: 'ZUGFeRD 2.0, Profil MINIMUM',
    profile: 'MINIMUM',
    einordnung: 'keineERechnung',
    source: 'FeRD ZUGFeRD 2.5.2 / Factur-X 1.09.2, Codeliste 1 (BT-24); BMF 15.10.2024 Rn. 25, 30',
    checked: false,
  },
  {
    id: `${CEN}#compliant#${ZF2}:basic`,
    match: 'exact',
    label: 'ZUGFeRD 2.0, Profil BASIC',
    profile: 'BASIC',
    einordnung: 'eRechnung',
    hint: TEXTS.zugferd20Hint,
    source:
      'FeRD ZUGFeRD 2.0 und 2.0.1 Musterrechnungen; ZUGFeRD 2.5.2 / Factur-X 1.09.2, Codeliste 1 (F17)',
    checked: false,
  },
  {
    id: `${CEN}#conformant#${ZF2}:extended`,
    match: 'exact',
    label: 'ZUGFeRD 2.0, Profil EXTENDED',
    profile: 'EXTENDED',
    einordnung: 'eRechnung',
    hint: TEXTS.zugferd20Hint,
    source:
      'FeRD ZUGFeRD 2.0 und 2.0.1 Musterrechnungen; ZUGFeRD 2.5.2 / Factur-X 1.09.2, Codeliste 1 (F17)',
    // the EXTENDED schema of ZUGFeRD 2.0 is not bundled; 2.5.2 is not checked against older files
    ownSchema: { label: 'ZUGFeRD 2.0 EXTENDED (FeRD)' },
    hierarchicalLines: true,
    checked: false,
  },
  {
    id: `${ZF2}:basicwl`,
    match: 'exact',
    label: 'ZUGFeRD 2.0, Profil BASIC WL',
    profile: 'BASIC WL',
    einordnung: 'keineERechnung',
    source: 'FeRD ZUGFeRD 2.5.2 / Factur-X 1.09.2, Codeliste 1 (BT-24); BMF 15.10.2024 Rn. 25, 30',
    checked: false,
  },
  {
    id: `${CEN}#compliant#${FEX}:basic`,
    match: 'exact',
    label: 'ZUGFeRD/Factur-X, Profil BASIC',
    profile: 'BASIC',
    einordnung: 'eRechnung',
    source: 'FeRD ZUGFeRD 2.5.2 Musterrechnungen (Infopaket vom 04.08.2026)',
    checked: true,
  },
  {
    id: `${CEN}#conformant#${FEX}:extended`,
    match: 'exact',
    label: 'ZUGFeRD/Factur-X, Profil EXTENDED',
    profile: 'EXTENDED',
    einordnung: 'eRechnung',
    source: 'FeRD ZUGFeRD 2.5.2 Musterrechnungen (Infopaket vom 04.08.2026)',
    // Step 2a: the EXTENDED schema of Factur-X 1.09.2 / ZUGFeRD 2.5.2 (FeRD, Apache-2.0)
    ownSchema: { entry: 'facturxExtended', label: 'Factur-X 1.09.2 EXTENDED (FeRD)' },
    hierarchicalLines: true,
    checked: true,
  },
  {
    id: `${CEN}#compliant#${KOSIT}:xrechnung_3.0#conformant#${KOSIT}:extension:xrechnung_3.0`,
    match: 'exact',
    label: 'XRechnung 3.0 mit Extension',
    einordnung: 'eRechnung',
    source: 'KoSIT XRechnung-Testsuite v2026-08-31 (instances/extension)',
    checked: true,
  },
  {
    id: `${CEN}#compliant#${KOSIT}:xrechnung_3.0#compliant#${KOSIT}:xrechnung:cvd_`,
    match: 'prefix',
    rest: VERSION,
    label: 'XRechnung 3.0, CVD',
    einordnung: 'eRechnung',
    source: 'KoSIT XRechnung-Testsuite v2026-08-31 (technical-cases/cvd)',
    checked: true,
  },
  {
    id: `${CEN}#compliant#${KOSIT}:xrechnung_3.0`,
    match: 'exact',
    label: 'XRechnung 3.0',
    einordnung: 'eRechnung',
    source: 'KoSIT XRechnung-Testsuite v2026-08-31',
    checked: true,
  },
  {
    id: `${CEN}#compliant#${KOSIT}:xrechnung_`,
    match: 'prefix',
    label: 'XRechnung',
    einordnung: 'eRechnung',
    rest: VERSION,
    source: 'Kennungsschema der KoSIT (weitere Fassungen von XRechnung 3)',
    checked: false,
  },
  {
    id: `${CEN}#compliant#urn:xoev-de:kosit:standard:xrechnung_`,
    match: 'prefix',
    label: 'XRechnung, ältere Fassung 1.x/2.x',
    einordnung: 'eRechnung',
    rest: VERSION,
    source:
      'FeRD-Musterrechnung mit xrechnung_2.1 (Infopaket 2.5.2); Kennungsschema der KoSIT bis XRechnung 2.3',
    checked: true,
  },
  {
    id: `${CEN}#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0`,
    match: 'exact',
    label: 'Peppol BIS Billing 3.0',
    einordnung: 'eRechnung',
    source: 'CEN-Beispiel BIS3_Invoice_positive (Validierungsartefakte 1.3.17)',
    checked: true,
  },
  {
    id: CEN,
    match: 'exact',
    label: 'EN 16931',
    // No nested brackets in the headline "E-Rechnung erkannt (…)" (audit 2026-11-14, U-08)
    note: 'bei ZUGFeRD/Factur-X: Profil EN 16931, früher COMFORT',
    profile: 'EN 16931',
    einordnung: 'eRechnung',
    source: 'CEN-Beispiele 1.3.17; Übergabe 2026-11-13',
    checked: true,
  },
  {
    id: 'urn:ferd:CrossIndustryDocument:invoice:1p0',
    match: 'prefix',
    label: 'ZUGFeRD 1.0',
    profile: 'ZUGFeRD 1.0',
    einordnung: 'keineERechnung',
    source:
      'BMF 15.10.2024 Rn. 25, 30; Abschnitt 14.1 Abs. 14 UStAE: ZUGFeRD erst ab Version 2.0.1 (F5)',
    checked: false,
  },
];

export interface ProfileMatch {
  /** The identifier as found (trimmed), undefined when BT-24 is missing */
  id?: string;
  entry?: ProfileEntry;
  einordnung: Einordnung;
}

/** The most specific entry wins: exact before prefix, longer prefix before shorter. */
export function profileOf(id: string | undefined): ProfileMatch {
  const trimmed = id?.trim();
  if (!trimmed) return { einordnung: 'nichtBeurteilt' };
  const exact = PROFILES.find((p) => p.match === 'exact' && p.id === trimmed);
  const prefix = PROFILES.filter(
    (p) =>
      p.match === 'prefix' &&
      trimmed.startsWith(p.id) &&
      (!p.rest || p.rest.test(trimmed.slice(p.id.length))),
  ).sort((a, b) => b.id.length - a.id.length)[0];
  const entry = exact ?? prefix;
  return entry
    ? { id: trimmed, entry, einordnung: entry.einordnung }
    : { id: trimmed, einordnung: 'nichtBeurteilt' };
}
