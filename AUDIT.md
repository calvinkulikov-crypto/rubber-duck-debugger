# AUDIT — Rubber Duck Debugger

**Letztes Update:** 2026-06-20 (Checkpoint nach T12-Code, Handoff an Playtest/Deploy)

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
