# Kanzlei-Konfiguration

Was die Kanzlei nennt, gehört **nicht** in dieses öffentliche Repo (Tobias, 15.11.2026). Beim Build
liest `vite.config.ts` über `src/build/kanzleiConfig.ts` die erste vorhandene dieser Dateien:

1. `config/kanzlei.local.json` – per `.gitignore` ausgeschlossen; von Hand oder vom Freigabe-Lauf
   dorthin gelegt,
2. `tests/fixtures/lokal/config/kanzlei.local.json` – das Original im privaten Repo
   `E-Rechnung-Pruefer-privat`, das als `tests/fixtures/lokal` eingebunden ist (Cloud und
   Kanzlei-PC),
3. `config/kanzlei.example.json` – neutral und leer: Das Tool fragt dann nichts.

```json
{
  "accessNotice": "Der E-Rechnungs-Prüfer ist ein kostenloses Hilfsmittel der Musterkanzlei. …"
}
```

- `accessNotice` (freiwillig) ist der Text, den die Online-Fassung vor dem Öffnen bestätigen lässt:
  Er ist die Beschriftung des Kästchens, „Weiter“ geht erst mit dem Haken. Mit „Antwort für die
  Zukunft merken“ merkt sich der Browser einen Fingerabdruck des Textes (SHA-256, kein Cookie) unter
  dem Schlüssel `e-rechnung-pruefer-zugang` (in einem Unterordner mit `@/ordner/` dahinter). Ein
  geänderter Text wird neu gefragt.
- Gefragt wird nur über `https://`. Eine heruntergeladene Datei (`file://`) fragt nicht und speichert
  nichts. Ohne den Eintrag fragt die App nichts.
- Andere Einträge, ein leerer Text oder einer mit mehr als 2000 Zeichen brechen den Build ab.
- Der Text des Hinweises ist von Tobias freigegeben (15.11.2026); geändert wird er nur mit seinem OK.
- `tests/static/noBranding.test.ts` prüft, dass der Text und sein erster Satz (mit dem Namen der
  Kanzlei) in keiner Datei des Repos stehen.
