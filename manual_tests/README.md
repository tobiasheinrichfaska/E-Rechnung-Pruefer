# Handtests – E-Rechnung prüfen

Hier steht nur, was unsere automatischen Tests nicht sauber abdecken können: echte Rechnungen
echter Lieferanten, echte Mailprogramme, echte Handys. Was eine Maschine prüfen kann, prüfen
`npm test` und `npm run test:e2e` – das wird hier nicht wiederholt.

## Vorbereitung

- Gehostet: die **Testzone** öffnen (Adresse von Tobias; Anmeldung „E-Rechnung - Test“ mit Ihrem
  Tester-Zugang, danach erkennt der Browser das Gerät wieder). Dort steht neben dem Tool die
  **Testseite** mit diesen Handtests (Tobias, 15.11.2026: Handtests über die Testumgebung):
  - Öffnen Sie dort einen Test. Die Zeit läuft von selbst, solange er offen ist, und endet, wenn Sie
    „Bestanden“ oder „Nicht bestanden“ wählen.
  - Bei „Nicht bestanden“ wählen Sie die Schritte mit Problem, je mit einem Grund aus der Liste.
    **Es gibt kein Textfeld.** Wo eine Anleitung „Notieren Sie …“ sagt, wählen Sie stattdessen den
    Schritt und seinen Grund; mehr sagen Sie Tobias direkt.
  - Zum Schluss **Bericht senden**. Bis dahin bleiben die Ergebnisse in diesem Browser gespeichert,
    auch wenn Sie die Seite neu laden; nach dem Senden sind sie gelöscht. „Neu beginnen“ löscht sie
    nach einer Rückfrage.
- Lokal: `npm run build`, dann `dist/index.html` mit einem Doppelklick öffnen.
- Beispielrechnungen: im öffentlichen Repo unter
  https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer/tree/main/beispiele (die Tabelle „Was
  sie zeigt“ steht unter der Dateiliste; herunterladen mit „Download raw file“), lokal
  `beispiele/index.html`. Sie werden nicht neben dem Tool hochgeladen (Tobias, 15.11.2026). Alle
  Daten sind erfunden; die Dateien dürfen in E-Mails und auf Geräte.
- Achtung: Notieren Sie die Versionsnummer unten auf der Seite (Stand des Repos: 0.8.0). Steht
  dort eine ältere Nummer, ist der letzte Upload noch nicht erfolgt; prüfen Sie dann lokal.
- Echte Rechnungen bleiben auf dem Rechner. Nie in das Repo legen, nie an Dritte senden. Notieren Sie
  nur Lieferant, Programm, Ergebnis und Abweichung – keine Beträge oder Namen von Mandanten.

## Übersicht

| Datei                                                | Tests               | Bereich                                                                                         |
| ---------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| [`01_echte_rechnungen.md`](01_echte_rechnungen.md)   | MT-01               | Echte Rechnungen: Ergebnis, Werte und jedes „fehlt“ gegen das PDF-Bild                          |
| [`02_geraete.md`](02_geraete.md)                     | MT-02, MT-03, MT-05 | Ziehen aus Mailprogramm und Explorer; echtes Handy oder Tablet; Tester einladen in der Testzone |
| [`03_verstaendlichkeit.md`](03_verstaendlichkeit.md) | MT-04               | Jedes Ergebnis und jeder Hinweis, gelesen wie von einem Mandanten                               |

## Automatisiert statt von Hand

- **Playwright** (`tests/e2e/*.spec.ts`; Chromium, Firefox, WebKit auf `dist/index.html`):
  - XML-E-Rechnung, Hybrid-PDF, einfaches PDF, Profil MINIMUM, widersprüchliche Rechnungsdaten,
    geschütztes PDF, Ablegen einer Datei (auch neben das Feld), feste Hinweiszeile, CSP.
  - Hybrid-PDF in einem Browser ohne die neuesten JavaScript-Funktionen (ältere Browser).
  - Schemafehler: Betrag mit Komma, Zeile und technische Meldung, Liste aufklappbar.
  - Rechenfehler: Gesamtbetrag passt nicht, BR-CO-15/-16 mit den belegenden Werten.
  - Pflichtangaben vollständig, mit Lücken und Hinweisen, Kleinbetrag; Positionen aufklappen.
  - Handybreite (375 px und 320 px, auch mit langem Dateinamen): nichts verschiebt sich seitlich, die
    Werte stehen unter Bezeichnung und Marke.
  - Testfassung (`dist-test/index.html`): „Tester einladen“ in der Fußzeile, im selben Tab, auf
    `/_zugang/einladen`; die öffentliche Fassung hat den Link nicht.
  - Testseite der Testfassung: alle Handtests neben dem Tool, die Zeit je Test (läuft, ruht beim
    Verlassen, endet mit dem Ergebnis), Schritte mit Grund, „Bericht senden“ mit genau den Feldern
    des Formats `testbericht/1`, Ablehnung (400) und fehlende Empfangsstelle (404), zwei Reiter am
    Handy; die öffentliche Fassung hat nichts davon und bleibt bei `connect-src 'none'`.
  - Screenreader: Statuszeile mit kurzem Ergebnissatz, Fokus auf dem Ergebnis, Zeilen- und
    Spaltenköpfe der Pflichtangaben, benannte Tabellen (`zugang.spec.ts`). Wie ein echter
    Screenreader vorliest, prüft das nicht.
  - Bei jedem Test: keine Netzwerkanfrage, kein Speicher- oder Cookie-Zugriff, kein Popup, kein
    Konsolenfehler.
- **Beispielrechnungen** (`tests/beispiele/beispiele.test.ts`): jede der 35 Dateien zeigt ihr
  erwartetes Ergebnis; zusammen zeigen sie jede Überschrift (außer leerer Datei, anderer Dateiart und
  zu großer Datei), jede Fallart und jeden Hinweis. Nicht abgedeckt sind die Begründungen „nur im
  Einzelfall nötig“ und die Meldung „Die Prüfung ist abgebrochen“ (unerwarteter Fehler).
- **Vitest** (`npm test`): alle Regeln der Pflichtangaben einschließlich Kleinunternehmer,
  Gutschrift, Leistungszeitpunkt und Anschrift (`src/logic/check.test.ts`); Erkennung und Lesen der
  Musterdateien von KoSIT und CEN; alle 33 Rechnungen der KoSIT-Testsuite jeweils als UBL und CII im Gegencheck; Hybrid-PDF auch komprimiert wie echte Factur-X-Dateien; die 61
  FeRD-Musterrechnungen und die 12 Muster zu ZUGFeRD 1.0 (aus dem privaten Repo, nicht im
  öffentlichen).
