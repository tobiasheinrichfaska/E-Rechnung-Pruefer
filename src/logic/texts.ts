// Every sentence the tool says, in one place: German, Sie-form, simple sentences. Hints, never an
// approval — no text may say "ordnungsgemäß" or "gültig".
import type { FileProblemKind } from './analysis';
import type { Tone } from './verdict';

export const TEXTS = {
  fixedNotice:
    'Technische Erstprüfung, keine steuerliche Prüfung. Maßgeblich sind die Daten in der XML. Bei Fragen wenden Sie sich an Ihre Kanzlei.',
  /** Before a result and when no e-invoice was found: the XML is not what counts (F19) */
  fixedNoticeGeneral:
    'Technische Erstprüfung, keine steuerliche Prüfung. Bei Fragen wenden Sie sich an Ihre Kanzlei.',

  eRechnung: 'E-Rechnung erkannt ({spec})',
  hybridSource: 'Das PDF enthält Rechnungsdaten als XML (Anhang „{name}“).',
  xmlCounts: 'Maßgeblich sind die Daten in der XML, nicht das Bild des PDF.',
  xmlFile: 'Die Datei enthält die Rechnungsdaten als XML.',

  keineERechnungPdf: 'PDF mit Rechnungsdaten, Profil {profile}: keine E-Rechnung im Sinne des UStG',
  keineERechnungXml: 'Rechnungsdaten im Profil {profile}: keine E-Rechnung im Sinne des UStG',
  minimumReason:
    'Nach dem BMF-Schreiben vom 15.10.2024 (Rn. 25 und 30) und Abschnitt 14.1 Abs. 14 UStAE gelten ZUGFeRD- und Factur-X-Rechnungen in den Profilen MINIMUM und BASIC WL nicht als E-Rechnung.',
  zugferd1Reason:
    'Das BMF erkennt ZUGFeRD erst ab Version 2.0.1 als E-Rechnung an; das ursprüngliche ZUGFeRD-Format beruht nicht auf der Normenreihe EN 16931 (BMF-Schreiben vom 15.10.2024, Rn. 30).',

  nichtBeurteilt: 'Rechnungsdaten erkannt, Spezifikation unbekannt: nicht beurteilt',
  specUnknown: 'Spezifikation unbekannt',
  unknownSpec: 'Kennung der Spezifikation (BT-24): {id}. Diese Kennung kennt das Tool nicht.',
  missingSpec: 'Die Kennung der Spezifikation (BT-24) fehlt.',
  shownAnyway: 'Die Angaben aus der XML werden trotzdem angezeigt.',
  zugferd20Hint:
    'Ob die Datei nach ZUGFeRD 2.0 oder 2.0.1 erstellt ist, lässt sich an ihr nicht erkennen; das BMF erkennt ZUGFeRD erst ab Version 2.0.1 als E-Rechnung an (BMF-Schreiben vom 15.10.2024, Rn. 30).',

  sameSeveral:
    'Dieselbe Rechnung ist {count}-mal eingebettet ({names}). Vorgesehen ist nur eine Rechnungs-XML je PDF.',
  contradicting: 'Mögliche Auffälligkeit: widersprüchliche Rechnungsdaten im PDF',
  contradictingWhy:
    'Das PDF enthält {count} Rechnungs-XML mit unterschiedlichen Daten ({names}). Unklar ist, welche gilt.',
  askSupplier: 'Bitte fordern Sie beim Lieferanten eine eindeutige Fassung an.',

  otherXml: 'XML-Datei ohne bekanntes Rechnungsformat',
  rootIs: 'Wurzelelement: {name} (Namensraum {namespace}).',
  otherFormats:
    'Das Tool kennt UBL und CII nach EN 16931. Andere Formate (z. B. EDI) können eine E-Rechnung sein, wenn Sie das mit dem Lieferanten vereinbart haben (§ 14 Abs. 1 Satz 6 Nr. 2 UStG; EDI übergangsweise bis Ende 2027, § 27 Abs. 38 UStG). Das Tool beurteilt sie nicht.',

  plainPdf: 'Keine E-Rechnung: einfaches PDF',
  pdfWithoutInvoiceData: 'Keine E-Rechnung: PDF ohne Rechnungsdaten',
  plainPdfWhy: 'Das PDF enthält keine Rechnungsdaten als XML. Ein PDF allein ist keine E-Rechnung.',
  attachmentsNoInvoice: 'Anhänge im PDF: {names}. Keiner davon enthält Rechnungsdaten.',
  pdfBrokenXml: 'PDF mit fehlerhafter XML',
  attachmentBroken: 'Der Anhang „{name}“ ist XML, lässt sich aber nicht lesen.',
  attachmentDoctype:
    'Der Anhang „{name}“ enthält eine Dokumenttyp-Angabe (DOCTYPE). Aus Sicherheitsgründen liest das Tool ihn nicht.',
  pdfNotChecked: 'PDF nicht vollständig geprüft',
  attachmentTooLarge:
    'Der Anhang „{name}“ ist größer als 20 MB. So große XML-Dateien liest das Tool nicht.',
  attachmentsTruncated: 'Das PDF hat sehr viele Anhänge. Das Tool hat nur die ersten 50 gelesen.',
  notJudged: 'Ob das PDF eine E-Rechnung ist, kann das Tool deshalb nicht sagen.',
  formatError: 'Formatfehler, gem. Rn. 6a ggf. keine E-Rechnung.',
  problemAtLine: 'Zeile {line}: {message}',

  pflichtHeading: 'Pflichtangaben nach § 14 Abs. 4 UStG',
  besondereHeading: 'Angaben in besonderen Fällen (§ 14 Abs. 5, § 14a, § 22c UStG)',
  // F21 (Tobias 2026-11-14)
  allPresent:
    'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
  missingList: 'Es fehlt: {list}.',
  missingOnly: 'nur',
  addressCity: 'Ort',
  addressPostcodeOrStreet: 'Postleitzahl oder Straße/Postfach',
  noGroup: 'keine Angabe „{group}“',
  statusVorhanden: 'vorhanden',
  statusFehlt: 'fehlt',
  statusEinzelfall: 'nur im Einzelfall nötig',
  showPositions: 'Positionen anzeigen ({count})',
  notInXml: '– nicht in der XML',
  noModel:
    'Für diese Rechnungsdaten zeigt das Tool keine Pflichtangaben (kein Format nach EN 16931).',
  noPflichtNoEInvoice:
    'Für Rechnungsdaten, die keine E-Rechnung sind, zeigt das Tool keine Pflichtangaben. Maßgeblich ist dann die lesbare Rechnung, nicht die XML.',

  fileProblems: {
    empty: { tone: 'bad', headline: 'Die Datei ist leer', explanation: [] },
    unsupportedType: {
      tone: 'bad',
      headline: 'Diese Dateiart prüft das Tool nicht',
      explanation: ['Bitte wählen Sie eine PDF- oder XML-Datei.'],
    },
    tooLarge: {
      tone: 'bad',
      headline: 'Die Datei ist zu groß',
      explanation: ['Das Tool prüft PDF-Dateien bis 30 MB und XML-Dateien bis 20 MB.'],
    },
    password: {
      tone: 'bad',
      headline: 'Das PDF ist mit einem Kennwort geschützt',
      explanation: [
        'Das Tool kann geschützte PDF-Dateien nicht lesen. Bitte fordern Sie beim Lieferanten eine ungeschützte Fassung an.',
      ],
    },
    damaged: {
      tone: 'bad',
      headline: 'Das PDF lässt sich nicht lesen',
      explanation: ['Die Datei ist beschädigt oder kein PDF.'],
    },
    xmlDoctype: {
      tone: 'warn',
      headline: 'XML-Datei mit Dokumenttyp-Angabe: nicht geprüft',
      explanation: [
        'E-Rechnungen enthalten keine Dokumenttyp-Angabe (DOCTYPE). Aus Sicherheitsgründen prüft das Tool solche Dateien nicht.',
      ],
    },
    xmlBroken: {
      tone: 'bad',
      headline: 'Die XML-Datei ist fehlerhaft',
      explanation: ['Formatfehler, gem. Rn. 6a ggf. keine E-Rechnung.'],
    },
  } satisfies Record<FileProblemKind, { tone: Tone; headline: string; explanation: string[] }>,
};

