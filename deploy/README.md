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
