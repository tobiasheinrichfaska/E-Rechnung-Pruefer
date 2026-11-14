# Bestandsaufnahme mit Qualitätscheck und Audit – 14.11.2026

Auftrag (Tobias, 14.11.2026): komplette Bestandsaufnahme inkl. Qualitätscheck, Audit und
agentenbestätigter Feststellungen (Widerlegungsagenten) vor der Behebung.

Ausgangsstand: Commit `7a8fef1` (`main` = Arbeitszweig). Alle Ergebnisse unten sind in dieser Sitzung
beobachtet (Cloud-Container, Node 22.23.4, npm 10.9.9, Chromium 1243). Steuerliche Fragen hat Claude
nicht entschieden; sie stehen als F16–F21 in [`offene-fragen.md`](offene-fragen.md).

## 1. Vorgehen

1. **Inventur:** alle Projekt-Prüfungen ausgeführt (Tests, Typprüfung, Lint, Format, Build, E2E,
   `npm audit`), Umfang und Stand erfasst.
2. **Audit:** fünf unabhängige Prüf-Agenten, je einer für Logik (L-), IO/Sicherheit/Build (S-),
   Zuordnung/Syntax/Profile (B-), Tests/Doku (T-), Oberfläche/Texte/Barrierefreiheit (U-). Jeder
   Befund mit Ort, Fehlerszenario und möglichst einer Reproduktion (Ad-hoc-Tests im gitignorierten
   `.tmp/audit/`). Dazu ein eigener Befund (U-00).
3. **Widerlegung:** je Bereich ein Widerlegungs-Agent, der jeden Befund zu widerlegen versuchte –
   eigene Reproduktion über die echten Einstiege, Abgleich mit den bekannten Einschränkungen und den
   entschiedenen Fragen F1–F15, Prüfung von Schwere und Vorschlag. Urteile: BESTÄTIGT / TEILWEISE /
   WIDERLEGT / Steuerfrage. Doppelte Befunde wurden nur einmal widerlegt.
4. **Behebung** nur bestätigter Befunde ohne steuerliche Entscheidung, jeweils mit einem Test, der
   ohne die Korrektur fehlschlägt (bei S-01, U-00/U-12, S-03 ausdrücklich gegengeprüft).

## 2. Inventur

| Bereich                    | Umfang                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `src/logic`                | 13 Dateien, 3.028 Zeilen (Daten: Zuordnung BT → XPath, Pflichtangaben, Profile, Texte)    |
| `src/io`                   | 6 Dateien, 437 Zeilen (libxml2-wasm, pdf.js)                                              |
| `src/ui`                   | 5 Dateien, 678 Zeilen (React)                                                             |
| `src/build`                | 4 Dateien, 1.576 Zeilen (CSP, Mini-PDF, Beispiele, Datenmodell-Seite)                     |
| Tests                      | 17 Vitest-Dateien (2.053 Zeilen), 4 E2E-Dateien (292 Zeilen)                              |
| Offizielle Dateien         | 20 XSD (UBL 2.1, CII D16B), 77 XML-Testdateien (CEN 1.3.17, KoSIT-Testsuite)              |
| Beispiele für Tester       | 26 Dateien (jetzt 28), generiert                                                          |
| Abhängigkeiten             | 4 zur Laufzeit (React 19.3.1, pdfjs-dist 6.4.299, libxml2-wasm 0.7.2), 17 zur Entwicklung |
| Geschichte                 | 14 Commits seit 13.11.2026, keine Tags, Version 0.1.0                                     |
| TODO/FIXME, `any`, `.only` | keine; einziges `skipIf`: lokaler FeRD-Test (Ordner fehlt im Container)                   |

**Prüfungen vor dem Audit (beobachtet):** Vitest 221 bestanden, 1 übersprungen; Typprüfung, Lint,
Format, Build sauber (`dist/index.html` 3,04 MB, gzip 1,03 MB); E2E in Chromium 8 von 9 – der
Handytest schlug fehl (2 px seitlich, siehe U-00); Firefox und WebKit sind im Container nicht
installiert. `npm audit`: 0 Lücken in den Laufzeit-Abhängigkeiten, 9 mittlere nur in
Entwicklungswerkzeugen (minimatch über eslint/typescript-eslint).