/** Replaces {name} placeholders. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : whole,
  );
}

/** VAT category codes (BT-118, BT-151; UNTDID 5305 as used by EN 16931). */
export const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  S: 'steuerpflichtig',
  Z: 'Nullsatz',
  E: 'steuerbefreit',
  AE: 'Steuerschuldnerschaft des Leistungsempfängers',
  K: 'innergemeinschaftliche Lieferung',
  G: 'Ausfuhr',
  O: 'nicht steuerbar',
  L: 'Kanarische Inseln',
  M: 'Ceuta und Melilla',
};

/** Frequent unit codes (BT-130, BT-150; UN/ECE Recommendation 20/21). */
export const UNIT_LABELS: Readonly<Record<string, string>> = {
  C62: 'Stück',
  H87: 'Stück',
  XPP: 'Stück',
  EA: 'Stück',
  SET: 'Satz',
  LS: 'pauschal',
  HUR: 'Stunde',
  MIN: 'Minute',
  DAY: 'Tag',
  WEE: 'Woche',
  MON: 'Monat',
  ANN: 'Jahr',
  KGM: 'Kilogramm',
  GRM: 'Gramm',
  TNE: 'Tonne',
  MTR: 'Meter',
  KMT: 'Kilometer',
  MTK: 'Quadratmeter',
  MTQ: 'Kubikmeter',
  LTR: 'Liter',
  KWH: 'Kilowattstunde',
  P1: 'Prozent',
};

/** Labels of the document type codes (BT-3, UNTDID 1001) that occur in German practice. */
export const TYPE_CODES: Readonly<Record<string, string>> = {
  '326': 'Teilrechnung',
  '380': 'Rechnung',
  '381': 'Rechnungskorrektur (Credit Note)',
  '384': 'Korrigierte Rechnung',
  '386': 'Anzahlungsrechnung',
  '389': 'Gutschrift (vom Leistungsempfänger ausgestellt)',
  '751': 'Rechnungsinformation für Buchungszwecke',
  '875': 'Abschlagsrechnung (Bauleistung)',
  '876': 'Teilschlussrechnung (Bauleistung)',
  '877': 'Schlussrechnung (Bauleistung)',
};
