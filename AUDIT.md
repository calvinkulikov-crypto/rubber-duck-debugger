# AUDIT — Rubber Duck Debugger

**Letztes Update:** 2026-06-22 21:40 (Wow-Picks 1–7 gebaut+gepusht, Playtest-Gate offen, HEAD `159cc12`)

## ⚠ BRANCH-KLARSTELLUNG (war im AUDIT verwirrend)
`pivot-typing` ist bereits in `main` gemerged (`main` = Typing-Pivot). **`wow-polish` ist abgezweigt
von `main` → enthält BEIDES: Typing-Pivot + Politur = SUPERSET = Ship-Kandidat.** `main` = Fallback.

## AKTIV — WOW-PICKS (Branch `wow-polish`, je eigener Commit+Push)
**Gebaut + verifiziert + gepusht (24/24 Tests, smoke ok, node --check sauber, headless useSkill-Test ok):**
1. **Quack** — Ente quakt beim Bug-Kill (nasaler Bandpass-Sweep, Pitch ∝ Combo). `audio.js`/`onKill`.
2. **Autocomplete-Ghost** — gelockter Command grau im Terminal vorgeschlagen. `drawTerminal`.
3. **/ultrathink-Superpower** — Skill-Meter lädt pro Kill (`CONFIG.skill.max`=12), **Enter** löst
   Screen-Clear + Slow-Mo + lila Flash aus; Boss verschont. `skillCharge/skillReady` (+2 Tests),
   `useSkill()`, HUD-Ladebalken, `audio.ultrathink`, `main.js` Enter-Input.
4. **Kill-Partikel = fallende Code-Zeichen** (`4c62e64`) — `CodeBit` (entities.js): Glyph aus
   Syntax-Palette, hochgeschleudert→Gravitation, dreht, faded. Spawn in `onKill` (9 normal/22 Boss)
   zusätzlich zum Spark-Burst. Bug zerfällt sichtbar in Quelltext.
5. **Boss-Arena-Alarm** (`7b43abb`) — solang `bossActive()`: Arena dunkelt + roter Rand-Puls +
   „⚠ INCIDENT"-Banner. `drawBossAlarm`, Overlay über Entities/unter HUD+Terminal (bleiben crisp).
6. **Boss-Tension-Drone** (`dab0dea`) — tiefer Dauerton solang Boss lebt. `audio.start/stopDrone`
   (55Hz-Säge + Quinte, Lowpass, 0.7Hz-Tremolo, idempotent); Game koppelt an `bossActive()`,
   Stop bei Kill/Escape/Pause/GameOver, Mute stoppt sofort.
7. **Intro-Cohesion** (`159cc12`) — Cursor folgt dem Tipp-Caret der aktiven „Hey Claude"-Zeile
   (statt fix), `keyClick` pro Zeichen in `updateIntro`. NB: Intro-Klang vor erster Geste still
   (Autoplay-Policy) — Cursor-Follow greift immer.

**NÄCHSTER SCHRITT = CALVIN PLAYTEST (alle 7 Picks):** `python3 -m http.server 8000` → Cmd+Shift+R.
Quack nicht zu oft? Ghost dezent+lesbar? Enter=/ultrathink mächtig, Boss fair? **Code-Regen beim Kill
nicht zu busy?** **Boss-Alarm bedrohlich aber Boss/Command lesbar?** **Drone hörbar aber nicht
nervig, stoppt sauber bei Kill/Pause/Mute?** Konsole error/404-frei. Tuning: Partikel-Count/`CodeBit`,
`drawBossAlarm`-Alphas, `startDrone`-Gain/Freq. **Danach: Abgabe einleiten** — keine offenen Picks mehr.
Nach Playtest: `merge main` → Redeploy `! npx vercel` → Abgabe (Repo+Live-Link in Thread). Deadline Di 18:00.

---

## (erledigt) WOW-POLISH-SPRINT T1–7 + 2 Bugfixes — Branch `wow-polish`

