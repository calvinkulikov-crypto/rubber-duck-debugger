# Rubber Duck Debugger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein poliertes Vanilla-Canvas-Arcade-Minigame "Rubber Duck Debugger" — Gummiente unten schießt Erklär-Strahlen auf absteigende Bugs, Combos, Wellen, Heisenbug-Boss — statisch auf Vercel deploybar.

**Architecture:** Eine `requestAnimationFrame`-Loop (dt-basiert) treibt eine `Game`-State-Machine (TITLE/PLAYING/PAUSED/GAMEOVER). Reine Spiel-Mathematik lebt in `mechanics.js` (unit-getestet via `node:test`). Entities (Duck/Bug/Beam/Particle/FloatingText) und `Game` zeichnen direkt auf Canvas. Null externe Assets — Grafik gezeichnet, Sound WebAudio-synthetisiert.

**Tech Stack:** Vanilla JS (ES-Module, `type="module"`), HTML5 Canvas 2D, WebAudio, `localStorage`. Tests: `node --test` (node v25, keine Dependencies). Deploy: Vercel (statisch).

---

## Spec

Quelle der Wahrheit: `docs/superpowers/specs/2026-06-20-rubber-duck-debugger-design.md`.

## File Structure

| Datei | Verantwortung |
|-------|---------------|
| `index.html` | Canvas + lädt `./main.js` als Modul. Minimal. |
| `style.css` | Dark Page-BG, Canvas zentriert + responsiv skaliert. |
| `package.json` | `"type":"module"` + `"test":"node --test"`. Kein Build-Step. |
| `config.js` | `CONFIG`-Objekt: alle Tuning-Konstanten (reine Daten). |
| `mechanics.js` | Reine Funktionen (combo/score/wellen/kollision/clamp). **Unit-getestet.** |
| `audio.js` | `Sound`-Helper: WebAudio-synth-Effekte. |
| `entities.js` | Klassen `Duck`, `Bug`, `Beam`, `Boss`, `Particle`, `FloatingText`. |
| `game.js` | `Game`-Klasse: State-Machine, Systeme, `update(dt)`/`draw(ctx)`. |
| `main.js` | Bootstrap: Canvas, `Game`, rAF-Loop (dt geclampt), Input-Listener. |
| `tests/mechanics.test.js` | `node:test`-Unit-Tests für `mechanics.js`. |

Alle Dateinamen lowercase, alle Imports relativ (`./`). Template-`game.js` (Platzhalter) wird ersetzt.

---

## Task 1: Scaffolding + Modul-Bootstrap (leeres Canvas rendert)

**Files:**
- Modify: `index.html`
- Create: `style.css` (ersetzt Template-Inhalt), `main.js`, `config.js`, `package.json`
- Note: Template-`game.js` wird in Task 3 vollständig als `Game` neu geschrieben; `index.html` lädt es ab jetzt nicht mehr direkt.

- [ ] **Step 1: `package.json` anlegen**

```json
{
  "name": "rubber-duck-debugger",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: `config.js` mit Startwerten anlegen**

```js
// Alle Tuning-Konstanten an einem Ort. Im Playtest justieren.
export const CONFIG = {
  canvas: { w: 800, h: 600 },
  floorY: 540,                 // ab hier "korrumpiert" ein Bug eine Code-Zeile
  duck: { w: 76, h: 64, y: 542, moveSpeed: 540, recoilTime: 0.12 },
  beam: { speed: 920, width: 6, len: 26, cooldown: 0.16 },
  combo: { perTier: 5, multCap: 8, timeout: 5 },
  lives: 3,
  waves: {
    baseBudget: 4, perWave: 2, speedMult: 1.08, bossEvery: 5,
    bannerTime: 1.6, spawnIntervalBase: 0.9, spawnIntervalMin: 0.28,
  },
  bugTypes: {
    standard: { r: 18, vy: 60,  hp: 1, points: 100, color: "#e06c75",
      labels: ["off-by-one", "typo", "NaN", "undefined", "null ptr"] },
    fast:     { r: 12, vy: 130, hp: 1, points: 150, color: "#e5c07b",
      labels: ["memory leak", "flaky test", "404"] },
    tank:     { r: 26, vy: 45,  hp: 3, points: 300, color: "#c678dd",
      labels: ["race condition", "deadlock", "segfault"] },
  },
  boss: { r: 48, vy: 30, hp: 12, points: 2000, color: "#56b6c2", label: "Heisenbug" },
};
```

- [ ] **Step 3: `index.html` auf Modul-Bootstrap umstellen**

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rubber Duck Debugger 🦆</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <canvas id="game" width="800" height="600"></canvas>
    </main>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: `style.css` (dark, zentriert, responsiv)**

```css
:root { color-scheme: dark; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body {
  background: #0d1117;
  display: flex; align-items: center; justify-content: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
main { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 12px; }
#game {
  width: min(96vw, calc(96vh * 4 / 3));   /* 800x600 = 4:3, skaliert, behält Ratio */
  height: auto; aspect-ratio: 4 / 3;
  background: #0d1117;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,.6);
  cursor: crosshair;
}
```

- [ ] **Step 5: `main.js` Bootstrap mit rAF-Loop (zeichnet erstmal nur Platzhalter)**

```js
import { CONFIG } from "./config.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1 / 30) dt = 1 / 30;            // großen Sprung (Tab-Blur) clampen
  // Platzhalter bis Task 3 die Game-Loop bringt:
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
  ctx.fillStyle = "#8b949e";
  ctx.font = "20px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("Scaffolding ok — Bootstrap läuft", CONFIG.canvas.w / 2, CONFIG.canvas.h / 2);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 6: Lokal starten + Konsole prüfen**

Run: `python3 -m http.server 8000` (im Repo-Root), dann Browser `http://localhost:8000`.
Erwartet: dunkles Canvas mit Text "Scaffolding ok…", **keine Fehler/404 in der Konsole** (Module laden via relative Pfade).

- [ ] **Step 7: Commit + Push**

```bash
git add -A
git commit -m "feat: scaffolding, modul-bootstrap, config, responsive canvas"
git push origin main
```

---

## Task 2: `mechanics.js` reine Logik (TDD)

**Files:**
- Create: `mechanics.js`, `tests/mechanics.test.js`

- [ ] **Step 1: Failing Tests schreiben (`tests/mechanics.test.js`)**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clamp, comboMultiplier, scoreForKill,
  waveBudget, waveSpeedMultiplier, isBossWave,
  bugReachedFloor, beamHitsBug,
} from "../mechanics.js";

