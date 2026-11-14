# Handtests – E-Rechnung prüfen

Hier steht nur, was unsere automatischen Tests nicht sauber abdecken können: echte Rechnungen
echter Lieferanten, echte Mailprogramme, echte Handys. Was eine Maschine prüfen kann, prüfen
`npm test` und `npm run test:e2e` – das wird hier nicht wiederholt.

## Vorbereitung

- Gehostet: die Adresse des Ordners `NebenprojektERechnung/` öffnen (aus der Kanzlei ohne Anmeldung,
  sonst mit Tester-Anmeldung „E-Rechnung - Test“).
- Lokal: `npm run build`, dann `dist/index.html` mit einem Doppelklick öffnen.
- Beispielrechnungen: lokal `beispiele/index.html`; gehostet erst nach dem nächsten Upload (die
  Adresse des Tools mit `beispiele/` am Ende). Alle Daten sind erfunden; die Dateien dürfen in
  E-Mails und auf Geräte.
- Achtung: Die gehostete Fassung ist älter als das Repo (hochgeladen 13.11.2026, Schritt 1c). Bitte
  notieren Sie die Versionsnummer unten auf der Seite; bis zum nächsten Upload mit neuer Nummer
  prüfen Sie die Änderungen ab dem 13.11.2026 nur lokal.
- Echte Rechnungen bleiben auf dem Rechner. Nie in das Repo legen, nie an Dritte senden. Notieren Sie
  nur Lieferant, Programm, Ergebnis und Abweichung – keine Beträge oder Namen von Mandanten.

## Übersicht

| Datei                                                | Tests         | Bereich                                                                |
| ---------------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| [`01_echte_rechnungen.md`](01_echte_rechnungen.md)   | MT-01         | Echte Rechnungen: Ergebnis, Werte und jedes „fehlt“ gegen das PDF-Bild |
| [`02_geraete.md`](02_geraete.md)                     | MT-02 – MT-03 | Ziehen aus Mailprogramm und Explorer; echtes Handy oder Tablet         |
| [`03_verstaendlichkeit.md`](03_verstaendlichkeit.md) | MT-04         | Jedes Ergebnis und jeder Hinweis, gelesen wie von einem Mandanten      |

## Automatisiert statt von Hand

- **Playwright** (`tests/e2e/*.spec.ts`; Chromium, Firefox, WebKit auf `dist/index.html`):
  - XML-E-Rechnung, Hybrid-PDF, einfaches PDF, Profil MINIMUM, widersprüchliche Rechnungsdaten,
    geschütztes PDF, Ablegen einer Datei (auch neben das Feld), feste Hinweiszeile, CSP.
  - Hybrid-PDF in einem Browser ohne die neuesten JavaScript-Funktionen (ältere Browser).
  - Pflichtangaben vollständig, mit Lücken und Hinweisen, Kleinbetrag; Positionen aufklappen.
  - Handybreite (375 px und 320 px, auch mit langem Dateinamen): nichts verschiebt sich seitlich, die
    Werte stehen unter Bezeichnung und Marke.
  - Bei jedem Test: keine Netzwerkanfrage, kein Speicher- oder Cookie-Zugriff, kein Popup, kein
    Konsolenfehler.
- **Beispielrechnungen** (`tests/beispiele/beispiele.test.ts`): jede der 27 Dateien zeigt ihr
  erwartetes Ergebnis; zusammen zeigen sie jede Überschrift (außer leerer Datei, anderer Dateiart und
  zu großer Datei), jede Fallart und jeden Hinweis. Nicht abgedeckt sind die Begründungen „nur im
  Einzelfall nötig“ und die Meldung „Die Prüfung ist abgebrochen“ (unerwarteter Fehler).
- **Vitest** (`npm test`): alle Regeln der Pflichtangaben einschließlich Kleinunternehmer,
  Gutschrift, Leistungszeitpunkt und Anschrift (`src/logic/check.test.ts`); Erkennung und Lesen der
  Musterdateien von KoSIT und CEN; 21 Rechnungen jeweils als UBL und CII im Gegencheck; die 61
  FeRD-Musterrechnungen (nur lokal, nicht im Repo).
