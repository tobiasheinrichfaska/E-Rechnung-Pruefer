# Plan: E-Rechnungs-Prüfer (`e-rechnung`)

Freigegeben von Tobias am 13.11.2026 (E1 und E2 „ok“, Plan „soweit freigegeben“). Die Übergabe
(Ziel, Rahmen, Nicht-Ziele, fachliche Grundlagen) ist die Grundlage; hier steht, wie gebaut wird.

## Ziel

Eine Datei (PDF oder XML) wird in den Browser gezogen. Das Tool zeigt:

1. **Erkennen:** E-Rechnung ja/nein, Syntax (UBL/CII), Profil/Spezifikation.
2. **Schema:** Prüfung der XML mit den offiziellen XSD.
3. **Pflichtangaben** nach § 14 Abs. 4 UStG (und §§ 14 Abs. 5, 14a, 22c UStG, §§ 33, 34a UStDV) mit
   den Werten aus der XML; je Angabe vorhanden / fehlt / nur im Einzelfall nötig.
4. **Plausibilität:** eine steuerlich relevante Teilmenge rechnerischer Regeln.

Ergebnis sind **Hinweise, keine Freigabe**.

## Entscheidungen

| Nr. | Entscheidung                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **Abgelöst am 13.11.2026:** eigenes Projekt (eigenes Repo, mit Historie aus `Fragebogen/e-rechnung/` herausgelöst). Ursprünglich: eigener Unterordner `e-rechnung/` im Fragebogen-Repo.                                                                                |
| E2  | **Abgelöst am 15.11.2026:** bunny.net, eigene Subdomain der Kanzlei (öffentlich) und eine Testzone hinter dem Login aus `Testumgebung`; Upload nur über das Repo `Freigabe` (`deploy/README.md`). Ursprünglich: `NebenprojektERechnung/` auf der Fragebogen-Subdomain. |
| E3  | **Geändert am 14.11.2026:** Commits und umkehrbare GitHub-Aktionen (Push, PR, Merge) ohne Rückfrage, nur gemeldet; Upload, Force-Push und Löschen nur nach Tobias' Freigabe (CLAUDE.md).                                                                               |
| T1  | Ein XML-Werkzeug für alles: libxml2-wasm (Einlesen, XPath, XSD). XML mit DOCTYPE wird abgewiesen.                                                                                                                                                                      |
| T2  | Eine HTML-Datei (vite-plugin-singlefile), CSP mit `connect-src 'none'` und `'wasm-unsafe-eval'`.                                                                                                                                                                       |
| T3  | **Geändert am 15.11.2026:** ESLint verbietet Speicher- und Netz-APIs bis auf benannte Ausnahmen (der gemerkte Zugangshinweis; in der Testfassung der Testlauf und „Bericht senden“); ein E2E-Test zählt Speicherzugriffe und Netzwerkanfragen.                         |
| T4  | Dezimalrechnung auf BigInt, keine Gleitkommazahlen.                                                                                                                                                                                                                    |
| T5  | Zuordnung Pflichtangabe → BT nach der KoSIT/FeRD-Empfehlung, Stand 25.07.2025 (siehe `quellen.md`).                                                                                                                                                                    |

## Aufbau

- `src/logic/` – rein, ohne Browser, WASM oder IO testbar: Profiltabelle (BT-24 → Syntax, Profil,
  Einordnung), Zuordnung BT → XPath (UBL, CII) als Daten, Normalisieren zum BT-Modell,
  Pflichtangaben-Tabelle mit Statusregeln, Plausibilitätsregeln als Daten, Dezimalrechnung,
  Ergebnistexte.
- `src/io/` – Datei einlesen, PDF-Anhänge (pdf.js), XML-Adapter (libxml2-wasm: einlesen, Zuordnung per
  XPath auswerten, XSD).
- `src/ui/` – Ablagefläche, Ergebnis, Pflichtangaben-Tabelle mit aufklappbaren Positionen,
  Plausibilität.
- `src/build/` – CSP für die eine Datei.

## Schritte

