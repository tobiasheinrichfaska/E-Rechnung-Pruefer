# Auslieferung

`upload.json` beschreibt das Ziel `test` (`NebenprojektERechnung/` auf der Fragebogen-Subdomain) für
`private/Auslieferung`. Hochgeladen werden `dist/index.html` und `beispiele/`.

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

- **Nur die Testfassung** hat unten den Link **„Tester einladen“**. Er führt im selben Tab auf
  `/_zugang/einladen`, die Seite des Anmeldeskripts für einen Einladungslink. Die öffentliche Fassung
  enthält diese Adresse nie; `tests/e2e/testfassung.spec.ts` prüft das an `dist/index.html`.
- Beide Builds brauchen vorher die Kanzlei-Konfiguration (Abschnitt „Zugangshinweis im
  Freigabe-Lauf“).
- **Gate:** Jeder Upload wartet auf die GitHub-Prüfung **„Tests“** (`.github/workflows/tests.yml`).
  Sie muss für genau den hochgeladenen Commit grün sein. In beiden Einträgen von `Freigabe` gilt
  deshalb `"gate": { "workflow": "Tests" }`.

## Kopfzeilen des Servers

Die Seite bringt ihre Content-Security-Policy als `<meta>`-Tag mit (`src/build/csp.ts`). Eine
`<meta>`-CSP kann `frame-ancestors` nicht setzen; ohne Kopfzeile des Servers lässt sich die Seite in
einen fremden Rahmen einbetten (Bestandsaufnahme 14.11.2026, S-11). Für `NebenprojektERechnung/`
sollte der Server deshalb senden:

```
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
```

Ob der Server das heute tut, lässt sich aus dem Repo nicht prüfen (die Zugangsregeln erzeugt
`private/Auslieferung`).

## Auf bunny.net (geplant; eingestellt am 15.11.2026)

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
- Geprüft wird mit `curl -I` nach dem ersten Upload. Bis zur Freigabe bleibt der Speicher leer.
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
