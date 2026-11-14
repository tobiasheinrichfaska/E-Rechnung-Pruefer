# Handtests – E-Rechnung prüfen

Hier steht nur, was unsere automatischen Tests nicht sauber abdecken können: echte Rechnungen
echter Lieferanten, echte Mailprogramme, echte Handys. Was eine Maschine prüfen kann, prüfen
`npm test` und `npm run test:e2e` – das wird hier nicht wiederholt.

## Vorbereitung

- Gehostet: die Adresse des Ordners `NebenprojektERechnung/` öffnen (aus der Kanzlei ohne Anmeldung,
  sonst mit Tester-Anmeldung „E-Rechnung - Test“).
- Lokal: `npm run build`, dann `dist/index.html` mit einem Doppelklick öffnen.
- Beispielrechnungen: die Adresse des Tools mit `beispiele/` am Ende (gehostet), lokal
  `beispiele/index.html`. Alle Daten sind erfunden; die Dateien dürfen in E-Mails und auf Geräte.
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
    geschütztes PDF, Ablegen einer Datei, feste Hinweiszeile, CSP.
  - Pflichtangaben vollständig, mit Lücken und Hinweisen, Kleinbetrag; Positionen aufklappen.
  - Handybreite (375 px): nichts verschiebt sich seitlich, die Werte stehen unter Bezeichnung und
    Marke.
  - Bei jedem Test: keine Netzwerkanfrage, kein Speicher- oder Cookie-Zugriff, kein Konsolenfehler.
- **Beispielrechnungen** (`tests/beispiele/beispiele.test.ts`): jede der 26 Dateien zeigt ihr
  erwartetes Ergebnis; zusammen zeigen sie jedes Ergebnis, jede Fallart und jeden Hinweis.
- **Vitest** (`npm test`): alle Regeln der Pflichtangaben einschließlich Kleinunternehmer,
  Gutschrift, Leistungszeitpunkt und Anschrift (`src/logic/check.test.ts`); Erkennung und Lesen der
  Musterdateien von KoSIT und CEN; 21 Rechnungen jeweils als UBL und CII im Gegencheck; die 61
  FeRD-Musterrechnungen (nur lokal, nicht im Repo).