test("clamp begrenzt nach unten/oben", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test("comboMultiplier steigt pro Tier, gedeckelt", () => {
  assert.equal(comboMultiplier(0, 5, 8), 1);
  assert.equal(comboMultiplier(4, 5, 8), 1);
  assert.equal(comboMultiplier(5, 5, 8), 2);
  assert.equal(comboMultiplier(34, 5, 8), 7);
  assert.equal(comboMultiplier(1000, 5, 8), 8);   // cap
});

test("scoreForKill = base * multiplier", () => {
  assert.equal(scoreForKill(100, 3), 300);
});

test("waveBudget = base + wave*per (1-indexiert)", () => {
  assert.equal(waveBudget(1, 4, 2), 6);
  assert.equal(waveBudget(3, 4, 2), 10);
});

test("waveSpeedMultiplier wächst exponentiell ab Welle 1", () => {
  assert.equal(waveSpeedMultiplier(1, 1.08), 1);
  assert.ok(Math.abs(waveSpeedMultiplier(2, 1.08) - 1.08) < 1e-9);
});

test("isBossWave bei Vielfachen von every", () => {
  assert.equal(isBossWave(5, 5), true);
  assert.equal(isBossWave(10, 5), true);
  assert.equal(isBossWave(7, 5), false);
});

test("bugReachedFloor wenn Unterkante >= floorY", () => {
  assert.equal(bugReachedFloor({ y: 500, r: 18 }, 540), false);
  assert.equal(bugReachedFloor({ y: 525, r: 18 }, 540), true);
});

test("beamHitsBug: vertikales Segment vs Kreis", () => {
  const bug = { x: 400, y: 200, r: 18 };
  assert.equal(beamHitsBug({ x: 400, y: 215, len: 26, width: 6 }, bug), true);   // direkt drunter, überlappt
  assert.equal(beamHitsBug({ x: 460, y: 215, len: 26, width: 6 }, bug), false);  // seitlich daneben
  assert.equal(beamHitsBug({ x: 400, y: 400, len: 26, width: 6 }, bug), false);  // zu weit weg vertikal
});
```

- [ ] **Step 2: Tests laufen → müssen fehlschlagen**

Run: `node --test`
Erwartet: FAIL — `Cannot find module '../mechanics.js'` bzw. Funktionen undefiniert.

- [ ] **Step 3: `mechanics.js` implementieren**

```js
// Reine, DOM-freie Funktionen — von Browser UND node:test importierbar.
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const comboMultiplier = (combo, perTier, cap) =>
  Math.min(cap, 1 + Math.floor(combo / perTier));

export const scoreForKill = (basePoints, multiplier) => basePoints * multiplier;

export const waveBudget = (wave, base, per) => base + wave * per;

export const waveSpeedMultiplier = (wave, speedMult) => Math.pow(speedMult, wave - 1);

export const isBossWave = (wave, every) => wave % every === 0;

export const bugReachedFloor = (bug, floorY) => bug.y + bug.r >= floorY;

// beam: vertikales Segment von (x, y) nach oben bis (x, y-len), Dicke width.
// bug: Kreis (x, y, r). Treffer, wenn Abstand Kreismitte→Segment <= r + width/2.
export const beamHitsBug = (beam, bug) => {
  const yTop = beam.y - beam.len;
  const cy = clamp(bug.y, yTop, beam.y);     // nächster Punkt auf Segment in y
  const dx = beam.x - bug.x;
  const dy = cy - bug.y;
  const rad = bug.r + beam.width / 2;
  return dx * dx + dy * dy <= rad * rad;
};
```

- [ ] **Step 4: Tests laufen → grün**

Run: `node --test`
Erwartet: PASS, alle Tests grün.

- [ ] **Step 5: Commit + Push**

```bash
git add -A
git commit -m "feat: mechanics.js reine logik + node:test (TDD)"
git push origin main
```

---

## Task 3: `Game`-State-Machine + Loop-Anbindung

**Files:**
- Create: `game.js` (ersetzt Template-`game.js` vollständig)
- Modify: `main.js` (Game instanzieren + Input)

- [ ] **Step 1: `game.js` mit State-Machine-Gerüst**

```js
import { CONFIG } from "./config.js";

export const STATE = { TITLE: "TITLE", PLAYING: "PLAYING", PAUSED: "PAUSED", GAMEOVER: "GAMEOVER" };

export class Game {
  constructor(sound = null) {
    this.W = CONFIG.canvas.w;
    this.H = CONFIG.canvas.h;
    this.sound = sound;
    this.state = STATE.TITLE;
    this.input = { mouseX: this.W / 2, firing: false, left: false, right: false };
    this.best = 0;            // wird in Task 11 aus localStorage geladen
    this.reset();
  }

  reset() {
    this.score = 0;
    this.wave = 0;            // Spawner startet Welle 1 in Task 6
    this.lives = CONFIG.lives;
    this.combo = 0;
    this.bugs = [];
    this.beams = [];
    this.particles = [];
    this.texts = [];
    this.shake = 0;
  }

  start() { this.reset(); this.state = STATE.PLAYING; }
  togglePause() {
    if (this.state === STATE.PLAYING) this.state = STATE.PAUSED;
    else if (this.state === STATE.PAUSED) this.state = STATE.PLAYING;
  }
  // Klick/Taste-"bestätigen" je nach State
  confirm() {
    if (this.state === STATE.TITLE) this.start();
    else if (this.state === STATE.GAMEOVER) this.start();
  }

  update(dt) {
    if (this.state !== STATE.PLAYING) return;
    // Systeme kommen in Tasks 4-8 hierher.
  }

  draw(ctx) {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#c9d1d9";
    if (this.state === STATE.TITLE) {
      ctx.font = "40px ui-monospace, monospace";
      ctx.fillText("🦆 Rubber Duck Debugger", this.W / 2, 220);
      ctx.font = "18px ui-monospace, monospace";
      ctx.fillText("Klick zum Start", this.W / 2, 320);
    } else if (this.state === STATE.GAMEOVER) {
      ctx.font = "40px ui-monospace, monospace";
      ctx.fillText("BUILD BROKEN", this.W / 2, 240);
      ctx.font = "18px ui-monospace, monospace";
      ctx.fillText("R / Klick = neu", this.W / 2, 320);
    } else if (this.state === STATE.PAUSED) {
      ctx.font = "32px ui-monospace, monospace";
      ctx.fillText("Pause", this.W / 2, this.H / 2);
    } else {
      ctx.font = "16px ui-monospace, monospace";
      ctx.fillText("PLAYING — Systeme folgen", this.W / 2, this.H / 2);
    }
  }
}
```

- [ ] **Step 2: `main.js` an `Game` + Input anschließen**

```js
import { CONFIG } from "./config.js";
import { Game, STATE } from "./game.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const game = new Game();

// CSS-Pixel → interne Canvas-Koordinaten (Canvas wird per CSS skaliert)
function toCanvasX(clientX) {
  const r = canvas.getBoundingClientRect();
  return ((clientX - r.left) / r.width) * CONFIG.canvas.w;
}

canvas.addEventListener("mousemove", (e) => { game.input.mouseX = toCanvasX(e.clientX); });
canvas.addEventListener("mousedown", () => {
  if (game.state === STATE.PLAYING) game.input.firing = true;
  else game.confirm();
});
window.addEventListener("mouseup", () => { game.input.firing = false; });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") game.input.left = true;
  if (e.code === "ArrowRight") game.input.right = true;
  if (e.code === "Space") { e.preventDefault(); if (game.state === STATE.PLAYING) game.input.firing = true; else game.confirm(); }
  if (e.code === "KeyR" && game.state === STATE.GAMEOVER) game.start();
  if (e.code === "KeyP" || e.code === "Escape") game.togglePause();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") game.input.left = false;
  if (e.code === "ArrowRight") game.input.right = false;
  if (e.code === "Space") game.input.firing = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === STATE.PLAYING) game.state = STATE.PAUSED;
});

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1 / 30) dt = 1 / 30;
  game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 3: Im Browser verifizieren**

