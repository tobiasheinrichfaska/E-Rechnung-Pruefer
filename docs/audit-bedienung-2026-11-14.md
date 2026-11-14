# Qualitätsaudit Bedienung – 14.11.2026

Auftrag (Tobias, 14.11.2026): „Qualitätsaudit, insbesondere für die Handhabung des Nutzers“.
Ausgangsstand: `main` nach dem Merge von PR #1 (`06e96a0`, Version 0.2.0). Alle Ergebnisse sind in
dieser Sitzung beobachtet (Cloud-Container, Playwright 1.61.0 mit Chromium, Firefox und WebKit).
Steuerliche Fragen hat Claude nicht entschieden: Sie stehen als F22–F25 in
[`offene-fragen.md`](offene-fragen.md). Gestaltungsfragen mit Abwägung stehen unten in Abschnitt 4.

## 1. Vorgehen

1. **Audit:** vier unabhängige Prüf-Agenten.
   - **Ablauf (A-):** der Weg des Nutzers – Datei wählen und ablegen, Warten, zweite Datei, Fehler,
     Tastatur, Handy.
   - **Verständlichkeit (V-):** jedes Ergebnis so gelesen, wie es ein Mandant ohne Steuer- und
     IT-Wissen liest.
   - **Barrierefreiheit (Z-):** WCAG 2.2 AA mit axe-core, Kontrast, Zoom, Kontrastmodus.
   - **Ergebnisseite (E-):** die Seite als Ganzes, Länge, Druck, Kopieren, Weitergabe an die Kanzlei.

   Alle 30 Beispiele wurden in der gebauten App (`dist/index.html`) bei 1280 × 800, 375 × 740 und
   320 px geöffnet. Skripte, Bildschirmfotos und Textauszüge liegen im gitignorierten
   `.tmp/audit/`.

2. **Widerlegung:** je Bereich ein Widerlegungs-Agent. Er versuchte jeden Befund zu widerlegen:
   eigene Nachstellung, Abgleich mit den Entscheidungen F1–F21 und der Bestandsaufnahme, Prüfung von
   Schwere, WCAG-Kriterium und Vorschlag. Urteile: bestätigt / teilweise / widerlegt; Klasse:
   behebbar / Entscheidung Tobias / Steuerfrage.
3. **Behebung** nur der bestätigten, behebbaren Befunde ohne Steuerbezug. Jede mit einem Test; bei
   Z-01 ausdrücklich gegengeprüft (ohne die Korrektur 97,7 px statt mehr als 150 px).

**Ergebnis:** 38 Befunde, davon einige doppelt aus mehreren Blickwinkeln (E-01 = V-01 = A-01).
**Keiner ist ganz widerlegt;** viele wurden in Fakten oder Schwere eingeschränkt. Ganz oder teilweise behoben: 19.
Für Tobias: 4 Steuerfragen (F22–F25) und 10 Gestaltungsfragen (G-1 bis G-10).

## 2. Befunde und Urteile

### Ergebnisseite (E-)

