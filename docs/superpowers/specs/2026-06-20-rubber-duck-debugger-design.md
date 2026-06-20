# Rubber Duck Debugger — Design Spec

**Datum:** 2026-06-20
**Projekt:** SKAILE Academy Building Challenge — Minigame
**Pflichtvorgabe:** Eine Gummiente muss im Spiel vorkommen (hier: zentrale Spielfigur/Waffe).
**Deadline:** Dienstag 18:00. **Ambition:** Top-3-Anlauf.

## 1. Pitch

Arcade-Reaktionsspiel. Dein Code wird von Bugs angegriffen. Deine einzige Waffe: die Gummiente.
Ente seitlich positionieren, "Bug erklären" = Erkenntnis-Strahl nach oben feuern, Bug platzt —
bevor er eine Code-Zeile korrumpiert. Eskalierende Wellen, Combo-Multiplikator, Heisenbug-Boss.
Reiner Browser, **null externe Assets**: alle Grafik auf Canvas gezeichnet, Sound via WebAudio
synthetisiert → kein 404/kaputter Pfad beim statischen Deploy.

## 2. Warum diese Wahl (Bewertungs-Mapping)

- **Läuft es?** Robuste State-Machine, keine Asset-Abhängigkeiten, eine Mechanik sauber umgesetzt.
- **Kreativität:** "Rubber-Duck-Debugging" ist DER Programmierer-Insider — trifft exakt die
  Claude-Code/AI-Builder-Jury. Bugs tragen Exception-Namen ("off-by-one", "race condition").
- **Saubere Umsetzung:** fokussierter Scope, klar getrennte Module/Klassen, kommentiert,
  progressive Commits.

## 3. Core Loop

1. Ente sitzt unten auf dem "Code-Editor"-Boden, folgt der Maus-X (Pfeiltasten als Fallback).
2. Bugs spawnen oben (y < 0), krabbeln nach unten (vy > 0) mit leichtem horizontalem Drift.
3. Klick/Leertaste (haltbar = Autofire mit Cooldown) feuert einen Erklär-Strahl nach oben.
4. Strahl trifft Bug → Bug verliert HP; bei 0 platzt er → Punkte × Combo-Multiplikator, Partikel,
   "Quaaak", Exception-Name fliegt groß weg und faded.
5. **Combo:** steigt pro Kill. Multiplikator = `1 + floor(combo/5)`, gedeckelt (z. B. ×8).
   Reset bei Leben-Verlust **oder** wenn länger als ~5 s kein Kill (Combo-Timeout). Verfehlte
   Schüsse brechen die Combo **nicht** (bewusst, hält das Spiel spaßig).
6. Bug erreicht den Boden → korrumpiert eine Code-Zeile = −1 von 3 Leben, Screen-Shake, Combo-Reset,
   betroffene Zeile wird rot/glitcht. 3 Korruptionen → **BUILD BROKEN** = Game Over.
7. **Wellen:** pro Welle mehr Bugs + höheres Tempo. Welle endet, wenn alle gespawnten Bugs tot oder
   entkommen sind → kurzer Wellen-Banner → nächste Welle. Jede 5. Welle: **Heisenbug-Boss**.

## 4. Game States (State Machine)

`TITLE → PLAYING → GAMEOVER → (Restart) → PLAYING`, plus `PAUSED` (Toggle aus PLAYING).

- **TITLE:** Titel "🦆 Rubber Duck Debugger", Gag-Subtitle "Erklär dem Entchen deinen Bug.",
  Best-Score, Mini-Anleitung (Maus = bewegen, Klick/Leertaste = feuern), "Klick zum Start".
- **PLAYING:** Spiel-Loop aktiv, HUD sichtbar.
- **PAUSED:** Loop pausiert (kein update), Overlay "Pause".
- **GAMEOVER:** "BUILD BROKEN", finaler Score, Best-Score, "R / Klick = neu".

State liegt in `Game.state`. `update(dt)` und `draw()` verzweigen nach State.

## 5. Entities (Klassen, jeweils `update(dt)` + `draw(ctx)`)

- **Duck:** `x` (folgt Maus, geclampt), feste `y` nahe Boden, `w/h`, `recoil` (Squash-Timer beim
  Feuern). Gezeichnete Vektor-Gummiente (Körper, Kopf, Schnabel, Auge) für konsistente Optik.
- **Beam:** Projektil. `x,y`, `vy < 0` (nach oben), `len`, Glow + Trail. Stirbt bei `y < 0` (Miss)
  oder Treffer.
- **Bug:** `x,y`, `vy`, Drift (`vx` sinusförmig), `r`, `hp`, `type`, `label` (Exception-Name),
  `flash` (Trefferblink). Krabbel-Animation (Beinchen/Wackeln). Stirbt bei hp ≤ 0 oder am Boden.
- **Particle:** kurzlebige Burst-Partikel (Pop/Korruption). `x,y,vx,vy,life,color`.
- **FloatingText:** aufsteigender, ausfadender Text (Exception-Name beim Pop, Combo "×3!").

## 6. Systeme (in `Game`)

- **Input:** `mousemove` → `duck.targetX` (CSS→Canvas-Koords via `getBoundingClientRect`-Skalierung);
  `mousedown`/`Space` → `firing=true`; `mouseup`/keyup → `firing=false`; `ArrowLeft/Right` →
  Tastatur-Move; `R`/Klick im GAMEOVER → Restart; Klick im TITLE → Start; `P`/`Esc` → Pause.
- **Spawner/Wellen:** pro Welle Bug-Budget `≈ 4 + welle*2`, Spawn-Intervall sinkt, Tempo-Multiplikator
  `*= ~1.08`/Welle. Welle 5/10/15/… ist eine **reine Boss-Welle** (ein Heisenbug + wenige
  Begleit-Bugs, kein normales Budget). Wellen-Banner-Phase zwischen den Wellen.