**Ohne Befund geprüft (Auszug):** alle SHA-256 aus `quellen.md` stimmen, XSD und Testdateien sind
byte-gleich mit den offiziellen Paketen (vom Prüf-Agenten T neu geladen und verglichen), `.gitattributes -text` hält; Lizenzen
(AGPLv3, Apache-2.0-Text bei den Beispielen) stimmig; generierte Dateien (`docs/data-model.html`,
`beispiele/`) aktuell; Zuordnung BT → XPath für UBL Invoice, CreditNote und CII nach EN 16931
korrekt, keine `//`-Pfade; ZUGFeRD-1.0-Namensräume bestätigt; Dezimalrechnung (Vorzeichen,
Nachkommastellen, 300.000 Stellen) fehlerfrei; Kontraste ab 5,5:1; keine HTML-Senken; kein Wettlauf
zweier Dateien; CSP vollständig (ohne `unsafe-*`), Hashes stimmen; Entity-Expansion wird abgewiesen.

## 3. Ergebnis in Zahlen

66 Befunde gemeldet (davon 6 doppelt zwischen den Bereichen), 60 einzeln widerlegt:

| Bereich        | gemeldet | bestätigt | teilweise | widerlegt |
| -------------- | -------- | --------- | --------- | --------- |
| Logik (L)      | 11       | 4         | 5         | 2         |
| IO/Sicherheit  | 12       | 4         | 6         | 0         |
| Zuordnung (B)  | 11       | 3         | 4         | 2         |
| Tests/Doku (T) | 16       | 8         | 6         | 0         |
| Oberfläche (U) | 16       | 8         | 7         | 1         |
| **Summe**      | **66**   | **27**    | **28**    | **5**     |

Doppelt (nicht mitgezählt bei den Urteilen): T-01 = L-03, T-07 = L-10, B-05 = L-05, B-09 ≈ T-06,
S-05 ≈ T-05/U-06, S-10 = U-05. Nach der Widerlegung ist kein Befund mehr „kritisch“; S-01 wurde von
kritisch auf mittel bis hoch gestuft, sieben weitere wurden herabgestuft.

## 4. Befunde, Urteile, Behebung

Commits: `86852c2` (S-01), `3c429e2` (Handy), `c7719f9` (XML/PDF-Randfälle), `a9bbcf4` (Logik und
Texte), `293b32c` (Wächter), dazu der Doku-Commit mit diesem Bericht.

### Logik

| ID   | Befund                                                                      | Urteil (Schwere)                | Stand                                                                                               |
| ---- | --------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| L-01 | Negative Summe (Storno) gilt als Kleinbetragsrechnung                       | teilweise (mittel), Steuerfrage | entschieden **F16**: Betrag \|BT-112\| ≤ 250 – umgesetzt                                            |
| L-02 | „§ 195 BGB“, „kein Kleinunternehmer“ schalten auf § 34a UStDV               | teilweise (mittel)              | „§ 19x“ behoben (`a9bbcf4`); **F18**: ausgewiesene Steuer schließt Kleinunternehmer aus – umgesetzt |
| L-03 | Mehrere XML: Einordnung hängt von der Reihenfolge der Anhänge ab            | bestätigt (mittel)              | behoben: BT-24 wird mitverglichen                                                                   |
| L-04 | ZUGFeRD-1.0-XML neben 2.x-XML gilt als „unterschiedliche Daten“             | bestätigt (niedrig)             | offen (kein realer Fall belegt)                                                                     |
| L-05 | xs:date mit Zeitzone wird nicht erkannt                                     | teilweise (niedrig)             | behoben; „20280230 vorhanden“ widerlegt (kein Validator)                                            |
| L-06 | Hinweise widersprechen dem Status (Anschrift ohne PLZ, F15 bei Kleinbetrag) | bestätigt (niedrig)             | behoben                                                                                             |
| L-07 | Nur Kategorie O → „Steuersatz vorhanden“                                    | widerlegt                       | so gewollt und getestet                                                                             |
| L-08 | Präfix `…xrechnung_` nimmt jede Fortsetzung an                              | teilweise (niedrig)             | behoben: nur Versionsnummer                                                                         |
| L-09 | Stichwörter: „ohne Skonto“, „befreit von Zoll“, „§ 14b“                     | teilweise (niedrig)             | „§ 14b“, „vereinnahmte Entgelte“ behoben; **F20**: Verneinung zählt nicht – umgesetzt               |
| L-10 | Sperre „ordnungsgemäß/gültig“ prüft nur `TEXTS`                             | bestätigt (niedrig)             | behoben (`tests/static/words.test.ts`)                                                              |
| L-11 | `fill()` ersetzt `{toString}`                                               | widerlegt als Fehler            | trotzdem `Object.hasOwn` (Wartbarkeit)                                                              |