| Schritt | Inhalt                                                                                                                                                                                                                                                                    | Stand                                                                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1     | Offizielle Artefakte laden, Lizenzen prüfen, `quellen.md`                                                                                                                                                                                                                 | erledigt (FeRD-Paket von Tobias geladen, `quellen.md`)                                                                                                                                                                                                             |
| 0.2     | Gerüst `e-rechnung/`, dieser Plan, zwei Zeilen im Hauptordner                                                                                                                                                                                                             | erledigt                                                                                                                                                                                                                                                           |
| 0.3     | `npm install --ignore-scripts`                                                                                                                                                                                                                                            | erledigt                                                                                                                                                                                                                                                           |
| 0.4     | Spike: libxml2-wasm + pdf.js in der einen Datei unter der CSP; XSD-Imports aus dem Speicher                                                                                                                                                                               | bestanden (Chromium, Firefox, WebKit)                                                                                                                                                                                                                              |
| 0.5     | Zuordnung gegen die KoSIT/FeRD-Empfehlung abgleichen → `offene-fragen.md` F9                                                                                                                                                                                              | erledigt                                                                                                                                                                                                                                                           |
| 1a      | Einlesen + Erkennen (PDF/XML, Anhänge am Inhalt, Syntax, Profil, Ergebnisarten, mehrere XML)                                                                                                                                                                              | erledigt                                                                                                                                                                                                                                                           |
| 1b      | Normalisieren (Zuordnung als Daten, BT-Modell, Positionen)                                                                                                                                                                                                                | erledigt                                                                                                                                                                                                                                                           |
| 1c      | Pflichtangaben-Ansicht (§ 14 Abs. 4 in Reihenfolge, Status, Gesamtsatz, fester Hinweis)                                                                                                                                                                                   | erledigt (F7, F10–F21 entschieden, F16–F21 am 14.11.2026)                                                                                                                                                                                                          |
| 2a      | XSDs übernehmen (nur weitergebbare), Profil → XSD                                                                                                                                                                                                                         | erledigt 14.11.2026: UBL 2.1 + CII D16B (KoSIT), Factur-X 1.09.2 EXTENDED (FeRD, Apache-2.0)                                                                                                                                                                       |
| 2b      | Schema-Prüfung + Anzeige                                                                                                                                                                                                                                                  | erledigt 14.11.2026 (Beispiel 29)                                                                                                                                                                                                                                  |
| 3a      | Plausibilitätsregeln (BR-CO-10, -13, -14, -15, -16, -17, Aufschlüsselung je Satz, Befreiungsgrund)                                                                                                                                                                        | erledigt 14.11.2026 (BR-CO-10–17, je Kategorie/Satz; Befreiungsgrund in den Pflichtangaben; Beispiel 30); für FeRD EXTENDED zunächst nur BR-CO-14 mit Hinweis, seit 0.3.0 (F29) die eigenen FeRD-Fassungen (BR-FXEXT-…, Logistikkosten; Musterrechnungen X11, X19) |
| 0.3.0   | Entscheidungen vom 14.11.2026: F22–F29, G-1 bis G-10 (Ergebnisbox, Handlungshinweise, Satz nach Datum, Formatfehler-Satz, zwei XML, Profil-Schemata, EXTENDED-Regeln, Bedienung); ZUGFeRD 1.0 aus der Spezifikation belegen; danach Upload von App und Beispielen (lokal) | umgesetzt 14.11.2026, in `main` mit PR #3 (`c78be21`); ZUGFeRD 1.0 belegt durch Spezifikation und 12 FeRD-Muster (privates Repo); offen: F30                                                                                                                       |
| 0.3.1   | F30: Satz bei Leistung vor 2025 („keine E-Rechnung nötig, auch wenn die Rechnung später ausgestellt wird“, BMF 15.10.2024 Rn. 50)                                                                                                                                         | umgesetzt 14.11.2026, in `main` mit PR #5 (`a3cf751`)                                                                                                                                                                                                              |

Ab 0.4.0 stehen die Schritte nur noch in der Versionstabelle von `CLAUDE.md` (Abschnitt „Versioning“) und im Status dort; hier wird keine zweite Liste geführt.

Nach jeder Phase: kurzer Stand mit beobachtetem Testergebnis; der Upload nur nach Freigabe.

## Ergebnis des Spikes (13.11.2026)

- libxml2-wasm bringt sein WebAssembly in der JS-Datei mit und lädt es mit `WebAssembly.instantiate`
  aus dem Speicher – kein `fetch`. Unter der CSP genügt `'wasm-unsafe-eval'`.
- Einlesen, XPath und XSD-Prüfung (UBL 2.1 Invoice/CreditNote, CII D16B; Imports aus dem Speicher)
  laufen in Node und in Chromium, Firefox und WebKit; erste Prüfung samt Übersetzen der XSD
  0,1–0,65 s.
- pdf.js 6 liefert die Anhänge als `Map` ohne Inhalt; den Inhalt holt `getAttachmentContent(name)`.
- Eine Datei mit pdf.js, libxml2, XSDs und zwei Beispielrechnungen: 3,6 MB (gzip 1,0 MB). Keine
  Konsolenfehler, keine Netzwerkanfrage.
