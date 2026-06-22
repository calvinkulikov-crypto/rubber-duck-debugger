# Design-Spec: Wow-Polish-Sprint (Rubber Duck Debugger)

**Datum:** 2026-06-22
**Status:** freigegeben (Brainstorming-Gate bestanden)
**Branch:** `wow-polish` (off `main`)
**Deadline:** Di 2026-06-23, 18:00 (SKAILE Building Challenge)

## Kontext & Ziel

Das Spiel (Typing-Debugger: Claude-Code-/commands tippen → Bugs killen) ist funktional fertig
und abgabefähig (`main`). Ziel dieses Sprints: **deutlich höhere wahrgenommene Qualität + Wow-Momente**
ohne die getestete Spiel-Logik zu destabilisieren. Bewertet wird u.a. Kreativität + saubere Umsetzung;
ein „premium"-Eindruck und ein erinnerbarer Hero-Moment heben die Platzierung.

Gewählte Strategie (freigegeben): **A — geschichteter Juice-Pass.** Nur Render-, Audio- und billige
additive Hooks anfassen; jede Verbesserung ein eigener Commit + Push; in Wow-pro-Stunde-Reihenfolge.
Erst A komplett, dann B/C (Stretch) bei Restzeit.

## Guardrails (nicht verhandelbar)

- **`main` bleibt der abgabefähige Fallback/Live-Stand.** Gebaut wird auf `wow-polish`. Merge → `main`
  + Deploy erst **nach** manuellem Playtest (Browser, Konsole error/404-frei).
- **Push nach jedem Schritt** zu `origin/wow-polish` (Challenge prüft Push-Verlauf).
- **Keine externen Assets** (kein Bild/Sound-File). Grafik = Canvas, Sound = WebAudio-Synth. Relative
  Pfade, Dateinamen klein.
- **`mechanics.js` bleibt rein + 19/19 Tests grün.** Neue Spiel-Logik (z.B. neue Spezial-Commands)
  geht über `CONFIG` + bestehende generische Pfade, nicht über Umbau der getesteten Funktionen.
  Wo neue testbare reine Logik entsteht → Test mitziehen.
- **Deterministisch im getesteten Pfad** (kein `Math.random` in Spawn/Targeting). `Math.random` nur
  im reinen Render/Juice (Partikel etc.) wie bisher erlaubt.
- Vor jedem Commit: `node --check` aller Files + `node --test tests/mechanics.test.js`.
- Canvas-intern 800×600; alle neuen Render-Layer in diesem Koordinatensystem.

## Verifikation pro Schritt

Headless geht nur Logik (node --check + mechanics-Tests). Optik/Feel/Audio brauchen Browser-Playtest
durch Calvin. Akzeptanzkriterien pro Item sind als manuelle Browser-Checks formuliert. Konsole muss
error/404-frei bleiben (Render-Pfad gegen `ctx` nicht crashen).

---

## MUSS — Kern-Wow (Reihenfolge = Bau-/Push-Reihenfolge)

### 1. Syntax-Farben im Code-Hintergrund  *(Look — Render-only)*
**Problem:** Code-BG ist einfarbig grau (`#3b4048`) → wirkt wie Platzhalter, nicht wie echte IDE.
**Lösung:** In `game.js:drawBackground` jede Code-Zeile tokenisieren und in GitHub-Dark-Syntaxfarben
zeichnen (Keyword `function/while/if/return/const/new` → `#ff7b72`; String/Template → `#a5d6ff`;
Kommentar `//…` → `#8b949e`; Funktions-/Methodenname → `#d2a8ff`; Klammern/Operator → `#c9d1d9`;
Zahlen → `#79c0ff`). Tokenizer = kleine reine Funktion `tokenizeLine(str)` in `mechanics.js`
(zeichen-/regex-basiert, **unit-testbar** → 2–3 Tests). Korrupte Zeile bleibt rot/Glitch (Vorrang).
**Risiko:** niedrig (rein kosmetisch). **Akzeptanz:** Code-BG sieht aus wie echtes Highlighting; korrupte
Zeilen weiterhin rot; Tests grün (inkl. neuer tokenize-Tests).

### 2. Per-Tastendruck-Juice + saftiger Kill  *(Feel)*
**Problem:** Tippen/Kill fühlt sich flach an; das ist die Kern-Schleife.
**Lösung:**
- Pro **korrektem** Buchstabe (in `game.handleChar`, Match-Zweig): Mini-Screen-Kick
  (`this.shake = max(this.shake, 0.06)`) + kurzer Label-„Punch" am Ziel-Bug (Bug bekommt `punch`-Timer,
  in `Bug.draw` Label kurz skaliert). Buffer/Terminal-Text macht beim Wachsen einen Mini-Bounce.
