# Wow-Polish-Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rubber Duck Debugger optisch/akustisch/feel-mäßig auf „premium" heben (mehr Wow), rein additiv, ohne die getestete Spiel-Logik zu destabilisieren.

**Architecture:** Strategie A — geschichteter Juice-Pass. Nur Render- (`game.js`, `entities.js`), Audio- (`audio.js`), Input- (`main.js`) und billige `CONFIG`-Hooks. `mechanics.js` bleibt rein; eine neue reine Funktion (`tokenizeLine`) wird per node:test mitgetestet. Jeder Task = eigener Commit + Push auf `wow-polish`.

**Tech Stack:** Vanilla ES-Module, Canvas 2D, WebAudio-Synth, `node:test`. Keine externen Assets. Branch `wow-polish` (off `main`), `main` = abgabefähiger Fallback.

**Verifikation pro Task (immer):**
```bash
for f in *.js; do node --check "$f" || exit 1; done
node --test tests/mechanics.test.js
node tests/smoke.mjs
```
Optik/Feel/Audio zusätzlich = manueller Browser-Playtest durch Calvin (am Ende von Task 7).

**Spec:** `docs/superpowers/specs/2026-06-22-wow-polish-sprint-design.md`

---

## Task 1: Headless-Smoke-Harness (Sicherheitsnetz)

Render-Crashes (z.B. undefiniertes `ctx`-Feld) sollen headless auffallen, nicht erst im Browser. Stub-`ctx`, dann jeden State zeichnen + viele Frames Spiel simulieren.

**Files:**
- Create: `tests/smoke.mjs`

- [ ] **Step 1: Smoke-Skript schreiben**

```js
// tests/smoke.mjs — headless Render/Update-Smoke gegen Stub-ctx (kein DOM nötig).
import { Game, STATE } from "../game.js";

function stubCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(_, p) {
      if (p === "measureText") return (s) => ({ width: String(s).length * 7 });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => grad;
      if (p === "createPattern") return () => ({});
      return () => {};            // jede Methode = no-op
    },
    set() { return true; },        // jede Property-Zuweisung schlucken
  });
}

const ctx = stubCtx();
const g = new Game(null);          // ohne Sound

// 1) jeden State zeichnen
for (const s of Object.values(STATE)) { g.state = s; g.draw(ctx); }

// 2) eine Runde simulieren (Spawns, Wellen, Boss, Escapes, GameOver-Pfad)
g.start();
for (let i = 0; i < 1800; i++) {
  g.update(1 / 60);
  if (i % 7 === 0) g.handleChar("/");   // Typing-Pfad + syntaxError anstoßen
  if (i % 7 === 1) g.handleChar("h");
  if (i % 50 === 0) g.handleBackspace();
  g.draw(ctx);
}

console.log("smoke ok");
```

- [ ] **Step 2: Smoke laufen lassen**

Run: `node tests/smoke.mjs`
Expected: Ausgabe `smoke ok`, Exit-Code 0, kein Stacktrace.

- [ ] **Step 3: Bestehende Tests + Syntax prüfen**

Run: `node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done`
Expected: `pass 19`, alle Files ohne Fehler.

- [ ] **Step 4: Commit + Push**

```bash
git add tests/smoke.mjs
git commit -m "test(smoke): headless render/update smoke gegen Stub-ctx"
git push origin wow-polish
```

---

## Task 2: Syntax-Farben im Code-Hintergrund  *(Look)*

Tokenizer als reine Funktion (testbar) + farbige Render-Schleife in `drawBackground`. Hintergrund-Code wird gedimmt gezeichnet (`globalAlpha`), damit er Background bleibt.

**Files:**
- Modify: `mechanics.js` (neue Funktion `tokenizeLine`)
- Modify: `tests/mechanics.test.js` (3 Tests)
- Modify: `game.js` (Import + `drawBackground` Render-Schleife)

- [ ] **Step 1: Failing-Test schreiben**

In `tests/mechanics.test.js` zuoberst den Import ergänzen (zur bestehenden Import-Zeile aus `../mechanics.js` `tokenizeLine` hinzufügen), dann ans Dateiende anhängen:

```js
test("tokenizeLine reconstructs the original line exactly", () => {
  const line = "const debugDuck = new Duck();";
  const toks = tokenizeLine(line);
  assert.equal(toks.map((t) => t.text).join(""), line);
});

test("tokenizeLine colors keywords and comments", () => {
  const kw = tokenizeLine("  return clean;");
  const ret = kw.find((t) => t.text === "return");
  assert.equal(ret.color, "#ff7b72");
  const c = tokenizeLine("// TODO: more tests");
  assert.equal(c[0].text, "// TODO: more tests");
  assert.equal(c[0].color, "#8b949e");
});

test("tokenizeLine flags function-call names", () => {
  const toks = tokenizeLine("debugDuck.quack();");
  const quack = toks.find((t) => t.text === "quack");
  assert.equal(quack.color, "#d2a8ff");
});
```

