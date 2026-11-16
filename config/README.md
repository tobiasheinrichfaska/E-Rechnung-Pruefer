# Kanzlei-Konfiguration

Was die Kanzlei nennt, gehört **nicht** in dieses öffentliche Repo (Tobias, 15.11.2026). Beim Build
liest `vite.config.ts` über `src/build/kanzleiConfig.ts` die erste vorhandene dieser Dateien:

1. `config/kanzlei.local.json` – per `.gitignore` ausgeschlossen; von Hand oder vom Freigabe-Lauf
   dorthin gelegt,
2. `tests/fixtures/lokal/config/kanzlei.local.json` – das Original im privaten Repo
   `E-Rechnung-Pruefer-privat`, das als `tests/fixtures/lokal` eingebunden ist (Cloud und
   Kanzlei-PC),
3. `config/kanzlei.example.json` – neutral und leer: Das Tool fragt dann nichts.

Vor allen dreien gilt die Datei, die die Umgebungsvariable `KANZLEI_CONFIG` nennt (relativ zum Repo
oder absolut; fehlt sie, bricht der Build ab). Die GitHub-Prüfung „Tests“ nennt dort die erfundene
Beispielkanzlei `tests/fixtures/config/beispiel-kanzlei.json`, damit die Tests von Zugangshinweis,
Fußzeile und Farben und die Testfassung mit dem Testrahmen auch ohne die privaten Dateien laufen
(`tests/fixtures/config/README.md`).

```json
{
  "accessNotice": "Der E-Rechnungs-Prüfer ist ein kostenloses Hilfsmittel der Musterkanzlei. …",
  "imprintUrl": "https://www.musterkanzlei.example/impressum",
  "privacyUrl": "https://www.musterkanzlei.example/datenschutz",
  "colors": { "accent": "#1f5fa8", "chosenBg": "#e4eefa", "infoBg": "#eef4fb" }
}
```

- `accessNotice` (freiwillig) ist der Text, den die Online-Fassung vor dem Öffnen bestätigen lässt:
  Er ist die Beschriftung des Kästchens, „Weiter“ geht erst mit dem Haken. Mit „Antwort für die
  Zukunft merken“ merkt sich der Browser einen Fingerabdruck des Textes (SHA-256, kein Cookie) unter
  dem Schlüssel `e-rechnung-pruefer-zugang` (in einem Unterordner mit `@/ordner/` dahinter). Ein
  geänderter Text wird neu gefragt.
- Gefragt wird nur über `https://`. Eine heruntergeladene Datei (`file://`) fragt nicht und speichert
  nichts. Ohne den Eintrag fragt die App nichts.
- `imprintUrl` und `privacyUrl` (freiwillig, seit 15.11.2026) sind Impressum und
  Datenschutzerklärung der Kanzlei. Die Fußzeile verlinkt sie („Impressum“, „Datenschutz“) und öffnet
  sie in einem neuen Tab, damit ein Ergebnis auf der Seite nicht verloren geht. Nur `https://`-Adressen
  ohne Zugangsdaten und ohne Leerzeichen.
- `colors` (freiwillig, seit 15.11.2026) übernimmt die Farben der Kanzlei, **derselbe Block wie in
  der Fragebogen-Konfiguration**: `accent` (Knöpfe, Links, Rand der Ablagefläche beim Ziehen, Rand
  des festen Hinweises; Pflicht, sobald `colors` da ist), `chosenBg` (Ablagefläche, während eine
  Datei darübergezogen wird), `infoBg` (Hintergrund des festen Hinweises), `accentDark`
  (angenommen wie im Fragebogen; das Tool hat noch keinen dunklen Modus), je als `#rrggbb`. Der
  Build lehnt eine Farbe ab, auf der Text nicht lesbar bliebe (Kontrast unter 4,5 : 1). Gesetzt
  werden sie beim Start als CSS-Variablen (`--kanzlei-…`); ohne `colors` gelten die Farben von
  `src/ui/app.css`.
- Andere Einträge, ein leerer Text, einer mit mehr als 2000 Zeichen oder eine ungültige Adresse
  brechen den Build ab.
- Der Text des Hinweises ist von Tobias freigegeben (15.11.2026); geändert wird er nur mit seinem OK.
- `tests/static/noBranding.test.ts` prüft, dass nichts davon in diesem Repo steht: weder der Text
  noch einer seiner Sätze mit dem Namen der Kanzlei (der erste und jeder mit einem Namen der
  privaten Namensliste `config/marken.txt` im privaten Repo), weder ein Name dieser Liste noch die
  Domain der beiden Adressen (ohne Subdomain). Leerzeichen, Zeilenumbrüche, `>`-Zitatzeichen und
  Groß- und Kleinschreibung zählen nicht. Gesucht wird, auch als Bytes (etwa in einer PDF), in
  zwei Fällen:
  - **Was der nächste Commit und Push veröffentlichen würde:**
    - jede Datei, die ein Commit mitnehmen könnte: die versionierten und die neuen, die
      `.gitignore` nicht ausschließt. Verlinkte Ordner wie `node_modules` oder
      `tests/fixtures/lokal` werden nicht durchsucht;
    - der Index, wo er von der Arbeitskopie abweicht: Eine Datei, die mit `git add` hinzugefügt und
      danach nur in der Arbeitskopie bereinigt oder gelöscht wurde, nimmt `git commit` so mit, wie
      sie hinzugefügt wurde;
    - die Dateien, Pfade und Nachrichten (mit Autor und Committer) jedes Commits, den noch kein
      Remote hat, auf HEAD und auf jedem lokalen Zweig, auch wenn ein späterer Commit sie wieder
      entfernt.
  - **Was schon veröffentlicht ist:** die Dateien, Pfade und Nachrichten jedes Commits, den ein
    Remote schon hat (alle Refs außer HEAD, den lokalen Zweigen und dem Stash, also die
    Remote-Zweige, die Tags und geholte Pull-Request-Refs).
    - Ein Fund dort geht an Tobias. Ein neuer Commit nimmt ihn nicht aus dem Verlauf, nur ein
      Force-Push. Die Refs, die GitHub für jeden Pull Request behält, entfernt nur der
      GitHub-Support.
    - Ein flacher Klon (`git clone --depth …`) lässt diesen Fall scheitern, statt still weniger zu
      lesen: vorher `git fetch --unshallow`.
  - In den Pfaden der Dateien und Ordner darf kein Name der Liste und keine der Domains stehen.
    Verglichen werden nur Buchstaben und Ziffern, `Erika_Probe.pdf` zählt also wie „Erika Probe“.

  Ein Fehlschlag zeigt nur Pfade (verdeckt, wenn sie die Kanzlei nennen), Zahlen oder ja/nein, nie
  den gefundenen Text. Nicht gefunden werden der Name in einem Bild oder in gepacktem Text (etwa
  komprimierter Text einer PDF) und ein Commit, der nur im Stash liegt. Ohne die privaten Dateien
  oder ohne git werden beide Fälle übersprungen und nennen den Grund.