Run: `python3 -m http.server 8000` → Browser.
Erwartet: Titel-Screen. Klick → "PLAYING — Systeme folgen". `P`/`Esc` → "Pause" toggelt. Keine Konsolen-Fehler.

- [ ] **Step 4: Commit + Push**

```bash
git add -A
git commit -m "feat: Game state-machine (TITLE/PLAYING/PAUSED/GAMEOVER) + input"
git push origin main
```

---

## Task 4: Duck-Entity + Bewegung

**Files:**
- Create: `entities.js` (mit `Duck`)
- Modify: `game.js` (Duck instanzieren, update/draw einhängen)

- [ ] **Step 1: `entities.js` mit `Duck`**

```js
import { CONFIG } from "./config.js";
import { clamp } from "./mechanics.js";

export class Duck {
  constructor() {
    this.x = CONFIG.canvas.w / 2;
    this.y = CONFIG.duck.y;
    this.w = CONFIG.duck.w;
    this.h = CONFIG.duck.h;
    this.recoil = 0;          // 0..recoilTime, zählt runter
  }

  update(dt, input) {
    const sp = CONFIG.duck.moveSpeed;
    let target = input.mouseX;
    if (input.left) target = this.x - sp * dt;       // Tastatur überschreibt Richtung
    if (input.right) target = this.x + sp * dt;
    // sanft zur Maus ziehen (begrenzte Geschwindigkeit)
    const dx = target - this.x;
    const step = clamp(dx, -sp * dt, sp * dt);
    this.x = clamp(this.x + step, this.w / 2, CONFIG.canvas.w - this.w / 2);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt);
  }

  triggerRecoil() { this.recoil = CONFIG.duck.recoilTime; }

  // Mündung des Strahls (oben an der Ente)
  muzzle() { return { x: this.x, y: this.y - this.h / 2 }; }

  draw(ctx) {
    const squash = this.recoil > 0 ? 1 + (this.recoil / CONFIG.duck.recoilTime) * 0.18 : 1;
    const w = this.w, h = this.h / squash;
    const x = this.x, y = this.y;
    ctx.save();
    ctx.translate(x, y);
    // Körper
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.12, w * 0.42, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    // Kopf
    ctx.beginPath();
    ctx.arc(w * 0.18, -h * 0.22, h * 0.26, 0, Math.PI * 2);
    ctx.fill();
    // Schnabel
    ctx.fillStyle = "#ff8c2b";
    ctx.beginPath();
    ctx.moveTo(w * 0.36, -h * 0.24);
    ctx.lineTo(w * 0.58, -h * 0.18);
    ctx.lineTo(w * 0.36, -h * 0.12);
    ctx.closePath();
    ctx.fill();
    // Auge
    ctx.fillStyle = "#1b1f24";
    ctx.beginPath();
    ctx.arc(w * 0.24, -h * 0.28, h * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
```

- [ ] **Step 2: Duck in `game.js` einhängen**

Oben importieren: `import { Duck } from "./entities.js";`.
In `reset()` ergänzen: `this.duck = new Duck();`.
In `update(dt)` (innerhalb PLAYING) ergänzen: `this.duck.update(dt, this.input);`.
In `draw(ctx)` im PLAYING-Zweig statt des Platzhaltertexts: `this.duck.draw(ctx);`.

- [ ] **Step 3: Verifizieren**

Browser: Start → gezeichnete Gummiente unten, folgt der Maus, bleibt im Rand. Pfeiltasten bewegen sie. Keine Fehler.

- [ ] **Step 4: Commit + Push**

```bash
git add -A
git commit -m "feat: Duck-entity + maus/tastatur-bewegung"
git push origin main
```

---

## Task 5: Beam feuern (Strahl + Cooldown + Autofire)

**Files:**
- Modify: `entities.js` (+`Beam`), `game.js` (Feuer-System)

- [ ] **Step 1: `Beam`-Klasse in `entities.js`**

