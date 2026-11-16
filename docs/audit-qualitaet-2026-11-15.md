# Qualitätsaudit vom 15.11.2026

Auftrag von Tobias (15.11.2026): „führe in der Zwischenzeit ein Qualitätsaudit durch. Befunde gehen an
Widerlegungsagenten, danach werden sie, soweit sinnvoll, behoben“. Dazu: „nach jedem Behebungslauf
folgt eine neue Schleife aus Qualitätsaudit, Widerlegungsagenten und Behebung, bis der Audit sauber
ist. Achte auch auf regelmäßige Merges.“

## Runde 1

### Vorgehen

- **Stand:** `main` bei `69bc34d` (Version 0.9.0).
- **Ausgangsprüfung:** in der Cloud-Sitzung, grün:
  - Typprüfung, Lint und Format;
  - 480 Unit-Tests, die privaten FeRD- und ZUGFeRD-1.0-Muster eingeschlossen;
  - 147 E2E-Tests in Chromium, Firefox und WebKit bestanden, 9 übersprungen (die Zweige „ohne
    Kanzlei-Konfiguration“).
- **Vier Prüf-Agenten**, je mit Belegpflicht (Code mit Datei und Zeile, eine Probe mit Eingabe und
  Ausgabe oder eine Mutation, die kein Test bemerkt):
  - Logik und Ergebnisse (QL);
  - Sicherheit, Datenschutz und Auslieferung (QS);
  - Bedienung, Texte und Zugänglichkeit (QU);
  - Tests und Dokumentation (QT).
- **Vier Widerlegungs-Agenten**, je einer pro Bereich. Sie haben jeden Befund selbst nachgestellt und
  eingeordnet:
  - Urteil: bestätigt, teilweise oder widerlegt;
  - Art: Fehler, Verbesserung, Gestaltungsfrage oder Steuerfrage.
- **Drei Behebungs-Agenten** in eigenen Arbeitskopien (Logik, Bedienung, Tests/CI/Sicherheit). Jede
  Behebung hat einen Test, der vorher fehlschlug oder eine Mutation fängt.
- **Nach dem Zusammenführen** (Version 0.9.1), in der Cloud-Sitzung beobachtet:
  - mit den privaten Dateien: Typprüfung, Lint und Format grün, 527 Unit-Tests, E2E 159 bestanden und
    9 übersprungen;
  - ohne sie, wie auf GitHub: 448 Unit-Tests bestanden und 4 übersprungen, E2E 138 bestanden und 30
    übersprungen;
  - der neue Lauf mit der erfundenen Kanzlei: 30 von 30.
- **Ausgenommen:** die Testseite der Testfassung (`src/ui/testbereich/` und ihre Logik). Sie wird
  durch den gemeinsamen Testrahmen aus `Testumgebung` ersetzt.
- **Kanzleidaten:** Kein Agent hat Inhalte der Kanzlei-Konfiguration ausgegeben.

### Ergebnis

46 Befunde, **keiner ganz widerlegt**: 30 bestätigt, 16 teilweise (überzogen in Schwere oder Begründung,
der Kern hält). Gestaltungs- und Steuerfragen entscheidet Tobias. Bis dahin bleibt das Verhalten.

| Bereich         | Befunde | bestätigt | teilweise | Gestaltungsfragen | Steuerfragen |
| --------------- | ------- | --------- | --------- | ----------------- | ------------ |
| Logik (QL)      | 10      | 10        | 0         | 1 (+1 Teil)       | 2            |
| Sicherheit (QS) | 6       | 3         | 3         | 1                 | 0            |
| Bedienung (QU)  | 15      | 7         | 8         | 3                 | 0            |
| Tests/Doku (QT) | 15      | 10        | 5         | 1                 | 0            |

### Logik und Ergebnisse (QL)

