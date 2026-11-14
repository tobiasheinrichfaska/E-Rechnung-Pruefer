# Offizielle Testdateien

Unverändert übernommen. Herkunft, Version und Prüfsumme der Pakete: [`../../../docs/quellen.md`](../../../docs/quellen.md).

| Ordner | Quelle | Lizenz |
| --- | --- | --- |
| `cen/` | CEN EN 16931 Validierungsartefakte 1.3.17 (`ConnectingEurope/eInvoicing-EN16931`), Ordner `examples/` der Pakete CII und UBL; UBL-Dateien mit dem Präfix `UBL_` | EUPL-1.2, Text in `cen/LICENSE-EUPL-1.2.txt` |
| `kosit/` | KoSIT XRechnung-Testsuite v2026-08-31 (`itplr-kosit/xrechnung-testsuite`), Ordner `instances/`: `standard/01.01a` (UBL und CII derselben Rechnung), `technical-cases/cius/01.05_minimal` (UBL, CII), `extension/04.01a`, `technical-cases/cvd/02.01a` | Apache-2.0 (Lizenz des Repositorys), Text in `kosit/LICENSE-Apache-2.0.txt` (das Paket selbst enthält keinen Lizenztext) |
| `kosit/paare/` | dieselbe Testsuite, `instances/standard/`: alle 33 Rechnungen jeweils als UBL und als CII (01.01a–01.15a, 01.17a–01.21a, 02.01a–02.06a, 03.01a–03.07a) – für den Gegencheck der Zuordnung | Apache-2.0 |

Die Musterrechnungen von FeRD (ZUGFeRD/Factur-X) dürfen nicht weitergegeben werden und liegen nur
lokal in `../lokal/` (gitignoriert).

Aus `kosit/paare/` entstehen die Beispieldateien für Tester in `../../../beispiele/` (`npm run beispiele`,
Katalog `src/build/beispiele.ts`) – mit erfundenen Namen statt Platzhaltern und den dort genannten Änderungen.