- [ ] **Step 2: Test laufen lassen → muss fehlschlagen**

Run: `node --test tests/mechanics.test.js`
Expected: FAIL — `tokenizeLine is not a function` / Import-Fehler.

- [ ] **Step 3: `tokenizeLine` implementieren**

Ans Ende von `mechanics.js` anhängen:

```js
// Zerlegt eine Code-Zeile in farbige Tokens (GitHub-Dark-Palette). Rein → unit-testbar.
// Join aller token.text ergibt exakt die Eingabe (inkl. Whitespace).
export function tokenizeLine(line) {
  const KEYWORDS = ["function", "while", "if", "else", "return", "const", "let", "var", "new", "for"];
  const re = /(\/\/.*$)|("[^"]*"|'[^']*'|`[^`]*`)|([A-Za-z_$][\w$]*)|(\d+)|(\s+)|([^\w\s])/g;
  const tokens = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m[1]) tokens.push({ text: m[1], color: "#8b949e" });            // Kommentar
    else if (m[2]) tokens.push({ text: m[2], color: "#a5d6ff" });       // String
    else if (m[3]) {
      if (KEYWORDS.includes(m[3])) tokens.push({ text: m[3], color: "#ff7b72" });
      else {
        const after = line.slice(re.lastIndex);                         // Funktionsname wenn "(" folgt
        tokens.push({ text: m[3], color: /^\s*\(/.test(after) ? "#d2a8ff" : "#c9d1d9" });
      }
    } else if (m[4]) tokens.push({ text: m[4], color: "#79c0ff" });     // Zahl
    else if (m[5]) tokens.push({ text: m[5], color: "#c9d1d9" });       // Whitespace (zeichnet nichts)
    else if (m[6]) tokens.push({ text: m[6], color: "#c9d1d9" });       // Satzzeichen/Operator
  }
  return tokens;
}
```

- [ ] **Step 4: Test laufen lassen → muss bestehen**

Run: `node --test tests/mechanics.test.js`
Expected: `pass 22`.

- [ ] **Step 5: Render-Schleife in `game.js`**

Import-Zeile aus `./mechanics.js` um `tokenizeLine` ergänzen. Dann in `drawBackground` die Code-Zeilen-Schleife (aktuell Zeilen ~315–324) ersetzen durch:

```js
    for (let i = 0; i < this.codeLines.length; i++) {
      const y = 80 + i * 30;
      ctx.fillStyle = "#6e7681";
      ctx.fillText(String(i + 1).padStart(2, " "), 12, y);
      const isBad = this.corrupted.includes(i);
      if (isBad) {
        let line = this.codeLines[i].replace(/[a-z]/gi, (c) => (((i + y) % 3) ? c : "▓"));
        ctx.fillStyle = "#f85149";
        ctx.fillText(line, 56, y);                          // korrumpiert = rot, Vorrang
      } else {
        ctx.save();
        ctx.globalAlpha = 0.55;                             // gedimmt → bleibt Hintergrund
        let x = 56;
        for (const tok of tokenizeLine(this.codeLines[i])) {
          ctx.fillStyle = tok.color;
          ctx.fillText(tok.text, x, y);
          x += ctx.measureText(tok.text).width;
        }
        ctx.restore();
      }
    }
```

- [ ] **Step 6: Verifikation (Smoke + Syntax)**

Run: `node tests/smoke.mjs && for f in *.js; do node --check "$f"; done`
Expected: `smoke ok`, keine Fehler.

- [ ] **Step 7: Commit + Push**

```bash
git add mechanics.js tests/mechanics.test.js game.js
git commit -m "feat(look): Syntax-Highlighting im Code-Hintergrund (+3 tokenize-Tests)"
git push origin wow-polish
```

---

## Task 3: Per-Tastendruck-Juice + Hit-Stop + Schockwellen-Ring  *(Feel)*

Taktiles Feedback pro korrektem Buchstabe, kurzer Impact-Freeze beim Kill, Schockwellen-Ring. Neue `Ring`-Entity (rein kosmetisch).

**Files:**
- Modify: `entities.js` (neue Klasse `Ring`)
- Modify: `game.js` (Import, `reset`, `handleChar`, `onKill`, `update`, `drawTerminal`, `drawPlayfield`)

- [ ] **Step 1: `Ring`-Entity**

Ans Ende von `entities.js` anhängen:

```js
export class Ring {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color;
    this.life = 0.4; this.max = 0.4; this.dead = false;
  }
  update(dt) { this.life -= dt; if (this.life <= 0) this.dead = true; }
  draw(ctx) {
    const p = 1 - this.life / this.max;                 // 0 → 1 expandierend
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.max) * 0.7;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6 + p * 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
```

- [ ] **Step 2: Import + State in `game.js`**

Import-Zeile aus `./entities.js` um `Ring` ergänzen. In `reset()` hinzufügen:

```js
    this.rings = [];
    this.hitstop = 0;       // > 0 = kurzer Impact-Freeze des Spielfelds
    this.typedPunch = 0;    // > 0 = Terminal-Text-Bounce nach Tastendruck
