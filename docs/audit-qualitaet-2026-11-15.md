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

- **G-17 (Testrahmen, 0.10.0):** Der gemeinsame Testrahmen aus `Testumgebung` behält gesendete
  Ergebnisse im Browser, als „gesendet“ markiert, und hat kein „Neu beginnen“. Für die eigene
  Testseite hatten Sie entschieden: gelöscht, sobald gesendet. Passt das Verhalten des Rahmens? Oder
  soll `Testumgebung` die gesendeten Ergebnisse löschen oder ein „Neu beginnen“ anbieten? Das ist
  auch ein Wunsch an `Testumgebung`, die Kopie hier wird nie geändert.

Steuerfragen: **F31** und **F32** in `docs/offene-fragen.md`.

## Runde 2 (16.11.2026)

### Vorgehen

- **Stand:** `0c2bdef`, Version 0.10.0. Dazu gehören die Behebungen aus Runde 1 und der gemeinsame
  Testrahmen.
- **Ablauf wie in Runde 1:**
  - vier Prüf-Agenten (R2-L, R2-S, R2-U, R2-T);
  - vier Widerlegungs-Agenten;
  - drei Behebungs-Agenten in eigenen Arbeitskopien.
- **Prüfauftrag:** Die Prüf-Agenten sollten die Behebungen aus Runde 1 selbst prüfen. Ausdrücklich
  galt: „nichts gefunden“ ist ein gültiges Ergebnis.
- **Testrahmen:** Probleme in der Kopie des Rahmens gingen als Wünsche an `Testumgebung`. Die Kopie
  wird hier nie geändert.