### IO, Sicherheit, Build

| ID   | Befund                                                                                        | Urteil (Schwere)                   | Stand                                                                                         |
| ---- | --------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| S-01 | Moderner pdf.js-Build: jedes PDF scheitert in Chrome/Edge ≤ 139, Firefox ≤ 133, Safari ≤ 18.3 | teilweise (mittel bis hoch)        | behoben: Legacy-Build + `Promise.withResolvers`; E2E ohne neueste JS-Funktionen               |
| S-02 | Textknoten > 10 MB (eingebettete Anlage) → „Formatfehler“                                     | bestätigt (mittel)                 | behoben: `XML_PARSE_HUGE`                                                                     |
| S-03 | DOCTYPE-Sperre über ISO-2022-JP umgehbar                                                      | teilweise (niedrig)                | behoben: Prüfung `doc.dtd` nach dem Einlesen                                                  |
| S-04 | Keine Grenze für entpackte Anhänge; Datei wird vor der Größenprüfung gelesen                  | teilweise (niedrig)                | Dateigröße vor dem Lesen behoben; entpackte Größe über pdf.js nicht begrenzbar (dokumentiert) |
| S-06 | ESLint-Sperre leicht zu umgehen (`globalThis.localStorage` …)                                 | teilweise (niedrig)                | behoben: 14 von 14 Umgehungen erkannt                                                         |
| S-07 | E2E-Spion übersieht BroadcastChannel, Popup, benannten Speicher; CSP-Kommentar zu weit        | bestätigt (niedrig)                | behoben                                                                                       |
| S-08 | Kaputter Anhang-Stream ergibt 0 Byte statt „nicht lesbar“                                     | teilweise (niedrig)                | offen (Urteil und Text bleiben gleich, nur die Listenzeile)                                   |
| S-09 | XML mit „%PDF-“ im ersten KB gilt als PDF                                                     | bestätigt technisch (sehr niedrig) | offen (praktisch kein Fall)                                                                   |
| S-11 | `frame-ancestors` nicht per `<meta>`-CSP                                                      | bestätigt (niedrig)                | dokumentiert in `deploy/README.md` – Kopfzeile am Server setzen                               |
| S-12 | Doppelte Schlüssel im Namensbaum verdecken einen Anhang                                       | teilweise (sehr niedrig)           | dokumentiert (Known Limitations)                                                              |

### Zuordnung, Syntax, Profile

| ID    | Befund                                                    | Urteil (Schwere)         | Stand                                                                                |
| ----- | --------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| B-01  | Kennungen ZUGFeRD 2.0 (`urn:zugferd.de:2p0:…`) fehlen     | teilweise, Steuerfrage   | MINIMUM/BASIC WL behoben; **F17**: BASIC/EXTENDED E-Rechnung mit Hinweis – umgesetzt |
| B-02  | CII-Unterpositionen werden eigene Positionen              | widerlegt                | entspricht KoSIT-Visualisierung und FeRD                                             |
| B-02b | (neu) Gruppenposition EXTENDED ohne Menge → „Menge fehlt“ | bestätigt (niedrig)      | dokumentiert (Known Limitations)                                                     |
| B-03  | Peppol-Umschlag (SBDH) wird nicht erkannt                 | bestätigt (niedrig)      | dokumentiert, offen                                                                  |
| B-04  | Leerraum in Wahrheitswerten (`ChargeIndicator`)           | teilweise (sehr niedrig) | offen                                                                                |
| B-06  | CII-Verkäufer mit `schemeID="VAT"`                        | widerlegt                | richtig nach EN 16931 (nur „VA“/„FC“)                                                |
| B-07  | CII BT-63 ohne `schemeID`-Filter                          | teilweise (sehr niedrig) | offen (folgt KoSIT; CEN verlangt „VA“)                                               |
| B-08  | Fiskalvertreter: Straße und PLZ unsichtbar                | bestätigt (niedrig)      | behoben                                                                              |
| B-10  | Präfix-Eintrag XRechnung `checked: true` ohne Musterdatei | teilweise (sehr niedrig) | behoben (`checked: false`); XRechnung 4.0 (EN 16931-1:2026) für 2027 vormerken       |

### Tests und Doku

