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

## Rahmen

- [x] **Keine Netzwerkanfrage, kein Speicherzugriff** — E2E zählt beides: null (Spion mit Selbsttest, Nachprüfung der Speicher nach jedem Test)
- [x] **Keine Konsolenfehler beim Laden**

| Path                               | Impact                                   | Audit Check                                                                                                     |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Hybrid-PDF wird erkannt            | Kernfrage der Mandanten                  | E2E mit offizieller XML in eigenem PDF, auch komprimiert wie echte Factur-X-Dateien (echte FeRD-PDFs nur lokal) |
| Nichts verlässt den Rechner        | Vertraulichkeit der Rechnung             | CSP-Test + E2E-Zähler                                                                                           |
| Pflichtangaben vollständig gezeigt | Grundlage der Rückfrage beim Lieferanten | Unit-Tests je Angabe, E2E für ausgewählte Zeilen                                                                |
