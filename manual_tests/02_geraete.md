# 02 – Echte Programme und Geräte

Die automatischen Tests legen Dateien künstlich ab und laufen in Browsern auf dem Entwicklungsrechner.
Ziehen aus einem echten Mailprogramm oder dem Explorer und die Dateiauswahl eines echten Handys
können sie nicht nachstellen.

## MT-02: Rechnung aus dem Mailprogramm und dem Explorer ziehen

**Voraussetzung:** Eine E-Mail mit einer PDF- oder XML-Rechnung im Anhang – ohne echte Rechnung
schicken Sie sich eine Beispielrechnung von der
[Seite mit den Beispielrechnungen](https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer/tree/main/beispiele).
Das Tool ist in einem Browserfenster geöffnet, das Mailprogramm daneben.

1. Ziehen Sie den Anhang aus der E-Mail über die Fläche „Rechnung hierher ziehen“ und halten Sie ihn
   dort.
   - **Danach:** Der Rahmen der Fläche färbt sich in der Farbe der Knöpfe, die Fläche wird hell
     getönt.
2. Lassen Sie los.
   - **Danach:** Unter der Fläche steht „Geprüfte Datei: …“ mit dem Namen des Anhangs, darunter das
     Ergebnis. Passiert nichts oder öffnet der Browser die Datei selbst: „Nicht bestanden“ mit diesem
     Schritt und dem Grund „Anderes Ergebnis als erwartet“. Das Mailprogramm (z. B. Outlook, Outlook
     im Browser, Thunderbird) sagen Sie Tobias direkt.
3. Speichern Sie den Anhang und ziehen Sie ihn aus dem Explorer auf die Fläche.
   - **Danach:** Wie in Schritt 2.
4. Laden Sie auf der Seite mit den Beispielrechnungen eine Datei herunter. Ziehen Sie sie direkt aus
   der Download-Liste des Browsers (Edge und Chrome: Symbol „Downloads“ oben rechts) auf die Fläche.
   - **Danach:** Wie in Schritt 2. Lässt sich die Datei dort nicht ziehen: „Nicht bestanden“ mit
     diesem Schritt und dem Grund „Anderes Ergebnis als erwartet“. Den Browser sagen Sie Tobias
     direkt.

## MT-03: Am Handy oder Tablet

**Voraussetzung:** Ein Handy oder Tablet (iPhone, iPad oder Android). Darauf ist eine Rechnung als
Datei gespeichert, z. B. aus einer E-Mail oder eine Beispielrechnung von der
[Seite mit den Beispielrechnungen](https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer/tree/main/beispiele).

1. Öffnen Sie die Adresse des Tools im Browser des Geräts.
   - **Danach:** Ist das Gerät in der Testzone noch nicht angemeldet, fragt der Browser nach
     Benutzername und Kennwort – nehmen Sie Ihre Tester-Anmeldung (auch in der Kanzlei). Stehen
     oben die Reiter **App** und **Tests**, sehen Sie zuerst die Tests. Tippen Sie dann auf **App**.
     Nun steht oben „E-Rechnung prüfen“ und darunter „Bitte bestätigen“ mit dem Zugangshinweis.
     Tippen Sie auf den Text, damit der Haken erscheint, dann auf **Weiter**. Der Text muss ganz
     lesbar sein, ohne dass Sie etwas seitlich verschieben.
2. Tippen Sie auf **Datei auswählen**.
   - **Danach:** Das Gerät öffnet seine Dateiauswahl.
3. Wählen Sie die Rechnung.
   - **Danach:** Das Ergebnis erscheint. Am Handy steht jede Pflichtangabe als eigener Block: oben
     die Bezeichnung und die Marke, darunter die Werte. Auf einem Tablet kann es eine Tabelle sein.
     In beiden Fällen müssen Sie nichts seitlich verschieben, um es zu lesen. Kein Wort steht
     getrennt auf zwei Zeilen, auch keine Kennung wie „BT-112“ und keine Angabe wie „19 %“. Ist
     etwas abgeschnitten, zu klein oder getrennt: „Nicht bestanden“ mit diesem Schritt und dem Grund
     „Darstellung falsch“. Gerät und Browser sagen Sie Tobias direkt.
