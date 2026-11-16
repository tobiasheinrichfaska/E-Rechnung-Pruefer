# E-Rechnung prüfen

Ein Werkzeug für den Browser: Sie ziehen eine Rechnung (PDF oder XML) hinein und sehen,

- ob es eine E-Rechnung ist (Syntax UBL oder CII, Profil),
- welche Pflichtangaben nach § 14 Abs. 4 UStG enthalten sind – mit den Werten aus der XML,
- ob die XML zu den offiziellen Schemadateien passt,
- ob ausgewählte Beträge rechnerisch zusammenpassen.

Das Ergebnis sind **Hinweise, keine Freigabe**: eine technische Erstprüfung, keine steuerliche Prüfung.
Bei einer E-Rechnung sind die Daten in der XML maßgeblich.

**Ihre Datei verlässt den Rechner nicht.** Das Werkzeug ist eine einzige HTML-Datei; der Browser
verbietet ihr jede Netzwerkverbindung (Content-Security-Policy). Gespeichert wird nur etwas, wenn Sie
bei einem Zugangshinweis „Antwort für die Zukunft merken“ wählen: ein Fingerabdruck des bestätigten
Hinweises in diesem Browser, nie die Rechnung.

**Stand:** online, in Entwicklung. Gebaut sind das Erkennen, die Schemaprüfung, die Pflichtangaben und
eine Auswahl der Rechenregeln. Beispielrechnungen für Tester liegen in [`beispiele/`](beispiele/).

## Entwicklung

```bash
npm ci --ignore-scripts
npm test          # Vitest
npm run build     # dist/index.html
npm run test:e2e  # Playwright
```

Quellen der offiziellen Artefakte: [`docs/quellen.md`](docs/quellen.md).

Die übernommenen offiziellen Artefakte (Schemadateien, Testdateien) behalten ihre eigenen Lizenzen,
siehe [`docs/quellen.md`](docs/quellen.md), [`schemas/README.md`](schemas/README.md) und
[`tests/fixtures/offiziell/README.md`](tests/fixtures/offiziell/README.md).

## License

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

This project is licensed under the **GNU Affero General Public License v3.0** (AGPLv3).
You are free to use, modify, and distribute this software under the terms of the AGPLv3.
If you use this software to provide a network service, you must make the full source code
of your modifications available to users of that service.

**Commercial License:** If you wish to use this software in a closed-source or proprietary
product, a commercial license is available. Contact: tobias.a.w.heinrich@gmail.com

See [LICENSE](LICENSE) for the full AGPLv3 text.
See [LICENSE_COMMERCIAL.md](LICENSE_COMMERCIAL.md) for commercial licensing terms.