| ID    | Befund                                                                                                                                                      | Urteil · Art            | Erledigung                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| QL-01 | Zwei Rechnungs-XML galten schon bei sechs gleichen Kopfwerten als „dieselbe Rechnung“; das Ergebnis hing von der Reihenfolge der Anhänge ab                 | bestätigt · Fehler      | behoben: auch Pflichtangaben- und Regel-Ergebnisse je Teil müssen gleich sein (`differingResults`), sonst F27                                     |
| QL-02 | Ein Steuersatz, der keine Zahl ist oder fehlt, machte die Aufschlüsselung „auffällig“ mit „Summe 0,00“                                                      | bestätigt · Fehler      | behoben: „nicht prüfbar“                                                                                                                          |
| QL-03 | CII-Dateien wurden in den Formen des UBL-Schematrons gerechnet; das CII-Schematron 1.3.17 rechnet bei BR-CO-17, BR-S-08, Z/E/AE/IC/G-08 und BR-CO-15 anders | bestätigt · Fehler      | behoben: Formen je Syntax als Daten (`RULE_FORMS`); alle amtlichen Dateien und FeRD-Muster weiter „passt“; Beschriftung von BR-CO-17 stimmt jetzt |
| QL-04 | Kleinbetrag und Kleinunternehmer bekommen beim Formatfehler den Satz nach Datum (F26)                                                                       | bestätigt · Steuerfrage | gefragt als **F31** (`offene-fragen.md`)                                                                                                          |
| QL-05 | „Maßgeblich sind die Daten in der XML“ steht auch beim Schemafehler                                                                                         | bestätigt · Steuerfrage | gefragt als **F32**                                                                                                                               |
| QL-06 | Nicht gelesene Anhänge neben einer Rechnungs-XML änderten das Ergebnis nicht; ein unlesbarer Anhang erschien nirgends                                       | bestätigt · Fehler      | behoben: mindestens gelb mit eigenem Satz, „nicht lesbar“ in der Liste                                                                            |
| QL-07 | Dieselbe Nicht-E-Rechnung zweimal eingebettet: Zeilen doppelt und dreifach, andere Überschrift                                                              | bestätigt · Fehler      | behoben; offen als Gestaltungsfrage **G-15**                                                                                                      |
| QL-08 | Straßen-Hinweis zum Empfänger bei einer Kleinbetragsrechnung                                                                                                | bestätigt · Fehler      | behoben                                                                                                                                           |
| QL-09 | Zeile „Schema (XSD)“ sichtbar bei „keine E-Rechnung“                                                                                                        | bestätigt · Fehler      | behoben (zusammen mit QU-08)                                                                                                                      |
| QL-10 | Der F17-Hinweis (ZUGFeRD 2.0) macht die Box nicht gelb                                                                                                      | bestätigt · Gestaltung  | Frage **G-14**                                                                                                                                    |

### Bedienung, Texte, Zugänglichkeit (QU)

| ID    | Befund                                                                                                    | Urteil · Art             | Erledigung                                                     |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| QU-01 | „keine E-Rechnung“ ist rot, auch wenn der Satz darunter „noch zulässig“ oder „vor 2025“ sagt              | teilweise · Gestaltung   | Frage **G-11**                                                 |
| QU-02 | Angaben, die bei Kleinbetrag/Kleinunternehmer nicht vorgeschrieben sind, heißen „nur im Einzelfall nötig“ | teilweise · Gestaltung   | Frage **G-12**                                                 |
| QU-03 | Die Box nannte bei teilweise vorhandenen Zeilen die ganze Zeile                                           | teilweise · Verbesserung | behoben: nur die fehlenden Teile, „davon fehlt:“ statt „nur“   |
| QU-04 | Die Kanzleifarbe ist vom Fehlerrot kaum zu unterscheiden (1,03:1)                                         | teilweise · Gestaltung   | Frage **G-13**                                                 |
| QU-05 | Zeilenhinweise nur an der Farbe erkennbar                                                                 | teilweise · Verbesserung | behoben: „Hinweis:“ davor, Rahmen im Kontrastmodus             |
| QU-06 | Nach „Weiter“ fiel der Fokus auf die Seite                                                                | teilweise · Verbesserung | behoben: Fokus auf die Überschrift                             |
| QU-07 | Der kopierte Text ließ „Unterschiedlich: …“ und den Satz zur verringerten Liste weg                       | teilweise · Fehler       | behoben                                                        |
| QU-08 | Schemazeile bei „keine E-Rechnung“                                                                        | bestätigt · Fehler       | behoben (QL-09)                                                |
| QU-09 | Ein einziger Anhang ohne Rechnungsdaten wurde zweimal genannt, „Keiner davon“                             | bestätigt · Fehler       | behoben: Name in „…“, Einzahl                                  |
| QU-10 | Am Handy sagte der Einleitungssatz „ziehen“ (gegen G-5)                                                   | bestätigt · Verbesserung | behoben                                                        |
| QU-11 | Der Sprunglink „Technische Meldungen“ ließ den Abschnitt zu; Aufklapptexte „anzeigen“                     | bestätigt · Verbesserung | behoben                                                        |
| QU-12 | Bei unbekannter XML stand das Wurzelelement als erste Zeile                                               | teilweise · Verbesserung | behoben: zuletzt, als „Technische Angabe“                      |
| QU-13 | Die Tabelle der Rechnungsdaten hatte keinen Namen                                                         | bestätigt · Verbesserung | behoben: Überschrift „Rechnungsdaten“, die die Tabelle benennt |
| QU-14 | Eine unerwartete englische Fehlermeldung stand ohne `lang` in einem deutschen Satz                        | bestätigt · Verbesserung | behoben                                                        |
| QU-15 | Impressum und Datenschutz öffnen einen neuen Tab, ohne es zu sagen                                        | bestätigt · Verbesserung | behoben: „(öffnet in neuem Tab)“ für Screenreader              |