| ID   | Befund                                                                                                                                                                                                            | Urteil    | Klasse                  | Umsetzung                                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-01 | Fehlende Pflichtangaben und Zeilenhinweise erreichen die Ergebnisbox nicht: Beispiel 06/07 grün „E-Rechnung erkannt“ über rotem „Es fehlt: …“; 28 mit § 14c-Hinweis grün. `verdict.ts` sieht nur die Rechenregeln | bestätigt | Steuerfrage             | **F22**                                                                                                                                                                                                                            |
| E-02 | Kein Drucklayout: Ablagefläche auf Seite 1, kein Prüfdatum, zugeklappte Abschnitte drucken leer, Farben fallen weg                                                                                                | teilweise | behebbar                | **behoben:** Druck ohne Einleitung und Ablagefläche, Farben bleiben (`print-color-adjust`), Zeilen nicht über Seiten getrennt, alle Abschnitte vor dem Druck geöffnet und danach wieder geschlossen, Zeile „geprüft am … um … Uhr“ |
| E-03 | Seite sehr lang (4 Bildschirme am Rechner, 9 am Handy, 17 bei zwei XML); 11 von 23 Zeilen „nur im Einzelfall nötig“                                                                                               | bestätigt | Entscheidung Tobias     | **G-1** (Falten berührt den F21-Satz)                                                                                                                                                                                              |
| E-04 | Zwei XML: „Unterschiedlich: Rechnungsnummer.“ ohne die Werte; Teile nur nummeriert                                                                                                                                | bestätigt | behebbar                | **behoben:** „Unterschiedlich: Rechnungsnummer (PRG1502112 / PRG1502113).“ (Datum und Betrag deutsch); Überschrift je Teil mit Anhangname. Ein Teil statt zwei bei gleichen Daten (Beispiel 23): **G-8**                           |
| E-05 | Gleiche Überschrift grün und gelb; Gründe erst in Zeile 3                                                                                                                                                         | bestätigt | Entscheidung Tobias     | **G-3** (Gelb bei Rechenauffälligkeit war eine bewusste Entscheidung in Schritt 3a)                                                                                                                                                |
| E-06 | Kein nächster Schritt bei „fehlt“, Formatfehler, „keine E-Rechnung“; „Rn. 6a“ ohne Quelle                                                                                                                         | teilweise | Steuerfrage             | **F23, F24** (jede Seite endet mit „Bei Fragen wenden Sie sich an Ihre Kanzlei.“)                                                                                                                                                  |
| E-07 | Kopieren: die unsichtbare Statuszeile kommt mit, kein Datum                                                                                                                                                       | bestätigt | behebbar / Entscheidung | **behoben:** Statuszeile wird nicht mitkopiert, Datum steht in der Zeile „Geprüfte Datei“. Knopf „Drucken“/„Kopieren“: **G-4**                                                                                                     |
| E-08 | (a) einziger Anhang doppelt genannt (Beispiel 24); (b) Dateiname doppelt bei XML; (c) Ablagefläche bleibt groß, am Handy Erklärung abgeschnitten (nur Beispiel 29); (d) Fokusrahmen der Überschrift druckt mit    | teilweise | behebbar / Entscheidung | **behoben:** (a) Karte entfällt, wenn das Ergebnis den einzigen Anhang schon nennt, sonst „Anhänge im PDF“ statt „Weitere …“; (b) Zeile „Datei“ entfällt bei XML; (d) kein Fokusrahmen im Druck. (c): **G-5**                      |

### Verständlichkeit (V-)

| ID   | Befund                                                                                                                                                                                                                         | Urteil    | Klasse                  | Umsetzung                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-01 | wie E-01                                                                                                                                                                                                                       | bestätigt | Steuerfrage             | **F22**                                                                                                                                                                                                                                                          |
| V-02 | Meist kein Handlungssatz; „Bitte prüfen Sie die Beträge“ ohne Bezug                                                                                                                                                            | teilweise | Steuerfrage / behebbar  | **F23**; der Bezug kommt jetzt über V-04 (erwarteter Wert)                                                                                                                                                                                                       |
| V-03 | F4-Satz ist kein Satz, „Rn. 6a“ ohne Dokument; derselbe Text doppelt im Code                                                                                                                                                   | bestätigt | Entscheidung / behebbar | Wortlaut: **F24**. **behoben:** eine Konstante statt zwei Kopien (Wortlaut unverändert)                                                                                                                                                                          |
| V-04 | Rechnerische Prüfung nur in Regel- und BT-Nummern, ohne erwarteten Wert; „Σ BT-117“, „Toleranz 1“                                                                                                                              | bestätigt | behebbar                | **behoben:** Werte mit Namen („Gesamtbetrag mit Umsatzsteuer (BT-112)“), Summen ausgeschrieben, neue Zeile „Nach der Regel erwartet: 336,90 EUR“ bei BR-CO-13, -15, -16, -17 und der Aufschlüsselung; „Abweichung bis 1 erlaubt“ statt „Toleranz 1“              |
| V-05 | „Die geprüften Beträge passen zusammen.“ in Grün, obwohl eine Regel nicht prüfbar war (Beispiel 29)                                                                                                                            | teilweise | behebbar                | **behoben:** „… Eine Regel ließ sich nicht prüfen (siehe unten).“, dann ohne grüne Farbe. Dabei gefunden: BR-CO-14 galt ohne BT-110 als „nicht prüfbar“ (3 von 101 amtlichen Rechnungen); das CEN-Schematron prüft die Regel nur, wo BT-110 steht – jetzt ebenso |
| V-06 | Fachbegriffe zuerst (Syntax, Spezifikation, Kennung BT-24, Schema)                                                                                                                                                             | bestätigt | Entscheidung Tobias     | **G-2**                                                                                                                                                                                                                                                          |
| V-07 | Ein Ding, mehrere Namen (Lieferant/Verkäufer, Betrag brutto/Gesamtbetrag mit Umsatzsteuer, Rechnungs-XML/Anhang, „Profil ZUGFeRD 1.0“)                                                                                         | teilweise | behebbar / Entscheidung | **behoben:** „Gesamtbetrag mit Umsatzsteuer (BT-112)“ auch in der Detailtabelle. Rest: **G-7**                                                                                                                                                                   |
| V-08 | Einzelfall-Zeilen zeigen fremde Werte (Zahlungsbedingungen bei „Minderungen“)                                                                                                                                                  | bestätigt | Entscheidung Tobias     | **G-1**                                                                                                                                                                                                                                                          |
| V-09 | Lange Rechtssätze; Fundstellen sind gewollt (F5, F15). Unklar bleiben „teilt umsatzsteuerlich das Schicksal der Hauptleistung“ und „Kleinbetragsrechnungen gelten nicht für diese Fälle … – das Tool prüft dann im Regelfall.“ | teilweise | Steuerfrage             | **F25**                                                                                                                                                                                                                                                          |
| V-10 | Englische Parsermeldung in der Ergebnisbox (bei Beispiel 14 als erste Zeile)                                                                                                                                                   | teilweise | behebbar                | Reihenfolge seit U-07 so entschieden; jetzt als englisch ausgezeichnet (Z-04). Deutscher Satz davor: **G-10**                                                                                                                                                    |
| V-11 | Gemischte Signale bei mehreren XML und bei „keine E-Rechnung“                                                                                                                                                                  | teilweise | Entscheidung Tobias     | **G-9**                                                                                                                                                                                                                                                          |
| V-12 | „Maßgeblich sind die Daten in der XML“ bei reiner XML-Datei; „Technische Erstprüfung“ unerklärt                                                                                                                                | teilweise | Entscheidung Tobias     | **G-6** (F19 legte den Satz für jede erkannte E-Rechnung fest)                                                                                                                                                                                                   |