```

- [ ] **Step 3: Juice in `handleChar` (Match-Zweig)**

In `handleChar`, direkt nach `this.target.typedLen = this.typed.length;` einfügen:

```js
    this.target.flash = 0.08;                              // Ziel blitzt kurz weiß
    this.shake = Math.max(this.shake, 0.05);               // Mini-Screen-Kick
    this.typedPunch = 0.12;                                // Terminal-Bounce
```

- [ ] **Step 4: Hit-Stop + Ring beim Kill**

In `onKill(bug)` direkt nach `this.combo += 1;` einfügen:

```js
    this.hitstop = 0.05;
    this.rings.push(new Ring(bug.x, bug.y, bug.color));
```

- [ ] **Step 5: Hit-Stop + Timer-Decay in `update`**

In `update(dt)` direkt nach `this.time += dt;` (vor `if (this.wave === 0)`) einfügen:

```js
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); dt *= 0.1; }
    if (this.typedPunch > 0) this.typedPunch = Math.max(0, this.typedPunch - dt);
```

Im Juice-Block von `update` (wo `particles`/`texts` getickt werden) ergänzen:

```js
    for (const r of this.rings) r.update(dt);
    this.rings = this.rings.filter((r) => !r.dead);
```

- [ ] **Step 6: Ringe zeichnen + Terminal-Bounce**

In `drawPlayfield`, nach `for (const p of this.particles) p.draw(ctx);` einfügen:

```js
    for (const r of this.rings) r.draw(ctx);
```

In `drawTerminal`, die getippte Zeile mit Bounce-Offset zeichnen — ersetze
`ctx.fillText(this.typed, 40, y);` durch:

```js
    const dy = this.typedPunch > 0 ? -Math.sin((1 - this.typedPunch / 0.12) * Math.PI) * 3 : 0;
    ctx.fillText(this.typed, 40, y + dy);
```

- [ ] **Step 7: Verifikation**

Run: `node tests/smoke.mjs && node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done`
Expected: `smoke ok`, `pass 22`, keine Fehler.

- [ ] **Step 8: Commit + Push**

```bash
git add entities.js game.js
git commit -m "feat(feel): Per-Tastendruck-Juice, Hit-Stop, Schockwellen-Ring"
git push origin wow-polish
```

---

## Task 4: CRT-Scanlines + Vignette  *(Look — Post-Process)*

Bildschirmweiter Post-Process-Layer (über allen States), tunebar via neuem `CONFIG.fx`. Wird nach `ctx.restore()` gezeichnet → bleibt screen-space (kein Shake).

> **Premortem-Mitigation (High):** FX darf die spielkritischen Texte NICHT überdecken — fallende Bug-`/command`-Labels + Terminal-Prompt müssen klar lesbar bleiben, besonders an den Rändern (Vignette dort am dunkelsten). `CONFIG.fx.vignette`/`scanlineAlpha` sind ein **tunebarer Deckel**: im Playtest-Gate verifizieren, im Zweifel senken.

**Files:**
- Modify: `config.js` (neuer `fx`-Block)
- Modify: `game.js` (`drawFX` + Aufruf in `draw`)

- [ ] **Step 1: `CONFIG.fx`**

In `config.js` vor der schließenden `};` von `CONFIG` einfügen (Komma nach dem vorherigen Eintrag beachten):

```js
  fx: { scanlineAlpha: 0.06, scanlineGap: 3, vignette: 0.34, flowThreshold: 4 },