- **Kollision:** Beam×Bug (Kreis/Segment bzw. AABB-Näherung), Bug×Boden (y-Schwelle). Erste-Treffer-
  Logik pro Beam.
- **Score/Combo:** `score += basePoints * multiplier`; Combo-Zähler, Multiplikator, Combo-Timeout.
- **Audio:** siehe §8. **Render:** Hintergrund (Fake-IDE) → Entities → HUD/Overlays, plus Screen-Shake.

## 7. Bug-Typen & Boss

| Typ | r | vy (Welle 1) | HP | Punkte | Labels / Verhalten |
|-----|---|--------------|----|--------|--------------------|
| Standard | ~18 | ~60 px/s | 1 | 100 | "off-by-one", "typo", "NaN", "undefined" |
| Fast | ~12 | ~130 px/s | 1 | 150 | klein, schnell, "memory leak" |
| Tank | ~26 | ~45 px/s | 3 | 300 | "race condition", blinkt bei Treffer |
| **Heisenbug (Boss)** | ~48 | ~30 px/s | ~12 | 2000 | teleportiert die x-Position bei jedem Treffer; alle 5 Wellen |

Werte sind Startwerte → im Playtest justieren (in `config.js`).

## 8. Juice (= Kreativität + Politur)

- Ente quetscht/ruckelt beim Feuern (recoil). Strahl mit Glow + Trail. Pop = Partikelburst +
  FloatingText (Exception-Name). Combo-Text ("×3!"), Farbwechsel bei hoher Combo.
- Screen-Shake bei Boss-Treffer und Code-Korruption.
- Hintergrund = Fake-IDE: dark, Monospace-Code-Zeilen mit Zeilennummern, blinkender Cursor;
  korrumpierte Zeilen werden rot und "glitchen".
- **Sound (WebAudio synth, keine Dateien):** Feuern (kurzer Square-Blip), Pop (Noise-Burst +
  Pitch-Down), Tank-Hit (Thud), Boss-Hit, Damage (tiefer Buzz), Wellen-Clear (Aufwärts-Arpeggio),
  GameOver (absteigender Ton). `AudioContext` erst bei erster User-Geste initialisieren
  (Autoplay-Policy); fehlt WebAudio → still weiterspielen (try/catch).

## 9. UI / HUD

- **HUD (PLAYING):** Score (oben links), Welle (oben mitte), 3 Leben als Code-Zeilen/Herzen
  (oben rechts), Combo-Multiplikator wenn > 1.
- **Overlays:** Titel-, Pause-, GameOver-Screen direkt auf Canvas gezeichnet (kein DOM-Overlay nötig).

## 10. Tech / Dateien / Deploy

- **Dateien (flach im Root, alle lowercase, relative `./`-Imports):**
  - `index.html` — `<canvas id="game" width="800" height="600">`, lädt `./main.js` als
    `type="module"`. Minimal.
  - `style.css` — dark Page-BG, Canvas zentriert + responsiv (CSS skaliert, intern fix 800×600;
    optional `devicePixelRatio`-Scaling für Schärfe).
  - `config.js` — `CONFIG`-Objekt mit allen Tuning-Konstanten.
  - `audio.js` — `Sound`-Helper (WebAudio synth).
  - `entities.js` — Klassen Duck, Bug, Beam, Particle, FloatingText.
  - `game.js` — `Game`-Klasse: State-Machine + Systeme + update/draw-Orchestrierung.
  - `main.js` — Bootstrap: Canvas holen, `Game` instanzieren, `requestAnimationFrame`-Loop
    (dt-basiert, dt auf max ~1/30 geclampt), Input-Listener.
- **Deploy:** statisch auf Vercel (Deploy-Prompt aus README). Keine Build-Step nötig.

## 11. Error Handling / Edge Cases

- `AudioContext` suspended bis Geste → bei erstem Klick/Key resumen; WebAudio fehlt → still.
- Keyboard-Listener auf `window`. Pointer-Koords von CSS-px → interne 800×600 mappen.
- Tab-Blur / großer dt-Sprung → dt clampen, optional auto-pause bei `visibilitychange`.
- `localStorage` kann werfen (privater Modus) → try/catch, Fallback Best-Score in-memory.
- High-DPI optional via `devicePixelRatio`-Backing-Store.

## 12. Testing

- Lokal: `python3 -m http.server` im Repo, im Browser spielen, jedes System prüfen.
- Automatisiert (webapp-testing / Playwright-MCP): Seite laden, Screenshot, **Konsole auf Fehler/404
  prüfen**, Start simulieren, ein paar Frames laufen lassen.
- Nach Deploy: Live-URL gegen Lokal verifizieren (Deploy-Prompt deckt das ab).

## 13. Scope / YAGNI

- **In Scope:** eine Mechanik richtig gut + 3 Bug-Typen + 1 Boss + Juice + 3 Screens + Best-Score.
- **Out (YAGNI):** kein Shop, keine Waffen-Vielfalt, kein Multiplayer, kein Level-Editor, kein Backend.
- **Stretch (nur wenn Zeit):** Touch-Steuerung/Mobile, mehr Bug-Typen, Power-ups, Online-Highscore.

## 14. Build-Reihenfolge (grob, jeder Schritt = Commit + Push)

Gerüst/State-Machine + Loop → Ente + Input → Bugs + Spawner → Strahl + Kollision → Score/Combo →
Wellen + Boss → Juice (Partikel/Sound/Shake/IDE-BG) → Screens (Title/Pause/GameOver) → Politur + Tuning.
