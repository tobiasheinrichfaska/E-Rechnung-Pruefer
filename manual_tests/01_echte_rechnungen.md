# 01 – Echte Rechnungen

Unsere automatischen Tests kennen nur Musterdateien von KoSIT, CEN und FeRD und eigene Testdateien.
Rechnungen aus den Programmen echter Lieferanten können anders aufgebaut sein. Für sie gibt es keinen
Sollwert – nur das PDF-Bild und Ihr Wissen über den Lieferanten.

## MT-01: Echte Rechnungen verschiedener Lieferanten

**Voraussetzung:** Einige echte Rechnungen verschiedener Lieferanten, möglichst aus verschiedenen
Programmen: ZUGFeRD- oder Factur-X-PDF, XRechnung als XML-Datei, eingescanntes PDF. Das Tool ist
geöffnet.

1. Klicken Sie auf **Datei auswählen** und wählen Sie eine Rechnung.
   - **Danach:** Nach wenigen Sekunden steht oben das Ergebnis, z. B. „E-Rechnung erkannt (…)“ oder
     „Keine E-Rechnung: einfaches PDF“. Dauert es länger als etwa 5 Sekunden, notieren Sie die
     Dateigröße.
2. Vergleichen Sie das Ergebnis mit dem, was Sie über die Rechnung wissen (z. B. „der Lieferant
   schickt ZUGFeRD“ oder „eingescannt“).
   - **Danach:** Beides passt. Wenn nicht, notieren Sie Lieferant, Programm (falls bekannt) und
     Ergebnis.
3. Vergleichen Sie in der Tabelle Rechnungsnummer, Datum, Lieferant und Bruttobetrag mit dem
   PDF-Bild.
   - **Danach:** Die Werte stimmen überein. Notieren Sie jede Abweichung. Maßgeblich ist die XML –
     die Abweichung kann also auch beim Lieferanten liegen.
4. Suchen Sie in „Pflichtangaben nach § 14 Abs. 4 UStG“ jede Zeile mit der roten Marke **fehlt**.
   Sehen Sie im PDF-Bild nach, ob die Angabe dort steht.
   - **Danach:** Steht die Angabe im Bild, notieren Sie die Zeile und den Lieferanten. Das Tool liest
     nur die XML; wir prüfen dann, ob die Angabe dort wirklich fehlt oder ob das Tool sie übersieht.
5. Nehmen Sie die nächste Rechnung und beginnen Sie wieder bei Schritt 1.
