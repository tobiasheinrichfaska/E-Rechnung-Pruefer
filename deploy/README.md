# Auslieferung

`upload.json` beschreibt das Ziel `test` (`NebenprojektERechnung/` auf der Fragebogen-Subdomain) für
`private/Auslieferung`. Hochgeladen werden `dist/index.html` und `beispiele/`.

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