### Sicherheit und Auslieferung (QS)

| ID    | Befund                                                                                             | Urteil · Art             | Erledigung                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QS-01 | Die Beträge einer EXTENDED-Rechnung wurden Zeile für Zeile mit eigener XPath gelesen (quadratisch) | bestätigt · Fehler       | behoben: Positionen Knoten für Knoten gelesen (20 000 Zeilen 0,14 s statt 15 s), gleiche Ausgabe auf allen 166 Dateien                                    |
| QS-02 | Die Schemaprüfung wird bei sehr vielen Meldungen quadratisch langsam (Bibliothek)                  | teilweise · Verbesserung | behoben: eigener Sammler der Meldungen auf festgeschriebener libxml2-wasm 0.7.2 (160 000 Meldungen 0,4 s statt 82 s); Test schlägt bei anderer Version an |
| QS-03 | `noBranding.test.ts` findet den Namen allein und umbrochene Zitate nicht                           | teilweise · Verbesserung | behoben (mit QT-04)                                                                                                                                       |
| QS-04 | Links wie `https:host` kamen durch die Prüfung der Konfiguration                                   | bestätigt · Fehler       | behoben: Links als `URL.href`, nur `https://…`                                                                                                            |
| QS-05 | Ein zweiter Upload-Weg (IONOS, `npm run hochladen`) besteht noch                                   | teilweise · Gestaltung   | Doku als „abgelöst“ markiert; Frage **G-16**                                                                                                              |
| QS-06 | Actions in `tests.yml` nicht auf Commits festgelegt, `persist-credentials` an                      | bestätigt · Verbesserung | behoben: Actions auf Commit-SHA (v4.4.0 bzw. v4.6.2, wie bisher `@v4`), `persist-credentials: false`, Test                                                |

### Tests und Dokumentation (QT)