| ID   | Befund                                                              | Urteil (Schwere)    | Stand                                                         |
| ---- | ------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| T-02 | Kein Test liest ein echtes (komprimiertes) Hybrid-PDF               | teilweise (mittel)  | Tabellentext korrigiert; Mini-PDF mit Kompression offen       |
| T-03 | Spion übersieht Speicherwege                                        | teilweise (niedrig) | behoben (mit S-07)                                            |
| T-04 | Handytest misst nur einen Zustand; langer Dateiname 185 px seitlich | bestätigt (mittel)  | behoben: 320 px, langer Name                                  |
| T-05 | Ungetestete Urteilspfade, Anhang > 20 MB = „Formatfehler“           | teilweise (niedrig) | behoben: Tests + „PDF nicht vollständig geprüft“, Beispiel 27 |
| T-06 | Pfade ohne Testdatei; 12 Paare der Testsuite nicht genutzt          | teilweise (niedrig) | offen                                                         |
| T-08 | „Gehostete Kopie identisch“ veraltet, Version 0.1.0 ohne Tag        | bestätigt (mittel)  | Doku korrigiert; Version 0.2.0 (Tag `v0.2.0` nach dem Merge)  |
| T-09 | Eingebettete Beispiel-XML nicht gegen das Schema geprüft            | bestätigt (niedrig) | behoben                                                       |
| T-10 | `plan.md`, `quellen.md` veraltet                                    | bestätigt (niedrig) | behoben                                                       |
| T-11 | `FEATURES_REQUIRED.md` Häkchen und Texte                            | bestätigt (niedrig) | behoben                                                       |
| T-12 | Verzeichnistabelle in `CLAUDE.md` unvollständig                     | teilweise (niedrig) | behoben                                                       |
| T-13 | Prüfung unsichtbarer Zeichen zu eng                                 | bestätigt (niedrig) | behoben                                                       |
| T-14 | Handtest-Übersicht: „jedes Ergebnis“                                | bestätigt (niedrig) | behoben (Ausnahmen genannt)                                   |
| T-15 | README verspricht Schema- und Rechenprüfung                         | bestätigt (niedrig) | behoben („geplant“)                                           |
| T-16 | Datenmodell-Test besteht mit leerem Beispielobjekt                  | teilweise (niedrig) | behoben                                                       |

### Oberfläche und Texte

| ID   | Befund                                                                           | Urteil (Schwere)       | Stand                                                                                                    |
| ---- | -------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| U-00 | Handy: Zeilen „nur im Einzelfall nötig“ ragen über (375 px: 2 px, 320 px: 57 px) | bestätigt (mittel)     | behoben: `minmax(0, 1fr)`                                                                                |
| U-01 | „Keine E-Rechnung“ zeigt trotzdem Pflichtangaben und „Maßgeblich ist die XML“    | teilweise, Steuerfrage | **F19**: keine Tabelle, fester Satz nur bei E-Rechnung – umgesetzt                                       |
| U-02 | Zusammenfassung nennt die ganze Zeile statt der fehlenden Teile                  | bestätigt (mittel)     | behoben („… (nur Ort; …)“); Platz unter der § 14-Überschrift offen                                       |
| U-03 | Kaputter Namensbaum → rohe englische Absturzmeldung                              | bestätigt (mittel)     | behoben: „Das PDF lässt sich nicht lesen“                                                                |
| U-04 | Keine dauerhafte Live-Region; Fokus fällt auf `body`                             | teilweise (niedrig)    | behoben (Statuszeile von Anfang an, nur ein kurzer Satz; Fokus auf die Überschrift)                      |
| U-05 | Datei neben der Fläche abgelegt → Browser öffnet sie                             | teilweise (niedrig)    | behoben: die ganze Seite nimmt die Datei                                                                 |
| U-06 | DOCTYPE-Anhang = „Formatfehler“, DOCTYPE-Datei = „nicht geprüft“                 | bestätigt (niedrig)    | behoben                                                                                                  |
| U-07 | Parser-Meldungen englisch, Reihenfolge XML/PDF verschieden                       | bestätigt (niedrig)    | offen                                                                                                    |
| U-08 | Verschachtelte Klammern in der Überschrift                                       | bestätigt (niedrig)    | behoben (auch CVD und ältere XRechnung)                                                                  |
| U-09 | Straßenhinweis sagt beim Empfänger „der Unternehmer“                             | bestätigt (niedrig)    | behoben                                                                                                  |
| U-10 | „Alle Pflichtfelder belegt“ trotz Einzelfall-Zeilen                              | widerlegt (festgelegt) | **F21**: neuer Satz – umgesetzt                                                                          |
| U-11 | Typcode in der Pflichtangaben-Tabelle ohne Bezeichnung                           | teilweise (niedrig)    | behoben; „(Credit Note)“ bleibt (F2)                                                                     |
| U-12 | Lange Werte ohne Umbruchstelle sprengen die Breite                               | teilweise (niedrig)    | behoben                                                                                                  |
| U-13 | Tabellen: erste Spalte `td`, Kopf auf dem Handy versteckt, keine `caption`       | bestätigt (niedrig)    | behoben (Zeilenköpfe, Tabellen und Abschnitte benannt, Spaltenköpfe auf dem Handy nur optisch versteckt) |
| U-14 | Zitat Abschnitt 14.5 Abs. 16 UStAE: Code „Sätze 3–4“, F15 „Sätze 2–4“            | teilweise              | Code zitiert genau (BMF 15.10.2025, Nr. 12 g); F15-Wortlaut prüft Tobias                                 |
| U-15 | Kleinigkeiten im Wortlaut                                                        | teilweise (niedrig)    | „Dieselbe Rechnung“, „Gerät“, „nur eine Rechnungs-XML“ behoben                                           |