```js
export class Beam {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.len = CONFIG.beam.len;
    this.width = CONFIG.beam.width;
    this.dead = false;
  }
  update(dt) {
    this.y -= CONFIG.beam.speed * dt;
    if (this.y + this.len < 0) this.dead = true;   // oben raus = Miss
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = "#7ee787";
    ctx.lineWidth = this.width;
    ctx.lineCap = "round";
    ctx.shadowColor = "#7ee787";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x, this.y - this.len);
    ctx.stroke();
    ctx.restore();
  }
}
```

- [ ] **Step 2: Feuer-System in `game.js`**

In `reset()` ergänzen: `this.fireCd = 0;`.
Import erweitern: `import { Duck, Beam } from "./entities.js";`.
In `update(dt)` (PLAYING), nach `this.duck.update(...)`:

```js
// Feuern (Autofire bei gehaltenem Button/Space, per Cooldown gedrosselt)
this.fireCd -= dt;
if (this.input.firing && this.fireCd <= 0) {
  const m = this.duck.muzzle();
  this.beams.push(new Beam(m.x, m.y));
  this.duck.triggerRecoil();
  this.fireCd = CONFIG.beam.cooldown;
  this.sound?.fire();           // Sound-Helper kommt in Task 9 (optional chaining → vorher harmlos)
}
for (const b of this.beams) b.update(dt);
this.beams = this.beams.filter((b) => !b.dead);
```

In `draw(ctx)` (PLAYING) vor `this.duck.draw(ctx)`: `for (const b of this.beams) b.draw(ctx);`.

- [ ] **Step 3: Verifizieren**

Browser: Klick/Leertaste halten → Strahlen steigen auf, Ente ruckelt (recoil), Strahlen verschwinden oben. Cooldown begrenzt Feuerrate. Keine Fehler.

- [ ] **Step 4: Commit + Push**

```bash
git add -A
git commit -m "feat: Beam feuern mit cooldown + autofire + recoil"
git push origin main
```

---

## Task 6: Bug-Entity + Spawner/Wellen

**Files:**
- Modify: `entities.js` (+`Bug`), `game.js` (Wellen-/Spawn-System)

- [ ] **Step 1: `Bug`-Klasse in `entities.js`**

```js
export class Bug {
  // typeKey: "standard" | "fast" | "tank"; speedMult skaliert vy pro Welle
  constructor(typeKey, x, speedMult, phase) {
    const t = CONFIG.bugTypes[typeKey];
    this.type = typeKey;
    this.x = x;
    this.y = -t.r;
    this.r = t.r;
    this.vy = t.vy * speedMult;
    this.hp = t.hp;
    this.maxHp = t.hp;
    this.points = t.points;
    this.color = t.color;
    this.label = t.labels[Math.floor((phase * 97) % t.labels.length)];  // deterministische Wahl
    this.phase = phase;          // für Krabbel-/Drift-Animation
    this.flash = 0;
    this.dead = false;
    this.escaped = false;
    this.isBoss = false;
  }
  update(dt, time) {
    this.y += this.vy * dt;
    this.x += Math.sin((time + this.phase) * 2.4) * 18 * dt; // leichter Drift
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
  }
  hit(dmg = 1) { this.hp -= dmg; this.flash = 0.12; if (this.hp <= 0) this.dead = true; }
  draw(ctx, time) {
    const wob = Math.sin((time + this.phase) * 10) * this.r * 0.12;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.flash > 0 ? "#ffffff" : this.color;
    // Körper
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r, this.r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    // Beinchen
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * this.r * 0.5, this.r * 0.5);
      ctx.lineTo(i * this.r * 0.7, this.r * 0.9 + wob);
      ctx.stroke();
    }
    // Augen
    ctx.fillStyle = "#0d1117";
    ctx.beginPath(); ctx.arc(-this.r * 0.3, -this.r * 0.2, this.r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.r * 0.3, -this.r * 0.2, this.r * 0.14, 0, Math.PI * 2); ctx.fill();
    // Label
    ctx.fillStyle = "#8b949e";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(this.label, 0, -this.r - 6);
    ctx.restore();
  }
}
```

- [ ] **Step 2: Wellen-/Spawn-System in `game.js`**

Imports: `import { waveBudget, waveSpeedMultiplier, isBossWave } from "./mechanics.js";` und `Bug` aus entities (`import { Duck, Beam, Bug } from "./entities.js";`).
In `reset()` ergänzen:

```js
this.time = 0;
this.toSpawn = 0;          // verbleibendes Bug-Budget der aktuellen Welle
this.spawnTimer = 0;
this.banner = 0;           // > 0 = Wellen-Banner sichtbar, kein Spawn
this.speedMult = 1;
this.bossPending = false;
```

Neue Methoden in `Game`:

```js
startWave() {
  this.wave += 1;
  this.speedMult = waveSpeedMultiplier(this.wave, CONFIG.waves.speedMult);
  this.banner = CONFIG.waves.bannerTime;
  if (this.wave > 1) this.sound?.waveClear();
  if (isBossWave(this.wave, CONFIG.waves.bossEvery)) {
    this.bossPending = true;     // Boss-Spawn folgt in Task 8
    this.toSpawn = 0;
  } else {
    this.toSpawn = waveBudget(this.wave, CONFIG.waves.baseBudget, CONFIG.waves.perWave);
    this.bossPending = false;
  }
  this.spawnTimer = 0;
}

spawnInterval() {
  const w = CONFIG.waves;
  return Math.max(w.spawnIntervalMin, w.spawnIntervalBase - this.wave * 0.05);
}

spawnBug() {
  const roll = (this.time * 131) % 1;             // deterministisch-pseudo
  const key = roll < 0.18 ? "tank" : roll < 0.5 ? "fast" : "standard";
  const t = CONFIG.bugTypes[key];
  const x = t.r + ((this.time * 733) % (CONFIG.canvas.w - 2 * t.r));
  this.bugs.push(new Bug(key, x, this.speedMult, this.time));
}
```

In `update(dt)` (PLAYING), Spawn-Logik:

```js
this.time += dt;
if (this.wave === 0) this.startWave();          // erste Welle starten
if (this.banner > 0) {
  this.banner -= dt;
} else if (this.toSpawn > 0) {
  this.spawnTimer -= dt;
  if (this.spawnTimer <= 0) { this.spawnBug(); this.toSpawn -= 1; this.spawnTimer = this.spawnInterval(); }
}
for (const bug of this.bugs) bug.update(dt, this.time);
// Welle vorbei? (nichts mehr zu spawnen, keine Bugs aktiv, kein Banner, kein Boss) → nächste
if (this.banner <= 0 && this.toSpawn === 0 && this.bugs.length === 0 && !this.bossPending) {
  this.startWave();
}
```