Sachfehler des Auditors, von der Widerlegung festgestellt: BT-112 und BT-115 sind in Beispiel 29
verschiedene Felder (nicht „derselbe Wert“); Beispiel 23 ist gelb, nicht grün; 11 statt 10 graue
Zeilen; der Satz „Bei Fragen wenden Sie sich an Ihre Kanzlei.“ steht auf jeder Seite.

### Barrierefreiheit (Z-)

| ID   | Befund                                                                                                                | Urteil                                         | Klasse              | Umsetzung                                                                                                                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z-01 | Bei 320 px bleiben für die Bezeichnung jeder Einzelfall-Zeile 98 px; Wörter brechen mitten im Wort („Vereinnahm/ung“) | teilweise (kein WCAG-Verstoß, aber Lesbarkeit) | behebbar            | **behoben:** Die Statusspalte ist so schmal wie das längste Wort, das Abzeichen bricht um („nur im / Einzelfall / nötig“), die Bezeichnung hat 175 px. Test in `handy.spec.ts` (> 150 px) |
| Z-02 | Windows-Kontrastmodus: „Datei auswählen“ ohne sichtbaren Rand                                                         | teilweise (gute Praxis)                        | behebbar            | **behoben:** transparenter Rand an Knopf und Abzeichen, im Kontrastmodus sichtbar                                                                                                         |
| Z-03 | Zwei XML: zwei Regionen „Rechnerische Prüfung …“ mit gleichem Namen (axe `landmark-unique`), Tabellen gleich benannt  | teilweise                                      | behebbar            | **behoben:** Regionen und Tabellen heißen nach ihrem Teil („Rechnungsdaten 1 von 2 – Anhang „…“ Rechnerische Prüfung …“); Test in `zugang.spec.ts`                                        |
| Z-04 | Englische technische Meldungen ohne `lang="en"` (WCAG 3.1.2)                                                          | bestätigt                                      | behebbar            | **behoben:** Die Meldung steht in `<span lang="en">`, der deutsche Vorsatz bleibt deutsch (`technicalParts`)                                                                              |
| Z-05 | Ansage und Überschrift bei Gelb gleich wie bei Grün                                                                   | teilweise (keine Barriere)                     | Entscheidung Tobias | **G-3**                                                                                                                                                                                   |

