# Handoff: Wow-Picks (Quack / Ghost / ultrathink) - 2026-06-22

## TL;DR
Branch `wow-polish` = **Superset** (Typing-Pivot + Politur) = Ship-Kandidat. Heute Abend 3 Wow-Picks
gebaut + 2 Runden Bugfix/Polish auf Calvin-Feedback. Alles gepusht, HEAD `5917dbb`, Tree sauber.
Naechster echter Block: **Calvin-Playtest** der letzten Polish-Runde, dann weitere Picks ODER
Richtung Abgabe (merge main + Deploy). Deadline **Di 2026-06-23 18:00**.

## Was gemacht wurde (alles auf `wow-polish`, je eigener Commit)
- `a327459` **Pick 1 Quack**: Ente quakt beim Bug-Kill. `audio.js:quack()`, Aufruf in `game.js:onKill`.
- `b4ec8dd` **Pick 2 Autocomplete-Ghost**: gelockter Command grau im Terminal vorgeschlagen,
  Cursor an der Naht. `game.js:drawTerminal`.
- `2e89275` **Pick 3 /ultrathink-Superpower**: Skill-Meter laedt pro Kill, **Enter** loest
  Screen-Clear (alle Nicht-Boss-Bugs) + Slow-Mo + lila Flash aus. Boss verschont.
  `mechanics.js:skillCharge/skillReady` (+2 Tests), `game.js:useSkill()` + HUD-Bar,
  `audio.js:ultrathink()`, `main.js` Enter-Input.
- `24a8991` **Bugfix-Runde 1** (Calvin: kein Quack hoerbar / ultrathink nicht einsetzbar):
  Logik war korrekt (headless verifiziert) - Ursachen waren Synth zu leise + Meter zu hoch.
- `5917dbb` **Polish-Runde 2** (Calvin-Feedback):
  - Quack v2: 2 verstimmte Saegezaehne + sweepender Bandpass-Formant + 30Hz-Tremolo-Schnatter.
  - Death-Screen: war Dauer-Jitter (shake klang in GAMEOVER nie ab). Jetzt `gameOver()` setzt
    fixen `shake=0.5`, neuer GAMEOVER-Branch in `update()` klingt ihn in ~0.23s aus -> steht still.
  - `CONFIG.skill.max` zurueck auf **12** (Calvin-Wunsch; war kurz auf 8 zum Erreichbar-Machen).

## Aktueller Stand
- Verifiziert: **24/24 mechanics-Tests gruen**, `tests/smoke.mjs` ok, `node --check` alle Files sauber.
- Headless-Tests bestaetigt: skill laedt +1/Kill, quack wird gerufen, useSkill cldert Bugs/verschont
  Boss/Slow-Mo, Death-Shake -> 0 nach 0.33s, max=12.
- **NICHT browser-getestet**: Quack-KLANG (synthetisch blind gebaut), Ghost-Optik, Flash, Death-Wackeln.
  Audio + Optik brauchen Calvins Ohr/Auge. Playwright-Bridge nicht verbunden.
- `wow-polish` ist **gepusht**, Working Tree sauber. `main` = nur Pivot = Fallback.

## Naechste Schritte
1. **Playtest** (Calvin, Browser): `python3 -m http.server 8000` -> http://localhost:8000 ->
   **Cmd+Shift+R** (Hard Refresh, sonst Cache!). Pruefen:
   - Quack v2 klingt entig genug? (Falls nein: Richtung sagen - hoeher/schnatternder/kuerzer ->
     `audio.js:quack` Formant-Freqs + `lfo.frequency` tunen.)
   - Death-Screen wackelt kurz, steht dann still?
   - /ultrathink: ~12 Kills -> HUD-Bar lila + "READY" pulst -> Enter feuert spuerbar?
   - Konsole error/404-frei (Intro -> Play -> Boss -> GameOver -> Restart).
2. **Dann Entscheidung**: weitere Picks ODER Abgabe einleiten.
   Offene Pick-Kandidaten (noch nicht gebaut): **Boss-Arena-Alarm** (BG dunkelt + roter Puls bei Boss),
   **Intro-Cohesion** (Tipp-Klicks + Cursor waehrend "Hey Claude"), **Kill-Partikel = fallende
   Code-Zeichen**, **Boss-Tension-Drone**.
3. **Abgabe** (vor Di 18:00): `git checkout main && git merge --no-ff wow-polish && git push origin main`
   -> `! npx vercel` (Calvin interaktiv, Login) -> Live-URL == lokal pruefen -> Repo+Live-Link in
   Community-Abgabe-Thread. **Premortem-Tipp: frueher Wegwerf-Deploy zum De-Risken der Pipeline.**

## Offene Punkte / Risiken
- Quack-Charakter ungewiss bis Calvin ihn hoert (blind synthetisiert). Tuning-Knoepfe stehen oben.
- Deploy-Pipeline noch nie gelaufen fuer diesen Branch -> Wegwerf-Deploy vor Final empfohlen.
- Push-Regel (CLAUDE.md): nach jedem fertigen Schritt sofort committen+pushen, nur zu `origin`.
- Vercel: statische Seite, Preset "Other", kein Build-Script, relative Pfade.

## Wichtige Pfade & Befehle
- `python3 -m http.server 8000` - lokaler Testserver (dann http://localhost:8000, Cmd+Shift+R)
- `node --test tests/mechanics.test.js` - Unit-Tests (24/24)
- `node tests/smoke.mjs` - headless Render/Update-Smoke
- `for f in *.js; do node --check "$f"; done` - Syntax-Check alle Files
- `audio.js:quack()` - Enten-Quack-Synth (Tuning hier)
- `game.js:useSkill()` / `drawHud` - /ultrathink-Logik + Meter-Bar
- `game.js:gameOver()` + `update()` GAMEOVER-Branch - Death-Shake
- `config.js:CONFIG.skill` / `CONFIG.fx` - alle Tuning-Werte
- `AUDIT.md` - laufender Projekt-Stand (oben aktualisiert)

## Kontext-Notizen
- AUDIT-Historie war verwirrend: `pivot-typing` ist laengst in `main` gemerged. `wow-polish` zweigt
  von `main` ab -> enthaelt BEIDES. Kein Entweder-Oder "Pivot vs Polish" mehr.
- Tech-Guardrails: keine externen Assets, Grafik komplett Canvas, Sound via WebAudio synthetisiert,
  relative Pfade, Dateinamen klein. Canvas intern 800x600.
- Quack/ultrathink-"Bugs" waren KEINE Logik-Fehler - nicht nochmal die Mechanik debuggen, nur
  Synth-Lautstaerke/-Charakter bzw. Erreichbarkeit/Feedback.
