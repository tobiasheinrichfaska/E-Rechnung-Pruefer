# Auslieferung

Hochgeladen wird nur über das private Repo `Freigabe` (GitHub Actions, jeden Lauf startet Tobias),
in die öffentliche Zone und die Testzone bei bunny.net (unten).

**Abgelöst:** `upload.json` beschreibt das alte Ziel `test` (`NebenprojektERechnung/` auf der
Fragebogen-Subdomain bei IONOS) für `private/Auslieferung` und `npm run hochladen`. Die IONOS-Kopie ist
seit dem 15.11.2026 nicht mehr Sache dieses Projekts (Tobias); ob Ziel und Skript ganz wegfallen,
entscheidet er.

**Auf bunny.net nur `dist/index.html` als `index.html`** (Tobias, 15.11.2026): Die Beispielrechnungen
kommen nicht neben die öffentliche Fassung. Mandanten brauchen sie nicht, und Tester holen sie aus
dem öffentlichen Repo (`beispiele/README.md` zeigt dort dieselbe Tabelle) oder aus dem lokalen
Ordner.

## Testfassung und Prüfung „Tests“ (15.11.2026)

Die Testfassung läuft in einer eigenen geschützten Testzone bei bunny.net, getrennt von der
öffentlichen Zone. Das Anmeldeskript kommt aus dem privaten Repo `Testumgebung` (`zugang/`).

| Zone                 | Eintrag im Repo `Freigabe` | Build                | Hochgeladen wird                        |
| -------------------- | -------------------------- | -------------------- | --------------------------------------- |
| öffentlich           | `erechnung`                | `npm run build`      | `dist/index.html` als `index.html`      |
| Testzone (geschützt) | `erechnungtest`            | `npm run build:test` | `dist-test/index.html` als `index.html` |

- **Nur die Testfassung** hat den Link **„Tester einladen“**, seit 0.10.0 im Kopf des gemeinsamen
  Testrahmens (nicht mehr in der Fußzeile). Er führt im selben Tab auf `/_zugang/einladen`, die Seite
  des Anmeldeskripts für einen Einladungslink. Die öffentliche Fassung enthält diese Adresse nie;
  `tests/e2e/testfassung.spec.ts` prüft das an `dist/index.html`.
- **Nicht installierbar** (Tobias, 15.11.2026): Keine der beiden Fassungen hat ein Manifest oder einen
  Service Worker; ihre CSP verbietet beides (`manifest-src`, `worker-src`). Deshalb nie eine
  `manifest.webmanifest` oder ein `sw.js` neben `index.html` hochladen.
- Beide Builds brauchen vorher die Kanzlei-Konfiguration (Abschnitt „Zugangshinweis im
  Freigabe-Lauf“).
- **Testseite** (ab 0.8.0, seit 0.10.0 der gemeinsame Testrahmen aus dem Repo `Testumgebung`, als
  unveränderte Kopie in `src/testrahmen/`): Die Testfassung zeigt neben dem Tool die Handtests und
  schickt mit „Bericht senden“ einen Bericht ohne Freitext an `/_zugang/bericht` (Format
  `testbericht/1`, `docs/testbericht.md` dort). Deshalb erlaubt nur ihre CSP `connect-src 'self'`; die
  öffentliche Fassung bleibt bei `connect-src 'none'`. Eine CSP-Kopfzeile der **Testzone** darf
  `connect-src` nicht auf `'none'` stellen. Der Testbuild braucht `git` (Commit als `stand`).
- **Gate:** Jeder Upload wartet auf die GitHub-Prüfung **„Tests“** (`.github/workflows/tests.yml`).
  Sie muss für genau den hochgeladenen Commit grün sein. In beiden Einträgen von `Freigabe` gilt
  deshalb `"gate": { "workflow": "Tests" }`.

## Kopfzeilen des Servers

Die Seite bringt ihre Content-Security-Policy als `<meta>`-Tag mit (`src/build/csp.ts`). Eine
`<meta>`-CSP kann `frame-ancestors` nicht setzen; ohne Kopfzeile des Servers lässt sich die Seite in
einen fremden Rahmen einbetten (Bestandsaufnahme 14.11.2026, S-11). Bei bunny.net senden die Edge
Rules diese Kopfzeilen (unten, mit `curl -I` geprüft am 15.11.2026). Für die alte IONOS-Kopie
(`NebenprojektERechnung/`) hätte der Server senden sollen:

```
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
```

Ob er das tat, ließ sich aus dem Repo nicht prüfen (die Zugangsregeln erzeugt
`private/Auslieferung`).

## Auf bunny.net (eingestellt am 15.11.2026, online seit demselben Tag)

Die öffentliche Fassung zieht auf eine eigene Subdomain bei bunny.net um (`CLAUDE.md`, „Hosting move
decided“). Dort ist im Dashboard der Pull Zone eingestellt, von Hand auf dem Kanzlei-PC:

- **Edge Rule „Sicherheits-Header“**, dieselben Werte wie beim Fragebogen:

  ```
  Content-Security-Policy: frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  ```

- **Edge Rule „Kein Zwischenspeicher“:** Cache-Zeit im CDN und im Browser 0. Jeder Upload kommt
  sofort an, ohne den Cache zu leeren.
- „Force SSL“, TLS ab 1.2, POST abgewiesen, nur GET und HEAD, Logs ohne IP-Adressen, Auslieferung nur
  über Rechenzentren in EU-Staaten.
- Der zweite Name leitet mit 301 auf die Subdomain weiter, der Pfad bleibt erhalten.
- **Ändert sich `src/build/csp.ts` bei `object-src`, `base-uri` oder `form-action`, muss auch die Edge
  Rule geändert werden**, sonst sperrt die Kopfzeile weiter.
