# Wochenprüfung E-Rechnung-Pruefer

Die geplante Aufgabe „Wochenprüfung“ arbeitet diese Liste bei jedem Lauf ab (Auftrag:
`aufgaben/wochenpruefung.md` im Repo `Pruefvorgaenge`, Abschnitt 2). Angelegt am 15.11.2026: Das
Tool stützt sich auf Rechtsquellen und technische Vorgaben, die sich ändern können, und wird als
öffentliche Seite der Kanzlei betrieben.

**Erweitern** heißt: hier einen Eintrag ergänzen. Prüfungen über alle Projekte (Sicherheit,
Integritätsauftrag, neue Projekte) stehen im Auftrag der Aufgabe, nicht hier.

## Regeln für jeden Lauf

- Nur Primärquellen: BGBl., gesetze-im-internet.de, Bundesfinanzministerium (BMF-Schreiben, FAQ
  E-Rechnung, UStAE), KoSIT (xeinkauf.de und die Releases unter github.com/itplr-kosit), FeRD
  (ferd-net.de) und CEN (github.com/ConnectingEurope/eInvoicing-EN16931). Nicht raten. Was sich
  nicht klären lässt, wird als „offen“ gemeldet, mit der Quelle, die fehlt. (Am 14.11.2026 waren
  gesetze-im-internet.de und bundesfinanzministerium.de aus der Cloud gesperrt.)
- **Steuerfragen entscheidet nur Tobias** (`CLAUDE.md`). Eine geänderte Rechtslage wird nicht
  umgesetzt, sondern als neue Frage in `docs/offene-fragen.md` aufgenommen (per PR, mit Fundstelle
  und den betroffenen Stellen im Code).
- Technische Änderungen (Schema, Zuordnung, Kennungen, Rechenregeln) als PR mit einem Test, der
  vorher fehlschlägt, nach den Regeln von `CLAUDE.md`. Neue Quellen mit SHA-256 in `docs/quellen.md`.
- PRs dieser Liste werden **nicht** gemergt.
- Nie hochladen. Die FeRD-Muster und alles, was die Kanzlei nennt, nie ins öffentliche Repo.
- Die Einträge S1 und S2 brauchen das private Repo `E-Rechnung-Pruefer-privat` als
  `tests/fixtures/lokal` (`CLAUDE.md`, „Every cloud session attaches it by itself“).
- Ist das „Ende“ eines Eintrags erreicht, wird der Eintrag im selben PR gestrichen.

## Einträge

### R1 · BMF-Schreiben und FAQ zur E-Rechnung

- **Prüfen:** Gibt es ein BMF-Schreiben zur E-Rechnung nach dem 15.10.2026 oder eine neue Fassung
  der FAQ E-Rechnung (Stand 29.10.2026)? Ändert es eine Randnummer, auf die sich das Tool stützt
  (15.10.2024 Rn. 25, 30, 33, 34, 50, 56–59, 62–65; 15.10.2025 Rn. 6a, 6b, 35a; 15.10.2026 Rn. 2,
  8–9, 15–16, 22, 23)?
- **Dann:** Melden, welche Texte (`src/logic/texts.ts`) und Regeln (`uebergang.ts`, `profiles.ts`,
  `pflichtangaben.ts`, `verdict.ts`) betroffen sind, und die Frage in `docs/offene-fragen.md`
  aufnehmen.
- **Ende:** dauerhaft.

### R2 · UStG und UStDV

- **Prüfen:** Ist eine Änderung von § 14, § 14a, § 27 Abs. 38 UStG oder §§ 31–34a UStDV verkündet
  (BGBl.)? Besonders die Übergangsfristen (31.12.2026, 31.12.2027, 800.000 Euro) und § 14 Abs. 4
  Satz 1 Nr. 6a UStG (ab 01.01.2028).
- **Dann:** Mit Fundstelle melden; die Frage in `docs/offene-fragen.md` aufnehmen.
  `src/logic/uebergang.ts` und `pflichtangaben.ts` erst nach Tobias' Entscheidung ändern.
- **Ende:** dauerhaft.