**Ziel:** Spiel optisch/akustisch/feel-mäßig auf „premium" + Wow-Momente, rein additiv. Pivot ist
fertig + auf `main` gemerged + abgabefähig → `main` = Fallback, gebaut wird auf `wow-polish`.

**Stand:** Task 1–7 (Muss) **gebaut, verifiziert, gepusht** + 2 Playtest-Bugfixes.
HEAD `wow-polish`: `3918bec`. Alle Verifikationen grün (22/22 Tests, smoke ok, node --check).
- T1 Smoke-Harness · T2 Syntax-Highlighting (+3 Tests) · T3 Tipp-Juice/Hit-Stop/Ring
- T4 CRT-Scanlines+Vignette · T5 Audio Key-Klick/Combo-Arpeggio + Mute-Icon
- T6 Flow-State Glow + „IN THE ZONE" · T7 Title-Glow + Game-Over Build-Log + High-Score
- **Bugfix 1:** `visibilitychange` pausierte Spiel beim App-Wechsel (Screenshot) →
  jetzt hebt JEDE Taste (nicht nur Esc) die Pause auf (`main.js` keydown-Handler)
- **Bugfix 2:** CSS `height:100%`-Kette durch `body { min-height:100vh }` ersetzt → zuverlässiges
  Flex-Centering in Safari

**NÄCHSTER SCHRITT = PLAYTEST-GATE (Calvin, Browser):**
`python3 -m http.server 8000` → http://localhost:8000 → Cmd+Shift+R (Hard Refresh!) → Klick = Start.
Prüfen: Kill-Mechanik (tippe z.B. `/status` → Bug explodiert); Konsole error/404-frei; Texte lesbar
(Bugs + Terminal + HUD) trotz Vignette/Scanlines/Flow-Glow; Highlighting dezent; Tipp-Feedback taktil;
Audio nicht ermüdend; Mute klickbar; Framerate flüssig. Tuning nur via `CONFIG.fx`/`CONFIG`.

**Nach bestandenem Playtest:**
`git checkout main && git merge --no-ff wow-polish && git push origin main`
dann `! npx vercel` (Calvin interaktiv). Stretch 8–10 nur bei Restzeit.

**Deadline: Di 2026-06-23 18:00.** Kippt der Sprint → `main` ist abgabefähig.

---

## ERLEDIGT — PIVOT „Claude-Code Debugger" (Command-Typing statt Shooter)

**Warum:** Calvin: aktuelles Spiel = nur Shooter-Klon mit eigenem Design. Ziel = echtes
Alleinstellungsmerkmal + tiefere Claude-Anbindung. Brainstorming-Entscheidungen (per AskUserQuestion):
1. Richtung = **„Erklären statt Schießen"** (Mechanik weg vom Shooter).
2. Tipp-Inhalt = **„Claude-Code-Flavor, keine API"** (rein statisch, kein Backend, kein Kostenrisiko).

**FREIGABE ERTEILT 2026-06-22** — Pivot wird gebaut. Zusätzlich in Scope: **Intro „Hey Claude"** (s.u.).

**Design (freigegeben):**
- *Mechanik:* Bugs sinken mit **Slash-Command als Label** (`/fix /test /revert /refactor` …). Spieler
  **tippt den Command** → erster Buchstabe lockt nächsten passenden Bug (ZType-auto-lock), jeder
  korrekte Buchstabe feuert Execute-Strahl, Command fertig = Bug platzt. Tippfehler = „syntax error"
  (Combo bricht, roter Glitch). Keine Maus-Bewegung mehr, Ente zielt automatisch. **Terminal-Prompt**
  unten zeigt Getipptes live (Claude-Code-Vibe, neues Optik-Element).
- *Bleibt:* Duck/Bug/Boss/Beam/Particle/FloatingText, Wellen, Score/Combo/Leben/GameOver, IDE-BG,
  Juice, Hi-DPI, alle mechanics.js-Tests.