```

- [ ] **Step 2: `drawFX` in `game.js`**

Neue Methode vor `draw(ctx)` einfügen:

```js
  // Post-Process über ALLE States: radiale Vignette + CRT-Scanlines. Screen-space.
  drawFX(ctx) {
    const fx = CONFIG.fx;
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.32, this.W / 2, this.H / 2, this.H * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${fx.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = `rgba(0,0,0,${fx.scanlineAlpha})`;
    for (let y = 0; y < this.H; y += fx.scanlineGap) ctx.fillRect(0, y, this.W, 1);
  }
```

- [ ] **Step 3: Aufruf in `draw`**

In `draw(ctx)` die abschließende Zeile `ctx.restore();` (am Ende, nach dem State-`if`) so erweitern:

```js
    ctx.restore();
    this.drawFX(ctx);     // Post-Process zuletzt, screen-space (kein Shake-Jitter)
  }
```

- [ ] **Step 4: Verifikation**

Run: `node tests/smoke.mjs && node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done`
Expected: `smoke ok`, `pass 22`, keine Fehler.

- [ ] **Step 5: Commit + Push**

```bash
git add config.js game.js
git commit -m "feat(look): CRT-Scanlines + Vignette Post-Process"
git push origin wow-polish
```

---

## Task 5: Audio-Overhaul + Mute  *(Audio)*

`audio.js` erweitern (Key-Klick mit Combo-Tonhöhe, Combo-Arpeggio), Mute-Flag, klickbares Mute-Icon (in ALLEN States). **Bewusste Abweichung von der Spec:** Mute per Icon-Klick statt `M`-Taste — `m` ist Bestandteil mehrerer Commands (`/model`, `/memory`, `/mcp`, `/compact`), eine `M`-Taste würde im Spiel mit dem Tippen kollidieren.

**Files:**
- Modify: `audio.js` (`muted`, `setMuted`, `keyClick`, `comboUp`)
- Modify: `game.js` (`muted`, `toggleMute`, `muteIconRect`, `hitMute`, `drawMute`, Aufruf in `handleChar`/`update`/`draw`)
- Modify: `main.js` (Klick-Hit-Test + Koordinaten-Mapping)

- [ ] **Step 1: `audio.js` erweitern**

Im `Sound`-Konstruktor `this.muted = false;` ergänzen. In `blip(...)` die erste Zeile ändern zu:

```js
    if (!this.ok || this.muted) return;
```

Neue Methoden in der Klasse hinzufügen:

```js
  setMuted(m) { this.muted = m; }
  keyClick(combo) { this.blip(300 + Math.min(combo, 14) * 36, 0.035, "square", 0.025); }
  comboUp(tier) {
    const base = 480 + tier * 55;
    for (let i = 0; i < 3; i++) this.blip(base * (1 + i * 0.26), 0.09, "sine", 0.035);
  }
```

- [ ] **Step 2: Mute-State + Icon-Geometrie in `game.js`**

In `reset()` ergänzen: `this.muted = this.sound ? this.sound.muted : false;`
Methoden vor `update` einfügen:

```js
  toggleMute() { this.muted = !this.muted; this.sound?.setMuted(this.muted); }
  muteIconRect() { return { x: this.W - 46, y: this.H - 30, w: 36, h: 26 }; }
  hitMute(px, py) {
    const r = this.muteIconRect();
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }
  drawMute(ctx) {
    const r = this.muteIconRect();
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "20px ui-monospace, monospace";
    ctx.fillStyle = "#8b949e";
    ctx.fillText(this.muted ? "🔇" : "🔊", r.x + r.w / 2, r.y + r.h - 6);
    ctx.restore();
  }
```

- [ ] **Step 3: Key-Klick beim Tippen**

In `handleChar`, die Zeile `this.sound?.fire();` ersetzen durch:

```js
    this.sound?.fire();
    this.sound?.keyClick(this.combo);
```

- [ ] **Step 4: Combo-Arpeggio in `update`**

In `reset()` `this._mult = 1;` ergänzen. In `update(dt)`, im Combo-Block (nach dem Combo-Timeout-Decay), einfügen:

```js
    const mult = this.multiplier();
    if (mult > this._mult) this.sound?.comboUp(mult);
    this._mult = mult;
```

- [ ] **Step 5: Mute-Icon zeichnen (global)**

In `draw(ctx)`, NACH `this.drawFX(ctx);` einfügen:

```js
    this.drawMute(ctx);   // immer sichtbar/klickbar, über dem Post-Process
```

- [ ] **Step 6: Klick-Hit-Test in `main.js`**

Den `canvas`-`mousedown`-Listener ersetzen durch:

```js
function eventToCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * CONFIG.canvas.w,
    y: ((e.clientY - r.top) / r.height) * CONFIG.canvas.h,
  };
}

