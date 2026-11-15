# Erfundene Kanzlei-Konfiguration für die Prüfung „Tests“

`beispiel-kanzlei.json` ist **erfunden**: Die „Beispielkanzlei Erika Mustermann“ gibt es nicht, die
Links zeigen auf `example.org`, die Farben sind frei gewählt (Kontrast mindestens 4,5 : 1). Die echte
Konfiguration nennt die Kanzlei und liegt nur im privaten Repo (`config/README.md`).

Die GitHub-Prüfung „Tests“ baut damit eine zweite Fassung und lässt `zugangshinweis.spec.ts`,
`fusszeile.spec.ts` und `farben.spec.ts` dagegen laufen, damit die Zweige „with … of the local
configuration“ auch ohne die privaten Dateien laufen (Audit 2026-11-15, QT-01). Gewählt wird die Datei
über die Umgebungsvariable `KANZLEI_CONFIG` (`src/build/kanzleiConfig.ts`):

```bash
export KANZLEI_CONFIG=tests/fixtures/config/beispiel-kanzlei.json
npm run build
npx playwright test tests/e2e/zugangshinweis.spec.ts tests/e2e/fusszeile.spec.ts tests/e2e/farben.spec.ts --grep "of the local configuration"
```

`tests/static/noBranding.test.ts` liest diese Variable nicht: Er sucht nur nach der echten
Konfiguration.
