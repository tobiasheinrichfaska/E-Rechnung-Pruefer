# Critical User Paths — E-Rechnung prüfen

**Purpose:** Core workflows that must not break. Audit validates these end-to-end.

## Einlesen und Erkennen (Phase 1)

- [x] **Hybrid-PDF (ZUGFeRD/Factur-X) hineinziehen** — „E-Rechnung erkannt (Profil …)“, Syntax CII
- [x] **XRechnung als XML (UBL oder CII) hineinziehen** — „E-Rechnung erkannt“ mit Spezifikation
- [x] **Einfaches PDF ohne Rechnungsdaten** — „Keine E-Rechnung: einfaches PDF“
- [x] **Profil MINIMUM oder BASIC WL** — „keine E-Rechnung im Sinne des UStG“
- [x] **Mehrere Rechnungs-XML im PDF** — alle gezeigt, Vergleich, nie eine Fassung selbst gewählt
- [x] **Kaputte, verschlüsselte oder zu große Datei** — klare Meldung mit Grund, kein Absturz

## Pflichtangaben (Phase 1)

- [x] **Pflichtangaben in der Reihenfolge des § 14 Abs. 4** — je Zeile Werte und Status
- [x] **Positionen aufklappbar** — Menge, Art, Betrag je Position
- [x] **Gesamtsatz nie „ordnungsgemäß“** — „Alle stets nötigen Pflichtangaben sind vorhanden. Bitte prüfen Sie die Werte und ob ein Fall ‚nur im Einzelfall nötig‘ zutrifft.“ bzw. „Es fehlt: …“
- [x] **Kleinbetrag und Kleinunternehmer** — verringerte Angaben nach § 33 bzw. § 34a UStDV

## Schema und Plausibilität (Phasen 2, 3)

- [x] **Schemafehler** — „Die Datei hat einen Formatfehler. Sie ist deshalb möglicherweise keine E-Rechnung (BMF-Schreiben vom 15.10.2025, Rn. 6a).“ (F24), dazu der Satz nach Leistungs- und Rechnungsdatum (F26), zuletzt die technische Meldung mit Zeile; Factur-X-Profile gegen ihr FeRD-Schema (F28)
- [x] **Rechenfehler** — „mögliche Auffälligkeit: …“ mit Regel-ID, belegenden Werten (mit Namen) und dem Wert, den die Regel erwartet

- [x] **Fehlende Pflichtangabe oder Hinweis** — Ergebnisbox gelb mit Zeile und Handlungshinweis (F22, F23)
- [x] **Zwei verschiedene Rechnungs-XML** — Formatfehler mit Vergleichstabelle (F27)

## Bedienung (Audit 14.11.2026)

- [x] **Ergebnis drucken für die Kanzlei** — ohne Ablagefläche, alle Abschnitte offen, mit Prüfdatum und Uhrzeit
- [x] **Ordner oder unlesbare Datei, mehrere Dateien zugleich** — deutsche Meldung bzw. „Geprüft wurde nur die erste.“
- [x] **Handy 320 px** — Bezeichnungen der Pflichtangaben ohne Trennung mitten im Wort

## Zugangshinweis (15.11.2026)

- [x] **Online-Fassung fragt den Hinweis vor dem Start** — Text aus der lokalen Kanzlei-Konfiguration, „Weiter“ erst mit Haken, vorher nichts vom Tool; „Antwort für die Zukunft merken“ merkt nur den Fingerabdruck des Textes; geänderter Text wird neu gefragt; heruntergeladene Datei fragt nicht

## Testfassung (15.11.2026)

- [x] **„Tester einladen“ nur in der Testfassung** — `npm run build:test` (`dist-test/`): Link in der Fußzeile auf `/_zugang/einladen`, im selben Tab; `dist/index.html` enthält weder die Adresse noch das Wort
- [x] **Nicht installierbar** — kein Manifest, kein Service Worker, keine Apple-Web-App-Angaben; CSP `manifest-src` und `worker-src` `'none'` (öffentliche Fassung und Testfassung)
- [x] **Testseite der Testfassung** — alle Handtests neben dem Tool (am Handy zwei Reiter); je Test „Bestanden“ / „Nicht bestanden“ mit Schritten und Grund aus fester Liste, **kein Textfeld**; die Zeit misst die Seite selbst; „Bericht senden“ an `/_zugang/bericht` im Format `testbericht/1`, Meldung bei 400 und 404; nur die Testfassung darf verbinden (`connect-src 'self'`); der Testlauf übersteht ein Neuladen und ist nach dem Senden gelöscht, „Neu beginnen“ mit Rückfrage
- [x] **GitHub-Prüfung „Tests“** — Typen, Lint, Format, Unit-Tests und E2E in drei Browsern; jeder Upload wartet darauf

## Rahmen

- [x] **Keine Netzwerkanfrage, kein Speicherzugriff außer dem gemerkten Zugangshinweis** — E2E zählt beides: null bis auf genau diesen Schlüssel (Spion mit Selbsttest, Nachprüfung der Speicher nach jedem Test); ESLint lässt `localStorage` nur in `src/io/accessStore.ts` zu (Regressionstest)
- [x] **Keine Konsolenfehler beim Laden**

| Path                               | Impact                                   | Audit Check                                                                                                     |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Hybrid-PDF wird erkannt            | Kernfrage der Mandanten                  | E2E mit offizieller XML in eigenem PDF, auch komprimiert wie echte Factur-X-Dateien (echte FeRD-PDFs nur lokal) |
| Nichts verlässt den Rechner        | Vertraulichkeit der Rechnung             | CSP-Test + E2E-Zähler                                                                                           |
| Zugangshinweis vor dem Start       | Nutzung nur nach Kenntnis des Hinweises  | E2E über https mit dem echten Text (privates Repo), Logik-Tests, kein Kanzleiname im Repo                       |
| Pflichtangaben vollständig gezeigt | Grundlage der Rückfrage beim Lieferanten | Unit-Tests je Angabe, E2E für ausgewählte Zeilen                                                                |