In `draw(ctx)` (PLAYING) Bugs zeichnen (vor Beams): `for (const bug of this.bugs) bug.draw(ctx, this.time);`.
Banner zeichnen wenn `this.banner > 0`: Text `Welle ${this.wave}` mittig.

- [ ] **Step 3: Verifizieren**

Browser: Start → "Welle 1"-Banner, dann krabbeln Bugs mit Exception-Labels von oben herab, leichter Drift. Mehr/schnellere Bugs in höheren Wellen. (Kollision/Tod erst Task 7 → Bugs laufen vorerst durch.) Keine Fehler.

- [ ] **Step 4: Commit + Push**

```bash
git add -A
git commit -m "feat: Bug-entity + wellen-spawner (budget/tempo skaliert)"
git push origin main
```

---

## Task 7: Kollision + Score/Combo + Leben + Game Over

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Imports erweitern**

`import { waveBudget, waveSpeedMultiplier, isBossWave, bugReachedFloor, beamHitsBug, comboMultiplier, scoreForKill } from "./mechanics.js";`
In `reset()` ergänzen: `this.comboTimer = 0;`.

- [ ] **Step 2: Kollisions-/Score-Logik in `update(dt)` (PLAYING), nach Bug-Update**

```js
// Beam × Bug
for (const beam of this.beams) {
  if (beam.dead) continue;
  for (const bug of this.bugs) {
    if (bug.dead) continue;
    if (beamHitsBug(beam, bug)) {
      beam.dead = true;
      bug.hit(1);
      if (bug.dead) this.onKill(bug);
      break;
    }
  }
}
this.beams = this.beams.filter((b) => !b.dead);

// Bug × Boden (Korruption) + tote entfernen
for (const bug of this.bugs) {
  if (!bug.dead && bugReachedFloor(bug, CONFIG.floorY)) { bug.escaped = true; this.onEscape(bug); }
}
this.bugs = this.bugs.filter((b) => !b.dead && !b.escaped);

// Combo-Timeout
if (this.combo > 0) {
  this.comboTimer -= dt;
  if (this.comboTimer <= 0) this.combo = 0;
}
```

- [ ] **Step 3: Helfer-Methoden in `Game`**

```js
multiplier() { return comboMultiplier(this.combo, CONFIG.combo.perTier, CONFIG.combo.multCap); }

onKill(bug) {
  this.combo += 1;
  this.comboTimer = CONFIG.combo.timeout;
  this.score += scoreForKill(bug.points, this.multiplier());
  // Partikel/FloatingText/Sound in Task 9
}

onEscape(bug) {
  this.lives -= 1;
  this.combo = 0;
  this.shake = 0.4;
  this.sound?.damage();
  // Code-Zeilen-Korruption (visuell) in Task 10
  if (this.lives <= 0) this.gameOver();
}

gameOver() {
  this.state = STATE.GAMEOVER;
  if (this.score > this.best) this.best = this.score;   // localStorage in Task 11
  this.sound?.gameOver();
}
```

- [ ] **Step 4: HUD zeichnen (PLAYING)**

In `draw(ctx)` (PLAYING), nach Entities:

```js
ctx.fillStyle = "#c9d1d9";
ctx.font = "16px ui-monospace, monospace";
ctx.textAlign = "left";
ctx.fillText(`Score ${this.score}`, 16, 26);
ctx.textAlign = "center";
ctx.fillText(`Welle ${this.wave}`, this.W / 2, 26);
ctx.textAlign = "right";
ctx.fillText(`Leben ${"♥".repeat(Math.max(0, this.lives))}`, this.W - 16, 26);
const mult = this.multiplier();
if (mult > 1) { ctx.textAlign = "center"; ctx.fillStyle = "#7ee787"; ctx.fillText(`×${mult}`, this.W / 2, 50); }
```

GameOver-Screen ergänzen: finalen `Score ${this.score}` und `Best ${this.best}` anzeigen.

- [ ] **Step 5: Verifizieren**

Browser: Strahlen platzen Bugs → Score steigt, Combo-Multiplikator ×N erscheint. Bug am Boden → Leben −1. 3× → BUILD BROKEN mit Score/Best. Restart (R/Klick) startet neu. Keine Fehler.

- [ ] **Step 6: Commit + Push**

```bash
git add -A
git commit -m "feat: kollision, score/combo/multiplier, leben, game over"
git push origin main
```

---

## Task 8: Heisenbug-Boss

**Files:**
- Modify: `entities.js` (+`Boss`), `game.js` (Boss-Wellen-Spawn)

- [ ] **Step 1: `Boss`-Klasse in `entities.js`**

```js
export class Boss {
  constructor() {
    const b = CONFIG.boss;
    this.x = CONFIG.canvas.w / 2;
    this.y = -b.r;
    this.r = b.r;
    this.vy = b.vy;
    this.hp = b.hp;
    this.maxHp = b.hp;
    this.points = b.points;
    this.color = b.color;
    this.label = b.label;
    this.flash = 0;
    this.dead = false;
    this.escaped = false;
    this.isBoss = true;
  }
  update(dt, time) {
    this.y += this.vy * dt;
    this.x += Math.sin(time * 1.6) * 40 * dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
  }
  hit(dmg = 1) {
    this.hp -= dmg;
    this.flash = 0.1;
    // Heisenbug: teleportiert seine x-Position bei jedem Treffer
    const margin = this.r + 20;
    this.x = margin + (Math.abs(this.hp * 137 + Math.floor(this.y) * 7) % (CONFIG.canvas.w - 2 * margin));
    if (this.hp <= 0) this.dead = true;
  }
  draw(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.flash > 0 ? "#ffffff" : this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r, this.r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d1117";
    ctx.beginPath(); ctx.arc(-this.r * 0.32, -this.r * 0.18, this.r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.r * 0.32, -this.r * 0.18, this.r * 0.13, 0, Math.PI * 2); ctx.fill();
    // HP-Bar
    ctx.fillStyle = "#30363d"; ctx.fillRect(-this.r, -this.r - 14, this.r * 2, 6);
    ctx.fillStyle = "#56b6c2"; ctx.fillRect(-this.r, -this.r - 14, this.r * 2 * (this.hp / this.maxHp), 6);
    ctx.fillStyle = "#8b949e"; ctx.font = "12px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(this.label, 0, -this.r - 20);
    ctx.restore();
  }
}
```

