# Handoff: Wow-Picks 4–7 (Code-Regen / Boss-Alarm / Boss-Drone / Intro-Cohesion) — 2026-06-22

## TL;DR
Branch `wow-polish` (= Superset, Ship-Kandidat). Heute Abend 4 weitere Wow-Picks gebaut, je eigener
Commit+Push, Tests durchweg **24/24 grün**, smoke ok, `node --check` sauber. HEAD `159cc12`, Tree sauber.
Damit sind **alle 7 geplanten Picks gebaut** (1–3 aus Vorsession, 4–7 jetzt). **Keine offenen Picks mehr.**
Nächster echter Block: **Calvin-Playtest** aller Picks → dann **Abgabe** (merge main + Deploy). Deadline **Di 18:00**.

## Was gemacht wurde (alles auf `wow-polish`, je eigener Commit)
- `4c62e64` **Pick 4 Kill-Partikel = fallende Code-Zeichen**: `CodeBit`-Entity (entities.js) — Glyph aus
  Syntax-Palette (`{ } ; / < > = …`), hochgeschleudert → Gravitation, dreht im Flug, faded aus.
  Spawn in `game.js:onKill` (9 normal / 22 Boss) zusätzlich zum bestehenden Spark-Burst. Update+Filter+Draw
  neben `particles`. On-theme: Bug zerfällt sichtbar in Quelltext.
- `7b43abb` **Pick 5 Boss-Arena-Alarm**: `game.js:drawBossAlarm` — solang `bossActive()` (neuer Helper):
  Arena dunkelt (rot), pulsierender roter Rand-Glow, „⚠ INCIDENT"-Banner. Gezeichnet in `drawPlayfield`
  als Overlay ÜBER Entities, UNTER HUD/Terminal → die bleiben crisp, Mitte (Boss + Command) lesbar.
- `dab0dea` **Pick 6 Boss-Tension-Drone**: `audio.js:startDrone/stopDrone` — 55Hz-Sägezahn + Sinus-Quinte
  durch Lowpass (dumpf), 0.7Hz-Tremolo, sauberes Ein-/Ausblenden, **idempotent**. `game.js:update` koppelt
  an `bossActive()`: Start bei Boss-Präsenz, Stop bei Kill/Escape/Pause/GameOver. `setMuted(true)` stoppt sofort.
- `159cc12` **Pick 7 Intro-Cohesion**: `game.js:drawIntro` — blinkender Cursor sitzt jetzt an der Naht
  hinter dem zuletzt getippten Zeichen der aktiven Zeile (vorher fix) → wirkt wie lebendiges Tippen.
  `keyClick` pro Nicht-Leerzeichen in `updateIntro`.

## Aktueller Stand
- Verifiziert (headless): **24/24 mechanics-Tests**, `tests/smoke.mjs` ok (zeichnet alle States + 1800-Frame-
  Runde inkl. Boss/Escape), `node --check` alle Files. Smoke läuft mit `sound=null` → Audio via `?.` geskippt.
- **NICHT browser-getestet** (brauchen Calvins Auge/Ohr): Code-Regen-Optik (zu busy?), Boss-Alarm
  (bedrohlich vs. lesbar?), Drone-Klang (hörbar/nicht nervig, stoppt sauber?), Intro-Cursor-Follow.
- **Audio-Caveat Intro-Klick:** vor erster User-Geste ist der AudioContext suspendiert (Browser-Autoplay).
  Klick auf Canvas = skippt Intro. → Intro-Klick meist still; **Cursor-Follow ist der sichere, immer-an Win.**
- `wow-polish` **gepusht**, Working Tree sauber. `main` = nur Pivot = Fallback.

## Nächste Schritte
1. **Playtest** (Calvin, Browser): `python3 -m http.server 8000` → http://localhost:8000 → **Cmd+Shift+R**.
   Alle 7 Picks prüfen (s. AUDIT.md „NÄCHSTER SCHRITT"). Tuning-Knöpfe:
   - Code-Regen zu busy → `onKill` bits-Count (9/22) senken, oder `CodeBit`-`life`/`size`.
   - Boss-Alarm zu stark/schwach → Alphas in `drawBossAlarm`.
   - Drone zu laut/leise/nervig → `startDrone` Gain (0.05) / Freqs (55/82.5) / Lowpass (220) / LFO (0.7Hz).
2. **Abgabe einleiten** (keine Picks mehr offen): `git checkout main && git merge --no-ff wow-polish &&
   git push origin main` → `! npx vercel` (Calvin interaktiv, Login) → Live-URL == lokal prüfen
   (Konsole error/404-frei: Intro→Play→Boss→GameOver→Restart) → Repo+Live-Link in Community-Abgabe-Thread.
   **Premortem-Tipp: früher Wegwerf-Deploy zum De-Risken der Pipeline.**

## Wichtige Pfade
- `entities.js:CodeBit` — fallende Code-Zeichen (Tuning: GLYPHS/COLORS/life/size/Velocity)
- `game.js:bossActive()` — Boss-Präsenz-Helper (Alarm + Drone)
- `game.js:drawBossAlarm` — Arena-Alarm (Alphas/Banner)
- `audio.js:startDrone/stopDrone` — Boss-Drone (idempotent, mute-gating)
- `game.js:drawIntro` / `updateIntro` — Cursor-Follow + Tipp-Klick
- `config.js` — alle Tuning-Werte · `node --test tests/mechanics.test.js` / `node tests/smoke.mjs` — Verifikation
