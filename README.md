# Imposter After Dark

Ein lokales Partyspiel für 3 bis 12 Personen. Alle bekommen denselben geheimen Begriff, die Imposter müssen bluffen. Ein Gerät wird reihum weitergegeben.

[Auf GitHub Pages spielen](https://thesimonmc.github.io/clashroyale-imposter/)

## Themen und Spielmodi

Acht Themenwelten: Clash Royale, Minecraft, Pokémon, Filme & Serien, Fußball, Essen & Trinken, Alltag & Chaos und eigene Begriffe. Die vorhandenen 117 Clash-Royale-Karten bleiben mit ihren Bildern und Hinweisen erhalten. Evolutionen, Champions und Helden lassen sich separat zuschalten. Die sechs weiteren vorgefertigten Welten enthalten jeweils 20 Begriffspaare.

| Modus | Ablauf |
| --- | --- |
| Klassisch | Das Team kennt den Begriff. Imposter sehen ihre Rolle und optional einen festen Hinweis. |
| Undercover | Imposter erhalten einen ähnlichen anderen Begriff. Niemand sieht vor der Auflösung die eigene Rolle. |
| Blitzrunde | Ein Hinweis pro Person, dann nach 60 Sekunden gemeinsam abstimmen. |

Bei eigenen Begriffen steht ein Begriff pro Zeile. Optionale Partnerbegriffe und Hinweise werden mit `|` getrennt:

```text
Pizza | Flammkuchen | Aus dem Ofen
Kaffee | Espresso | Hilft am Morgen
```

Mindestens sechs unterschiedliche Begriffe sind nötig. Undercover verlangt für jeden Eintrag einen anderen Partnerbegriff. Die Person, die eigene Begriffe eingibt, kennt den Pool bereits.

## Spielen

1. Thema, Modus, Namen und Anzahl der Imposter wählen.
2. Jede Person hält ihre Karte gedrückt, liest den Begriff und lässt vor der Übergabe los. Mit Leertaste oder Enter geht es ebenfalls. Alternativ kann die Karte per Klick aufgedeckt und wieder verdeckt werden.
3. Die angezeigte Person beginnt. Reihum einen kurzen Hinweis geben, ohne den Begriff zu nennen.
4. In der Gruppe diskutieren und abstimmen. Die Person mit den meisten Stimmen auf dem Gerät auswählen und den Ausschluss bestätigen. Bei Gleichstand erst weiterdiskutieren.
5. Das Team gewinnt, wenn alle Imposter gefunden sind. Imposter gewinnen bei Gleichstand oder Überzahl gegenüber den verbleibenden Teammitgliedern.

Der Timer lässt sich pausieren oder neu starten. Sein Ablauf schließt niemanden automatisch aus. Ausgeschiedene Personen bleiben ausgeschieden, bis eine neue Runde beginnt. Optional bleiben ihre Rollen bis zur abschließenden Auflösung geheim. Das ist keine geheime Einzelabstimmung.

## Lokal öffnen

`index.html` im Browser öffnen. Es gibt keinen Build-Schritt und keine JavaScript-Abhängigkeiten. CSS, Spiellogik, Begriffe und Vektorgrafiken liegen im Repository. Für die externen Clash-Royale-Bilder wird eine Internetverbindung benötigt. Bei Ladefehlern erscheint ein lokales Symbol; der Begriff bleibt lesbar.

Optional über einen lokalen Server:

```sh
python3 -m http.server 8000
```

Namen und Einstellungen werden, soweit der Browser es erlaubt, in `localStorage` auf dem Gerät gespeichert. Rollen, gezogene Begriffe und laufende Spielstände werden nicht gespeichert. Beim Neuladen beginnt eine neue Rollenverteilung. Beim Verlassen des Fensters oder Wechseln des Tabs werden aufgedeckte Karten sofort verdeckt. Die Verdeckung schützt vor versehentlichem Mitlesen, nicht vor absichtlichem Untersuchen des Browsercodes.

## Dateien

- `index.html`: Seitenstruktur, native Dialoge und lokale SVG-Symbole.
- `assets/styles.css`: dunkles, responsives Layout und reduzierte Bewegung.
- `assets/data.js`: Karten und Begriffspaare.
- `assets/engine.js`: Spiellogik ohne DOM-Abhängigkeit.
- `assets/app.js`: Rollenübergabe, Einstellungen, Timer und Gruppenabstimmung.
- `tests/engine.test.cjs`: Tests für Rollenverteilung, Spielphasen und Siegbedingungen.

## Prüfen

```sh
node --test tests/engine.test.cjs
```

Die Tests benötigen nur Node.js ab Version 18. GitHub Actions führt sie bei Pull Requests und Änderungen auf `main` oder `codex/**` aus. Das vorhandene GitHub-Pages-Deployment läuft weiterhin ausschließlich über `main`.

Die im Repository enthaltene `app-debug.apk` ist eine ältere Android-Version und wird durch Website-Änderungen nicht neu gebaut.

## Autor und Inhalte

Ursprüngliches Spiel von RcnTV / [TheSimonMC](https://github.com/TheSimonMC). Unabhängiges Fan-Projekt, nicht mit den Rechteinhabern der genannten Spiele und Marken verbunden. Die vorhandenen Clash-Royale-Bilder werden von RoyaleAPI geladen.
