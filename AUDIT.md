# AUDIT — Rubber Duck Debugger

**Letztes Update:** 2026-06-22 18:xx (Wow-Polish-Sprint: Spec+Plan+Premortem fertig, Bau startet nächste Session)

## AKTIV — WOW-POLISH-SPRINT (Strategie A, Branch `wow-polish`)

**Ziel:** Spiel optisch/akustisch/feel-mäßig auf „premium" + Wow-Momente, rein additiv. Pivot ist
fertig + auf `main` gemerged + abgabefähig → `main` = Fallback, gebaut wird auf `wow-polish`.

**Stand:** Brainstorming→Spec→Plan→Premortem **durch**, alles auf `origin/wow-polish` gepusht.
- Spec: `docs/superpowers/specs/2026-06-22-wow-polish-sprint-design.md`
- Plan: `docs/superpowers/plans/2026-06-22-wow-polish-sprint.md` (10 Tasks)
- Premortem: `…-wow-polish-sprint-premortem.md` — Verdikt REVISE→**PROCEED** (FX-Lesbarkeit gepatcht)
- Baseline grün: 19/19 mechanics-Tests, alle Files `node --check` ok.

**NÄCHSTER SCHRITT:** Plan ausführen (executing-plans, inline) Task 1→7 (Muss), dann Playtest-Gate,
dann Merge→`main`+Deploy, dann Stretch 8–10 bei Restzeit. Push nach jedem Task auf `wow-polish`.
Tasks (Wow pro Stunde): 1 Smoke-Harness · 2 Syntax-Farben · 3 Tipp-Juice/Hit-Stop/Ring ·
4 CRT-Scanlines/Vignette · 5 Audio+Mute · 6 Flow-State (Signatur) · 7 Title/Game-Over-Reskin.

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