- **Geprüft am 15.11.2026** mit `curl -I` (Kanzlei-PC, Ausgabe im privaten Repo unter
  `auslieferung/kopfzeilen-2026-11-15.txt`): Die öffentliche Zone sendet alle acht Kopfzeilen oben
  und `Cache-Control: public, max-age=0`. Die Testzone antwortet 401 vom Login-Skript mit
  `frame-ancestors`, `base-uri` und `object-src` auf `'none'`, ohne `connect-src` (so darf
  „Bericht senden“ verbinden) und ohne `form-action` (Einladungen des Login-Skripts).
- **Zwischenspeicher der Testzonen (erledigt am 15.11.2026):** Die Edge Rule setzte dort
  `Cache-Control: public, max-age=0` und überschrieb damit das `no-store` bzw. `private` des
  Login-Skripts. Antworten nach der Anmeldung tragen das Cookie (`Set-Cookie`), und `public` erlaubt
  fremden Zwischenspeichern, sie aufzuheben. Tobias: „ja“; Claude in Chrome hat es nach dem Auftrag im
  privaten Repo (`auslieferung/auftrag-chrome-zwischenspeicher-2026-11-15.md`) geändert: In
  `erechnungtest` und `fragebogentest` hat die Regel „Kein Zwischenspeicher“ jetzt „Override Cache
  Time“ 0 und „Set Response Header“ `Cache-Control: private, no-store` (statt „Override Browser Cache
  Time“ 0). `curl -I` am selben Abend: beide Testzonen 401 mit `cache-control: private, no-store`,
  die Live-Zonen `erechnung` und `fragebogen` unverändert 200 mit `public, max-age=0`, die
  Sicherheits-Kopfzeilen der Testzone vollständig. Dieselbe Sollzeile gilt für die
  Einrichtungs-Aufträge im Repo `Testumgebung` und die Testzonen im privaten bunny-Konto; das
  übernimmt die Sitzung von `Testumgebung`.
- **Reste im Speicher:** Die Beispieldateien früherer Läufe hat Tobias am 15.11.2026 gelöscht. In
  der öffentlichen Zone antworten alle 39 Dateien von `beispiele/` mit 404 (geprüft am selben
  Abend); die Testzone lässt sich ohne Tester-Anmeldung nicht prüfen (401).
- **Nicht in Suchmaschinen** (Tobias, 15.11.2026): Die Seite trägt `<meta name="robots"
content="noindex">` (`index.html`). Mandanten kommen über den Link der Kanzlei. Keine `robots.txt`
  mit `Disallow` hochladen: Eine gesperrte Seite liest die Suchmaschine nicht und sieht dann auch das
  `noindex` nicht.

## Zugangshinweis im Freigabe-Lauf

Die Online-Fassung fragt vor dem Start den Zugangshinweis (15.11.2026). Sein Text nennt die Kanzlei
und steht deshalb nur im privaten Repo `E-Rechnung-Pruefer-privat` (`config/kanzlei.local.json`).
Der Build nimmt ihn nur mit, wenn die Datei vor `npm run build` an einer dieser Stellen liegt
(`config/README.md`):

- `config/kanzlei.local.json` im Checkout, oder
- das private Repo als `tests/fixtures/lokal` (dann `tests/fixtures/lokal/config/kanzlei.local.json`).

Fehlt sie, entsteht ohne Fehlermeldung eine Fassung **ohne** Hinweis und ohne die Links zu
Impressum und Datenschutz. Der Freigabe-Lauf sollte das deshalb vor dem Upload prüfen, z. B. ob
`dist/index.html` den Anfang des Hinweises und beide Adressen enthält.

**Welche Fassung in welche Zone** (Qualitätsaudit 16.11.2026, R2-S-04; Anfrage an den Kanzlei-PC):
Die Prüfung oben besteht auch die Testfassung. Der Freigabe-Lauf sollte deshalb zusätzlich prüfen:

- **öffentliche Zone** (`dist/index.html`): `connect-src 'none'` steht darin, `tr-huelle`,
  `starteTestrahmen` und `_zugang` fehlen;
- **Testzone** (`dist-test/index.html`): umgekehrt, `connect-src 'self'` und `tr-huelle` stehen darin;
- wahlweise: `connect-src 'none'` auch in der CSP-Kopfzeile der Edge Rule der öffentlichen Zone.

Seit 0.10.0 wählt `vite.config.ts` den Ordner nach dem Modus (`npm run build:test` schreibt weiter
`dist-test/index.html`); eine Testfassung, die nach `dist/` gebaut werden soll, bricht den Build ab.

## Nachweis jedes Uploads (für den täglichen Integritätsauftrag)

Die Wochenprüfung (`Pruefvorgaenge`, `aufgaben/wochenpruefung.md`, Abschnitt 4) zählt ein Projekt
als bereit für einen täglichen Vergleich der hochgeladenen Dateien, wenn sein privates Repo nach
jedem Upload eine Datei `auslieferung/<Ziel>.json` führt, wie beim Fragebogen
(`docs/briefing-kanzlei-pc.md`, Abschnitt 6). Der Freigabe-Lauf schreibt deshalb nach jedem
erfolgreichen Upload nach `E-Rechnung-Pruefer-privat/auslieferung/oeffentlich.json`:

```json
{
  "ziel": "oeffentlich",
  "adresse": "https://…/",
  "commit": "<Commit des hochgeladenen Stands>",
  "zeit": "2026-11-15T10:00:00+01:00",
  "dateien": [{ "pfad": "index.html", "sha256": "…" }]
}
```

Darin stehen nur Adresse und Hashes, keine Zugangsdaten.