### R3 · Umsatzsteuer-Anwendungserlass

- **Prüfen:** Gibt es einen neueren Stand des UStAE als den vom 19.10.2026 mit Änderungen in den
  Abschnitten 14.1, 14.4, 14.5, 14.8, 14.11, 15.2 oder 15.2a?
- **Dann:** Wie R1.
- **Ende:** dauerhaft.

### R4 · XRechnung und KoSIT-Artefakte

- **Prüfen:** Gibt es neuere Releases als die im Tool?
  - Validator-Konfiguration XRechnung: v2026-08-31 (XRechnung 3.0.2)
  - XRechnung-Testsuite: v2026-08-31
  - XRechnung-Visualization: v2026-10-13 (Quelle von `src/logic/binding.ts`)
  - Ist XRechnung 4.0.0 (Vorversion vom 15.09.2026) endgültig erschienen, und ab wann gilt sie?
- **Dann:** Das neue Release laden (`docs/quellen.md` mit SHA-256). Die Testsuite gegen das Tool
  laufen lassen. Unterschiede in der Zuordnung (`binding.ts`), im Schema (`schemas/`, `syntax.ts`)
  oder bei den Kennungen (`profiles.ts`, BT-24) als PR mit Test. Eine neue Kennung bleibt „nicht
  beurteilt“, bis Tobias sie einordnet.
- **Ende:** dauerhaft.

### R5 · ZUGFeRD und Factur-X (FeRD)

- **Prüfen:** Gibt es eine neuere Version als ZUGFeRD 2.5.2 / Factur-X 1.09.2 (Infopaket vom
  04.08.2026), mit neuen Profilkennungen, Schemata, Schematron-Regeln oder Codelisten?
- **Dann:** Tobias melden: Das Paket liegt hinter einem Formular und wird von ihm geladen (ins
  private Repo). Weitergebbare XSD (Apache-2.0) kommen danach nach `schemas/`.
- **Ende:** dauerhaft.

### R6 · CEN-Validierungsartefakte EN 16931

- **Prüfen:** Gibt es ein Release nach `validation-1.3.17` mit geänderten Regeln BR-CO-10 bis
  BR-CO-17 oder BR-…-08 (Aufschlüsselung je Steuersatz)?
- **Dann:** Die Unterschiede in `src/logic/rules.ts` als PR mit Test; die offiziellen Beispiele in
  `tests/fixtures/offiziell/` neu laden.
- **Ende:** dauerhaft.

### R7 · Empfehlung von KoSIT und FeRD zu den Pflichtangaben

- **Prüfen:** Gibt es eine neue Fassung der „Empfehlungen zu Pflichtangaben in einer E-Rechnung –
  Teil I“ (Stand 25.07.2025)? Das BMF verweist auf die „jeweils aktuelle“ Fassung (15.10.2026,
  Rn. 8–9).
- **Dann:** Die Unterschiede zu `src/logic/pflichtangaben.ts` melden. Eine geänderte Zuordnung als
  PR mit Test; eine steuerliche Bewertung als Frage in `docs/offene-fragen.md`.
- **Ende:** dauerhaft.

### S1 · Keine Angaben der Kanzlei im öffentlichen Repo

- **Prüfen:** `npx vitest run tests/static/noBranding.test.ts` mit dem privaten Repo. Ohne es
  prüft der Test nur das neutrale Beispiel – das zählt als „offen“.
- **Dann:** Treffer melden (die Datei, nie den gefundenen Text) und als PR entfernen.
- **Ende:** dauerhaft.

### S2 · Tests mit den privaten Dateien

- **Prüfen:**
  - `npx vitest run tests/io/ferdLokal.test.ts tests/io/zugferd1Lokal.test.ts`
  - `npm run test:e2e -- --trace off tests/e2e/zugangshinweis.spec.ts tests/e2e/fusszeile.spec.ts`
    (die Browser richtet das Setup-Skript der Umgebung ein)

  Ein übersprungener Test ist nicht bestanden.

- **Dann:** Einen Fehlschlag mit Ursache melden und beheben wie jeden anderen.
- **Ende:** dauerhaft.