- **Hit-Stop** beim Kill: globaler `this.hitstop` (~0.05s) in `Game`, der in `update` `dt` kurz auf 0
  zieht (nur Spielfeld, nicht Render) → spürbarer „Impact".
- Kill-Pop aufgewertet: zusätzlich zum Partikel-Burst ein **expandierender Schockwellen-Ring**
  (neue leichte Entity oder Inline-Draw in `particles`), Squash-Skalierung kurz vor Verschwinden.
**Risiko:** niedrig–mittel (Hit-Stop berührt `update`-dt → klein halten, abklingen lassen).
**Akzeptanz:** jeder Buchstabe gibt taktiles Feedback; Kill fühlt sich „wuchtig" an; kein Ruckeln/Hänger.

### 3. CRT-Scanlines + Vignette + Bloom-Overlay  *(Look — Post-Process)*
**Problem:** flacher Look ohne Tiefe/Atmosphäre.
**Lösung:** Neuer Post-Process-Layer am Ende von `game.js:draw` (nach `ctx.restore()`), über ALLE States:
horizontale Scanlines (transluzent, 2–3px Raster), radiale Vignette (Rand abdunkeln), dezenter
Bloom/Glow auf hellen Elementen (bereits Beams; ergänzen für Terminal-Text + Spezial-Bug-Ring via
`shadowBlur`). Alles transluzent + tunebar (Alpha-Konstanten in `CONFIG.fx`). Performance: Scanlines als
einmal vorgerendertes Pattern/Path, nicht Pixel-Loop.
**Risiko:** niedrig (Overlay, Alpha justierbar). **Akzeptanz:** „premium Terminal/CRT"-Vibe; Code +
Terminal-Prompt bleiben klar lesbar; flüssige Framerate.

### 4. Audio-Overhaul + Mute-Toggle (M)  *(Audio)*
**Problem:** `audio.js` ist 31 Zeilen Minimal-Synth; trägt kaum zum Wow bei.
**Lösung:** `audio.js` erweitern (gleiche `blip`-Basis):
- `keyClick(combo)` pro korrektem Buchstabe — kurzer mechanischer Klick, **Tonhöhe steigt mit Combo**
  (Aufstiegs-Gefühl). Aufruf in `handleChar` Match-Zweig.
- Kill-`pop` mit Pitch-Up-Variation; `comboTier()`-Arpeggio bei Multiplikator-Aufstieg (Hook in `onKill`,
  wenn `multiplier()` über Schwelle steigt); Boss-Drohne (tiefer Layer während Boss lebt);
  `waveClear`-Chime aufgewertet; `gameOver` absteigend.
- **Mute:** `Sound.muted` Flag; `M` in `main.js` toggelt; `blip` no-op wenn gemutet; On-Screen-Icon
  (🔊/🔇) im HUD. Default = **an** (Sound an), aber sauber gegen Autoplay-Policy (init bei erster Geste,
  schon vorhanden).
**Risiko:** niedrig (WebAudio-only, Gesture-Gate existiert). **Akzeptanz:** Tippen/Kill/Combo klingen
befriedigend; M mutet/unmutet sofort; kein Audio-Fehler in Konsole.

### 5. Combo-Crescendo / Flow-State  *(Feel + Look) — Signatur-Wow-Moment*
**Problem:** hohe Combo fühlt sich nicht anders an als niedrige.
**Lösung:** Render-Intensität an `this.multiplier()` koppeln (Wert existiert): ab Schwelle (z.B. ×4)
Bildschirm-Rand-Glow (innerer Vignette-Glow in Combo-Farbe), dezenter BG-Puls im Takt, hellerer/größerer
Terminal-Text, einmaliger „IN THE ZONE"/„FLOW" Banner beim Erreichen der Top-Stufe (FloatingText/Toast).
Bei ×Cap zusätzlicher Effekt (Partikel-Funken am Rand). Bricht Combo → Glow fällt weich ab.
**Risiko:** niedrig (liest bestehenden `combo`/`multiplier`, rein additiv im Render). **Akzeptanz:**
hohe Combo fühlt sich sichtbar „heiß" an; klarer, erinnerbarer Moment beim Top-Multiplikator.