- [ ] **Step 2: Boss in `game.js` spawnen**

Import erweitern: `import { Duck, Beam, Bug, Boss } from "./entities.js";`.
In `startWave()` den Boss-Zweig konkretisieren (statt nur `bossPending=true`):

```js
if (isBossWave(this.wave, CONFIG.waves.bossEvery)) {
  this.bugs.push(new Boss());
  this.toSpawn = 3;            // wenige Begleit-Bugs
  this.bossPending = false;
}
```

(Boss zählt als normaler Eintrag in `this.bugs`; `onKill`/`bugReachedFloor`/`beamHitsBug` funktionieren über die gleichen Felder `x,y,r,hp,points`. `Boss.hit()` ist überschrieben → Teleport. Die "Welle vorbei"-Bedingung greift erst, wenn auch der Boss tot/weg ist.)

- [ ] **Step 3: Verifizieren**

Browser: Welle 5 → großer Heisenbug mit HP-Bar, teleportiert bei jedem Treffer seitlich, braucht viele Treffer, gibt 2000×Mult Punkte. Begleit-Bugs zusätzlich. Keine Fehler.

- [ ] **Step 4: Commit + Push**

```bash
git add -A
git commit -m "feat: Heisenbug-boss (multi-hit, teleport, boss-welle)"
git push origin main
```

---

## Task 9: Juice — Partikel, FloatingText, Sound, Screen-Shake

**Files:**
- Create: `audio.js`
- Modify: `entities.js` (+`Particle`, `FloatingText`), `game.js` (einbinden), `main.js` (AudioContext bei erster Geste)

- [ ] **Step 1: `Particle` + `FloatingText` in `entities.js`**