| ID    | Befund                                                                                         | Urteil · Art             | Erledigung                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| QT-01 | Die GitHub-Prüfung testet Zugangshinweis, Fußzeilen-Links und Farben nie                       | teilweise · Verbesserung | behoben: zweiter E2E-Schritt mit erfundener Kanzlei (`KANZLEI_CONFIG`), bricht ab, wenn etwas übersprungen wird      |
| QT-02 | Zwei Fehler fing nur der private FeRD-Test (BR-CO-17 ohne `abs`, falsches MINIMUM-Schema)      | bestätigt · Verbesserung | behoben: öffentlicher Test für BR-CO-17 mit negativen Beträgen; (b) mit QT-03                                        |
| QT-03 | F28 (eigenes Schema je Profil) nur an der Bezeichnung geprüft; keine Prüfsummen der XSD        | bestätigt · Verbesserung | behoben: erstes abgelehntes Element je Profil, Prüfsummen aller 40 XSD in `quellen.md`                               |
| QT-04 | wie QS-03                                                                                      | teilweise · Verbesserung | behoben: Leerraum, Zitatzeichen und Groß-/Kleinschreibung egal, Namensliste im privaten Repo, Dateien auch als Bytes |
| QT-05 | README „Es speichert nichts.“, Plan E2/E3/T3 veraltet                                          | bestätigt · Fehler       | behoben                                                                                                              |
| QT-06 | Der E2E-Spion erlaubte den Zugangsschlüssel auch auf `file://`                                 | bestätigt · Verbesserung | behoben: Zugangsschlüssel nur über https erlaubt                                                                     |
| QT-07 | Kein Test nennt `base-uri`, `form-action`, `object-src` der CSP                                | bestätigt · Verbesserung | behoben                                                                                                              |
| QT-08 | Der Wörter-Test liest die Bezeichnungen in `details.ts` und `binding.ts` nicht                 | bestätigt · Verbesserung | behoben: Detailzeilen und alle Bezeichnungen der Zuordnung                                                           |
| QT-09 | IONOS-Stellen als aktuell beschrieben; MT-03 „außerhalb der Kanzlei“                           | bestätigt · Verbesserung | behoben (Doku); Frage **G-16**                                                                                       |
| QT-10 | Veraltete Zeilen und Kommentare vor F28/F29                                                    | teilweise · Verbesserung | behoben (Doku und Kommentare)                                                                                        |
| QT-11 | `npm install` statt `npm ci` in CLAUDE.md und README                                           | bestätigt · Verbesserung | behoben                                                                                                              |
| QT-12 | `uebergang.ts`, `zusammenfassung.ts` fehlten in der Tabelle; Version in der Handtest-Übersicht | teilweise · Verbesserung | behoben                                                                                                              |
| QT-13 | Peppol BIS 3 als „belegt“ markiert ohne passende Datei                                         | bestätigt · Verbesserung | behoben: amtliches CEN-Beispiel `UBL_BIS3_Invoice_positive.xml` übernommen                                           |
| QT-14 | `hiddenChars.test.ts` liest `config/`, `schemas/README.md`, `.github/` nicht                   | bestätigt · Verbesserung | behoben                                                                                                              |
| QT-15 | Der Selbsttest des Spions löst fünf seiner Wege nicht aus                                      | teilweise · Verbesserung | behoben; dabei gefunden: in WebKit sah der Spion IndexedDB und cookieStore nicht, jetzt am Prototyp                  |

### Fragen an Tobias

Gestaltungsfragen (fortlaufend nach G-1 … G-10 aus `audit-bedienung-2026-11-14.md`):

- **G-11 (QU-01):** Soll die Farbe der Box bei „keine E-Rechnung“ dem Satz nach Datum folgen? Gelb
  wäre sie bei „vor 2025“ und „noch zulässig“, rot bei „Hier ist eine E-Rechnung nötig“ und ohne
  Datum. Oder zeigt Rot weiter den Befund über die Datei? Siehe auch F31: Die Zustimmung des
  Empfängers zu einer sonstigen elektronischen Rechnung nennt das Tool nicht.
- **G-12 (QU-02):** Soll eine Angabe, die bei Kleinbetrag oder Kleinunternehmer nicht vorgeschrieben
  ist, einen eigenen Status bekommen, etwa „hier nicht nötig“? Das wäre ein vierter Status neben
  vorhanden / fehlt / nur im Einzelfall nötig. Gilt der F21-Satz dann nur noch für die echten
  Einzelfälle?
- **G-13 (QU-04):** Die Kanzleifarbe und das Rot für „fehlt“ und „Formatfehler“ sind fast gleich.
  Sollen die Aufklapptexte, die Links und der Rand des festen Hinweises die Kanzleifarbe behalten?
  Oder werden sie neutral (dunkelgrau), oder bekommt das Status-Rot einen deutlich anderen Ton?
- **G-14 (QL-10):** Soll der F17-Hinweis die Box gelb machen und „– mit Hinweisen“ in die Überschrift
  bringen? Er sagt, dass ZUGFeRD 2.0 und 2.0.1 nicht zu unterscheiden sind.
- **G-15 (QL-07):** Sollen fehlende Pflichtangaben und Hinweise auch bei „nicht beurteilt“ in der Box
  stehen, etwa bei einer XML mit unbekannter Spezifikation? F22 regelt nur die E-Rechnung.
- **G-16 (QT-09, QS-05):** Wird die alte IONOS-Kopie (`NebenprojektERechnung/`) noch hochgeladen?
  Oder dürfen `deploy/upload.json` und `npm run hochladen` weg?

Steuerfragen: **F31** und **F32** in `docs/offene-fragen.md`.