## 5. Offen für Tobias

**Steuerfragen:** F16–F21 hat Tobias am 14.11.2026 entschieden; sie sind umgesetzt (Beispiel 28 für
F18, Antworten und Fundstellen in [`offene-fragen.md`](offene-fragen.md)). Zu F17 wurde vorher
recherchiert: ZUGFeRD 2.0 und 2.0.1 sind an der Datei nicht zu unterscheiden. Offen ist nur noch
der Hinweis zum Zitat in F15 (U-14).

**Ohne Steuerbezug, zur Entscheidung:**

- **Upload:** Version ist 0.2.0; nach dem Merge Tag `v0.2.0` setzen und hochladen – Beispiele mit
  hochladen? (Push erfolgt am 14.11.2026, Pull Request #1.)
- **Mindest-Browser** festlegen (heute etwa Chrome/Edge 98, Firefox 102, Safari 16.4, abgeleitet).
- **Server-Kopfzeile** `frame-ancestors 'none'` für `NebenprojektERechnung/` (`deploy/README.md`).
- **Testabdeckung** T-02 (Mini-PDF mit Kompression) und T-06 (12 weitere KoSIT-Paare).
- Kleinere offene Punkte: L-04, S-08, S-09, B-03, B-04, B-07, U-07.

## 6. Prüfungen nach der Behebung (beobachtet)

| Prüfung                     | Ergebnis                                                                  |
| --------------------------- | ------------------------------------------------------------------------- |
| `npm test`                  | 242 bestanden, 1 übersprungen (lokaler FeRD-Test, Ordner fehlt)           |
| `npm run typecheck`, `lint` | sauber                                                                    |
| `npm run format:check`      | sauber                                                                    |
| `npm run build`             | `dist/index.html` 3,16 MB (gzip 1,07 MB; +40 KB gzip durch pdf.js legacy) |
| E2E Chromium (Container)    | 12 von 12 bestanden                                                       |
| E2E Firefox, WebKit         | nicht ausgeführt (im Container nicht installiert) – lokal nachholen       |
| `npm audit --omit=dev`      | 0 Lücken                                                                  |

## 7. Hinweise zum Ablauf

- Die Agenten haben nichts im Repo geändert; ihre Proben liegen im gitignorierten `.tmp/audit/`.
- Für Fakten zu Browser-Versionen und Kennungen wurden öffentliche Quellen gelesen (MDN
  browser-compat-data, Codelisten im mustangproject, KoSIT-Repositories, BMF-Schreiben). Für den
  Bytevergleich wurden die offiziellen Pakete aus `quellen.md` neu geladen. Es wurden keine
  Projektdaten nach außen gesendet.
- Ein Prüf-Agent hat bei einem Browser-Test zwei Anfragen an `https://example.org` ausgelöst
  (`window.open`, Platzhalter `?leak=1`, keine Nutzer- oder Projektdaten); die Widerlegung hat danach
  alle externen Anfragen abgefangen.
- `npm install` mit npm 10 entfernt die `libc`-Felder aus `package-lock.json`; die Änderung wurde
  zurückgesetzt (kein Befund).
