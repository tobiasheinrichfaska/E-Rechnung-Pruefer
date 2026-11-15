# Beispielrechnungen

Beispieldateien zum Ausprobieren des E-Rechnungs-Prüfers. Alle Daten sind erfunden, keine Datei ist
eine echte Rechnung. Dieser Ordner wird erzeugt (`npm run beispiele`); nie von Hand ändern.

**Herunterladen:** Klicken Sie unten auf den Namen einer Datei und dann auf „Download raw file“
(Pfeil nach unten, oben rechts über dem Inhalt). Ziehen Sie die Datei dann auf die Fläche „Rechnung
hierher ziehen“ oder wählen Sie sie mit „Datei auswählen“.

| Datei | Was sie zeigt |
| --- | --- |
| [01_XRechnung_UBL_vollstaendig.xml](01_XRechnung_UBL_vollstaendig.xml) | XRechnung als XML (UBL), alle Pflichtangaben vorhanden. |
| [02_XRechnung_CII_vollstaendig.xml](02_XRechnung_CII_vollstaendig.xml) | XRechnung als XML (CII), alle Pflichtangaben vorhanden. |
| [03_Kleinbetragsrechnung.xml](03_Kleinbetragsrechnung.xml) | Rechnung über 12,60 Euro: es gelten die verringerten Angaben einer Kleinbetragsrechnung. |
| [04_Kleinunternehmer.xml](04_Kleinunternehmer.xml) | Rechnung eines Kleinunternehmers (§ 19 UStG): verringerte Angaben, keine Umsatzsteuer. |
| [05_Leistungszeitraum_nicht_bei_jeder_Position.xml](05_Leistungszeitraum_nicht_bei_jeder_Position.xml) | Abonnement mit Leistungszeitraum, die Position „Porto + Versandkosten“ ohne eigenen Zeitraum: Hinweis zur Nebenleistung. |
| [06_Leistungsdatum_nur_als_Vermerk.xml](06_Leistungsdatum_nur_als_Vermerk.xml) | Kein Leistungsdatum in den Daten, nur der Vermerk „Leistungsdatum entspricht Rechnungsdatum“: das genügt in einer E-Rechnung nicht. |
| [07_Anschriften_ohne_Strasse_Fiskalvertreter_unvollstaendig.xml](07_Anschriften_ohne_Strasse_Fiskalvertreter_unvollstaendig.xml) | Anschriften ohne Straße (Hinweis) und ein Fiskalvertreter ohne vollständige Angaben (fehlt). |
| [08_Gutschrift_vom_Leistungsempfaenger.xml](08_Gutschrift_vom_Leistungsempfaenger.xml) | Gutschrift im Sinne des UStG (Typcode 389, vom Leistungsempfänger ausgestellt). |
| [09_Rechnungskorrektur_mit_Bemerkung_Gutschrift.xml](09_Rechnungskorrektur_mit_Bemerkung_Gutschrift.xml) | Rechnungskorrektur (Typcode 381), die in einer Bemerkung „Gutschrift“ heißt: Hinweis, dass das keine Gutschrift im Sinne des UStG ist. |
| [10_Steuerschuldnerschaft_des_Leistungsempfaengers.xml](10_Steuerschuldnerschaft_des_Leistungsempfaengers.xml) | Leistung, für die der Leistungsempfänger die Steuer schuldet (Kategorie AE, § 13b UStG), mit beiden USt-IdNr. |
| [11_Unbekannte_Spezifikation.xml](11_Unbekannte_Spezifikation.xml) | Rechnungsdaten mit einer Kennung der Spezifikation, die das Tool nicht kennt. |
| [12_Kennung_ZUGFeRD_1.0.xml](12_Kennung_ZUGFeRD_1.0.xml) | Rechnungsdaten mit der Kennung von ZUGFeRD 1.0: keine E-Rechnung. |
| [13_Keine_Rechnung.xml](13_Keine_Rechnung.xml) | Eine XML-Datei, die keine Rechnung ist (ein Lieferschein). |
| [14_Fehlerhafte_XML.xml](14_Fehlerhafte_XML.xml) | Eine Rechnungs-XML, die abbricht (Formatfehler). |
| [15_XML_mit_Dokumenttyp.xml](15_XML_mit_Dokumenttyp.xml) | Eine XML-Datei mit Dokumenttyp-Angabe (DOCTYPE): aus Sicherheitsgründen nicht geprüft. |
| [16_ZUGFeRD_EN16931.pdf](16_ZUGFeRD_EN16931.pdf) | PDF mit Rechnungsdaten (ZUGFeRD/Factur-X, Profil EN 16931): eine E-Rechnung. |
| [17_ZUGFeRD_XRechnung.pdf](17_ZUGFeRD_XRechnung.pdf) | PDF mit Rechnungsdaten im Profil XRECHNUNG: eine E-Rechnung. |
| [18_ZUGFeRD_MINIMUM.pdf](18_ZUGFeRD_MINIMUM.pdf) | PDF mit Rechnungsdaten im Profil MINIMUM: keine E-Rechnung im Sinne des UStG. |
| [19_ZUGFeRD_BASIC_WL.pdf](19_ZUGFeRD_BASIC_WL.pdf) | PDF mit Rechnungsdaten im Profil BASIC WL: keine E-Rechnung im Sinne des UStG. |
| [20_PDF_ohne_Rechnungsdaten.pdf](20_PDF_ohne_Rechnungsdaten.pdf) | Ein PDF, das wie eine Rechnung aussieht, aber keine Rechnungsdaten enthält. |
| [21_PDF_mit_anderem_Anhang.pdf](21_PDF_mit_anderem_Anhang.pdf) | Ein PDF mit einem Anhang, der keine Rechnungsdaten enthält (Lieferschein als Text). |
| [22_PDF_zwei_verschiedene_Rechnungsdaten.pdf](22_PDF_zwei_verschiedene_Rechnungsdaten.pdf) | Ein PDF mit zwei Rechnungs-XML, die sich in der Rechnungsnummer unterscheiden. |
| [23_PDF_zweimal_dieselben_Rechnungsdaten.pdf](23_PDF_zweimal_dieselben_Rechnungsdaten.pdf) | Ein PDF, das dieselbe Rechnungs-XML zweimal enthält. |
| [24_PDF_mit_fehlerhafter_XML.pdf](24_PDF_mit_fehlerhafter_XML.pdf) | Ein PDF, dessen Rechnungs-XML abbricht (Formatfehler). |
| [25_PDF_mit_Kennwort.pdf](25_PDF_mit_Kennwort.pdf) | Ein PDF, das ein Kennwort verlangt. |
| [26_PDF_beschaedigt.pdf](26_PDF_beschaedigt.pdf) | Eine Datei, die mit „%PDF“ beginnt, aber kein lesbares PDF ist. |
| [27_PDF_mit_XML_mit_Dokumenttyp.pdf](27_PDF_mit_XML_mit_Dokumenttyp.pdf) | Ein PDF, dessen XML-Anhang eine Dokumenttyp-Angabe (DOCTYPE) enthält: aus Sicherheitsgründen nicht gelesen, also nicht beurteilt. |
| [28_Kleinunternehmer_Vermerk_mit_Steuerausweis.xml](28_Kleinunternehmer_Vermerk_mit_Steuerausweis.xml) | Eine Rechnung mit 19 % Umsatzsteuer, die zugleich „Kleinunternehmer gemäß § 19 UStG“ vermerkt: volle Pflichtangaben und ein Hinweis auf den Widerspruch (§ 14c UStG). |
| [29_XRechnung_mit_Formatfehler.xml](29_XRechnung_mit_Formatfehler.xml) | Eine XRechnung, die nicht zum offiziellen Schema passt: ein Betrag mit Komma statt Punkt („336,90“). Formatfehler – möglicherweise keine E-Rechnung (F24). |
| [30_XRechnung_mit_Rechenfehler.xml](30_XRechnung_mit_Rechenfehler.xml) | Eine XRechnung, deren Gesamtbetrag mit Umsatzsteuer nicht zur Summe aus Nettobetrag und Steuer passt: mögliche Auffälligkeit BR-CO-15 und BR-CO-16 mit den belegenden Werten. |
| [31_MINIMUM_als_XML.xml](31_MINIMUM_als_XML.xml) | Rechnungsdaten im Profil MINIMUM als eigene XML-Datei: keine E-Rechnung; dazu der Satz zum Leistungsdatum oder der allgemeine Satz (F26). |
| [32_ZUGFeRD_1.0.pdf](32_ZUGFeRD_1.0.pdf) | PDF mit Rechnungsdaten nach ZUGFeRD 1.0: keine E-Rechnung (G-7: eine Version, kein Profil). |
| [33_MINIMUM_Leistung_2026.xml](33_MINIMUM_Leistung_2026.xml) | Rechnungsdaten im Profil MINIMUM, Leistung im November 2026, Rechnung vom 30.11.2026: keine E-Rechnung, aber eine sonstige Rechnung ist noch zulässig (F26, § 27 Abs. 38 Nr. 1 UStG). |
| [34_BASIC_WL_Leistung_2027.xml](34_BASIC_WL_Leistung_2027.xml) | Rechnungsdaten im Profil BASIC WL, Leistung im März 2027: zulässig nur bei einem Vorjahresumsatz des Lieferanten bis 800.000 Euro – mit der Frage, ob das geklärt ist (F26, § 27 Abs. 38 Nr. 2 UStG). |
| [35_Formatfehler_Leistung_2028.xml](35_Formatfehler_Leistung_2028.xml) | Eine XRechnung mit Formatfehler (Betrag mit Komma), Leistung im Januar 2028: hier ist eine E-Rechnung nötig (F24, F26). |

Die XML-Daten stammen aus der XRechnung-Testsuite der KoSIT (Apache License 2.0), mit erfundenen
Namen statt Platzhaltern; was geändert ist, steht am Anfang jeder XML. Die PDF-Dateien hat der
E-Rechnungs-Prüfer selbst erzeugt. Lizenzhinweise: [LIZENZEN.txt](LIZENZEN.txt).
