# Erfundene Kanzlei-Konfiguration für die Prüfung „Tests“

`beispiel-kanzlei.json` ist **erfunden**: Die „Beispielkanzlei Erika Mustermann“ gibt es nicht, die
Links zeigen auf `example.org`, die Farben sind frei gewählt (Kontrast mindestens 4,5 : 1). Die echte
Konfiguration nennt die Kanzlei und liegt nur im privaten Repo (`config/README.md`).

Die GitHub-Prüfung „Tests“ baut damit in zwei eigenen Schritten weitere Fassungen, damit die
Zweige mit Konfiguration auch ohne die privaten Dateien laufen. Gewählt wird die Datei über die
Umgebungsvariable `KANZLEI_CONFIG` (`src/build/kanzleiConfig.ts`):

- die öffentliche Fassung für die Zweige „with … of the local configuration“ von
  `zugangshinweis.spec.ts`, `fusszeile.spec.ts` und `farben.spec.ts` (Audit 2026-11-15, QT-01);
- die Testfassung für den ganzen `testrahmen.spec.ts`: Neben dem Testrahmen fragt das Tool den
  Zugangshinweis nur, wenn einer eingestellt ist (Audit 2026-11-16, R4-T-01). Nennt
  `KANZLEI_CONFIG` eine Datei ohne Hinweis, bricht der Lauf ab, statt diese Zweige still zu
  überspringen (`passNotice` in `tests/e2e/helpers.ts`).

```bash
export KANZLEI_CONFIG=tests/fixtures/config/beispiel-kanzlei.json
npm run build
npx playwright test tests/e2e/zugangshinweis.spec.ts tests/e2e/fusszeile.spec.ts tests/e2e/farben.spec.ts --grep "of the local configuration"
npm run build:test
npx playwright test tests/e2e/testrahmen.spec.ts
```

`tests/static/noBranding.test.ts` liest diese Variable nicht: Er sucht nur nach der echten
Konfiguration.