canvas.addEventListener("mousedown", (e) => {
  const p = eventToCanvas(e);
  if (game.hitMute(p.x, p.y)) { game.toggleMute(); return; }   // Mute zuerst, in jedem State
  if (game.state !== STATE.PLAYING) game.confirm();            // sonst Start/Skip/Restart
});
```

- [ ] **Step 7: Verifikation**

Run: `node tests/smoke.mjs && node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done`
Expected: `smoke ok`, `pass 22`, keine Fehler.

- [ ] **Step 8: Commit + Push**

```bash
git add audio.js game.js main.js
git commit -m "feat(audio): Key-Klick mit Combo-Pitch, Combo-Arpeggio, klickbares Mute-Icon"
git push origin wow-polish
```

---

## Task 6: Combo-Crescendo / Flow-State  *(Feel + Look) — Signatur-Moment*

Bei hohem Multiplikator grüner Rand-Glow (Intensität skaliert) + einmaliger „IN THE ZONE"-Banner beim Erreichen des Caps.

**Files:**
- Modify: `game.js` (`update` Banner-Trigger, `drawFlow` + Aufruf)

- [ ] **Step 1: Flow-Banner-Trigger in `update`**

In `update(dt)`, den in Task 5 eingefügten Combo-Block erweitern zu:

```js
    const mult = this.multiplier();
    if (mult > this._mult) {
      this.sound?.comboUp(mult);
      if (mult >= CONFIG.combo.multCap && this._mult < CONFIG.combo.multCap) {
        this.texts.push(new FloatingText(this.W / 2, this.H / 2 - 60, "⚡ IN THE ZONE", "#7ee787"));
      }
    }
    this._mult = mult;
