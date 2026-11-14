// Sample files for testers (folder beispiele/, written by `npm run beispiele`). Data: one entry per
// file. XML comes from the KoSIT XRechnung test suite (Apache-2.0), with invented names instead of
// its placeholders and the changes listed per entry; the PDF files are built here (minipdf) with a
// page drawn from the invoice data. tests/beispiele/beispiele.test.ts checks every expected result
// and that each result headline, case text and hint of the tool appears in at least one sample.
import { createHash } from 'node:crypto';
import { analyzeFile } from '../io/analyze';
import { displayValue } from '../logic/check';
import { firstValue, groupsOf } from '../logic/model';
import type { InvoiceModel, ModelGroup } from '../logic/model';
import { TYPE_CODES } from '../logic/texts';
import type { Tone } from '../logic/verdict';
import { miniPdf, winAnsi } from './minipdf';
import type { PageLine } from './minipdf';

export const KOSIT_SOURCE =
  'KoSIT XRechnung-Testsuite v2026-08-31 (https://github.com/itplr-kosit/xrechnung-testsuite), Apache License 2.0';

/** An exact text change; without `alle` the text must occur exactly once. */
export interface Aenderung {
  ersetze: string;
  durch: string;
  alle?: boolean;
}

/** A KoSIT file (path below tests/fixtures/offiziell/kosit/) and what is changed in it. */
export interface KositXml {
  basis: string;
  aenderungen?: Aenderung[];
  /** The change breaks the official schema on purpose (sample for the schema check, step 2b) */
  schemafehler?: boolean;
  /** Short German note of the changes for the comment in the file */
  geaendert?: string;
}

export type Quelle =
  | { art: 'kosit'; xml: KositXml }
  | { art: 'eigeneXml'; text: string }
  | {
      art: 'pdf';
      /** The visible page is drawn from this invoice (also when it is not attached) */
      seite: KositXml;
      xml: { name: string; xml: KositXml | string }[];
      andere?: { name: string; text: string }[];
      kennwort?: boolean;
    }
  | { art: 'roh'; text: string };

export interface Beispiel {
  datei: string;
  /** What the file shows (German, for the overview page) */
  zeigt: string;
  quelle: Quelle;
  erwartet: { ton: Tone; ueberschrift: string; pflicht?: string };
}

// The KoSIT files use placeholders such as "[Seller name]"; invented names read better.
const NAMEN: Readonly<Record<string, string>> = {
  '[Seller name]': 'Muster Lieferant GmbH',
  '[Seller trading name]': 'Muster Lieferant',
  '[Seller address line 1]': 'Lieferweg 1',
  '[Seller street]': 'Lieferweg 1',
  '[Seller city]': 'Musterstadt',
  '[Seller contact person]': 'Max Mustermann',
  '[Seller tax representative name]': 'Muster Fiskalvertretung GmbH',
  '[Buyer name]': 'Beispiel Käufer GmbH',
  '[Buyer address line 1]': 'Kaufstraße 2',
  '[Buyer city]': 'Beispielstadt',
  '[Buyer contact person]': 'Erika Mustermann',
  '[Buyer identifier]': 'K-4711',
  '[Payee name]': 'Muster Zahlstelle GmbH',
  '[Deliver to party name]': 'Beispiel Lager',
  '[Deliver to address line 1]': 'Lagerweg 3',
  '[Deliver to street]': 'Lagerweg 3',
  '[Deliver to city]': 'Lagerstadt',
  '[ShipToTradeParty]': 'Beispiel Empfänger',
  '[Street]': 'Musterweg 5',
  '[City]': 'Musterort',
};

const XRECHNUNG_ID = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
const ciiSpec = (id: string): Aenderung => ({
  ersetze: `<ram:ID>${XRECHNUNG_ID}</ram:ID>`,
  durch: `<ram:ID>${id}</ram:ID>`,
});

const CII_CLEAN = 'paare/01.05a-INVOICE_uncefact.xml';
const ZUGFERD_EN16931: KositXml = {
  basis: CII_CLEAN,
  aenderungen: [ciiSpec('urn:cen.eu:en16931:2017')],
  geaendert: 'Kennung der Spezifikation (BT-24) auf EN 16931 (ZUGFeRD/Factur-X EN 16931)',
};

const BROKEN_XML =
  '<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">\n  <rsm:ExchangedDocument>\n    <ram:ID>R-1</ram:ID>\n</rsm:CrossIndustryInvoice>\n';

const DOCTYPE_XML =
  '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE Rechnung [ <!ENTITY firma "Muster Lieferant GmbH"> ]>\n<Rechnung>&firma;</Rechnung>\n';