- *Raus:* Maus-Bewegung, Autofire, Klick-Feuern.
- *Neu:* Tipp-Buffer + Lock-State + Targeting (game.js), Terminal-Render, Input-Remap (main.js:
  Buchstaben→Buffer, Backspace=Korrektur, Esc=Pause), config-Labels → Commands, neue reine Funktion
  `matchCommand()` in mechanics.js (unit-testbar → TDD bleibt grün).
- *Content:* Command-Pool nach Tier — kurz/häufig `/fix /test /lint /retry`; Tank/lang
  `/refactor /rollback /mutex /rebase`; Boss-„Incident" = Mehrwort-Sequenz `/triage`→`/rollback`→`/ship`
  (teleportiert zwischen Commands).
- *Lock-Default:* auto-lock-nächster passender Bug (anfängerfreundlich). Alt: frei-zielen/blind tippen.
- *Scope:* additiver Branch, statisches T1–T12-Game bleibt Fallback. ~6–8 Tasks.
- *Intro (Idee 1, IN SCOPE):* Title-Screen als getippter Claude-Code-Dialog — User-Zeile
  „Hey Claude, lass uns ein Spiel bauen" tippt sich selbst, Claude-Antwort-Zeile folgt, dann
  startet Game. Reine Render-/Timing-Sache, keine neue Mechanik. Skippbar (Taste/Klick).

## Backlog — nach Abgabe (Di 18:00), NICHT vor Deadline anfassen
- **On-Theme-Politur (Idee 2):** Syntax-Farben, Scanlines/CRT, Glow, Tiefe.
  **Wasser-Revision 2026-06-22 (Calvin):** voll-Gewässer-BG bleibt verworfen (clasht mit IDE/Terminal-
  Theme = Alleinstellungsmerkmal) — ABER **Minimal-Wasser als Mittelweg umgesetzt** (Ente = Rubber Duck
  → schwimmt): transluzente Wasserfläche + animierte Wellenlinie an `floorY`, Ente bobbt/schaukelt,
  Ripple. Terminal-Prompt bleibt lesbar. Siehe Iteration 3.
- **Skill-Trigger (Idee 3):** auslösbare „Superpower" als In-Game-Power (z.B. Screen-Clear/
  Slow-Mo). Neue Mechanik → erst nach Abgabe.
- **MCP (Idee 4):** echtes MCP nicht machbar (statisch, kein Backend, Tech-Guardrail).
  Nur als Flavor/Naming denkbar (Gegner-/Power-Typ „MCP").

**STAND PIVOT:** Code **Task 0–6 + 2 Playtest-Iterationen fertig + gepusht auf Branch `pivot-typing`**
(commands statt labels, Typing, Execute-Strahlen, Boss-Sequenz, Terminal-Prompt, Input-Remap,
Intro „Hey Claude"). **Iteration 1 (Speed/Targeting):** vy gesenkt (fast 130→78, std 60→44, tank 45→30),
Wave-Budget 4+2n→3+n, Spawn langsamer; Auto-Lock → freies Buffer-Targeting (`pickTargetByBuffer`,
jeder Bug in beliebiger Reihenfolge killbar). **Iteration 2 (Claude-Code-Theme):** echte CC-Commands
(`/help /model /init /status /memory /agents` · `/mcp /vim /bug /ide /login` · `/permissions
/terminal-setup /output-style /add-dir`); **Spezial-Bugs** (leuchten): `/clear`=Feld leeren,
`/compact`=Slow-Mo 3s, `/cost`=Bonus-Score; Boss „Heisenbug"→„Context Overflow" (`/compact→/clear→/resume`).
**Iteration 3 (Minimal-Wasser, 2026-06-22):** Ente schwimmt jetzt — transluzenter Wasserkörper
(Verlauf) + animierte Wellen-Oberfläche an `floorY`, `Duck.bobT` → Auf-und-Ab + leichtes Schaukeln,
expandierende Ripple unter der Ente (`game.js:drawWater`, in `drawPlayfield` nach `drawBackground`).
Bewusst transluzent → Terminal/IDE-Look bleibt intakt. Deterministisch (kein `Math.random` im Pfad).
Verifiziert: **19/19 mechanics-Tests grün**, `node --check` alle Files, **headless Smoke** (clear leert
Feld, compact-Slow-Mo skaliert vy, cost-Bonus, freie Reihenfolge; Render-Pfad gegen Stub-ctx crashfrei).
`main`-HEAD = statisches T12 = Fallback.

**OFFEN = Task 7 (braucht Calvin/Browser):** 1) `python3 -m http.server 8000` → Playtest 3–4 Runden:
Speed jetzt ok? Spezial-Bug-Frequenz (16%) angenehm? `/c`-Cluster (clear/compact/cost) verwirrend? → nur
`config.js`-Werte justieren. **NEU: Wasser optisch prüfen** — Wellen sichtbar/Ente schwimmt, aber
Terminal-Prompt + Code lesbar (nicht aufdringlich)? Falls zu stark/schwach → Alpha in `drawWater` justieren. 2) Konsole error/404-frei (Intro→Play→Boss→GameOver→Restart). 3) Erst NACH
bestandenem Playtest: `git checkout main && git merge --no-ff pivot-typing && git push origin main`.
4) `! npx vercel` (Login interaktiv, Calvin) → Live-URL == lokal → Repo+Live-Link in Abgabe-Thread.
**Deadline: Di 18:00 = morgen.** Kippt der Pivot → `main` (statisch) ist abgabefähig.

