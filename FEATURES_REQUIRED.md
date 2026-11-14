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

- [x] **Schemafehler** — „Formatfehler, gem. Rn. 6a ggf. keine E-Rechnung“ mit Fundstelle (Zeile und technische Meldung; EXTENDED noch nicht geprüft)
- [ ] **Rechenfehler** — „mögliche Auffälligkeit: …“ mit Regel-ID und belegenden Werten

## Rahmen

- [x] **Keine Netzwerkanfrage, kein Speicherzugriff** — E2E zählt beides: null (Spion mit Selbsttest, Nachprüfung der Speicher nach jedem Test)
- [x] **Keine Konsolenfehler beim Laden**

| Path                               | Impact                                   | Audit Check                                                                                                     |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Hybrid-PDF wird erkannt            | Kernfrage der Mandanten                  | E2E mit offizieller XML in eigenem PDF, auch komprimiert wie echte Factur-X-Dateien (echte FeRD-PDFs nur lokal) |
| Nichts verlässt den Rechner        | Vertraulichkeit der Rechnung             | CSP-Test + E2E-Zähler                                                                                           |
| Pflichtangaben vollständig gezeigt | Grundlage der Rückfrage beim Lieferanten | Unit-Tests je Angabe, E2E für ausgewählte Zeilen                                                                |
