// Every sentence the tool says, in one place: German, Sie-form, simple sentences. Hints, never an
// approval — no text may say "ordnungsgemäß" or "gültig".
import type { FileProblemKind } from './analysis';
import type { Tone } from './verdict';

// „Rn.“ and its number stay on one line: a no-break space (written as \u00a0) between them, as before
// „%“ in check.ts and rules.ts (DIN 5008; audit R3-U-10)

/** F24 (Tobias 2026-11-14, replaces the F4 wording) — one constant for every place it is shown */
const FORMAT_ERROR =
  'Die Datei hat einen Formatfehler. Sie ist deshalb möglicherweise keine E-Rechnung (BMF-Schreiben vom 15.10.2025, Rn.\u00a06a).';
/** F23: the supplier, not the tool, can mend a file (Tobias: a hint, not a demand) */
const RESEND = 'Sie könnten den Lieferanten bitten, die Datei noch einmal zu schicken.';
const KANZLEI_JUDGES = 'Ob das eine E-Rechnung ist, kann Ihre Kanzlei beurteilen.';

export const TEXTS = {
  /** A PDF with an e-invoice: the XML counts, not the picture (F19; G-6: only for a PDF) */
  fixedNotice:
    'Technische Erstprüfung, keine steuerliche Prüfung: Das Tool liest nur die Daten der Datei und beurteilt nicht, ob die Rechnung steuerlich richtig ist. Maßgeblich sind die Daten in der XML. Bei Fragen wenden Sie sich an Ihre Kanzlei.',
  fixedNoticeGeneral:
    'Technische Erstprüfung, keine steuerliche Prüfung: Das Tool liest nur die Daten der Datei und beurteilt nicht, ob die Rechnung steuerlich richtig ist. Bei Fragen wenden Sie sich an Ihre Kanzlei.',
  // G-6: what the tool shows, before a file is chosen
  introPoints: [
    'ob es eine E-Rechnung ist,',
    'welche Pflichtangaben sie enthält,',
    'ob die Datei dem Standard entspricht und die Beträge zusammenpassen.',
  ],
  introLead: 'Das Tool zeigt:',

  eRechnung: 'E-Rechnung erkannt ({spec})',
  // G-3: a yellow result says so in its headline (and the announcement)
  eRechnungHints: 'E-Rechnung erkannt ({spec}) – mit Hinweisen',
  hybridSource: 'Das PDF enthält Rechnungsdaten als XML (Anhang „{name}“).',
  // G-8: the same data in several attachments, each named (audit R3-U-09)
  hybridSourceSeveral: 'Das PDF enthält Rechnungsdaten als XML (Anhänge {names}).',
  xmlCounts: 'Maßgeblich sind die Daten in der XML, nicht das Bild des PDF.',
  xmlFile: 'Die Datei enthält die Rechnungsdaten als XML.',

  keineERechnungPdf: 'PDF mit Rechnungsdaten, Profil {profile}: keine E-Rechnung im Sinne des UStG',
  keineERechnungXml: 'Rechnungsdaten im Profil {profile}: keine E-Rechnung im Sinne des UStG',
  // G-7: ZUGFeRD 1.0 is a version, not a profile
  zugferd1Pdf: 'PDF mit Rechnungsdaten nach ZUGFeRD 1.0: keine E-Rechnung im Sinne des UStG',
  zugferd1Xml: 'Rechnungsdaten nach ZUGFeRD 1.0: keine E-Rechnung im Sinne des UStG',
  minimumReason:
    'Nach dem BMF-Schreiben vom 15.10.2024 (Rn.\u00a025 und 30) und Abschnitt 14.1 Abs. 14 UStAE gelten ZUGFeRD- und Factur-X-Rechnungen in den Profilen MINIMUM und BASIC WL nicht als E-Rechnung.',
  zugferd1Reason:
    'Das BMF erkennt ZUGFeRD erst ab Version 2.0.1 als E-Rechnung an; das ursprüngliche ZUGFeRD-Format beruht nicht auf der Normenreihe EN 16931 (BMF-Schreiben vom 15.10.2024, Rn.\u00a030).',

  nichtBeurteilt: 'Rechnungsdaten erkannt, Spezifikation unbekannt: nicht beurteilt',
  specUnknown: 'Spezifikation unbekannt',
  unknownSpec: 'Kennung der Spezifikation (BT-24): {id}. Diese Kennung kennt das Tool nicht.',
  missingSpec: 'Die Kennung der Spezifikation (BT-24) fehlt.',
  shownAnyway: 'Die Angaben aus der XML werden trotzdem angezeigt.',
  kanzleiJudges: KANZLEI_JUDGES,
  zugferd20Hint:
    'Ob die Datei nach ZUGFeRD 2.0 oder 2.0.1 erstellt ist, lässt sich an ihr nicht erkennen; das BMF erkennt ZUGFeRD erst ab Version 2.0.1 als E-Rechnung an (BMF-Schreiben vom 15.10.2024, Rn.\u00a030).',

  // F27: the standard allows one invoice XML per PDF (Factur-X 1.09.2, specification p. 28)
  sameSeveral:
    'Dieselbe Rechnung ist {count}-mal eingebettet ({names}). Nach dem Standard ist nur eine Rechnungs-XML je PDF zulässig.',
  contradicting: 'Rechnungsdaten mit Formatfehler: mehrere Rechnungs-XML im PDF',
  contradictingWhy:
    'Das PDF enthält {count} Rechnungs-XML mit unterschiedlichen Daten ({names}). Unklar ist, welche gilt.',
  oneXmlOnly: 'Nach dem Standard (Factur-X/ZUGFeRD) ist nur eine Rechnungs-XML je PDF zulässig.',
  askSupplier: 'Sie könnten beim Lieferanten eine eindeutige Fassung anfordern.',

  otherXml: 'XML-Datei ohne bekanntes Rechnungsformat',
  // QU-12: a technical detail, so last in the box (as G-10 for the engine's messages)
  rootIs: 'Technische Angabe: Wurzelelement {name} (Namensraum {namespace}).',
  otherFormats:
    'Das Tool kennt UBL und CII nach EN 16931. Andere Formate (z. B. EDI) können eine E-Rechnung sein, wenn Sie das mit dem Lieferanten vereinbart haben (§ 14 Abs. 1 Satz 6 Nr. 2 UStG; EDI übergangsweise bis Ende 2027, § 27 Abs. 38 UStG). Das Tool beurteilt sie nicht.',

  plainPdf: 'Keine E-Rechnung: einfaches PDF',
  pdfWithoutInvoiceData: 'Keine E-Rechnung: PDF ohne Rechnungsdaten',
  plainPdfWhy: 'Das PDF enthält keine Rechnungsdaten als XML. Ein PDF allein ist keine E-Rechnung.',
  // the names in quotes, as everywhere else (audit QU-09)
  attachmentNoInvoice: 'Der Anhang „{name}“ enthält keine Rechnungsdaten.',
  attachmentsNoInvoice: 'Anhänge im PDF: {names}. Keiner davon enthält Rechnungsdaten.',
  pdfBrokenXml: 'PDF mit fehlerhafter XML',
  attachmentBroken: 'Der Anhang „{name}“ ist XML, lässt sich aber nicht lesen.',
  attachmentDoctype:
    'Der Anhang „{name}“ enthält eine Dokumenttyp-Angabe (DOCTYPE). Aus Sicherheitsgründen liest das Tool ihn nicht.',
  pdfNotChecked: 'PDF nicht vollständig geprüft',
  attachmentTooLarge:
    'Der Anhang „{name}“ ist größer als 20 MB. So große XML-Dateien liest das Tool nicht.',
  attachmentsTruncated: 'Das PDF hat sehr viele Anhänge. Das Tool hat nur die ersten 50 gelesen.',
  // pdf.js could not take the attachment out of the PDF (audit QL-06)
  attachmentUnreadable: 'Der Anhang „{name}“ lässt sich nicht aus dem PDF lesen.',
  notJudged: 'Ob das PDF eine E-Rechnung ist, kann das Tool deshalb nicht sagen.',
  // Beside an invoice XML: what the attachments not read mean for the result (audit R2-U-08)
  unreadOne: 'Ob dieser Anhang weitere Rechnungsdaten enthält, kann das Tool nicht sagen.',
  unreadSeveral:
    'Ob die nicht gelesenen Anhänge weitere Rechnungsdaten enthalten, kann das Tool nicht sagen.',
  formatError: FORMAT_ERROR,

  // F26: § 27 Abs. 38 UStG by the date of supply and invoice (src/logic/uebergang.ts)
  // F30: supply before 2025, whatever the invoice date (§ 27 Abs. 1 Satz 1 UStG)
  regimeBefore2025:
    'Für Leistungen vor 2025 ist keine E-Rechnung nötig, auch wenn die Rechnung später ausgestellt wird (BMF-Schreiben vom 15.10.2024, Rn.\u00a050).',
  regimeAllowed:
    'Für diese Rechnung ist eine sonstige Rechnung noch zulässig (§ 27 Abs. 38 Nr. 1 UStG).',
  regimeTurnover:
    'Für eine Leistung im Jahr 2027 ist eine sonstige Rechnung nur zulässig, wenn der Gesamtumsatz des Lieferanten 2026 höchstens 800.000 Euro betrug (§ 27 Abs. 38 Nr. 2 UStG). Haben Sie zuverlässig geklärt, dass der Lieferant keine E-Rechnung ausstellen muss?',
  regimeRequired:
    'Hier ist eine E-Rechnung nötig. Sie könnten mit dem Lieferanten klären, ob er die Datei berichtigt. Ohne Berichtigung kann der Vorsteuerabzug gefährdet sein.',
  // F23: no readable supply date
  regimeGeneral:
    'Ob der Lieferant eine E-Rechnung ausstellen muss, hängt vom Datum der Leistung und von seinem Umsatz ab. Ihre Kanzlei kann das beurteilen.',
  supplierMendFile: 'Sie könnten mit dem Lieferanten klären, ob er die Datei berichtigt.',
  datesApart: 'Lieferdatum und Leistungszeitraum liegen in verschiedenen Jahren.',
  linePeriodsApart: 'Die Leistungszeiträume der Positionen liegen in verschiedenen Jahren.',

  // F22/F23: missing Pflichtangaben and hints of the rows, in the result box
  pflichtMissingLine: 'Es fehlen Pflichtangaben: {list} (siehe „Pflichtangaben“).',
  pflichtHintLine: 'Ein Hinweis zu den Pflichtangaben (siehe „Pflichtangaben“).',
  pflichtHintsLine: '{count} Hinweise zu den Pflichtangaben (siehe „Pflichtangaben“).',
  supplierComplete:
    'Sie könnten mit dem Lieferanten klären, ob er die Rechnung ergänzt. Ohne die fehlende Angabe kann der Vorsteuerabzug gefährdet sein.',

  // Step 2b: the official schema (F4 for the statement)
  schemaErrorHeadline: 'Rechnungsdaten mit Formatfehler ({spec})',
  schemaMismatch:
    'Die XML weicht vom offiziellen Schema {schema} ab (technische Meldungen: {count}).',
  schemaMismatchIn:
    'Der Anhang „{name}“ weicht vom offiziellen Schema {schema} ab (technische Meldungen: {count}).',
  schemaMore: 'Weitere technische Meldungen: {count} (siehe unten).',
  // Several parts with other messages: each line names its attachment (audit R4-U-02)
  schemaMoreIn: 'Weitere technische Meldungen im Anhang „{name}“: {count} (siehe unten).',
  // At the end of the list itself nothing follows: these messages are counted, not shown
  schemaMoreNotShown: 'Weitere technische Meldungen, die hier nicht einzeln stehen: {count}.',
  schemaOwnProfile:
    'Für ZUGFeRD 2.0 im Profil EXTENDED gilt ein eigenes Schema von FeRD, das das Tool nicht enthält.',
  schemaNone: 'keine Abweichung vom Schema {schema}',
  schemaDetail: 'Abweichungen vom Schema {schema}: {count}',
  schemaNotChecked: 'nicht geprüft – {reason}',
  schemaProblemsTitle: 'Technische Meldungen der Schemaprüfung ({count})',
  // one list per part with messages, named where the PDF holds several (audit R4-U-02)
  schemaProblemsTitleIn: 'Technische Meldungen der Schemaprüfung, Anhang „{name}“ ({count})',
  // The parser's own message (English) marked as such (audit 2026-11-14, U-07)
  problemAtLine: 'Technische Meldung (Zeile {line}): {message}',
  problemMessage: 'Technische Meldung: {message}',
  problemAtLineIn: 'Technische Meldung, Anhang „{name}“ (Zeile {line}): {message}',
  problemMessageIn: 'Technische Meldung, Anhang „{name}“: {message}',

  // Above the result: which file and when — on paper the Kanzlei sees when it was checked
  // (audit Bedienung, E-02/A-12)
  checkedFile: 'Geprüfte Datei: „{name}“ – geprüft am {date} um {time} Uhr',
  differingLine: 'Unterschiedlich: {items}.',
  differingItem: '{label} ({values})',
  /** R5-U-02: beside a differing header value, what else differs is only counted */
  differingMoreOne:
    'Außerdem weicht eine weitere Angabe oder Regel ab (siehe „Vergleich der Rechnungsdaten“).',
  differingMore:
    'Außerdem weichen {count} weitere Angaben oder Regeln ab (siehe „Vergleich der Rechnungsdaten“).',
  // QL-01: with the same header the Pflichtangaben or the rules of the parts may still differ
  differingWithHint: 'mit Hinweis',
  differingWithHints: 'mit {count} Hinweisen',
  differingRules: 'Rechnerische Prüfung',
  // Rows with the same differing values, named together (audit R3-U-03)
  labelsAnd: ' und ',
  // G-1: rows "nur im Einzelfall nötig" without a value are folded; jump links from the box.
  // A fold-out names what it holds, not "anzeigen", which stays wrong once it is open (QU-11), and
  // with the word of its rows' badges: „in besonderen Fällen“ is the section below (R2-U-07)
  foldedRows: '{count} Angaben „nur im Einzelfall nötig“ (nicht in der XML)',
  foldedRow: 'Eine Angabe „nur im Einzelfall nötig“ (nicht in der XML)',
  jumpTo: 'Springen zu:',
  jumpPflicht: 'Pflichtangaben',
  jumpRules: 'Rechnerische Prüfung',
  jumpSchema: 'Technische Meldungen',
  // G-2: the technical rows of an invoice, closed
  technicalDetails: 'Technische Angaben',
  // QU-13: the heading of the invoice data, which also names their table
  invoiceDataHeading: 'Rechnungsdaten',
  // G-8/F27: several invoice XML in one PDF
  sameHeading: 'Rechnungsdaten (gleich in {names})',
  // G-8: a technical row of one of the parts, where the parts differ in it (audit R3-U-09)
  attachmentsRow: 'Anhänge',
  ofPart: '{label}, Anhang „{name}“',
  comparisonHeading: 'Vergleich der Rechnungsdaten',
  comparisonValue: 'Wert',
  // G-4: pass the result on to the Kanzlei
  printResult: 'Ergebnis drucken',
  copyResult: 'Ergebnis als Text kopieren',
  copied: 'Das Ergebnis ist in die Zwischenablage kopiert.',
  copyFailed:
    'Kopieren hat nicht geklappt. Bitte markieren Sie den Text und kopieren Sie ihn selbst.',
  copyTitle: 'E-Rechnung prüfen – Ergebnis',
  copyHeadline: 'Ergebnis: {headline}',
  // a dash, not a colon: the summaries have colons of their own („Mögliche Auffälligkeit: …“, R3-U-08)
  copyPflicht: 'Pflichtangaben – {summary}',
  copyRules: 'Rechnerische Prüfung – {summary}',
  copyVersion: 'Version {version}',
  // G-5: the drop zone after a result, and on a phone
  anotherFile: 'Andere Datei prüfen',
  dropTitle: 'Rechnung hierher ziehen',
  dropTitlePhone: 'Rechnung auswählen',
  chooseFile: 'Datei auswählen',
  dropSub: 'PDF oder XML. Die Datei bleibt auf Ihrem Gerät.',
  introLeadText: 'Wählen Sie eine Rechnung aus oder ziehen Sie sie hierher.',
  // QU-10: on a phone nothing can be dragged — the sentence says it as the title does (G-5)
  introLeadTextPhone: 'Wählen Sie eine Rechnung aus.',

  // The access notice before the hosted copy opens (Tobias 2026-11-15, as in the Fragebogen); the
  // notice itself comes from the local Kanzlei configuration, never from this repo
  accessTitle: 'Bitte bestätigen',
  accessRemember: 'Antwort für die Zukunft merken',
  accessRememberNote: 'Gemerkt wird nur in diesem Browser.',
  // the browser keeps nothing (blocked site data): no offer that does nothing (audit R3-U-12)
  accessCannotRemember: 'In diesem Browser lässt sich die Antwort nicht merken.',
  accessContinue: 'Weiter',
  // Links at the foot of the page, addresses from the local Kanzlei configuration
  imprint: 'Impressum',
  privacy: 'Datenschutz',
  // Said to screen readers only: these links open a new tab (audit QU-15, technique G201)
  newTab: '(öffnet in neuem Tab)',

  // Only the first file of a drop counts — said, not silent (audit Bedienung, A-04)
  onlyFirstFile: 'Sie haben {count} Dateien abgelegt. Geprüft wurde nur die erste.',

  // An unexpected error: the German sentences first, the engine's (mostly English) message last as
  // a technical line (G-10, audit QU-14)
  failedHeadline: 'Die Prüfung ist abgebrochen',
  failedWhy: 'Bei „{name}“ ist ein unerwarteter Fehler aufgetreten.',
  failedAgain: 'Bitte versuchen Sie es erneut oder wenden Sie sich an Ihre Kanzlei.',

  announceChecking: '„{name}“ wird geprüft.',
  announceResult: 'Ergebnis: {headline}.',
  announceFailed: 'Die Prüfung ist abgebrochen.',

  // Step 3a: calculation rules of EN 16931 (a selection)
  rulesHeading: 'Rechnerische Prüfung (Auswahl von Regeln der EN 16931)',
  rulesOk: 'Die geprüften Beträge passen zusammen.',
  rulesFerdRules:
    'Für das Profil EXTENDED gelten die Rechenregeln von FeRD (Factur-X 1.09.2): Logistikkosten zählen als Zuschläge, Gruppen- und Infozeilen zählen nicht mit, kleine Abweichungen je Betrag sind erlaubt.',
  rulesOwnRules:
    'Für das Profil EXTENDED gelten eigene Rechenregeln von FeRD. Diese werden hier nicht geprüft, nur die Regel BR-CO-14.',
  // the rule of XRechnung in place of one of EN 16931, as the KoSIT validator (audit R6-U-01)
  rulesThirdParty:
    'Für XRechnung mit Extension prüft das Werkzeug wie der KoSIT-Validator die Regel BR-DEX-09 der XRechnung statt BR-CO-16 der EN 16931: Forderungen Dritter (BG-DEX-09) gehören zum fälligen Betrag.',
  rulesAuffaellig: 'Mögliche Auffälligkeit: {ids}.',
  // F23 by the kind of rule (Tobias 2026-11-14)
  adviceAmount: 'Sie könnten mit dem Lieferanten klären, welcher Betrag richtig ist.',
  adviceAmountBeforePayment:
    'Sie könnten vor der Zahlung mit dem Lieferanten klären, welcher Betrag richtig ist.',
  adviceTax:
    'Als Vorsteuer abziehbar ist höchstens die gesetzlich geschuldete Steuer, bei zu niedrigem Ausweis nur der ausgewiesene Betrag.',
  adviceNet:
    'Das Entgelt ist eine Pflichtangabe; ein Fehler darin kann den Vorsteuerabzug gefährden.',
  rulesHint: 'Mögliche Auffälligkeit bei den Beträgen: {ids} (siehe „Rechnerische Prüfung“).',
  rulesHintIn:
    'Mögliche Auffälligkeit bei den Beträgen im Anhang „{name}“: {ids} (siehe „Rechnerische Prüfung“).',
  rulesShowAll: 'Alle geprüften Regeln',
  rulesShowOthers: 'Weitere geprüfte Regeln',
  ruleStatusPasst: 'passt',
  ruleStatusAuffaellig: 'mögliche Auffälligkeit',
  ruleStatusNichtPruefbar: 'nicht prüfbar',
  ruleOccurrence: 'Kategorie {category}, {rate}',
  ruleLineSum: 'Summe der Positionen (BT-131)',
  ruleLineSumDetail: 'Summe der Positionen (BT-131, ohne Gruppen- und Infozeilen)',
  ruleSumLogistics: 'Summe der Logistikkosten (BT-X-272)',
  ruleSumAdjustments: 'Summe der Ausgleichsbeträge',
  ruleSumAllowances: 'Summe der Nachlässe auf Dokumentebene (BT-92)',
  ruleSumCharges: 'Summe der Zuschläge auf Dokumentebene (BT-99)',
  ruleSumTaxes: 'Summe der Steuerbeträge je Kategorie (BT-117)',
  // XRechnung Extension, BR-DEX-09 (audit R5-L-01). Our own German: KoSIT names the group only
  // „THIRD PARTY PAYMENT“; the amounts are claims of third parties the supplier collects, added
  // to the amount due (audit R6-U-01)
  ruleThirdParty: 'Forderungen Dritter, im fälligen Betrag enthalten (BG-DEX-09)',
  // The sums of one VAT breakdown, named apart from the document totals (audit R3-U-07):
  // „Summe der Positionen mit diesem Satz (BT-131)“, „… dieser Kategorie (BT-131)“
  ruleOfRate: 'mit diesem Satz',
  ruleOfCategory: 'dieser Kategorie',
  // What the rule computes from the other values — the client compares it with the invoice
  // (audit Bedienung, V-04)
  ruleExpected: 'Nach der Regel erwartet',
  rulesNone: 'Keine der ausgewählten Regeln lässt sich auf diese Rechnung anwenden.',
  rulesOneNotChecked: 'Eine Regel ließ sich nicht prüfen (siehe unten).',
  rulesSomeNotChecked: '{count} Regeln ließen sich nicht prüfen (siehe unten).',
  ruleMissing: '– nicht angegeben',
  ruleNoNumber: '– keine Zahl',
  // A rate that is no number in a part of a breakdown per rate: the rate is named (audit R2-L-07)
  ruleLineRate: 'Umsatzsteuersatz einer Position (BT-152)',
  ruleChargeRate: 'Umsatzsteuersatz eines Zuschlags auf Dokumentebene (BT-103)',
  ruleAllowanceRate: 'Umsatzsteuersatz eines Nachlasses auf Dokumentebene (BT-96)',
  // UBL BR-S-08 wants a line, charge or allowance of its rate (audit R2-L-05)
  ruleOwnParts: 'Positionen, Zuschläge oder Nachlässe mit diesem Satz',
  ruleOwnPartsNone: 'keine',
  // BR-CO-15 adds BT-110 only where exactly one is given in the document currency (audit R2-L-03)
  ruleTaxTotals: 'Angaben „Summe der Umsatzsteuer“ (BT-110) in Rechnungswährung',
  ruleTaxTotalsCount: '{count} – die Regel verlangt genau eine',
  // Without the invoice currency BR-CO-14 and BR-CO-15 are not checked (audit R3-L-01)
  ruleCurrency: 'Rechnungswährung (BT-5)',
  ruleAnd: ' und ',

  pflichtHeading: 'Pflichtangaben nach § 14 Abs. 4 UStG',
  besondereHeading: 'Angaben in besonderen Fällen (§ 14 Abs. 5, § 14a, § 22c UStG)',
  // F21 (Tobias 2026-11-14)
  allPresent:
    'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
  // F22: the F21 sentence names the hints of the rows
  hintBelow: 'Bitte beachten Sie den Hinweis unten.',
  hintsBelow: 'Bitte beachten Sie die {count} Hinweise unten.',
  missingList: 'Es fehlt: {list}.',
  // QU-05: a row hint is named in words, not by its colour alone — every one with the same word,
  // the one box and summary use (audit R2-U-06)
  rowHintLabel: 'Hinweis:',
  // QU-03: what is missing of a partly present row — "nur …" read as "only this is there"
  missingPart: 'davon fehlt:',
  missingParts: 'davon fehlen:',
  addressCity: 'Ort',
  addressPostcodeOrStreet: 'Postleitzahl oder Straße/Postfach',
  // the group itself, so the row reads „davon fehlt: Aufschlüsselung der Umsatzsteuer“ (R3-L-06)
  noGroup: '{group}',
  // BT-110 is defined in the invoice currency: without BT-5 the tool reads none, though the XML
  // may hold the amount — the gap named as it is (audit R4-L-01; whether BT-5 is a Pflichtangabe
  // of its own is F33)
  taxTotalNoCurrency:
    'Summe der Umsatzsteuer in Rechnungswährung – die Rechnung nennt keine Rechnungswährung (BT-5)',
  statusVorhanden: 'vorhanden',
  statusFehlt: 'fehlt',
  statusEinzelfall: 'nur im Einzelfall nötig',
  showPositions: 'Positionen ({count})',
  notInXml: '– nicht in der XML',
  noModel:
    'Für diese Rechnungsdaten zeigt das Tool keine Pflichtangaben (kein Format nach EN 16931).',
  noPflichtNoEInvoice:
    'Für Rechnungsdaten, die keine E-Rechnung sind, zeigt das Tool keine Pflichtangaben. Maßgeblich ist dann die lesbare Rechnung, nicht die XML.',

  fileProblems: {
    empty: { tone: 'bad', headline: 'Die Datei ist leer', explanation: [RESEND] },
    // The browser cannot read it: a dropped folder, or a file moved or deleted meanwhile — the
    // browser's own (English) message is not shown (audit Bedienung, A-03)
    unreadable: {
      tone: 'bad',
      headline: 'Die Datei lässt sich nicht öffnen',
      explanation: [
        'Vielleicht ist es ein Ordner, oder die Datei wurde inzwischen verschoben. Bitte wählen Sie eine einzelne PDF- oder XML-Datei.',
        RESEND,
      ],
    },
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
        'Das Tool kann geschützte PDF-Dateien nicht lesen. Sie könnten beim Lieferanten eine ungeschützte Fassung anfordern.',
      ],
    },
    damaged: {
      tone: 'bad',
      headline: 'Das PDF lässt sich nicht lesen',
      explanation: ['Die Datei ist beschädigt oder kein PDF.', RESEND],
    },
    xmlDoctype: {
      tone: 'warn',
      headline: 'XML-Datei mit Dokumenttyp-Angabe: nicht geprüft',
      explanation: [
        'E-Rechnungen enthalten keine Dokumenttyp-Angabe (DOCTYPE). Aus Sicherheitsgründen prüft das Tool solche Dateien nicht.',
        KANZLEI_JUDGES,
      ],
    },
    xmlBroken: {
      tone: 'bad',
      headline: 'Die XML-Datei ist fehlerhaft',
      explanation: [FORMAT_ERROR],
    },
  } satisfies Record<FileProblemKind, { tone: Tone; headline: string; explanation: string[] }>,
};

/**
 * Pointers to other parts of the page inside the sentences above. The copied text for a mail (G-4,
 * zusammenfassung.ts) has no „unten“ and no section to point to, so it leaves them out, together
 * with `hintBelow` / `hintsBelow` (audit R3-U-08); zusammenfassung.test.ts checks that no sentence
 * of TEXTS keeps one there.
 */
export const PAGE_POINTERS: readonly string[] = [
  ' (siehe unten)',
  ' (siehe „Pflichtangaben“)',
  ' (siehe „Rechnerische Prüfung“)',
  ' (siehe „Vergleich der Rechnungsdaten“)',
];

/** Replaces {name} placeholders. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : whole,
  );
}

/**
 * A no-break space before „%“, so „7 %“ as written in an XML never breaks over two lines (audit
 * R3-U-10, R6-U-02)
 */
export const keepPercent = (text: string): string => text.replace(/(\d) %/g, '$1\u00a0%');

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