### 6. Title + Game-Over Reskin  *(Look) — erster & letzter Eindruck*
**Problem:** Title/Game-Over sind funktional, aber unspektakulär.
**Lösung:**
- **Title** (`drawTitle`): glühender animierter Logo-Titel (Pulse/Glow), Tagline im CC-Stil, klarere
  Command-Legende, „Klick zum Start" als blinkender Prompt. CRT-Layer (Item 3) wirkt automatisch mit.
- **Game-Over** (`drawGameOver`): als **„Build-Log / Stack-Trace"** inszenieren — `✗ BUILD BROKEN`
  als Fehlerausgabe, Score/Best/Welle als Log-Zeilen (`exit code 1`, `bugs leaked: N`), neue Best =
  hervorgehobenes „NEW HIGH SCORE" + Chime. „Enter = neu starten" als Prompt.
**Risiko:** niedrig (nur diese zwei Draw-Funktionen). **Akzeptanz:** Title zieht sofort an; Game-Over
liest sich wie ein Build-Log und belohnt neue Bestmarke.

---

## STRETCH — nur bei Restzeit (B/C, nach A komplett)

### 7. Neue Spezial-Commands  *(Features — B)*
2–3 zusätzliche On-Theme-Commands in `CONFIG.specials` + Zweig in `game.applySpecial`:
`/undo` (eine korrumpierte Code-Zeile heilen + Build-grün-Feedback), `/review` (killt automatisch den
tiefsten Bug), `/think` (kurzes Time-Freeze ~1.5s, Variante von slowmo). Jeweils Farbe/Punkte/Effekt.
Falls Effekt-Logik wächst → kleine reine Helfer testbar halten. **Risiko:** niedrig (generischer Pfad
existiert). **Akzeptanz:** neue Commands spawnen, Effekt greift, Tests grün.

### 8. Achievements-Toasts + „Clean Build"-Wave-Bonus  *(Features — B)*
Toast-System (kleine Liste oben rechts, abklingend): „First Blood", „Combo ×8", „Boss Slain",
„Flawless Wave". `perfectWave` = Welle ohne Escape geräumt → Bonus-Score + „✓ CLEAN BUILD" Banner +
Chime (Tracking-Flag pro Welle in `startWave`/`onEscape`). **Risiko:** niedrig–mittel (etwas State).
**Akzeptanz:** Toasts erscheinen passend, Flawless-Bonus wird korrekt vergeben/zurückgesetzt.

### 9. Duck/Bug-Art aufgewertet  *(Look — C)*
`entities.js` Duck: Flügel-Andeutung, gelegentliches Blinzeln, Wasser-Reflexion unter der Ente.
Bugs: typ-distinktere Silhouetten (fast = schlank/scharf, tank = wuchtig/gepanzert), Fühler-Wackeln.
**Risiko:** niedrig (reine Draw-Änderungen). **Akzeptanz:** Figuren wirken charaktervoller, Typen
auf einen Blick unterscheidbar.

---

## Nicht im Scope (Non-Goals)

- Kein Backend / keine echte API / kein echtes MCP (Tech-Guardrail: statisch, kein Kostenrisiko).
- Kein Umbau der Kern-Mechanik (Targeting/Spawn/Combo-Formel) — `mechanics.js`-Verträge bleiben.
- Kein neues Framework / keine Build-Pipeline (bleibt Vanilla, statisches Deploy).
- Kein Mobile/Touch-Gameplay-Umbau (Desktop-Hinweis bleibt).
- Daily-Seed/Online-Leaderboard: verworfen (geringer Judge-Wow pro Stunde).

## Git-/Abgabe-Flow

1. Pro Item: bauen → `node --check` + mechanics-Tests → commit → `git push origin wow-polish`.
2. Nach A komplett: Calvin-Playtest 3–4 Runden im Browser (Konsole error/404-frei, Intro→Play→Boss→
   GameOver→Restart, Lesbarkeit Code/Terminal trotz FX, Audio/Mute, Flow-State sichtbar).
3. Erst nach bestandenem Playtest: `git checkout main && git merge --no-ff wow-polish && git push origin main`,
   dann Deploy (`npx vercel`, interaktiv durch Calvin) → Live == lokal → Links im Abgabe-Thread.
4. Kippt der Sprint zeitlich → `main` (jetziger Stand) ist abgabefähig; einzelne fertige Items sind
   bereits gemerged-fähig (jeder Commit für sich grün).
