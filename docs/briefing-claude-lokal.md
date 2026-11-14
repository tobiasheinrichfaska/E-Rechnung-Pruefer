# Briefing für Claude Code lokal – Arbeitsteilung Cloud / lokal

Stand 14.11.2026, auf Wunsch von Tobias. Ziel (Tobias): Auf dem lokalen Rechner läuft für
E-Rechnung-Pruefer nichts mehr außer den Upload-Schritten. Entwickelt, getestet und geprüft wird in
**Claude Code im Web** (Cloud-Sitzung). Dieses Briefing sagt dir, was du lokal nicht mehr tust, was
lokal bleibt und wie du dich mit der Cloud abstimmst.

## 1. Was die Cloud-Sitzung übernimmt

- **Entwicklung:** alle Änderungen an Code, Tests, Beispielen (`npm run beispiele`), Datenmodell
  (`npm run docs`) und Doku. Gearbeitet wird auf einem Branch `claude/…`, zusammengeführt per Pull
  Request in `main` – nach Tobias' „Merge ok“.
- **Alle Tests**, jeweils in der Sitzung beobachtet:
  - `npm test` einschließlich der 61 FeRD-Musterrechnungen (`tests/io/ferdLokal.test.ts`),
  - `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`,
  - `npm run test:e2e` in **Chromium, Firefox und WebKit**.
- **Audits** mit Prüf- und Widerlegungs-Agenten, Recherche amtlicher Quellen, Pflege von
  `docs/offene-fragen.md` (Steuerfragen entscheidet weiter nur Tobias).
- **Versionen:** `package.json` erhöhen und die Zeile in der Versionstabelle von `CLAUDE.md`
  (Tobias 14.11.2026: Tabelle statt Git-Tag).
- **Einrichtung der Cloud-Umgebung:** Die Default-Umgebung hat ein gemeinsames Setup-Skript für alle
  Web-Apps; die Fragebogen-Sitzung pflegt den Rahmen, jedes Repo seinen Block. Die Blöcke für
  E-Rechnung-Pruefer und E-Rechnung-Pruefer-privat pflegt die Cloud-Sitzung dieses Projekts.

## 2. Was lokal entfällt

| Bisher lokal                                                                | Jetzt                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test` und `npm run test:e2e` vor dem Merge                             | Läuft in der Cloud (auch Firefox, WebKit, FeRD-Muster). Vor dem Upload nicht mehr nötig.                                                                                             |
| FeRD-Musterrechnungen aus `import/` nach `tests/fixtures/lokal/ferd/` legen | Sie liegen im **privaten Repo `E-Rechnung-Pruefer-privat`** (`ferd/`, dazu das ganze Paket in `ferd-paket/`). Lokal wie in der Cloud wird es als `tests/fixtures/lokal` eingebunden. |
| Offizielle Artefakte prüfen und übernehmen (XSD, Prüfsummen, `quellen.md`)  | Cloud. Lokal nur noch, wenn ein Download hinter einem Formular liegt (siehe Abschnitt 3).                                                                                            |
| Git-Tag `vX.Y.Z` nach dem Merge                                             | Entfällt (Tobias 14.11.2026). Die Versionstabelle in `CLAUDE.md` nennt den Merge-Commit. Das alte Tag `v0.2.0` wurde nie gesetzt; es fehlt nicht.                                    |
| Eigene Entwicklung an diesem Projekt                                        | Nicht parallel zur Cloud. Tobias: „dein Zweig ist der einzige, der weiterverfolgt wird“. Lokale Änderungen an `src/`, `tests/` oder `docs/` nur nach Absprache mit Tobias.           |

## 3. Was lokal bleibt

- **Upload:** `npm run hochladen` (und `npm run tester`) – sie rufen `private/Auslieferung` auf, das
  nur auf diesem Rechner liegt. Vorher `git pull` auf `main` und `npm ci --ignore-scripts`, dann
  `npm run build`. Hochladen nur nach Tobias' ausdrücklichem OK (unverändert).
- **Server-Kopfzeilen:** `frame-ancestors 'none'` und `X-Frame-Options: DENY` für
  `NebenprojektERechnung/` (`deploy/README.md`) – das ist Server-Konfiguration in
  `private/Auslieferung`.
- **Downloads hinter Formularen** (z. B. das FeRD-Paket mit Name und E-Mail): Tobias lädt sie;
  nicht weitergebbares Material kommt ins private Repo `E-Rechnung-Pruefer-privat` (dort committen und
  pushen), weitergebbares (z. B. XSD unter Apache-2.0) bitte als Hinweis an die Cloud-Sitzung, die es
  ins öffentliche Repo übernimmt. Amtliche Seiten, die die Cloud nicht erreicht
  (gesetze-im-internet.de und bundesfinanzministerium.de waren am 14.11.2026 aus der Cloud gesperrt),
  kann lokal geladen und als Datei in die Sitzung gegeben werden.
- **Handtests** in `manual_tests/`: echte Lieferantenrechnungen, Ziehen aus Mail-Programm und
  Explorer, echtes Handy, Verständlichkeit. Ergebnisse an die Cloud-Sitzung geben.
- **Arbeitsbereich außerhalb des Repos:** die zentrale `CLAUDE.md` unter
  `c:\skripte\private\general stuff\` und die Projekttabelle dort. Bitte ergänzen: das private
  Zusatz-Repo `E-Rechnung-Pruefer-privat` (Inhalt: FeRD-Muster und FeRD-Paket, nie öffentlich).

## 4. Abstimmung

- **Vor jeder lokalen Arbeit** `git pull` auf `main`. Lokal nichts nach `main` pushen, was die Cloud
  noch bearbeitet; im Zweifel Tobias fragen.
- **Privates Repo lokal einbinden** (ersetzt den alten Ordner `tests/fixtures/lokal/` – vorher
  prüfen, ob dort etwas liegt, das nicht im privaten Repo ist):

  ```bash
  git clone https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer-privat.git tests/fixtures/lokal
  ```

  `.gitignore` schließt `tests/fixtures/lokal` aus – als Ordner und als Verknüpfung.

- **Was die Cloud gerade umsetzt** (Dialog vom 14.11.2026, Antworten von Tobias): F22–F25
  (Ergebnisbox bei fehlenden Pflichtangaben, Handlungshinweise je Ergebnis, Formatfehler-Satz mit
  Quelle, einfachere Hinweise) und G-1 bis G-10 (Seitenlänge, technische Angaben, Druck-/Kopierknopf,
  Ablagefläche, Startansicht, Begriffe, zwei XML). Bis das in `main` ist, nichts davon lokal
  anfangen.
- **Bestehende Regeln gelten weiter:** Commits ohne Rückfrage melden; Push und Upload nur nach
  Tobias' OK; Steuerfragen entscheidet nur Tobias; keine Speicher- und keine Netzwerkzugriffe in der
  App; FeRD-Muster nie ins öffentliche Repo.
