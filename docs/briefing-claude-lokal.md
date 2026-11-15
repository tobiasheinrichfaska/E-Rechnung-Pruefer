# Briefing für Claude Code lokal – Arbeitsteilung Cloud / lokal

Stand 14.11.2026, auf Wunsch von Tobias. Ziel (Tobias): Auf dem lokalen Rechner läuft für
E-Rechnung-Pruefer nichts mehr außer den Upload-Schritten. Entwickelt, getestet und geprüft wird in
**Claude Code im Web** (Cloud-Sitzung). Dieses Briefing sagt dir, was du lokal nicht mehr tust, was
lokal bleibt und wie du dich mit der Cloud abstimmst.

## 1. Was die Cloud-Sitzung übernimmt

- **Entwicklung:** alle Änderungen an Code, Tests, Beispielen (`npm run beispiele`), Datenmodell
  (`npm run docs`) und Doku. Gearbeitet wird auf einem Branch `claude/…`, zusammengeführt per Pull
  Request in `main` – ohne Rückfrage, danach berichtet (Tobias 14.11.2026: „reversibel GitHub
  Aktionen kannst du ohne mich ausführen“).
- **Alle Tests**, jeweils in der Sitzung beobachtet:
  - `npm test` einschließlich der 61 FeRD-Musterrechnungen (`tests/io/ferdLokal.test.ts`) und der
    12 Muster zu ZUGFeRD 1.0 (`tests/io/zugferd1Lokal.test.ts`),
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

- **Upload (geändert 15.11.2026, `CLAUDE.md`, „Hosting move decided“):**
  - **Testfassung bei IONOS** (`NebenprojektERechnung/`, hinter der Anmeldung): bis zur Freigabe wie
    bisher vom Kanzlei-PC mit `npm run hochladen` (und `npm run tester`). Beide rufen
    `private/Auslieferung` auf, das nur auf diesem Rechner liegt. Vorher `git pull` auf `main`,
    `npm ci --ignore-scripts`, dann `npm run build`. Hochladen nur nach Tobias' ausdrücklichem OK.
  - **Öffentliche Fassung auf bunny.net** (eigene Subdomain der Kanzlei): nicht über das lokale
    Upload-Werkzeug (es hat keinen Weg zu bunny.net), sondern über das private „Freigabe“-Repo mit
    GitHub Actions; jeden Lauf startet Tobias von Hand. Das gilt schon für den ersten Upload dorthin.
    Das Freigabe-Repo wird nie an eine Cloud-Sitzung angehängt; Cloud-Sitzungen laden nie hoch.
  - **Testzone bei bunny.net** (geschützt, Anmeldeskript aus `Testumgebung`): Eintrag `erechnungtest`
    mit `npm run build:test`, hochgeladen wird `dist-test/index.html`; nur diese Fassung hat
    „Tester einladen“ in der Fußzeile. Beide Einträge warten auf die GitHub-Prüfung „Tests“
    (`deploy/README.md`, „Testfassung und Prüfung ‚Tests‘“).
- **Server-Kopfzeilen:**
  - IONOS: `frame-ancestors 'none'` und `X-Frame-Options: DENY` für `NebenprojektERechnung/`
    (`deploy/README.md`) – Server-Konfiguration in `private/Auslieferung`.
  - bunny.net: Edge Rules am 15.11.2026 im Dashboard eingestellt (`deploy/README.md`, „Auf
    bunny.net“); geprüft wird mit `curl -I` nach dem ersten Upload. Ändert sich
    `src/build/csp.ts` bei `object-src`, `base-uri` oder `form-action`, muss die Edge Rule auf dem
    Kanzlei-PC mitgeändert werden.
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
  Zusatz-Repo `E-Rechnung-Pruefer-privat` (Inhalt: FeRD-Muster, FeRD-Paket und das Material zu
  ZUGFeRD 1.0, nie öffentlich).

## 4. Abstimmung

- **Vor jeder lokalen Arbeit** `git pull` auf `main`. Lokal nichts nach `main` pushen, was die Cloud
  noch bearbeitet; im Zweifel Tobias fragen.
- **Privates Repo lokal einbinden** (ersetzt den alten Ordner `tests/fixtures/lokal/` – vorher
  prüfen, ob dort etwas liegt, das nicht im privaten Repo ist):

  ```bash
  git clone https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer-privat.git tests/fixtures/lokal
  ```

  `.gitignore` schließt `tests/fixtures/lokal` aus – als Ordner und als Verknüpfung.

- **Stand 15.11.2026:** Alles aus dem Dialog vom 14.11.2026 (F22–F30, G-1 bis G-10) ist in `main`
  (Version 0.3.1). Neu am 15.11.2026 (`CLAUDE.md`, „Hosting move decided“): Umzug auf bunny.net;
  nächste Aufgabe der Cloud ist der Zugangshinweis vor dem Start (Text und Ablageort der
  Konfiguration klärt sie mit Tobias). Lokal offen: Upload der Testfassung bei IONOS,
  Server-Kopfzeilen, Handtests.
- **Regeln:** Commits ohne Rückfrage melden; umkehrbare GitHub-Aktionen (Push auf einen Zweig,
  Pull Requests, Merge nach `main`) ohne Rückfrage, aber melden (Tobias 14.11.2026); der Upload
  auf den Server nur nach Tobias' OK; Steuerfragen entscheidet nur Tobias; keine Netzwerkzugriffe in der App; Speicher nur für den
  bestätigten Zugangshinweis (Tobias 15.11.2026), alles Weitere nur nach Rückfrage; FeRD-Muster nie ins öffentliche Repo.