export const BEISPIELE: readonly Beispiel[] = [
  {
    datei: '01_XRechnung_UBL_vollstaendig.xml',
    zeigt: 'XRechnung als XML (UBL), alle Pflichtangaben vorhanden.',
    quelle: { art: 'kosit', xml: { basis: 'paare/01.05a-INVOICE_ubl.xml' } },
    erwartet: {
      ton: 'ok',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '02_XRechnung_CII_vollstaendig.xml',
    zeigt: 'XRechnung als XML (CII), alle Pflichtangaben vorhanden.',
    quelle: { art: 'kosit', xml: { basis: 'paare/01.06a-INVOICE_uncefact.xml' } },
    erwartet: {
      ton: 'ok',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '03_Kleinbetragsrechnung.xml',
    zeigt:
      'Rechnung über 12,60 Euro: es gelten die verringerten Angaben einer Kleinbetragsrechnung.',
    quelle: { art: 'kosit', xml: { basis: 'paare/01.02a-INVOICE_ubl.xml' } },
    erwartet: {
      ton: 'ok',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '04_Kleinunternehmer.xml',
    zeigt: 'Rechnung eines Kleinunternehmers (§ 19 UStG): verringerte Angaben, keine Umsatzsteuer.',
    quelle: {
      art: 'kosit',
      xml: {
        basis: 'paare/01.02a-INVOICE_ubl.xml',
        geaendert:
          'als Rechnung eines Kleinunternehmers: Kategorie E, 0 %, Befreiungsgrund § 19 UStG, Beträge ohne Umsatzsteuer',
        aenderungen: [
          {
            ersetze: '<cbc:TaxAmount currencyID="EUR">0.82</cbc:TaxAmount>',
            durch: '<cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>',
            alle: true,
          },
          {
            ersetze: '<cbc:ID>S</cbc:ID>\n                <cbc:Percent>7</cbc:Percent>',
            durch: '<cbc:ID>E</cbc:ID>\n                <cbc:Percent>0</cbc:Percent>',
            alle: true,
          },
          {
            ersetze:
              '<cbc:Percent>0</cbc:Percent>\n                <cac:TaxScheme>\n                    <cbc:ID>VAT</cbc:ID>\n                </cac:TaxScheme>\n            </cac:TaxCategory>',
            durch:
              '<cbc:Percent>0</cbc:Percent>\n                <cbc:TaxExemptionReason>Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG</cbc:TaxExemptionReason>\n                <cac:TaxScheme>\n                    <cbc:ID>VAT</cbc:ID>\n                </cac:TaxScheme>\n            </cac:TaxCategory>',
          },
          {
            ersetze: '<cbc:TaxInclusiveAmount currencyID="EUR">12.6</cbc:TaxInclusiveAmount>',
            durch: '<cbc:TaxInclusiveAmount currencyID="EUR">11.78</cbc:TaxInclusiveAmount>',
          },
          {
            ersetze: '<cbc:PayableAmount currencyID="EUR">12.6</cbc:PayableAmount>',
            durch: '<cbc:PayableAmount currencyID="EUR">11.78</cbc:PayableAmount>',
          },
        ],
      },
    },
    erwartet: {
      ton: 'ok',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '05_Leistungszeitraum_nicht_bei_jeder_Position.xml',
    zeigt:
      'Abonnement mit Leistungszeitraum, die Position „Porto + Versandkosten“ ohne eigenen Zeitraum: Hinweis zur Nebenleistung.',
    quelle: { art: 'kosit', xml: { basis: 'paare/01.01a-INVOICE_ubl.xml' } },
    erwartet: {
      ton: 'warn',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft. Bitte beachten Sie den Hinweis unten.',
    },
  },
  {
    datei: '06_Leistungsdatum_nur_als_Vermerk.xml',
    zeigt:
      'Kein Leistungsdatum in den Daten, nur der Vermerk „Leistungsdatum entspricht Rechnungsdatum“: das genügt in einer E-Rechnung nicht.',
    quelle: {
      art: 'kosit',
      xml: {
        basis: 'paare/01.08a-INVOICE_ubl.xml',
        geaendert: 'Bemerkung „Leistungsdatum entspricht Rechnungsdatum.“ ergänzt',
        aenderungen: [
          {
            ersetze: '<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>',
            durch:
              '<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>\n    <cbc:Note>Leistungsdatum entspricht Rechnungsdatum.</cbc:Note>',
          },
        ],
      },
    },
    erwartet: {
      ton: 'warn',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
      pflicht: 'Es fehlt: Zeitpunkt der Lieferung oder Leistung (Kalendermonat genügt).',
    },
  },
  {
    datei: '07_Anschriften_ohne_Strasse_Fiskalvertreter_unvollstaendig.xml',
    zeigt:
      'Anschriften ohne Straße (Hinweis) und ein Fiskalvertreter ohne vollständige Angaben (fehlt).',
    quelle: { art: 'kosit', xml: { basis: 'paare/01.14a-INVOICE_ubl.xml' } },
    erwartet: {
      ton: 'warn',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
      pflicht:
        'Es fehlt: Fiskalvertreter: Name, Anschrift und USt-IdNr. (nur Ort; Postleitzahl oder Straße/Postfach).',
    },
  },
  {
    datei: '08_Gutschrift_vom_Leistungsempfaenger.xml',
    zeigt: 'Gutschrift im Sinne des UStG (Typcode 389, vom Leistungsempfänger ausgestellt).',
    quelle: { art: 'kosit', xml: { basis: 'paare/01.20a-INVOICE_ubl.xml' } },
    erwartet: {
      ton: 'ok',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '09_Rechnungskorrektur_mit_Bemerkung_Gutschrift.xml',
    zeigt:
      'Rechnungskorrektur (Typcode 381), die in einer Bemerkung „Gutschrift“ heißt: Hinweis, dass das keine Gutschrift im Sinne des UStG ist.',
    quelle: {
      art: 'kosit',
      xml: {
        basis: 'paare/01.06a-INVOICE_uncefact.xml',
        geaendert: 'Art der Rechnung 381 statt 380, Bemerkung „Gutschrift zur Rechnung R123456788“',
        aenderungen: [
          {
            ersetze: '<ram:TypeCode>380</ram:TypeCode>',
            durch: '<ram:TypeCode>381</ram:TypeCode>',
          },
          {
            ersetze: '    </rsm:ExchangedDocument>',
            durch:
              '        <ram:IncludedNote>\n            <ram:Content>Gutschrift zur Rechnung R123456788</ram:Content>\n        </ram:IncludedNote>\n    </rsm:ExchangedDocument>',
          },
        ],
      },
    },
    erwartet: {
      ton: 'warn',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft. Bitte beachten Sie den Hinweis unten.',
    },
  },
  {
    datei: '10_Steuerschuldnerschaft_des_Leistungsempfaengers.xml',
    zeigt:
      'Leistung, für die der Leistungsempfänger die Steuer schuldet (Kategorie AE, § 13b UStG), mit beiden USt-IdNr.',
    quelle: { art: 'kosit', xml: { basis: 'paare/01.21a-INVOICE_ubl.xml' } },
    erwartet: {
      ton: 'ok',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '11_Unbekannte_Spezifikation.xml',
    zeigt: 'Rechnungsdaten mit einer Kennung der Spezifikation, die das Tool nicht kennt.',
    quelle: {
      art: 'kosit',
      xml: {
        basis: 'paare/01.05a-INVOICE_ubl.xml',
        geaendert: 'Kennung der Spezifikation (BT-24) durch eine erfundene ersetzt',
        aenderungen: [
          {
            ersetze: `<cbc:CustomizationID>${XRECHNUNG_ID}</cbc:CustomizationID>`,
            durch:
              '<cbc:CustomizationID>urn:beispiel:unbekannte-spezifikation:1.0</cbc:CustomizationID>',
          },
        ],
      },
    },
    erwartet: {
      ton: 'warn',
      ueberschrift: 'Rechnungsdaten erkannt, Spezifikation unbekannt: nicht beurteilt',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '12_Kennung_ZUGFeRD_1.0.xml',
    zeigt: 'Rechnungsdaten mit der Kennung von ZUGFeRD 1.0: keine E-Rechnung.',
    quelle: {
      art: 'kosit',
      xml: {
        basis: CII_CLEAN,
        aenderungen: [ciiSpec('urn:ferd:CrossIndustryDocument:invoice:1p0:comfort')],
        geaendert: 'Kennung der Spezifikation (BT-24) auf ZUGFeRD 1.0 COMFORT',
      },
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'Rechnungsdaten nach ZUGFeRD 1.0: keine E-Rechnung im Sinne des UStG',
    },
  },
  {
    datei: '13_Keine_Rechnung.xml',
    zeigt: 'Eine XML-Datei, die keine Rechnung ist (ein Lieferschein).',
    quelle: {
      art: 'eigeneXml',
      text: '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Beispieldatei des E-Rechnungs-Prüfers mit erfundenen Daten -->\n<Lieferschein xmlns="urn:beispiel:lieferschein">\n  <Nummer>LS-100</Nummer>\n  <Datum>2026-11-02</Datum>\n  <Position>Bürostuhl, 2 Stück</Position>\n</Lieferschein>\n',
    },
    erwartet: { ton: 'warn', ueberschrift: 'XML-Datei ohne bekanntes Rechnungsformat' },
  },
  {
    datei: '14_Fehlerhafte_XML.xml',
    zeigt: 'Eine Rechnungs-XML, die abbricht (Formatfehler).',
    quelle: { art: 'eigeneXml', text: BROKEN_XML },
    erwartet: { ton: 'bad', ueberschrift: 'Die XML-Datei ist fehlerhaft' },
  },
  {
    datei: '15_XML_mit_Dokumenttyp.xml',
    zeigt: 'Eine XML-Datei mit Dokumenttyp-Angabe (DOCTYPE): aus Sicherheitsgründen nicht geprüft.',
    quelle: { art: 'eigeneXml', text: DOCTYPE_XML },
    erwartet: { ton: 'warn', ueberschrift: 'XML-Datei mit Dokumenttyp-Angabe: nicht geprüft' },
  },
  {
    datei: '16_ZUGFeRD_EN16931.pdf',
    zeigt: 'PDF mit Rechnungsdaten (ZUGFeRD/Factur-X, Profil EN 16931): eine E-Rechnung.',
    quelle: {
      art: 'pdf',
      seite: ZUGFERD_EN16931,
      xml: [{ name: 'factur-x.xml', xml: ZUGFERD_EN16931 }],
    },
    erwartet: {
      ton: 'ok',
      ueberschrift: 'E-Rechnung erkannt (EN 16931)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '17_ZUGFeRD_XRechnung.pdf',
    zeigt: 'PDF mit Rechnungsdaten im Profil XRECHNUNG: eine E-Rechnung.',
    quelle: {
      art: 'pdf',
      seite: { basis: CII_CLEAN },
      xml: [{ name: 'xrechnung.xml', xml: { basis: CII_CLEAN } }],
    },
    erwartet: {
      ton: 'ok',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '18_ZUGFeRD_MINIMUM.pdf',
    zeigt: 'PDF mit Rechnungsdaten im Profil MINIMUM: keine E-Rechnung im Sinne des UStG.',
    quelle: {
      art: 'pdf',
      seite: { basis: CII_CLEAN },
      xml: [
        {
          name: 'factur-x.xml',
          xml: {
            basis: CII_CLEAN,
            aenderungen: [ciiSpec('urn:factur-x.eu:1p0:minimum')],
            geaendert: 'Kennung der Spezifikation (BT-24) auf das Profil MINIMUM',
          },
        },
      ],
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'PDF mit Rechnungsdaten, Profil MINIMUM: keine E-Rechnung im Sinne des UStG',
    },
  },
  {
    datei: '19_ZUGFeRD_BASIC_WL.pdf',
    zeigt: 'PDF mit Rechnungsdaten im Profil BASIC WL: keine E-Rechnung im Sinne des UStG.',
    quelle: {
      art: 'pdf',
      seite: { basis: CII_CLEAN },
      xml: [
        {
          name: 'factur-x.xml',
          xml: {
            basis: CII_CLEAN,
            aenderungen: [ciiSpec('urn:factur-x.eu:1p0:basicwl')],
            geaendert: 'Kennung der Spezifikation (BT-24) auf das Profil BASIC WL',
          },
        },
      ],
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'PDF mit Rechnungsdaten, Profil BASIC WL: keine E-Rechnung im Sinne des UStG',
    },
  },
  {
    datei: '20_PDF_ohne_Rechnungsdaten.pdf',
    zeigt: 'Ein PDF, das wie eine Rechnung aussieht, aber keine Rechnungsdaten enthält.',
    quelle: { art: 'pdf', seite: { basis: CII_CLEAN }, xml: [] },
    erwartet: { ton: 'bad', ueberschrift: 'Keine E-Rechnung: einfaches PDF' },
  },
  {
    datei: '21_PDF_mit_anderem_Anhang.pdf',
    zeigt: 'Ein PDF mit einem Anhang, der keine Rechnungsdaten enthält (Lieferschein als Text).',
    quelle: {
      art: 'pdf',
      seite: { basis: CII_CLEAN },
      xml: [],
      andere: [{ name: 'lieferschein.txt', text: 'Lieferschein LS-100: Bürostuhl, 2 Stück' }],
    },
    erwartet: { ton: 'bad', ueberschrift: 'Keine E-Rechnung: PDF ohne Rechnungsdaten' },
  },
  {
    datei: '22_PDF_zwei_verschiedene_Rechnungsdaten.pdf',
    zeigt: 'Ein PDF mit zwei Rechnungs-XML, die sich in der Rechnungsnummer unterscheiden.',
    quelle: {
      art: 'pdf',
      seite: ZUGFERD_EN16931,
      xml: [
        { name: 'factur-x.xml', xml: ZUGFERD_EN16931 },
        {
          name: 'zugferd-invoice.xml',
          xml: {
            basis: CII_CLEAN,
            aenderungen: [
              ciiSpec('urn:cen.eu:en16931:2017'),
              { ersetze: '<ram:ID>PRG1502112</ram:ID>', durch: '<ram:ID>PRG1502113</ram:ID>' },
            ],
            geaendert: 'Kennung EN 16931, Rechnungsnummer PRG1502113 statt PRG1502112',
          },
        },
      ],
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'Rechnungsdaten mit Formatfehler: mehrere Rechnungs-XML im PDF',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '23_PDF_zweimal_dieselben_Rechnungsdaten.pdf',
    zeigt: 'Ein PDF, das dieselbe Rechnungs-XML zweimal enthält.',
    quelle: {
      art: 'pdf',
      seite: ZUGFERD_EN16931,
      xml: [
        { name: 'factur-x.xml', xml: ZUGFERD_EN16931 },
        { name: 'zugferd-invoice.xml', xml: ZUGFERD_EN16931 },
      ],
    },
    erwartet: {
      ton: 'warn',
      ueberschrift: 'E-Rechnung erkannt (EN 16931) – mit Hinweisen',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
  {
    datei: '24_PDF_mit_fehlerhafter_XML.pdf',
    zeigt: 'Ein PDF, dessen Rechnungs-XML abbricht (Formatfehler).',
    quelle: {
      art: 'pdf',
      seite: { basis: CII_CLEAN },
      xml: [{ name: 'factur-x.xml', xml: BROKEN_XML }],
    },
    erwartet: { ton: 'bad', ueberschrift: 'PDF mit fehlerhafter XML' },
  },
  {
    datei: '25_PDF_mit_Kennwort.pdf',
    zeigt: 'Ein PDF, das ein Kennwort verlangt.',
    quelle: {
      art: 'pdf',
      seite: ZUGFERD_EN16931,
      xml: [{ name: 'factur-x.xml', xml: ZUGFERD_EN16931 }],
      kennwort: true,
    },
    erwartet: { ton: 'bad', ueberschrift: 'Das PDF ist mit einem Kennwort geschützt' },
  },
  {
    datei: '26_PDF_beschaedigt.pdf',
    zeigt: 'Eine Datei, die mit „%PDF“ beginnt, aber kein lesbares PDF ist.',
    quelle: { art: 'roh', text: '%PDF-1.7\nDiese Datei ist absichtlich beschädigt.\n' },
    erwartet: { ton: 'bad', ueberschrift: 'Das PDF lässt sich nicht lesen' },
  },
  {
    datei: '27_PDF_mit_XML_mit_Dokumenttyp.pdf',
    zeigt:
      'Ein PDF, dessen XML-Anhang eine Dokumenttyp-Angabe (DOCTYPE) enthält: aus Sicherheitsgründen nicht gelesen, also nicht beurteilt.',
    quelle: {
      art: 'pdf',
      seite: { basis: CII_CLEAN },
      xml: [{ name: 'factur-x.xml', xml: DOCTYPE_XML }],
    },
    erwartet: { ton: 'warn', ueberschrift: 'PDF nicht vollständig geprüft' },
  },
  {
    datei: '28_Kleinunternehmer_Vermerk_mit_Steuerausweis.xml',
    zeigt:
      'Eine Rechnung mit 19 % Umsatzsteuer, die zugleich „Kleinunternehmer gemäß § 19 UStG“ vermerkt: volle Pflichtangaben und ein Hinweis auf den Widerspruch (§ 14c UStG).',
    quelle: {
      art: 'kosit',
      xml: {
        basis: 'paare/01.01a-INVOICE_ubl.xml',
        geaendert: 'zusätzliche Bemerkung „Kleinunternehmer gemäß § 19 UStG“',
        aenderungen: [
          {
            ersetze: '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
            durch:
              '<cbc:Note>Kleinunternehmer gemäß § 19 UStG</cbc:Note>\n    <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
          },
        ],
      },
    },
    erwartet: {
      ton: 'warn',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft. Bitte beachten Sie die 2 Hinweise unten.',
    },
  },
  {
    datei: '29_XRechnung_mit_Formatfehler.xml',
    zeigt:
      'Eine XRechnung, die nicht zum offiziellen Schema passt: ein Betrag mit Komma statt Punkt („336,90“). Formatfehler – möglicherweise keine E-Rechnung (F24).',
    quelle: {
      art: 'kosit',
      xml: {
        basis: 'paare/01.01a-INVOICE_ubl.xml',
        geaendert: 'Zahlbetrag mit Komma statt Punkt (Schemafehler)',
        schemafehler: true,
        aenderungen: [
          {
            ersetze: '<cbc:PayableAmount currencyID="EUR">336.9</cbc:PayableAmount>',
            durch: '<cbc:PayableAmount currencyID="EUR">336,90</cbc:PayableAmount>',
          },
        ],
      },
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'Rechnungsdaten mit Formatfehler (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft. Bitte beachten Sie den Hinweis unten.',
    },
  },
  {
    datei: '30_XRechnung_mit_Rechenfehler.xml',
    zeigt:
      'Eine XRechnung, deren Gesamtbetrag mit Umsatzsteuer nicht zur Summe aus Nettobetrag und Steuer passt: mögliche Auffälligkeit BR-CO-15 und BR-CO-16 mit den belegenden Werten.',
    quelle: {
      art: 'kosit',
      xml: {
        basis: 'paare/01.01a-INVOICE_ubl.xml',
        geaendert: 'Gesamtbetrag mit Umsatzsteuer um 10,00 EUR zu hoch (Rechenfehler)',
        aenderungen: [
          {
            ersetze: '<cbc:TaxInclusiveAmount currencyID="EUR">336.9</cbc:TaxInclusiveAmount>',
            durch: '<cbc:TaxInclusiveAmount currencyID="EUR">346.9</cbc:TaxInclusiveAmount>',
          },
        ],
      },
    },
    erwartet: {
      ton: 'warn',
      ueberschrift: 'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft. Bitte beachten Sie den Hinweis unten.',
    },
  },
  {
    datei: '31_MINIMUM_als_XML.xml',
    zeigt:
      'Rechnungsdaten im Profil MINIMUM als eigene XML-Datei: keine E-Rechnung; dazu der Satz zum Leistungsdatum oder der allgemeine Satz (F26).',
    quelle: {
      art: 'kosit',
      xml: {
        basis: CII_CLEAN,
        aenderungen: [ciiSpec('urn:factur-x.eu:1p0:minimum')],
        geaendert: 'Kennung der Spezifikation (BT-24) auf das Profil MINIMUM',
      },
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'Rechnungsdaten im Profil MINIMUM: keine E-Rechnung im Sinne des UStG',
    },
  },
  {
    datei: '32_ZUGFeRD_1.0.pdf',
    zeigt:
      'PDF mit Rechnungsdaten nach ZUGFeRD 1.0: keine E-Rechnung (G-7: eine Version, kein Profil).',
    quelle: {
      art: 'pdf',
      seite: { basis: CII_CLEAN },
      xml: [
        {
          name: 'ZUGFeRD-invoice.xml',
          xml: {
            basis: CII_CLEAN,
            aenderungen: [ciiSpec('urn:ferd:CrossIndustryDocument:invoice:1p0:comfort')],
            geaendert: 'Kennung der Spezifikation (BT-24) auf ZUGFeRD 1.0 COMFORT',
          },
        },
      ],
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'PDF mit Rechnungsdaten nach ZUGFeRD 1.0: keine E-Rechnung im Sinne des UStG',
    },
  },
  {
    datei: '33_MINIMUM_Leistung_2026.xml',
    zeigt:
      'Rechnungsdaten im Profil MINIMUM, Leistung im November 2026, Rechnung vom 30.11.2026: keine E-Rechnung, aber eine sonstige Rechnung ist noch zulässig (F26, § 27 Abs. 38 Nr. 1 UStG).',
    quelle: {
      art: 'kosit',
      xml: {
        basis: CII_CLEAN,
        aenderungen: [
          ciiSpec('urn:factur-x.eu:1p0:minimum'),
          {
            ersetze: '<udt:DateTimeString format="102">20150424</udt:DateTimeString>',
            durch: '<udt:DateTimeString format="102">20261130</udt:DateTimeString>',
            alle: true,
          },
          {
            ersetze: '<udt:DateTimeString format="102">20150420</udt:DateTimeString>',
            durch: '<udt:DateTimeString format="102">20261101</udt:DateTimeString>',
          },
        ],
        geaendert:
          'Kennung auf das Profil MINIMUM; Rechnungsdatum 30.11.2026, Leistungszeitraum 01.–30.11.2026',
      },
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'Rechnungsdaten im Profil MINIMUM: keine E-Rechnung im Sinne des UStG',
    },
  },
  {
    datei: '34_BASIC_WL_Leistung_2027.xml',
    zeigt:
      'Rechnungsdaten im Profil BASIC WL, Leistung im März 2027: zulässig nur bei einem Vorjahresumsatz des Lieferanten bis 800.000 Euro – mit der Frage, ob das geklärt ist (F26, § 27 Abs. 38 Nr. 2 UStG).',
    quelle: {
      art: 'kosit',
      xml: {
        basis: CII_CLEAN,
        aenderungen: [
          ciiSpec('urn:factur-x.eu:1p0:basicwl'),
          {
            ersetze: '<udt:DateTimeString format="102">20150424</udt:DateTimeString>',
            durch: '<udt:DateTimeString format="102">20270331</udt:DateTimeString>',
            alle: true,
          },
          {
            ersetze: '<udt:DateTimeString format="102">20150420</udt:DateTimeString>',
            durch: '<udt:DateTimeString format="102">20270301</udt:DateTimeString>',
          },
        ],
        geaendert:
          'Kennung auf das Profil BASIC WL; Rechnungsdatum 31.03.2027, Leistungszeitraum 01.–31.03.2027',
      },
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'Rechnungsdaten im Profil BASIC WL: keine E-Rechnung im Sinne des UStG',
    },
  },
  {
    datei: '35_Formatfehler_Leistung_2028.xml',
    zeigt:
      'Eine XRechnung mit Formatfehler (Betrag mit Komma), Leistung im Januar 2028: hier ist eine E-Rechnung nötig (F24, F26).',
    quelle: {
      art: 'kosit',
      xml: {
        basis: CII_CLEAN,
        schemafehler: true,
        aenderungen: [
          {
            ersetze: '<ram:DuePayableAmount>10555.3</ram:DuePayableAmount>',
            durch: '<ram:DuePayableAmount>10555,30</ram:DuePayableAmount>',
          },
          {
            ersetze: '<udt:DateTimeString format="102">20150424</udt:DateTimeString>',
            durch: '<udt:DateTimeString format="102">20280131</udt:DateTimeString>',
            alle: true,
          },
          {
            ersetze: '<udt:DateTimeString format="102">20150420</udt:DateTimeString>',
            durch: '<udt:DateTimeString format="102">20280101</udt:DateTimeString>',
          },
        ],
        geaendert:
          'Zahlbetrag mit Komma statt Punkt (Schemafehler); Rechnungsdatum 31.01.2028, Leistungszeitraum 01.–31.01.2028',
      },
    },
    erwartet: {
      ton: 'bad',
      ueberschrift: 'Rechnungsdaten mit Formatfehler (XRechnung 3.0)',
      pflicht:
        'Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall „nur im Einzelfall nötig“ zutrifft.',
    },
  },
];

/** Result headlines no sample shows, with the reason (checked by the coverage test). */
export const NICHT_ALS_BEISPIEL: Readonly<Record<string, string>> = {
  'Die Datei ist leer': 'eine leere Datei braucht kein Beispiel',
  'Diese Dateiart prüft das Tool nicht': 'jede andere Datei (z. B. ein Foto) zeigt es',
  'Die Datei ist zu groß': 'eine Datei über 20 MB wäre als Beispiel zu groß',
  'Die Datei lässt sich nicht öffnen': 'entsteht nur beim Ablegen eines Ordners',
};

// --- building ---------------------------------------------------------------------------------

export interface BuiltFile {
  name: string;
  bytes: Uint8Array;
}

/** Applies the changes; throws when a text is missing or (without `alle`) not unique. */
export function applyChanges(text: string, changes: readonly Aenderung[]): string {
  return changes.reduce((current, change) => {
    const count = current.split(change.ersetze).length - 1;
    if (count === 0) throw new Error(`Not found: ${change.ersetze}`);
    if (count > 1 && !change.alle) throw new Error(`Not unique (${count}×): ${change.ersetze}`);
    return current.split(change.ersetze).join(change.durch);
  }, text);
}

function kositText(xml: KositXml, read: (path: string) => string): string {
  let text = read(xml.basis).replace(/\r\n/g, '\n');
  for (const [placeholder, name] of Object.entries(NAMEN)) {
    text = text.split(placeholder).join(name);
  }
  text = applyChanges(text, xml.aenderungen ?? []);
  const changed = ['erfundene Namen statt Platzhalter', 'Zeilenenden LF', xml.geaendert]
    .filter((part): part is string => part !== undefined)
    .join('; ');
  const comment = `<!-- Beispieldatei des E-Rechnungs-Prüfers, erstellt aus der ${KOSIT_SOURCE}, Datei instances/standard/${xml.basis.replace(/^paare\//, '')}. Geändert: ${changed}. Alle Daten sind erfunden. -->`;
  const prolog = /^<\?xml[^>]*\?>\n?/.exec(text);
  if (!prolog) throw new Error(`No XML declaration in ${xml.basis}`);
  return `${prolog[0].trimEnd()}\n${comment}\n${text.slice(prolog[0].length)}`;
}

const encode = (text: string) => new TextEncoder().encode(text);
const noPdfJs = () => Promise.reject(new Error('XML only'));

async function modelOf(xml: string): Promise<InvoiceModel> {
  const analysis = await analyzeFile('seite.xml', encode(xml), noPdfJs);
  const model = analysis.invoices[0]?.model;
  if (!model) throw new Error('The page needs invoice data');
  return model;
}

const lastSegment = (path: string) => path.split('/').pop() ?? path;
const WIDTH = 92;

function wrap(text: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
    if (line && `${line} ${word}`.length > WIDTH) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The visible page of a sample PDF: the main data of the invoice in a simple layout. */
export function invoicePage(model: InvoiceModel, footer: string): PageLine[] {
  const currency = firstValue(model, 'BT-5');
  const at = (group: ModelGroup, path: string) => {
    const value = firstValue(group, path);
    return value === undefined ? undefined : displayValue(lastSegment(path), value, currency);
  };
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ');
  const type = firstValue(model, 'BT-3') ?? '380';
  const lines: PageLine[] = [{ text: (TYPE_CODES[type] ?? 'Rechnung').toUpperCase(), bold: true }];
  const seller = groupsOf(model, 'BG-4')[0];
  if (seller) {
    const address = groupsOf(seller, 'BG-5')[0];
    lines.push({
      text: [
        at(seller, 'BT-27'),
        address && at(address, 'BT-35'),
        address && join(at(address, 'BT-38'), at(address, 'BT-37')),
      ]
        .filter(Boolean)
        .join(' · '),
      space: 6,
    });
  }
  const buyer = groupsOf(model, 'BG-7')[0];
  if (buyer) {
    const address = groupsOf(buyer, 'BG-8')[0];
    lines.push({ text: at(buyer, 'BT-44') ?? '', space: 14 });
    if (address) {
      const street = at(address, 'BT-50');
      if (street) lines.push({ text: street });
      lines.push({ text: join(at(address, 'BT-53'), at(address, 'BT-52')) });
    }
  }
  lines.push({ text: `Rechnungsnummer: ${at(model, 'BT-1') ?? '–'}`, space: 16 });
  lines.push({ text: `Rechnungsdatum: ${at(model, 'BT-2') ?? '–'}` });
  const delivery = at(model, 'BG-13/BT-72');
  const from = at(model, 'BG-14/BT-73');
  const to = at(model, 'BG-14/BT-74');
  if (delivery) lines.push({ text: `Leistungsdatum: ${delivery}` });
  else if (from || to) lines.push({ text: `Leistungszeitraum: ${from ?? '…'} bis ${to ?? '…'}` });

  lines.push({ text: 'Pos.  Menge  Bezeichnung  Betrag netto', bold: true, space: 12 });
  for (const position of groupsOf(model, 'BG-25').slice(0, 12)) {
    const item = groupsOf(position, 'BG-31')[0];
    const text = join(
      at(position, 'BT-126'),
      ' ',
      at(position, 'BT-129'),
      at(position, 'BT-130'),
      ' ',
      item && at(item, 'BT-153'),
      ' ',
      at(position, 'BT-131'),
    );
    lines.push(...wrap(text).map((t) => ({ text: t })));
  }
  const totals = groupsOf(model, 'BG-22')[0];
  if (totals) {
    lines.push({ text: `Summe netto: ${at(totals, 'BT-109') ?? '–'}`, space: 10 });
    for (const vat of groupsOf(model, 'BG-23')) {
      lines.push({
        text: join(
          'Umsatzsteuer',
          at(vat, 'BT-118'),
          at(vat, 'BT-119'),
          `auf ${at(vat, 'BT-116') ?? '–'}:`,
          at(vat, 'BT-117') ?? '–',
        ),
      });
    }
    lines.push({ text: `Gesamtbetrag: ${at(totals, 'BT-112') ?? '–'}`, bold: true });
    const paid = at(totals, 'BT-113');
    if (paid) lines.push({ text: `Bereits gezahlt: ${paid}` });
    const due = at(totals, 'BT-115');
    if (due) lines.push({ text: `Zu zahlen: ${due}` });
  }
  const terms = firstValue(model, 'BT-20');
  if (terms)
    lines.push(...wrap(terms).map((t, i) => ({ text: t, ...(i === 0 ? { space: 10 } : {}) })));
  for (const note of groupsOf(model, 'BG-1').slice(0, 3)) {
    const text = firstValue(note, 'BT-22');
    if (text)
      lines.push(...wrap(text).map((t, i) => ({ text: t, ...(i === 0 ? { space: 6 } : {}) })));
  }
  lines.push(
    ...wrap(footer).map((t, i) => ({ text: t, bold: true, ...(i === 0 ? { space: 18 } : {}) })),
  );
  return lines;
}

const FOOTER_WITH_XML =
  'Beispielrechnung mit erfundenen Daten, keine echte Rechnung. Maßgeblich sind die Rechnungsdaten in der angehängten XML.';
const FOOTER_WITHOUT_XML =
  'Beispielrechnung mit erfundenen Daten, keine echte Rechnung. Dieses PDF enthält keine Rechnungsdaten als XML.';

/** Builds one sample; `read` gives a KoSIT file below tests/fixtures/offiziell/kosit/. */
export async function buildBeispiel(
  beispiel: Beispiel,
  read: (path: string) => string,
): Promise<Uint8Array> {
  const quelle = beispiel.quelle;
  switch (quelle.art) {
    case 'kosit':
      return encode(kositText(quelle.xml, read));
    case 'eigeneXml':
      return encode(quelle.text);
    case 'roh':
      return winAnsi(quelle.text);
    case 'pdf': {
      const xml = quelle.xml.map((part) => ({
        name: part.name,
        text: typeof part.xml === 'string' ? part.xml : kositText(part.xml, read),
      }));
      const model = await modelOf(kositText(quelle.seite, read));
      return miniPdf({
        lines: invoicePage(model, xml.length > 0 ? FOOTER_WITH_XML : FOOTER_WITHOUT_XML),
        attachments: [
          ...xml.map((part) => ({
            name: part.name,
            bytes: encode(part.text),
            mime: 'text/xml',
            relationship: 'Alternative' as const,
            description: 'Rechnungsdaten',
          })),
          ...(quelle.andere ?? []).map((other) => ({
            name: other.name,
            bytes: encode(other.text),
            mime: 'text/plain',
            relationship: 'Supplement' as const,
          })),
        ],
        ...(quelle.kennwort ? { passwordProtected: true } : {}),
      });
    }
  }
}

// --- overview page and licence note ---------------------------------------------------------

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE =
  'body{font-family:system-ui,sans-serif;margin:0;padding:24px 16px;color:#1d2125;background:#fff;line-height:1.45}main{max-width:900px;margin:0 auto}h1{font-size:1.5rem}table{border-collapse:collapse;width:100%}td,th{text-align:left;vertical-align:top;padding:8px 6px;border-bottom:1px solid #d6dbe0}a{color:#0b5cad}.datei{white-space:nowrap}@media (max-width:640px){td,th{display:block;border:0;padding:2px 0}tr{display:block;border-bottom:1px solid #d6dbe0;padding:8px 0}thead{display:none}.datei{white-space:normal;word-break:break-all}}@media (prefers-color-scheme:dark){body{background:#16181b;color:#e8eaed}a{color:#6aa8ef}td,th,tr{border-color:#3a3f45}}';

/** The overview page: one download link per file (no script, own strict CSP). */
export function beispieleSeite(): string {
  const hash = createHash('sha256').update(STYLE, 'utf8').digest('base64');
  const csp = `default-src 'none'; style-src 'sha256-${hash}'; base-uri 'none'; form-action 'none'`;
  const rows = BEISPIELE.map(
    (b) =>
      `<tr><td class="datei"><a href="${esc(b.datei)}" download>${esc(b.datei)}</a></td><td>${esc(b.zeigt)}</td></tr>`,
  ).join('\n');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Beispielrechnungen</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>Beispielrechnungen</h1>
<p>Beispieldateien zum Ausprobieren des E-Rechnungs-Prüfers. Alle Daten sind erfunden, keine Datei ist eine echte Rechnung.</p>
<p>Laden Sie eine Datei herunter. Ziehen Sie sie dann auf die Fläche „Rechnung hierher ziehen“ oder wählen Sie sie mit „Datei auswählen“.</p>
<table>
<thead><tr><th>Datei</th><th>Was sie zeigt</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<p>Die XML-Daten stammen aus der XRechnung-Testsuite der KoSIT (Apache License 2.0), mit erfundenen Namen statt Platzhaltern; was geändert ist, steht am Anfang jeder XML. Die PDF-Dateien hat der E-Rechnungs-Prüfer selbst erzeugt. Lizenzhinweise: <a href="LIZENZEN.txt">LIZENZEN.txt</a>.</p>
</main>
</body>
</html>
`;
}

export const LIZENZEN = `Beispielrechnungen des E-Rechnungs-Prüfers
==========================================

Alle Daten sind erfunden. Keine Datei ist eine echte Rechnung.

XML-Dateien und die Rechnungsdaten in den PDF-Dateien
  Quelle: ${KOSIT_SOURCE}
  Lizenz: Apache License 2.0, Text in LICENSE-Apache-2.0.txt
  Geändert: erfundene Namen statt der Platzhalter der Testsuite, Zeilenenden LF und je Datei die
  Änderungen, die im Kommentar am Anfang der XML stehen.

Eigene Dateien (13_Keine_Rechnung.xml, 14_Fehlerhafte_XML.xml, 15_XML_mit_Dokumenttyp.xml,
26_PDF_beschaedigt.pdf, die sichtbaren Seiten der PDF-Dateien)
  E-Rechnungs-Prüfer, https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer
  Lizenz: GNU AGPL v3 oder kommerziell (siehe LICENSE im Repository).
`;

/** Every file of the folder beispiele/ (built from the catalog). */
export async function buildFolder(
  read: (path: string) => string,
  apacheLicense: string,
): Promise<BuiltFile[]> {
  const samples = await Promise.all(
    BEISPIELE.map(async (b) => ({ name: b.datei, bytes: await buildBeispiel(b, read) })),
  );
  return [
    ...samples,
    { name: 'index.html', bytes: encode(beispieleSeite()) },
    { name: 'LIZENZEN.txt', bytes: encode(LIZENZEN) },
    { name: 'LICENSE-Apache-2.0.txt', bytes: encode(apacheLicense) },
  ];
}
