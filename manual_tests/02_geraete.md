# 02 – Echte Programme und Geräte

Die automatischen Tests legen Dateien künstlich ab und laufen in Browsern auf dem Entwicklungsrechner.
Ziehen aus einem echten Mailprogramm oder dem Explorer und die Dateiauswahl eines echten Handys
können sie nicht nachstellen.

## MT-02: Rechnung aus dem Mailprogramm und dem Explorer ziehen

**Voraussetzung:** Eine E-Mail mit einer PDF- oder XML-Rechnung im Anhang – ohne echte Rechnung
schicken Sie sich eine Beispielrechnung (siehe [README](README.md)). Das Tool ist in einem
Browserfenster geöffnet, das Mailprogramm daneben.

1. Ziehen Sie den Anhang aus der E-Mail über die Fläche „Rechnung hierher ziehen“ und halten Sie ihn
   dort.
   - **Danach:** Der Rahmen der Fläche färbt sich in der Farbe der Knöpfe, die Fläche wird hell
     getönt.
2. Lassen Sie los.
   - **Danach:** Unter der Fläche steht „Geprüfte Datei: …“ mit dem Namen des Anhangs, darunter das
     Ergebnis. Passiert nichts oder öffnet der Browser die Datei selbst, notieren Sie das
     Mailprogramm (z. B. Outlook, Outlook im Browser, Thunderbird).
3. Speichern Sie den Anhang und ziehen Sie ihn aus dem Explorer auf die Fläche.
   - **Danach:** Wie in Schritt 2.
4. Laden Sie auf der Seite mit den Beispielrechnungen eine Datei herunter. Ziehen Sie sie direkt aus
   der Download-Liste des Browsers (Edge und Chrome: Symbol „Downloads“ oben rechts) auf die Fläche.
   - **Danach:** Wie in Schritt 2. Lässt sich die Datei dort nicht ziehen, notieren Sie den Browser.

## MT-03: Am Handy oder Tablet

**Voraussetzung:** Ein Handy oder Tablet (iPhone, iPad oder Android). Darauf ist eine Rechnung als
Datei gespeichert, z. B. aus einer E-Mail oder eine Beispielrechnung von der Seite mit den
Beispielen.

1. Öffnen Sie die Adresse des Tools im Browser des Geräts.
   - **Danach:** Ist das Gerät in der Testzone noch nicht angemeldet, fragt der Browser nach
     Benutzername und Kennwort – nehmen Sie Ihre Tester-Anmeldung (auch in der Kanzlei). Dann steht oben „E-Rechnung prüfen“ und darunter „Bitte bestätigen“ mit
     dem Zugangshinweis. Tippen Sie auf den Text, damit der Haken erscheint, dann auf **Weiter**.
     Der Text muss ganz lesbar sein, ohne dass Sie etwas seitlich verschieben.
2. Tippen Sie auf **Datei auswählen**.
   - **Danach:** Das Gerät öffnet seine Dateiauswahl.
3. Wählen Sie die Rechnung.
   - **Danach:** Das Ergebnis erscheint. Jede Pflichtangabe steht als eigener Block: oben die
     Bezeichnung und die Marke, darunter die Werte. Sie müssen nichts seitlich verschieben, um es zu
     lesen. Notieren Sie Gerät und Browser, wenn etwas abgeschnitten oder zu klein ist.

## MT-05: Tester einladen in der Testzone

**Voraussetzung:** Die Testfassung liegt in der geschützten Testzone bei bunny.net, und Sie sind dort
als Tester angemeldet. Die automatischen Tests prüfen nur den Link; die Seite dahinter gehört zum
Anmeldeskript (Repo `Testumgebung`) und lässt sich hier nicht nachstellen.

1. Öffnen Sie die Testfassung und schauen Sie oben auf die Testseite (am Handy der Reiter mit den
   Tests).
   - **Danach:** Dort steht **Tester einladen**, genau einmal auf der Seite.
2. Klicken Sie auf **Tester einladen**.
   - **Danach:** Im selben Tab öffnet sich die Seite für einen Einladungslink. Kein neuer Tab.
3. Klicken Sie dort auf **Zurück zur App**.
   - **Danach:** Das Tool erscheint wieder.
4. Öffnen Sie die öffentliche Adresse des Tools.
   - **Danach:** Nirgends auf der Seite steht **Tester einladen**, und es gibt keine Testseite.
5. Öffnen Sie auf dem Handy und am Rechner (Chrome oder Edge) das Menü des Browsers.
   - **Danach:** Es gibt keinen Eintrag **App installieren** für das Tool. „Zum Startbildschirm
     hinzufügen“ oder „Verknüpfung erstellen“ darf es geben: Das ist nur ein Lesezeichen. Notieren
     Sie Gerät und Browser, wenn „App installieren“ erscheint.