```

(`this._mult` wird in `reset()` bereits auf 1 gesetzt — Task 5. Bricht die Combo, fällt `multiplier()` auf 1, `_mult` folgt → Banner kann erneut triggern.)

- [ ] **Step 2: `drawFlow` in `game.js`**

Neue Methode vor `draw` einfügen:

```js
  // Flow-State: ab Schwelle grüner Rand-Glow, Intensität ∝ Multiplikator, im Takt pulsierend.
  drawFlow(ctx) {
    const mult = this.multiplier();
    if (mult < CONFIG.fx.flowThreshold) return;
    const span = CONFIG.combo.multCap - CONFIG.fx.flowThreshold + 1;
    const intensity = Math.min(1, (mult - CONFIG.fx.flowThreshold + 1) / span);
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 8);
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.34, this.W / 2, this.H / 2, this.H * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(126,231,135,${0.22 * intensity * pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  }
```

- [ ] **Step 3: Aufruf in `draw` (nur PLAYING, vor Post-Process)**

In `draw(ctx)`, zwischen `ctx.restore();` und `this.drawFX(ctx);` einfügen:

```js
    if (this.state === STATE.PLAYING) this.drawFlow(ctx);
```

- [ ] **Step 4: Verifikation**

Run: `node tests/smoke.mjs && node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done`
Expected: `smoke ok`, `pass 22`, keine Fehler.

- [ ] **Step 5: Commit + Push**

```bash
git add game.js
git commit -m "feat(feel): Combo-Crescendo / Flow-State Rand-Glow + IN-THE-ZONE-Banner"
git push origin wow-polish
```

---

## Task 7: Title + Game-Over Reskin  *(Look) — erster & letzter Eindruck*

Glühender animierter Title; Game-Over als Build-Log mit `bugs leaked`, `exit code 1` und „NEW HIGH SCORE".

**Files:**
- Modify: `game.js` (`reset`, `onEscape`, `gameOver`, `drawTitle`, `drawGameOver`)

- [ ] **Step 1: State für Log-Zeilen**

In `reset()` ergänzen: `this.leaked = 0; this.newBest = false;`
In `onEscape(bug)` direkt nach `this.lives -= 1;` ergänzen: `this.leaked += 1;`

- [ ] **Step 2: `gameOver` → New-Best-Erkennung**

`gameOver()` ersetzen durch:

```js
  gameOver() {
    this.state = STATE.GAMEOVER;
    this.newBest = this.score > this.best;
    if (this.newBest) { this.best = this.score; this.saveBest(); }
    this.sound?.gameOver();
    if (this.newBest) this.sound?.waveClear();   // Belohnungs-Chime für neue Bestmarke
  }
```

- [ ] **Step 3: `drawTitle` mit Glow**

In `drawTitle(ctx)` den Logo-Block (die `fillText("🦆 Rubber Duck Debugger", …)`-Zeile samt zugehörigem `fillStyle`/`font`) ersetzen durch:

```js
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    ctx.save();
    ctx.fillStyle = "#ffd23f";
    ctx.font = "44px ui-monospace, monospace";
    ctx.shadowColor = "#ffd23f";
    ctx.shadowBlur = 12 + pulse * 18;                       // pulsierender Glow
    ctx.fillText("🦆 Rubber Duck Debugger", this.W / 2, 190);
    ctx.restore();
```

In derselben Funktion „Klick zum Start" blinken lassen — die Zeile
`ctx.fillText("Klick zum Start", this.W / 2, 430);` ersetzen durch:

```js
    if ((Math.floor(this.time * 2) % 2) === 0) ctx.fillText("▶ Klick zum Start", this.W / 2, 430);
```

- [ ] **Step 4: `drawGameOver` als Build-Log**

`drawGameOver(ctx)` ersetzen durch:

```js
  drawGameOver(ctx) {
    this.drawBackground(ctx);
    ctx.fillStyle = "rgba(13,17,23,0.85)"; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f85149"; ctx.font = "46px ui-monospace, monospace";
    ctx.save(); ctx.shadowColor = "#f85149"; ctx.shadowBlur = 16;
    ctx.fillText("✗ BUILD BROKEN", this.W / 2, 200); ctx.restore();
    // Build-Log
    ctx.textAlign = "left"; ctx.font = "18px ui-monospace, monospace";
    const cx = this.W / 2 - 150; let ly = 260;
    const log = [
      ["$ ", "#7ee787", "npm run debug", "#c9d1d9"],
      ["  bugs leaked: ", "#8b949e", String(this.leaked), "#f85149"],
      ["  waves cleared: ", "#8b949e", String(this.wave), "#c9d1d9"],
      ["  score: ", "#8b949e", String(this.score), "#ffd23f"],
      ["  best: ", "#8b949e", String(this.best), "#c9d1d9"],
      ["✗ ", "#f85149", "exit code 1", "#8b949e"],
    ];
    for (const [a, ca, b, cb] of log) {
      ctx.fillStyle = ca; ctx.fillText(a, cx, ly);
      ctx.fillStyle = cb; ctx.fillText(b, cx + ctx.measureText(a).width, ly);
      ly += 28;
    }
    if (this.newBest) {
      ctx.textAlign = "center"; ctx.fillStyle = "#ffd23f"; ctx.font = "22px ui-monospace, monospace";
      ctx.save(); ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 12;
      ctx.fillText("★ NEW HIGH SCORE ★", this.W / 2, ly + 16); ctx.restore();
      ly += 28;
    }
    ctx.textAlign = "center"; ctx.fillStyle = "#7ee787"; ctx.font = "18px ui-monospace, monospace";
    if ((Math.floor(this.time * 2) % 2) === 0) ctx.fillText("› Enter / Klick = neu starten", this.W / 2, ly + 40);
  }
```

- [ ] **Step 5: Verifikation**

Run: `node tests/smoke.mjs && node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done`
Expected: `smoke ok`, `pass 22`, keine Fehler.

- [ ] **Step 6: Commit + Push**

```bash
git add game.js
git commit -m "feat(look): Title-Glow + Game-Over als Build-Log mit New-High-Score"
git push origin wow-polish
```

---

## Task 7-Gate: Browser-Playtest (MUSS vor Merge)

- [ ] **Calvin spielt 3–4 Runden** (`python3 -m http.server 8000 --directory .` → http://localhost:8000):
  - Konsole error/404-frei über Intro → Play → Boss → GameOver → Restart.
  - **(Premortem-High) Spielkritische Texte lesbar:** fallende Bug-`/command`-Labels **und** Terminal-Prompt
    trotz Scanlines/Vignette/Flow-Glow klar lesbar — explizit an den **Rändern** (Vignette am dunkelsten)
    und bei aktivem **grünem Flow-Glow** (grün-auf-grün-Labels prüfen). Wenn unklar: `CONFIG.fx.vignette` +
    `CONFIG.fx.scanlineAlpha` senken, Flow-Glow-Alpha (0.22-Faktor in `drawFlow`) reduzieren.
  - Code-Highlighting im Hintergrund sichtbar, aber dezent (bleibt Background, lenkt nicht ab).
  - Tippen fühlt sich taktil an (Key-Klick, Kick, Bounce), Kill wuchtig (Ring, Hit-Stop **ohne Stottern**
    bei Kill-Salven — sonst `this.hitstop` in Task 3 auf 0.03 senken).
  - Audio gut, Key-Klick **nicht ermüdend/zu laut** (sonst gain senken), Mute-Icon klickbar in allen States.
  - Flow-State-Glow + „IN THE ZONE" sichtbar bei hoher Combo.
  - **Framerate flüssig** trotz FX (sonst Scanlines als `createPattern` cachen).
- [ ] Falls nötig: nur Tuning-Werte in `CONFIG.fx`/`CONFIG` justieren, committen, pushen.
- [ ] **Merge nach `main` + Deploy** (erst nach bestandenem Playtest):
  ```bash
  git checkout main && git merge --no-ff wow-polish && git push origin main
  # danach Deploy durch Calvin: ! npx vercel   (interaktiver Login)
  ```

---

## STRETCH (nur bei Restzeit, nach A komplett + gemerged) — Strategie B/C

### Task 8 (STRETCH/B): Neue Spezial-Commands `/undo` + `/review`

**Files:** Modify `config.js` (`specials`), `game.js` (`applySpecial`).

- [ ] **Step 1:** In `config.js` dem `specials`-Array hinzufügen:

```js
    { command: "/undo",   effect: "heal",     r: 16, vy: 50, points: 200, color: "#a5d6ff" },
    { command: "/review", effect: "killdeep", r: 16, vy: 50, points: 300, color: "#d2a8ff" },
```

- [ ] **Step 2:** In `game.js:applySpecial(effect, src)` vor der schließenden `}` zwei Zweige ergänzen:

```js
    else if (effect === "heal") {
      if (this.corrupted.length) {
        this.corrupted.pop();                              // eine korrumpierte Zeile heilen
        this.texts.push(new FloatingText(this.W / 2, this.H / 2, "↩ /undo — LINE RESTORED", "#a5d6ff"));
      } else {
        this.score += 200;
        this.texts.push(new FloatingText(src.x, src.y - 20, "+200", "#a5d6ff"));
      }
    } else if (effect === "killdeep") {
      let deep = null;
      for (const b of this.bugs) {
        if (b === src || b.dead || b.escaped || b.isBoss) continue;
        if (!deep || b.y > deep.y) deep = b;               // tiefster (gefährlichster) Bug
      }
      if (deep) {
        deep.dead = true;
        this.rings.push(new Ring(deep.x, deep.y, deep.color));
        for (let i = 0; i < 8; i++) this.particles.push(new Particle(deep.x, deep.y, deep.color));
      }
      this.texts.push(new FloatingText(src.x, src.y - 20, "/review ✓", "#d2a8ff"));
    }