Ohne Befund geprüft: axe-Kontrast überall, Tastatur, Fokusführung, Reflow und Zoom bis 400 %,
Zielgröße (`summary` 23,2 px hoch, erfüllt nur über die Abstandsausnahme), keine Animationen.

### Ablauf (A-)

| ID   | Befund                                                                                            | Urteil    | Klasse              | Umsetzung                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------- | --------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| A-01 | wie E-01                                                                                          | bestätigt | Steuerfrage         | **F22**                                                                                                                |
| A-02 | Gelbe Zeilenhinweise (05, 09, 28) stehen in keiner Zusammenfassung                                | bestätigt | Steuerfrage         | **F22** (ändert den F21-Satz; darf ein § 14c-Hinweis grün bleiben, F18?)                                               |
| A-03 | Ordner abgelegt: „unerwarteter Fehler … A requested file or directory could not be found …“       | bestätigt | behebbar            | **behoben:** neues Ergebnis „Die Datei lässt sich nicht öffnen“ mit „Vielleicht ist es ein Ordner …“, ohne Browsertext |
| A-04 | Zwei Dateien zugleich abgelegt: nur die erste geprüft, ohne Hinweis                               | bestätigt | behebbar            | **behoben:** „Sie haben 2 Dateien abgelegt. Geprüft wurde nur die erste.“ (Ablagefläche und ganze Seite)               |
| A-05 | wie Z-01                                                                                          | bestätigt | behebbar            | **behoben** (Z-01)                                                                                                     |
| A-06 | wie E-03/E-04, dazu Sprunglinks aus der Box                                                       | bestätigt | Entscheidung Tobias | **G-1**; Werte der Unterschiede jetzt in der Box (E-04)                                                                |
| A-07 | wie E-06; auch „beschädigt“ und „leer“ ohne nächsten Schritt                                      | bestätigt | Steuerfrage         | **F23**                                                                                                                |
| A-08 | Kleines Handy: Erklärung reicht unter die Kante; Titel „Rechnung hierher ziehen“ am Handy         | teilweise | Entscheidung Tobias | **G-5**                                                                                                                |
| A-09 | Gezogener Text oder Link wird geschluckt; die Fläche wird dabei sogar blau                        | teilweise | behebbar            | **behoben:** Nur Dateien werden angenommen und hervorgehoben                                                           |
| A-10 | Hervorhebung nur über der gestrichelten Fläche, obwohl die ganze Seite Dateien annimmt            | bestätigt | behebbar            | **behoben:** Eine Datei irgendwo über der Seite hebt die Fläche hervor, bis das Ziehen endet                           |
| A-11 | Fokusring auf dem blauen Knopf in Firefox blau auf blau, in WebKit schwach                        | teilweise | behebbar            | **behoben:** 3 px dunkler Ring mit Abstand (`:focus-visible`); Test in `bedienung.spec.ts`                             |
| A-12 | Dieselbe Datei erneut geprüft: nicht wahrnehmbar                                                  | bestätigt | Entscheidung Tobias | erledigt durch die Uhrzeit in „Geprüfte Datei … – geprüft am … um … Uhr“ (E-02)                                        |
| A-13 | Startansicht nennt Schema- und Rechenprüfung nicht; fester Hinweis nach einem Ergebnis ganz unten | teilweise | Entscheidung Tobias | **G-6**                                                                                                                |

Nebenbefund der Widerlegung: Eine während der Prüfung abgelegte Datei wird verworfen (nur bei
blockiertem Hauptthread „eingereiht“). Das Ergebnis bleibt richtig; kein Handlungsbedarf.

## 3. Behebung (nur bestätigte, behebbare Befunde ohne Steuerbezug)

- **Druck (E-02, E-07, E-08d, A-12):** `@media print` in `app.css`; `App.tsx` öffnet vor dem
  Drucken alle zugeklappten Abschnitte und schließt sie danach; `TEXTS.checkedFile` mit Datum und
  Uhrzeit (`germanMoment`, Ortszeit, ohne Speicher und Netz).
- **Zwei XML (E-04):** `differingLine` in `verdict.ts`, `TEXTS.partHeading`.
- **Rechnerische Prüfung (V-04, V-05):** `rules.ts` – Namen der Werte, „Nach der Regel erwartet“,
  `notChecked` und der Satz dazu, `TEXTS.rulesNone`, BR-CO-14 nur mit BT-110.