## 5. Anfrage an den Kanzlei-PC (Cloud-Sitzung, 15.11.2026)

Tobias hat am 15.11.2026 abends die offenen Punkte am Kanzlei-PC so verteilt: „formuliere eine
Anfrage an den PC“. Bitte arbeite sie im Repo `Freigabe` und lokal ab und melde das Ergebnis über
eine Cloud-Sitzung oder eine Datei im privaten Repo `E-Rechnung-Pruefer-privat` (`auslieferung/`).
Keine Zugangsdaten, keine Zonen-IDs in dieses öffentliche Repo.

1. **Gate auf die GitHub-Prüfung „Tests“** (Einträge `erechnung` und `erechnungtest` im Repo
   `Freigabe`): `"gate": { "workflow": "Tests" }`.
   - Warum: Seit Version 0.7.0 (`main`, Merge `f342986`) hat dieses Repo den Workflow
     `.github/workflows/tests.yml` mit dem Namen „Tests“: Typprüfung, Lint, Formatierung,
     Unit-Tests und E2E in Chromium, Firefox und WebKit, bei jedem Push auf `main` und jedem PR.
     Er war für `f342986` und `b8b1584` grün.
   - Der Notbehelf „der Upload führt selbst `npm test` aus“ kann dann wegfallen.
2. **Build der Testzone** (`erechnungtest`): `npm run build:test` statt `npm run build`; hochgeladen
   wird `dist-test/index.html` als `index.html`.
   - Nur diese Fassung hat „Tester einladen“, ab 0.8.0 die Testseite mit „Bericht senden“ und in
     ihrer CSP `connect-src 'self'`. Die öffentliche Zone (`erechnung`) bekommt weiter
     `npm run build` und `dist/index.html`.
   - Der Testbuild braucht `git` im Checkout: Er setzt den Commit als `stand` in den Bericht ein
     (`git rev-parse --short HEAD`) und bricht ohne `git` ab.
3. **Kanzlei-Konfiguration vor dem Build** (beide Einträge): Der Lauf muss vor dem Build das private
   Repo `E-Rechnung-Pruefer-privat` als `tests/fixtures/lokal` auschecken oder
   `config/kanzlei.local.json` hinlegen (`deploy/README.md`, „Zugangshinweis im Freigabe-Lauf“).
   - Sonst entsteht **ohne Fehlermeldung** eine Fassung ohne Zugangshinweis, ohne Impressum und
     Datenschutz und ohne Kanzleifarben.
   - Bitte einen Prüfschritt nach dem Build: Die gebaute Datei enthält den Anfang des Hinweises und
     beide Adressen.
   - Die Cloud kann das nicht selbst einbauen: Das Repo `Freigabe` wird nie an eine Cloud-Sitzung
     angehängt.
4. **Nur `index.html` hochladen** – so sollte es nach Meinung der Cloud sein; bitte bestätigen oder
   sagen, was der Lauf heute hochlädt.
   - Keine Beispielrechnungen (Tobias, 15.11.2026), kein `manifest.webmanifest`, kein `sw.js`, keine
     Quelltexte. Die App ist absichtlich nicht installierbar (`deploy/README.md`).
5. **Nachweis nach jedem Upload:** Der Lauf schreibt nach jedem erfolgreichen Upload
   `auslieferung/<Ziel>.json` ins private Repo `E-Rechnung-Pruefer-privat` (Adresse, Commit, Zeit,
   Dateien mit SHA-256; Format in `deploy/README.md`, „Nachweis jedes Uploads“). Darauf baut später
   ein täglicher Integritätsabgleich auf (Wochenprüfung, Punkt 4).
6. **Kopfzeilen der Testzone:** Ab 0.8.0 schickt „Bericht senden“ an `/_zugang/bericht`. Setzt eine
   Edge Rule der **Testzone** eine CSP-Kopfzeile, darf sie `connect-src` nicht auf `'none'` stellen,
   sonst blockiert der Browser den Bericht. Die öffentliche Zone bleibt, wie sie ist.
7. **Nach dem ersten Upload:** `curl -I` der öffentlichen Adresse (und der Testzone; dort ist 401
   vom Login-Skript richtig). Die Ausgabe als Datei ins private Repo `E-Rechnung-Pruefer-privat`
   (`auslieferung/kopfzeilen-JJJJ-MM-TT.txt`) legen. Die Cloud prüft damit die Sicherheits-Kopfzeilen
   gegen `deploy/README.md` und schließt den Befund S-11 der Bestandsaufnahme.
8. **Workspace-`CLAUDE.md`** (`c:\skripte\private\general stuff\CLAUDE.md`): in der Projekttabelle
   einen Eintrag für das private Repo `E-Rechnung-Pruefer-privat` (reines Daten-Begleitrepo des
   E-Rechnungs-Prüfers: FeRD-Muster, ZUGFeRD 1.0, Kanzlei-Konfiguration; eingebunden als
   `tests/fixtures/lokal`).

Nicht mehr in dieser Anfrage: die alte IONOS-Testkopie (Tobias: „nicht mehr dein Problem“) und die
Datenschutzerklärung der Kanzlei (Tobias: „machen wir später“).