```

- [ ] **Step 3:** Verifikation: `node tests/smoke.mjs && node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done` → `smoke ok`, `pass 22`.
- [ ] **Step 4:** Commit + Push:
  ```bash
  git add config.js game.js
  git commit -m "feat(content): Spezial-Commands /undo (heal) + /review (kill-deepest)"
  git push origin wow-polish
  ```

### Task 9 (STRETCH/B): Achievements-Toasts + „Clean Build"-Wave-Bonus

**Files:** Modify `game.js` (`reset`, `addToast`, `onKill`, `onEscape`, `startWave`, Wave-Clear-Branch, `update`, `drawToasts`+Aufruf in `drawPlayfield`).

- [ ] **Step 1:** In `reset()` ergänzen:

```js
    this.toasts = [];
    this.escapesThisWave = 0;
    this._firstBlood = false;
```

- [ ] **Step 2:** Methode `addToast` vor `update` einfügen:

```js
  addToast(text) { this.toasts.push({ text, life: 2.2, max: 2.2 }); }
```

- [ ] **Step 3:** In `onKill(bug)` am Ende einfügen:

```js
    if (!this._firstBlood) { this._firstBlood = true; this.addToast("⚔ First Blood"); }
    if (bug.isBoss) this.addToast("☠ Boss Slain");
```

- [ ] **Step 4:** In `onEscape(bug)` ergänzen: `this.escapesThisWave += 1;`
      In `startWave()` am Anfang (nach `this.wave += 1;`) ergänzen: `this.escapesThisWave = 0;`

- [ ] **Step 5:** Den Wave-Clear-Branch in `update` (die `if (this.banner <= 0 && this.toSpawn === 0 && this.bugs.length === 0 && !this.bossPending)`-Bedingung) ersetzen durch:

```js
    if (this.banner <= 0 && this.toSpawn === 0 && this.bugs.length === 0 && !this.bossPending) {
      if (this.wave > 0 && this.escapesThisWave === 0) {
        this.score += 500;
        this.addToast("✓ CLEAN BUILD +500");
        this.sound?.waveClear();
      }
      this.startWave();
    }