- **Ablauf (A-03, A-04, A-09, A-10, A-11):** neues Dateiproblem `unreadable` (`unreadableFile`),
  `onlyFirstFile`, `DropZone` nur für Dateien und mit `pageDrag`, `button.primary:focus-visible`.
- **Barrierefreiheit (Z-01 … Z-04):** Spalte `min-content` mit umbrechendem Abzeichen, transparente
  Ränder, `contextId` für die Rechenprüfung und die Tabellen, `technicalParts` mit `lang="en"`.
- **Kleinigkeiten (E-08a/b, V-03, V-07):** doppelte Nennungen entfernt, F4-Satz als eine Konstante,
  „Gesamtbetrag mit Umsatzsteuer (BT-112)“ einheitlich.
- **Tests:** neu `tests/e2e/bedienung.spec.ts` (Prüfzeitpunkt und erste Datei, unlesbare Datei,
  Ziehen nur für Dateien und über die ganze Seite, Druck, Fokusring); erweitert `handy.spec.ts`
  (Z-01), `zugang.spec.ts` (Z-03), `erkennen.spec.ts` (E-04, V-04), `rules.test.ts`,
  `tests/io/rules.test.ts`, `verdict.test.ts`, `dates.test.ts`.

## 4. Gestaltungsfragen für Tobias (keine Steuerfragen)

| Nr.  | Frage                                                                                                                                                                                                                                                                    | Aus              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| G-1  | Einzelfall-Zeilen ohne Wert („– nicht in der XML“, 7 von 11 in Beispiel 01) zuklappen? Das kürzt die Seite um etwa ein Fünftel (Handy: ein Viertel), berührt aber den F21-Satz „… ob ein Fall „nur im Einzelfall nötig“ zutrifft“. Dazu Sprunglinks aus der Ergebnisbox. | E-03, V-08, A-06 |
| G-2  | Technische Zeilen (Syntax, Spezifikation, Kennung BT-24, Schema) in einen zugeklappten Abschnitt „Technische Angaben“, Rechnungsnummer, Datum, Lieferant und Betrag zuerst?                                                                                              | V-06             |
| G-3  | Überschrift und Ansage bei Gelb mit Zusatz, z. B. „E-Rechnung erkannt (XRechnung 3.0) – mit Hinweis“? Die Überschriften stammen aus der Übergabe.                                                                                                                        | E-05, Z-05       |
| G-4  | Knopf „Ergebnis drucken“ oder „Ergebnis als Text kopieren“ (eine kurze Zusammenfassung: Datei, Zeitpunkt, Ergebnis, was fehlt)?                                                                                                                                          | E-07             |
| G-5  | Ablagefläche nach einem Ergebnis auf eine Zeile verkleinern; am Handy ein Titel ohne „ziehen“?                                                                                                                                                                           | A-08, E-08c      |
| G-6  | Startansicht: drei Stichpunkte, was geprüft wird (E-Rechnung, Schema, Pflichtangaben, Beträge); den festen Hinweis direkt unter das Ergebnis; „Maßgeblich … XML“ bei einer reinen XML-Datei weglassen; „Technische Erstprüfung“ erklären?                                | A-13, V-12       |
| G-7  | Einheitliche Wörter für den Mandanten: „Lieferant“ statt „Verkäufer“ in den Werten? Überschrift „Rechnungsdaten im Profil ZUGFeRD 1.0“ nennt eine Version, kein Profil – Überschrift aus der Übergabe ändern?                                                            | V-07             |
| G-8  | Gleiche Rechnungsdaten in zwei Anhängen (Beispiel 23): nur einmal zeigen, mit beiden Anhangnamen?                                                                                                                                                                        | E-04             |
| G-9  | Bei „keine E-Rechnung“ steht die Detailtabelle mit „Schema (XSD): keine Abweichung“ unter roter Überschrift (F19 ließ sie stehen); bei zwei XML grüne Teilzusammenfassungen unter gelber Box. Detailtabelle dort zuklappen?                                              | V-11             |
| G-10 | Fehlerhafte XML-Datei (Beispiel 14): einen deutschen Satz vor die englische Meldung setzen (bisher U-07: Meldung vor „Formatfehler …“)?                                                                                                                                  | V-10             |
