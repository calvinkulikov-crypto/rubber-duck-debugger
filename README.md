# 🦆 Rubber Duck Debugger

Ein Mini-Arcade-Spiel für die **SKAILE Academy Building Challenge**. Läuft direkt im Browser,
ohne Installation, ohne Login.

## Pitch (3 Sätze)

Bugs fallen als Slash-Commands aus einem Claude-Code-Terminal – und du killst sie, indem du den
Command **tippst** statt klickst. Deine Waffe ist eine Gummiente, die jeden korrekten Tastendruck
in einen Execute-Strahl verwandelt; ein Tippfehler bricht deine Combo. Es ist „Rubber Duck Debugging"
als Reflex-Spiel: erklär den Bug, indem du ihn ausführst, bevor er deinen Build korrumpiert.

## Das Konzept

Die Challenge-Vorgabe war: **eine Gummiente muss vorkommen**. Statt sie zum Deko-Objekt zu machen,
ist sie hier die zentrale Spielfigur — die Debugging-Ente, der man das Problem erklärt.

Der Twist gegenüber einem klassischen Shooter: **es gibt keine Maus-Steuerung**. Jeder Bug trägt
einen echten Claude-Code-`/command` als Label (`/fix`, `/status`, `/refactor` …). Du tippst ihn —
der erste passende Buchstabe lockt das Ziel, jedes weitere Zeichen feuert einen Strahl, der
fertige Command lässt den Bug in farbigen Quelltext zerfallen. Erreicht ein Bug den Boden,
korrumpiert er eine Zeile deines Codes; drei Lecks und der Build ist gebrochen.

## So spielst du

- **Tippen** = zielen + feuern. Beliebige Reihenfolge — der getippte Command wählt den Bug.
- **Backspace** korrigiert, **Esc** pausiert.
- **Tippfehler** = `syntax error`: Combo bricht, roter Glitch.
- Combo halten → Multiplikator + „IN THE ZONE"-Flow-Glow.

### Sonder-Commands & Superpower

| Command | Effekt |
|---|---|
| `/clear` | leert das Feld sofort |
| `/compact` | Bugs in Zeitlupe |
| `/cost` | +1500 Bonus-Score |
| ⚡ `/ultrathink` | ab ×15 Combo automatisch: Auto-Clear + Slow-Mo |

Alle 5 Wellen erscheint ein **Boss** („Context Overflow") — eine Mehrwort-Sequenz, die zwischen
den Commands durch die Arena teleportiert, während Alarm-Licht und ein Tension-Drone einsetzen.

## Technik

- **Vanilla HTML/CSS/JS** auf einem einzelnen `<canvas>`, keine Frameworks, kein Build-Step.
- **Keine externen Assets:** alle Grafik wird auf Canvas gezeichnet, jeder Sound per WebAudio
  synthetisiert (Quack, Tipp-Klicks, Combo-Arpeggio, Boss-Drone). Kein 404-Risiko beim Deploy.
- Canvas intern 800×600, CSS skaliert responsiv; Hi-DPI-scharf.
- Reine Spiel-Logik in `mechanics.js` ist DOM-frei und per `node:test` unit-getestet.

## Lokal starten

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Tests:

```bash
node --test
```

## Deploy

Statische Seite — auf Vercel/Netlify/GitHub Pages ohne Build-Step deploybar. Am Game-Over-Screen
kopiert ein Klick auf **„⧉ Ergebnis kopieren"** den Score samt Live-URL für die Zwischenablage.

---

Gebaut mit Claude Code. 🦆
