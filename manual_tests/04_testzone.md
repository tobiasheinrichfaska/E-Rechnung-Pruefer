# 04 – Testzone

Die Testfassung liegt in einer geschützten Testzone. Was dort hinter dem Link „Tester einladen“
geschieht und was das Menü eines echten Browsers anbietet, können die automatischen Tests nicht
nachstellen.

## MT-05: Tester einladen in der Testzone

**Voraussetzung:** Die Testfassung liegt in der geschützten Testzone bei bunny.net, und Sie sind dort
als Tester angemeldet. Die öffentliche Adresse des Tools haben Sie von Tobias. Die automatischen
Tests prüfen nur den Link; die Seite dahinter gehört zum Anmeldeskript (Repo `Testumgebung`) und
lässt sich hier nicht nachstellen.

1. Öffnen Sie die Testfassung und schauen Sie oben auf die Testseite (am Handy der Reiter mit den
   Tests).
   - **Danach:** Dort steht **Tester einladen**, genau einmal auf der Seite.
2. Klicken Sie auf **Tester einladen**.
   - **Danach:** Im selben Tab öffnet sich die Seite für einen Einladungslink. Kein neuer Tab.
3. Klicken Sie dort auf **Zurück zur App**.
   - **Danach:** Das Tool erscheint wieder.
4. Öffnen Sie die öffentliche Adresse des Tools (Adresse von Tobias).
   - **Danach:** Nirgends auf der Seite steht **Tester einladen**, und es gibt keine Testseite.
5. Öffnen Sie auf dem Handy und am Rechner (Chrome oder Edge) das Menü des Browsers.
   - **Danach:** Es gibt keinen Eintrag **App installieren** für das Tool. „Zum Startbildschirm
     hinzufügen“ oder „Verknüpfung erstellen“ darf es geben: Das ist nur ein Lesezeichen. Erscheint
     „App installieren“: „Nicht bestanden“ mit diesem Schritt und dem Grund „Anderes Ergebnis als
     erwartet“. Gerät und Browser sagen Sie Tobias direkt.