```js
export class Particle {
  constructor(x, y, color) {
    const a = (x * 13 + y * 7) % (Math.PI * 2);
    const sp = 60 + ((x * 31 + y) % 160);
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp + ((y % 7) - 3) * 20;
    this.vy = Math.sin(a) * sp - 40;
    this.life = 0.5 + ((x % 5) * 0.06);
    this.max = this.life; this.color = color; this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 380 * dt;
    this.life -= dt; if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}

export class FloatingText {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.life = 0.9; this.max = 0.9; this.dead = false;
  }
  update(dt) { this.y -= 36 * dt; this.life -= dt; if (this.life <= 0) this.dead = true; }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.fillStyle = this.color;
    ctx.font = "bold 16px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 2: `audio.js` (WebAudio-synth, robust ohne Asset)**

```js
// Synthetisierte Effekte. Kein Asset, kein 404. Bei fehlendem WebAudio: still.
export class Sound {
  constructor() { this.ctx = null; this.ok = false; }
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC(); this.ok = true;
    } catch { this.ok = false; }
  }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }
  blip(freq, dur, type = "square", gain = 0.06, slideTo = null) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }
  fire()      { this.blip(680, 0.08, "square", 0.04, 880); }
  pop()       { this.blip(420, 0.12, "triangle", 0.07, 120); }
  tankHit()   { this.blip(160, 0.08, "sawtooth", 0.05); }
  bossHit()   { this.blip(240, 0.1, "sawtooth", 0.06, 90); }
  damage()    { this.blip(90, 0.3, "sawtooth", 0.09, 50); }
  waveClear() { this.blip(523, 0.1, "sine", 0.05, 784); }
  gameOver()  { this.blip(330, 0.6, "sine", 0.08, 70); }
}
```

- [ ] **Step 3: In `game.js` verdrahten**

Import erweitern: `import { Duck, Beam, Bug, Boss, Particle, FloatingText } from "./entities.js";`.
(Der `Game`-Konstruktor nimmt `sound` bereits seit Task 3 entgegen.) In `onKill(bug)` ergänzen:

```js
for (let i = 0; i < 10; i++) this.particles.push(new Particle(bug.x, bug.y, bug.color));
this.texts.push(new FloatingText(bug.x, bug.y, bug.label, "#c9d1d9"));
if (this.multiplier() > 1) this.texts.push(new FloatingText(bug.x, bug.y - 18, `×${this.multiplier()}`, "#7ee787"));
if (bug.isBoss) this.shake = Math.max(this.shake, 0.25);
this.sound?.[bug.isBoss ? "bossHit" : "pop"]();
```

(Beim Tank-Treffer ohne Kill optional `this.sound?.tankHit();` in der Kollisionsschleife, wenn `!bug.dead && bug.type === "tank"`.)
In `update(dt)` (PLAYING) Partikel/Texte updaten + Shake abklingen:

```js
for (const p of this.particles) p.update(dt);
for (const t of this.texts) t.update(dt);
this.particles = this.particles.filter((p) => !p.dead);
this.texts = this.texts.filter((t) => !t.dead);
if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
```

Screen-Shake in `draw(ctx)`: ganz am Anfang `ctx.save()` + Translate um Offset, am Ende `ctx.restore()`. Partikel/Texte im PLAYING zeichnen:

```js
draw(ctx) {
  ctx.save();
  if (this.shake > 0) {
    const s = this.shake * 14;
    ctx.translate((((this.time * 911) % 2) - 1) * s, (((this.time * 733) % 2) - 1) * s);
  }
  // ... bestehendes Zeichnen je State ...
  // im PLAYING nach Entities: for (const p of this.particles) p.draw(ctx); for (const t of this.texts) t.draw(ctx);
  ctx.restore();
}
```

- [ ] **Step 4: `main.js` — Sound erzeugen + bei erster Geste init/resume**

```js
import { Sound } from "./audio.js";
const sound = new Sound();
const game = new Game(sound);     // Game-Konstruktor nimmt sound entgegen (seit Task 3)
function unlockAudio() { sound.init(); sound.resume(); }
window.addEventListener("mousedown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });
```

(Die `const game = new Game();`-Zeile aus Task 3 entsprechend durch `new Game(sound)` ersetzen.)

- [ ] **Step 5: Verifizieren**

Browser: Pops mit Partikelburst + auffliegendem Exception-Namen, Combo-Text, Sounds (Feuern/Pop/Damage/GameOver), Screen-Shake bei Korruption/Boss. Bei stummgeschaltetem/altem Browser kein Crash. Keine Fehler.

- [ ] **Step 6: Commit + Push**

```bash
git add -A
git commit -m "feat: juice — partikel, floating-text, webaudio-sound, screen-shake"
git push origin main
```

---

## Task 10: Fake-IDE-Hintergrund + Code-Zeilen-Korruption

**Files:**
- Modify: `game.js` (Hintergrund-Render + Korruptions-Zustand)

- [ ] **Step 1: Hintergrund-Daten in `reset()`**

```js
this.codeLines = [
  "function fixBug(duck) {", "  while (bugs.length) {", "    duck.explain(bug);",
  "    if (bug.solved) ship();", "  }", "  return clean;", "}",
  "const debugDuck = new Duck();", "debugDuck.quack();", "// TODO: more tests",
];
this.corrupted = [];     // Indizes korrumpierter Zeilen
```
In `onEscape(bug)` ergänzen: `this.corrupted.push((this.corrupted.length * 3 + 2) % this.codeLines.length);` (markiert eine Zeile pro Korruption).

- [ ] **Step 2: `drawBackground(ctx)`-Methode + Aufruf**

```js
drawBackground(ctx) {
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, this.W, this.H);
  // Gutter
  ctx.fillStyle = "#161b22";
  ctx.fillRect(0, 0, 44, this.H);
  ctx.textAlign = "left";
  ctx.font = "15px ui-monospace, monospace";
  for (let i = 0; i < this.codeLines.length; i++) {
    const y = 80 + i * 30;
    ctx.fillStyle = "#6e7681";
    ctx.fillText(String(i + 1).padStart(2, " "), 12, y);
    const isBad = this.corrupted.includes(i);
    ctx.fillStyle = isBad ? "#f85149" : "#3b4048";          // korrumpiert = rot
    let line = this.codeLines[i];
    if (isBad) line = line.replace(/[a-z]/gi, (c) => (((i + y) % 3) ? c : "▓"));  // glitch
    ctx.fillText(line, 56, y);
  }
  // Editor-Boden-Linie
  ctx.strokeStyle = "#30363d"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, CONFIG.floorY); ctx.lineTo(this.W, CONFIG.floorY); ctx.stroke();
  // Blinkender Cursor am Ende der letzten Zeile
  if ((Math.floor(this.time * 2) % 2) === 0) {
    ctx.fillStyle = "#7ee787";
    const lastW = ctx.measureText(this.codeLines[this.codeLines.length - 1]).width;
    ctx.fillRect(56 + lastW + 2, 80 + (this.codeLines.length - 1) * 30 - 12, 8, 16);
  }
}
```

In `draw(ctx)`: im PLAYING/PAUSED-Zweig zuerst `this.drawBackground(ctx);` statt des einfachen `fillRect`. (TITLE/GAMEOVER nutzen ihn in Task 11 als gedimmten Hintergrund.)

- [ ] **Step 3: Verifizieren**

Browser: IDE-Look (Zeilennummern, grauer Code, blinkender Cursor, Bodenlinie). Bug am Boden → eine Zeile wird rot + glitcht. Bugs bleiben gut lesbar (Kontrast). Keine Fehler.

- [ ] **Step 4: Commit + Push**

```bash
git add -A
git commit -m "feat: fake-IDE hintergrund + code-zeilen-korruption"
git push origin main
```

---

## Task 11: Screens-Politur + Best-Score (localStorage)

**Files:**
- Modify: `game.js` (Title/Pause/GameOver feiner, localStorage)

- [ ] **Step 1: Best-Score robust laden/speichern**

In `game.js` Helfer:

```js
loadBest() { try { return parseInt(localStorage.getItem("rdd_best") || "0", 10) || 0; } catch { return 0; } }
saveBest() { try { localStorage.setItem("rdd_best", String(this.best)); } catch { /* privater modus: nur in-memory */ } }
```
Konstruktor: `this.best = this.loadBest();` (ersetzt `this.best = 0;`). In `gameOver()` nach Best-Update: `this.saveBest();`.

- [ ] **Step 2: Title-Screen ausbauen**

```js
// TITLE-Zweig in draw()
this.drawBackground(ctx);
ctx.fillStyle = "rgba(13,17,23,0.78)"; ctx.fillRect(0, 0, this.W, this.H);
ctx.textAlign = "center";
ctx.fillStyle = "#ffd23f"; ctx.font = "44px ui-monospace, monospace";
ctx.fillText("🦆 Rubber Duck Debugger", this.W / 2, 190);
ctx.fillStyle = "#c9d1d9"; ctx.font = "18px ui-monospace, monospace";
ctx.fillText("Erklär dem Entchen deinen Bug.", this.W / 2, 230);
ctx.fillStyle = "#8b949e"; ctx.font = "15px ui-monospace, monospace";
ctx.fillText("Maus / Pfeile = bewegen   •   Klick / Leertaste = Erklär-Strahl", this.W / 2, 300);
ctx.fillText("Schieß Bugs ab, bevor sie deinen Code korrumpieren.", this.W / 2, 326);
ctx.fillStyle = "#7ee787"; ctx.font = "20px ui-monospace, monospace";
ctx.fillText("Klick zum Start", this.W / 2, 400);
ctx.fillStyle = "#8b949e"; ctx.font = "14px ui-monospace, monospace";
ctx.fillText(`Best: ${this.best}`, this.W / 2, 440);
```

- [ ] **Step 3: GameOver- + Pause-Screen feiner**

```js
// GAMEOVER
this.drawBackground(ctx);
ctx.fillStyle = "rgba(13,17,23,0.82)"; ctx.fillRect(0, 0, this.W, this.H);
ctx.textAlign = "center";
ctx.fillStyle = "#f85149"; ctx.font = "46px ui-monospace, monospace";
ctx.fillText("BUILD BROKEN", this.W / 2, 230);
ctx.fillStyle = "#c9d1d9"; ctx.font = "22px ui-monospace, monospace";
ctx.fillText(`Score: ${this.score}`, this.W / 2, 290);
ctx.fillText(`Best: ${this.best}`, this.W / 2, 322);
ctx.fillText(`Welle: ${this.wave}`, this.W / 2, 354);
ctx.fillStyle = "#7ee787"; ctx.font = "18px ui-monospace, monospace";
ctx.fillText("R / Klick = neu starten", this.W / 2, 420);
```
Pause-Overlay: über den (eingefrorenen) PLAYING-Frame ein halbtransparentes Rechteck + "⏸ Pause — P/Esc weiter". Dafür im PAUSED-Zweig zuerst denselben PLAYING-Render (Background+Entities+HUD) zeichnen, dann Overlay drauf.

- [ ] **Step 4: Verifizieren**

Browser: Title mit Anleitung + Best. Spielen, Highscore schlagen, neu laden → Best bleibt (localStorage). Privater Modus → kein Crash. Pause-Overlay sauber über dem Spielstand. Keine Fehler.

- [ ] **Step 5: Commit + Push**

```bash
git add -A
git commit -m "feat: screens-politur (title/pause/gameover) + localStorage best-score"
git push origin main
```

---

## Task 12: Finale Politur, Responsive/Crispness, Playtest, Konsolen-Check

**Files:**
- Modify: `main.js` (devicePixelRatio-Scaling), `config.js` (Tuning nach Playtest), `AUDIT.md`

- [ ] **Step 1: High-DPI-Schärfe in `main.js`**

```js
function setupHiDPI() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CONFIG.canvas.w * dpr;
  canvas.height = CONFIG.canvas.h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // ab jetzt in interne 800x600-Koordinaten zeichnen
}
setupHiDPI();
```
Wichtig: `draw()` nutzt nur `translate` (Shake) innerhalb von save/restore → die per `setTransform` gesetzte DPR-Basis bleibt erhalten. `draw()` darf selbst KEIN `setTransform` aufrufen.

- [ ] **Step 2: Playtest-Tuning**

Spiele 3–4 Runden. Justiere in `config.js` nur Werte (keine Logik): Bug-Tempo (`vy`), Spawn-Intervall, Beam-Cooldown, Boss-HP, Combo-Cap — bis es sich fair + fordernd anfühlt. Pro spürbarer Änderung committen.

- [ ] **Step 3: Automatischer Konsolen-/Smoke-Check (webapp-testing / Playwright-MCP)**

Lokalen Server starten, Seite laden, Screenshot, **Konsole auf Errors/404 prüfen**, einen Klick (Start) simulieren, ~2 s laufen lassen, erneut Screenshot + Konsole. Erwartet: keine Errors, Gameplay sichtbar.

- [ ] **Step 4: `tests/mechanics.test.js` final grün**

Run: `node --test`
Erwartet: PASS.

- [ ] **Step 5: `AUDIT.md` aktualisieren** (Stand = "Spiel fertig, lokal verifiziert", nächster Schritt = Deploy).

- [ ] **Step 6: Commit + Push**

```bash
git add -A
git commit -m "polish: hi-dpi, tuning, smoke-check, audit-update"
git push origin main
```

---

## Task 13: Deploy auf Vercel + Live-Verifikation

**Files:** keine Code-Änderung (außer evtl. Fixes aus Live-Check).

- [ ] **Step 1: Deploy-Prompt aus `README.md` ausführen**

Den im README hinterlegten Deploy-Prompt benutzen. Kernschritte: alles committed/gepusht prüfen
(`git status` sauber, `git log origin/main..HEAD` leer) → Vollständigkeit aller Dateien → lokal als
Referenz testen → Stolperfallen (Pfad-Groß/Kleinschreibung, relative Pfade) → `npx vercel` Deploy
**als statische Seite** (kein Build-Step; `package.json` hat keinen build-script) → Live-URL öffnen,
Konsole auf 404/Fehler prüfen, gegen Lokal abgleichen → bei Abweichung fixen/neu deployen.

- [ ] **Step 2: Live verifizieren (Playwright-MCP)**

Live-URL laden, Start klicken, spielen, **Konsole prüfen** (keine 404 auf `*.js`). Identisch zu lokal?

- [ ] **Step 3: Abgabe vorbereiten**

Repo-Link + Live-Link notieren für den Community-Abgabe-Thread (vor **Dienstag 18:00**).

---

## Self-Review (vom Plan-Autor)

**Spec-Coverage:** Pitch/Loop → T3–T9. State-Machine (§4) → T3. Entities (§5) → T4/5/6/8/9. Systeme (§6) → T5–T9. Bug-Typen+Boss (§7) → T6/T8. Juice (§8) → T9/T10. HUD/UI (§9) → T7/T11. Tech/Dateien (§10) → T1. Error-Handling (§11) → AudioContext T9, localStorage T11, dt-clamp T3, pointer-mapping T3, visibility-pause T3, hi-DPI T12. Testing (§12) → T2 (unit), T12/T13 (smoke/live). Scope (§13) → eingehalten, Stretch ausgelassen. Build-Reihenfolge (§14) → Task-Reihenfolge. **Keine Lücke.**

**Placeholder-Scan:** keine TBD/TODO im Plan. Das `// TODO: more tests` ist bewusster Flavor-Text im Fake-Code (Hintergrund), kein Plan-Platzhalter. Render-lastige draw-Funktionen enthalten echten, lauffähigen Code; Pixel-Tuning ist explizit Playtest (T12), kein Platzhalter.

**Typ-Konsistenz:** Bug/Boss teilen die Felder `x,y,r,hp,points,color,label,flash,dead,escaped,isBoss` + Methoden `update(dt,time)`, `hit(dmg)`, `draw(ctx,time)`. `Beam`: `x,y,len,width,dead` + `update(dt)`/`draw(ctx)`. `Duck`: `x,y,w,h,recoil` + `update(dt,input)`/`triggerRecoil()`/`muzzle()`/`draw(ctx)`. `mechanics`-Signaturen identisch zwischen T2-Definition und Aufrufen (T6/T7). `Game.sound` wird seit T3 im Konstruktor injiziert, überall via `this.sound?.xxx()`. `STATE`-Enum durchgängig. `this.time` in T6 eingeführt, in T8/T9/T10 genutzt.
