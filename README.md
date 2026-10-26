# Stack

Eine schlanke App für Bestand, Zählungen und gespeicherte Listen.

## Lokal starten

Node.js 18 oder neuer installieren, dann:

```sh
npm start
```

Öffne http://localhost:3000.

## Funktionen

- Artikel direkt anlegen und bearbeiten
- Kategorien auswählen
- Artikel durch Halten und Ziehen sortieren
- Löschbestätigung nach Wischgeste
- Mengen mit Plus, Minus oder direkter Eingabe ändern
- Zählungen als Listen speichern
- Änderungsverlauf im Bestand mit Rückgängig-Funktion

## Daten

Daten werden ausschließlich im Local Storage des jeweiligen Browsers gespeichert. Sie werden weder zwischen Geräten noch zwischen unterschiedlichen Domains synchronisiert. Das Repository enthält den Anwendungscode, keine im Browser eingegebenen Bestandsdaten.

## Struktur

`dist/` enthält HTML, CSS, JavaScript und das SVG-Logo. Die App benötigt keinen Build-Schritt und kann mit jedem statischen Webserver betrieben werden.