- **Nach dem Zusammenführen** (Version 0.10.1, `b10009c`), in der Cloud-Sitzung beobachtet:
  - mit den privaten Dateien: Typprüfung, Lint und Format grün, 587 Unit-Tests, E2E 168 bestanden und
    9 übersprungen;
  - ohne sie: 508 Unit-Tests bestanden und 4 übersprungen, E2E 147 bestanden und 30 übersprungen;
  - der Lauf mit der erfundenen Kanzlei: 30 von 30;
  - die Prüfung „Tests“ auf GitHub grün (PR #36).
- **Rechteprüfung:** Ein Widerlegungs-Agent wollte Saxon von Maven Central laden und eine private
  FeRD-Datei kopieren. Beides wurde abgelehnt, und er hat es nicht wiederholt. Zwei Aussagen zum
  Schematron sind deshalb gelesen, nicht vom Validator bestätigt.

### Ergebnis

34 Befunde, **keiner ganz widerlegt**.

| Bereich           | Befunde | bestätigt | teilweise | Wünsche an Testumgebung |
| ----------------- | ------- | --------- | --------- | ----------------------- |
| Logik (R2-L)      | 8       | 6         | 2         | 0                       |
| Sicherheit (R2-S) | 6       | 2         | 4         | 1                       |
| Bedienung (R2-U)  | 11      | 10        | 1         | 2                       |
| Tests/Doku (R2-T) | 9       | 8         | 1         | 1                       |

### Logik und Ergebnisse (R2-L)

| ID      | Befund                                                                                                                                                                                                 | Erledigung                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-L-01 | Die Behebung QL-01 verglich Anzeigetexte: dieselbe Rechnung mit „7“ und „7.00“, einer Nullsumme nur in einer XML oder anderer Reihenfolge galt als Formatfehler (rot), ebenso das amtliche Paar 03.07a | behoben: Vergleich nach Wert, Listen als Mengen, Regeln nur ungleich „passt“; 7/7.00, 1/1.0000, Nullsumme, Reihenfolge und 03.07a gelten als gleich, echte Unterschiede bleiben; BT-113 ist Frage **G-20** |
| R2-L-02 | „Unterschiedlich: …“ zeigte bei Positionen und Regeln gleiche Texte („vorhanden / vorhanden“)                                                                                                          | behoben: die abweichenden Werte stehen in der Zeile                                                                                                                                                        |
| R2-L-03 | UBL-Form von BR-CO-15 ohne BT-110 „passt“, CEN verlangt genau einen Steuerbetrag in Belegwährung                                                                                                       | behoben: genau ein Steuerbetrag in beiden Syntaxen (`co15ExactlyOneTax`); EXTENDED folgt der Meldung, Frage **G-21**                                                                                       |
| R2-L-04 | Die Box nannte bei Angaben je Position die ganze Zeile                                                                                                                                                 | behoben                                                                                                                                                                                                    |
| R2-L-05 | UBL BR-S-08 „auffällig“ mit lauter 0,00, ohne den Grund                                                                                                                                                | behoben: „Positionen, Zuschläge oder Nachlässe mit diesem Satz: keine“                                                                                                                                     |
| R2-L-06 | Eine angehängte, nicht wohlgeformte HTML-Datei galt als fehlerhafte XML                                                                                                                                | behoben: eine Webseite ist „kein XML“, nach Inhalt erkannt                                                                                                                                                 |
| R2-L-07 | Ein fehlender Teilbetrag hieß „keine Zahl“                                                                                                                                                             | behoben                                                                                                                                                                                                    |
| R2-L-08 | BR-CO-11/-12 nannten den zweiten Wert nur mit seiner Kennung                                                                                                                                           | behoben                                                                                                                                                                                                    |

### Sicherheit und Auslieferung (R2-S)

| ID      | Befund                                                                                                                           | Erledigung                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-S-01 | Sehr viele Positionen (100 000 leere in 14 KiB) frieren die Seite für Sekunden ein; echte 20-MB-Rechnungen 3,4–4,9 s             | behoben: jede XPath einmal je Dokument übersetzt (50 000 leere Positionen 2,1 s statt 5 s, gleiche Ausgabe auf 252 Dateien); die Obergrenze ist Frage **G-18**                |
| R2-S-02 | Schemameldungen hinter Zeile 65535 nannten Zeile 65535                                                                           | behoben (`XML_PARSE_BIG_LINES`)                                                                                                                                               |
| R2-S-03 | Die Sperren um die Kopie des Rahmens galten nur für die heutigen Dateinamen                                                      | behoben: genaue Dateiliste mit eigenen Prüfsummen, ESLint auch für `.js`/`.mjs`/`.cjs`, unsichtbare Zeichen auch in `.mjs`/`.mts`; Wunsch an Testumgebung (dort schon gebaut) |
| R2-S-04 | Ein Build der Testfassung ohne Ausgabeordner schrieb nach `dist/`, und die Prüfung im Freigabe-Lauf bestand auch die Testfassung | behoben: Ordner nach Modus, Testfassung in `dist/` bricht ab; Anfrage an den Kanzlei-PC (Briefing § 6)                                                                        |
| R2-S-05 | Der Kanzleidaten-Test las nur den heutigen Stand, nicht noch nicht gepushte Commits                                              | behoben                                                                                                                                                                       |
| R2-S-06 | Die öffentliche Doku nennt die Namen der Pull Zones; daraus ergeben sich die privaten `….b-cdn.net`-Adressen                     | Frage **G-19**                                                                                                                                                                |

### Bedienung, Texte, Zugänglichkeit (R2-U)

| ID      | Befund                                                                                        | Erledigung                                                                             |
| ------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| R2-U-01 | In der Testfassung zwischen 900 und 1050 px war das Tool zu schmal für seine Tabelle          | behoben: Container-Abfrage (`src/testArea.css`)                                        |
| R2-U-02 | Die Testfassung druckte im Hochformat nur die Testseite                                       | behoben durch den Rahmen `2645a15`, mit Test                                           |
| R2-U-03 | Die Handtests nannten die Beispielseite nur als „siehe README“                                | behoben                                                                                |
| R2-U-04 | Drei „Danach“-Sätze passten nicht zur Testfassung                                             | behoben                                                                                |
| R2-U-05 | Eine Datei auf der Testseite wurde im verborgenen Tool geprüft                                | behoben: neben dem Tool abgewiesen                                                     |
| R2-U-06 | Der Gutschrift-Hinweis hieß „Mögliche Auffälligkeit“, Box und Zusammenfassung sagen „Hinweis“ | behoben: auch der Gutschrift-Hinweis beginnt mit „Hinweis:“                            |
| R2-U-07 | „besondere Fälle“ bedeutete zweierlei                                                         | behoben: „nur im Einzelfall nötig“ wie die Marke                                       |
| R2-U-08 | Ein nicht gelesener Anhang machte gelb, ohne zu sagen, was das bedeutet                       | behoben: „Ob dieser Anhang weitere Rechnungsdaten enthält, kann das Tool nicht sagen.“ |
| R2-U-09 | Bei mehreren XML standen Anhangnamen ohne „…“                                                 | behoben                                                                                |
| R2-U-10 | Statusmeldungen des Rahmens werden vermutlich nicht vorgelesen                                | Wunsch an Testumgebung (dort gebaut, noch nicht in `main`)                             |
| R2-U-11 | Im Kontrastmodus sehen gewählte Knöpfe des Rahmens gleich aus                                 | Wunsch an Testumgebung (dort gebaut, noch nicht in `main`)                             |

### Tests und Dokumentation (R2-T)

| ID      | Befund                                                                                   | Erledigung                                                                              |
| ------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| R2-T-01 | Die Rechenformen je Syntax hingen an einer Zeile, die kein Test schützte                 | behoben: Test über `verdictOf`                                                          |
| R2-T-02 | Viele Einträge von `RULE_FORMS` ließen sich ohne roten Test ändern                       | behoben: Tabelle über alle Kategorien und beide Syntaxen, 22 von 22 Mutationen gefangen |
| R2-T-03 | QL-01 ungetestet für einen Unterschied nur in den Regeln                                 | behoben                                                                                 |
| R2-T-04 | Die CI-Prüfung mit der erfundenen Kanzlei zählte nur die Summe                           | behoben: je Spec                                                                        |
| R2-T-05 | wie R2-S-03                                                                              | behoben                                                                                 |
| R2-T-06 | Prüfsummen der XSD nicht an den Pfad gebunden                                            | teilweise widerlegt, keine Änderung nötig                                               |
| R2-T-07 | Unsichtbare Zeichen in eigenen Dateien unter `tests/fixtures/` wurden nicht gefunden     | behoben                                                                                 |
| R2-T-08 | Einige Zeilen in CLAUDE.md und `config/README.md` versprachen mehr, als die Tests prüfen | behoben (Tests und Doku)                                                                |
| R2-T-09 | Zwei Dateien ohne Zeile in CLAUDE.md                                                     | behoben                                                                                 |

### Neue Fragen an Tobias

- **G-18 (R2-S-01):** Soll es eine Obergrenze für die Zahl der Positionen geben, und wie hoch? Gezählt
  würde über alle Anhänge eines PDF. Der Vorschlag 10 000 würde echte Rechnungen abweisen.
- **G-19 (R2-S-06):** Dürfen die Namen der Pull Zones öffentlich bleiben?
  - Aus ihnen ergeben sich die `….b-cdn.net`-Adressen, die das private Repo als privat führt. Die
    Live-Adresse zeigt den Zugangshinweis mit dem Kanzleinamen.
  - Wenn ja, passe ich die private Regel an. Wenn nein, ersetze ich die Namen in der Doku und nehme
    sie in die private Namensliste auf.
- **G-21 (R2-L-03):** Die FeRD-Regel BR-FXEXT-CO-15 (EXTENDED) folgt heute der Meldung ihres Asserts.
  Wörtlich gelesen würde ihr Test jede EXTENDED-Rechnung ohne BT-110 als Fehler melden; das ließ sich
  ohne Saxon nicht nachstellen. F29 sagt „wie das FeRD-Schematron rechnet“. Soll das Tool dem Text der
  Meldung folgen (heute) oder dem strengen Test?
- **G-20 (R2-L-01):** Zwei XML derselben Rechnung, von denen nur eine BT-113 = 0,00 nennt (amtliches
  Paar 01.20a), unterscheiden sich im Status der Zeile „Endrechnung“. Zählt das als Unterschied (F27)?