## Stand
- Setup ✓, Spec ✓, Plan (13 Tasks) ✓, Premortem (PROCEED) ✓.
- **Code T1–T12 fertig + gepusht:** Scaffolding, mechanics.js (+8 node:test grün), State-Machine,
  Duck, Beam, Bugs+Spawner/Wellen, Kollision+Score/Combo+Leben+GameOver+HUD, Heisenbug-Boss,
  Juice (Partikel-Burst/FloatingText/WebAudio-Sound/Screen-Shake-Jitter), Fake-IDE-Hintergrund
  + Code-Korruption (T10), Screens-Politur + localStorage Best + Touch-Hinweis (T11), Hi-DPI (T12).
- Komplettes Spiel steht, jederzeit abgabefähig. 6/6 Files `node --check` ok, 8/8 Tests grün.
- Lokaler Testserver: `python3 -m http.server 8000 --directory .` → http://localhost:8000
- **Bewusste Plan-Abweichungen:** (T9) Partikel via `Math.random()`-Radial-Burst statt
  position-pseudo-random (Plan-Code hätte alle 10 Partikel identisch fliegen lassen; premortem
  sanktioniert Browser-`Math.random()`); zusätzl. `bossHit`-Sound bei Boss-Nicht-Kill-Treffer.

## Nächste Schritte (brauchen Calvin / Browser)
- **T12-Rest:** manueller Playtest 3–4 Runden → nur `config.js`-Werte justieren (vy/spawn/cooldown/
  boss-hp/combo-cap). Bis Feedback da ist, Startwerte unverändert gelassen.
- **Browser-Smoke:** Seite laden, Konsole auf Errors/404 prüfen, Start klicken, ~2s laufen lassen
  (lokal `python3 -m http.server 8000`). Geht erst wieder mit verbundener Playwright-Bridge oder von Hand.
- **T13 Deploy:** `npx vercel` als statische Seite (Preset „Other", kein build-script) → Live-URL,
  Konsole prüfen, gegen lokal abgleichen → Repo-Link + Live-Link in Abgabe-Thread (vor **Di 18:00**).
  `npx vercel` braucht interaktiven Login — von Calvin auszulösen (`! npx vercel`).
- Premortem-Mitigation: früher Wegwerf-Deploy zum De-Risken der Pipeline empfohlen.

## Blocker / Notizen
- Playwright-MCP-Bridge (Browser-Extension) nicht verbunden → kein automatisches Headless-Rendering;
  Logik via node:test/`node --check` verifiziert, Optik/Feel + Live-Check brauchen manuellen Playtest.
- GateGuard-Hook (ECC fact-forcing) feuert bei neuen Dateien; in `.claude/settings.local.json`
  deaktiviert → greift ab nächster Session.