```

- [ ] **Step 6:** Toast-Tick im Juice-Block von `update` ergänzen:

```js
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
```

- [ ] **Step 7:** `drawToasts` vor `draw` einfügen + in `drawPlayfield` nach `this.drawTerminal(ctx);` aufrufen (`this.drawToasts(ctx);`):

```js
  drawToasts(ctx) {
    ctx.save();
    ctx.textAlign = "right";
    ctx.font = "14px ui-monospace, monospace";
    let y = 80;
    for (const t of this.toasts) {
      ctx.globalAlpha = Math.min(1, t.life / 0.4);          // weiches Ausblenden
      ctx.fillStyle = "#7ee787";
      ctx.fillText(t.text, this.W - 16, y);
      y += 22;
    }
    ctx.restore();
  }
```

- [ ] **Step 8:** Verifikation: `node tests/smoke.mjs && node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done` → `smoke ok`, `pass 22`.
- [ ] **Step 9:** Commit + Push:
  ```bash
  git add game.js
  git commit -m "feat(content): Achievement-Toasts + Clean-Build-Wave-Bonus"
  git push origin wow-polish
  ```

### Task 10 (STRETCH/C): Duck/Bug-Art aufgewertet

**Files:** Modify `entities.js` (`Duck.draw`, `Bug.draw`).

- [ ] **Step 1:** In `Duck.draw`, nach dem Körper-`fill()` (vor dem Kopf-Block) Flügel-Andeutung einfügen:

```js
    // Flügel-Andeutung
    ctx.fillStyle = "#f0c020";
    ctx.beginPath();
    ctx.ellipse(-w * 0.08, h * 0.14, w * 0.2, h * 0.18, Math.sin(this.bobT * 2.2) * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
```

- [ ] **Step 2:** In `Duck.draw` den Augen-Block (Auge-`fillStyle` + `arc` + `fill`) mit Blinzeln ersetzen:

```js
    const blink = (Math.floor(this.bobT * 0.6) % 6) === 0;   // gelegentliches Blinzeln
    ctx.fillStyle = "#1b1f24";
    if (blink) {
      ctx.fillRect(w * 0.2, -h * 0.28, h * 0.08, 1.5);       // geschlossenes Auge
    } else {
      ctx.beginPath();
      ctx.arc(w * 0.24, -h * 0.28, h * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
```

- [ ] **Step 3:** In `Bug.draw`, direkt vor `ctx.fillStyle = this.flash > 0 ? "#ffffff" : this.color;` typ-distinkte Marker (Panzer für tank, Stacheln für fast) einfügen:

```js
    if (this.type === "tank") {                              // gepanzert: dunkler Außenring
      ctx.fillStyle = "#0d1117";
      ctx.beginPath(); ctx.ellipse(0, 0, this.r + 3, this.r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === "fast") {                       // scharf: Stachel-Spitzen
      ctx.strokeStyle = this.color; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + time;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * this.r, Math.sin(a) * this.r);
        ctx.lineTo(Math.cos(a) * (this.r + 5), Math.sin(a) * (this.r + 5));
        ctx.stroke();
      }
    }
```

- [ ] **Step 4:** Verifikation: `node tests/smoke.mjs && node --test tests/mechanics.test.js && for f in *.js; do node --check "$f"; done` → `smoke ok`, `pass 22`.
- [ ] **Step 5:** Commit + Push:
  ```bash
  git add entities.js
  git commit -m "feat(look): Duck-Flügel/Blinzeln + typ-distinkte Bug-Silhouetten"
  git push origin wow-polish
  ```

---

## Self-Review-Ergebnis (gegen Spec)

- **Spec-Abdeckung:** Item 1→Task 2, Item 2→Task 3, Item 3→Task 4, Item 4→Task 5, Item 5→Task 6, Item 6→Task 7; Stretch 7→Task 8, 8→Task 9, 9→Task 10. Smoke-Harness (Task 1) = zusätzliche Verifikations-Infrastruktur (von „Verifikation pro Schritt" der Spec gefordert).
- **Bewusste Abweichung:** Mute = Icon-Klick statt `M`-Taste (Begründung in Task 5) — verhindert Kollision mit Command-Buchstaben.
- **Typ-Konsistenz:** `this.rings`/`Ring` (Task 3) genutzt in Task 8; `this._mult` in `reset` (Task 5) genutzt in Task 6; `CONFIG.fx.flowThreshold` (Task 4) genutzt in Task 6; `this.leaked`/`this.newBest` (Task 7) konsistent in `gameOver`/`drawGameOver`. Geprüft, stimmig.
- **Keine Platzhalter:** alle Code-Steps enthalten vollständigen Code.
```
