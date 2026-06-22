# Claude-Code Debugger (Command-Typing Pivot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the rubber-duck shooter into a ZType-style typing game where bugs fall labeled with slash-commands (`/fix`, `/refactor`) the player types to kill them — plus a typed "Hey Claude" intro that frames the game as a Claude-Code session.

**Architecture:** Keep the existing module split (config/entities/mechanics/game/main) and every pure function in `mechanics.js` (its 8 node:test cases stay green). Add two pure, unit-tested functions (`matchCommand`, `pickTarget`). Replace mouse-aim + click-autofire with a typing buffer + auto-lock targeting in `Game`. Beams become cosmetic "execute" projectiles fired at the locked bug on each correct keystroke; the kill fires on command completion, not on collision. Add an `INTRO` state with a typewriter Claude-Code dialog before `TITLE`.

**Tech Stack:** Vanilla ES-modules, `<canvas>` 2D, WebAudio (existing `Sound`), `node:test` for pure logic. No new dependencies, no assets, no backend.

## Global Constraints

- **No external assets** (no image/sound files). All graphics drawn on canvas, sound synthesized in `audio.js`. (CLAUDE.md tech-guardrail — avoids 404 on Vercel.)
- Relative imports (`./...`), all filenames lowercase (Vercel/Linux case-sensitive).
- Canvas internal resolution fixed `800×600` (`CONFIG.canvas`), CSS scales responsively; hi-DPI backing-store stays as-is in `main.js`.
- All 8 existing `tests/mechanics.test.js` cases must stay green — `mechanics.js` exports are append-only, no signature changes to existing functions.
- **Build the whole pivot on branch `pivot-typing`** (Task 0). After **every** task: `git add -A`, clear message, `git push origin pivot-typing` — satisfies the CLAUDE.md push rule (pushes happen per step, to `origin`) while keeping `main` clean.
- **`main` HEAD must stay the finished static T1–T12 game** = always-deployable deadline fallback. Merge `pivot-typing → main` only after Task 6 passes a manual playtest (Task 7). If the deadline hits mid-pivot, deploy `main` (static game). Deadline **Di 18:00 (2026-06-23)**.
- *(Premortem High-risk mitigation: prevents an unplayable `main` HEAD mid-sequence.)*

---

### Task 0: Branch off `main` (premortem mitigation)

**Files:** none (git only).

- [ ] **Step 1: Create + switch to the pivot branch**

```bash
git checkout main && git pull
git checkout -b pivot-typing
git push -u origin pivot-typing
```

- [ ] **Step 2: Confirm** — `git branch --show-current` prints `pivot-typing`. All Task 1–6 commits land here; `main` stays the static fallback until the Task 7 merge.

---

### Task 1: Pure typing-core functions (`matchCommand`, `pickTarget`)

**Files:**
- Modify: `mechanics.js` (append two exports)
- Test: `tests/mechanics.test.js` (append cases + import)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `matchCommand(command: string, buffer: string, char: string) → { ok: boolean, buffer: string, complete: boolean }` — `ok` = `char` is the next correct char of `command` after `buffer`; `buffer` = advanced buffer if ok else unchanged; `complete` = buffer now equals full `command`.
  - `pickTarget(bugs: {command?: string, y: number, dead: boolean}[], char: string) → number` — index of the **lowest on screen** (max `y`) live bug whose `command` starts with `char`, or `-1`.

- [ ] **Step 1: Write the failing tests** — append to `tests/mechanics.test.js`, and add `matchCommand, pickTarget` to the existing import from `../mechanics.js`:

```js
test("matchCommand: korrekter nächster Buchstabe schreitet voran", () => {
  assert.deepEqual(matchCommand("/fix", "", "/"), { ok: true, buffer: "/", complete: false });
  assert.deepEqual(matchCommand("/fix", "/fi", "x"), { ok: true, buffer: "/fix", complete: true });
});

test("matchCommand: falscher Buchstabe = Syntax-Error, Buffer unverändert", () => {
  assert.deepEqual(matchCommand("/fix", "/f", "z"), { ok: false, buffer: "/f", complete: false });
});

test("pickTarget: tiefster (größtes y) Bug mit passendem ersten Zeichen", () => {
  const bugs = [
    { command: "/fix", y: 100, dead: false },
    { command: "/test", y: 300, dead: false },
    { command: "/fix", y: 250, dead: false },
  ];
  assert.equal(pickTarget(bugs, "/"), 1); // y=300 am tiefsten
});

test("pickTarget: kein passender Bug → -1", () => {
  assert.equal(pickTarget([{ command: "/fix", y: 100, dead: false }], "x"), -1);
});

test("pickTarget: tote Bugs werden ignoriert", () => {
  const bugs = [{ command: "/fix", y: 400, dead: true }, { command: "/fix", y: 100, dead: false }];
  assert.equal(pickTarget(bugs, "/"), 1);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test tests/mechanics.test.js`
Expected: FAIL — `matchCommand is not a function` / `pickTarget is not a function`. The 8 original cases still pass.

- [ ] **Step 3: Implement** — append to `mechanics.js`:

```js
// Tipp-Matching: schreitet im command voran, wenn char das nächste Zeichen ist.
export const matchCommand = (command, buffer, char) => {
  const next = buffer + char;
  const ok = command.startsWith(next);
  return { ok, buffer: ok ? next : buffer, complete: ok && next.length === command.length };
};

// Ziel-Wahl: Index des tiefsten (größtes y) lebenden Bugs, dessen command mit char beginnt; sonst -1.
export const pickTarget = (bugs, char) => {
  let best = -1, bestY = -Infinity;
  for (let i = 0; i < bugs.length; i++) {
    const b = bugs[i];
    if (b.dead || !b.command) continue;
    if (b.command[0] === char && b.y > bestY) { bestY = b.y; best = i; }
  }
  return best;
};
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `node --test tests/mechanics.test.js`
Expected: PASS — 13/13 (8 original + 5 new).

- [ ] **Step 5: Commit**

```bash
git add mechanics.js tests/mechanics.test.js
git commit -m "feat(pivot): matchCommand + pickTarget pure functions (+5 tests)"
git push
```

---

### Task 2: Command content + command-aware entities (`config.js`, `entities.js`)

**Files:**
- Modify: `config.js:13-21` (bugTypes labels → commands; boss commands)
- Modify: `entities.js` (Bug: `command`/`typedLen`; Boss: command-sequence; Beam: directional)
- Test: `node --check config.js entities.js`

**Interfaces:**
- Consumes: `CONFIG.bugTypes[*].commands`, `CONFIG.boss.commands` (Task-2 config).
- Produces:
  - `Bug.command: string` (its slash-command), `Bug.typedLen: number` (highlight cursor, set by Game).
  - `Boss.command: string` (getter → current command in sequence), `Boss.commands: string[]`, `Boss.seq: number`, `Boss.typedLen: number`, `Boss.advance(): void` (teleport + next command; sets `dead` when sequence exhausted).
  - `Beam(x, y, tx, ty)` — flies from `(x,y)` toward `(tx,ty)`, cosmetic, self-expires.

- [ ] **Step 1: Replace `bugTypes` + `boss` in `config.js`** — swap the `labels:` arrays for `commands:` (slash-commands), keep all numeric tuning untouched. Lines 13–21 become:

```js
  bugTypes: {
    standard: { r: 18, vy: 60,  hp: 1, points: 100, color: "#e06c75",
      commands: ["/fix", "/test", "/lint", "/retry"] },
    fast:     { r: 12, vy: 130, hp: 1, points: 150, color: "#e5c07b",
      commands: ["/ci", "/cd", "/rm", "/ls"] },
    tank:     { r: 26, vy: 45,  hp: 3, points: 300, color: "#c678dd",
      commands: ["/refactor", "/rollback", "/mutex", "/rebase"] },
  },
  boss: { r: 48, vy: 30, hp: 12, points: 2000, color: "#56b6c2",
    label: "Heisenbug", commands: ["/triage", "/rollback", "/ship"] },
```

- [ ] **Step 2: Make `Bug` command-aware** in `entities.js`. Replace the label line (`entities.js:101`) and add `typedLen`:

```js
    this.command = t.commands[Math.floor((phase * 97) % t.commands.length)]; // deterministische Wahl
    this.typedLen = 0;                 // wie viele Zeichen des Commands schon getippt (vom Game gesetzt)
```

Then in `Bug.draw` replace the label block (`entities.js:136-140`) with a typed-prefix highlight:

```js
    // Command-Label: getippter Teil grün, Rest grau
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    const cmd = this.command;
    const done = cmd.slice(0, this.typedLen);
    const restW = ctx.measureText(cmd).width;
    const x0 = -restW / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "#7ee787";
    ctx.fillText(done, x0, -this.r - 6);
    ctx.fillStyle = "#8b949e";
    ctx.fillText(cmd.slice(this.typedLen), x0 + ctx.measureText(done).width, -this.r - 6);
```

- [ ] **Step 3: Make `Boss` a command sequence** in `entities.js`. In the `Boss` constructor, replace `this.label = b.label;` with:

```js
    this.label = b.label;
    this.commands = b.commands;
    this.seq = 0;
    this.typedLen = 0;
```

Add a getter + `advance()` right after the constructor (before `update`):

```js
  get command() { return this.commands[this.seq]; }   // aktueller Command der Sequenz
  advance() {
    this.seq += 1;
    this.typedLen = 0;
    this.flash = 0.1;
    const margin = this.r + 20;       // teleport wie bisher beim Treffer
    this.x = margin + (Math.abs(this.seq * 137 + Math.floor(this.y) * 7) % (CONFIG.canvas.w - 2 * margin));
    if (this.seq >= this.commands.length) this.dead = true;
  }
```

Replace the boss HP-bar + label block in `Boss.draw` (`entities.js:186-189`) with sequence-progress + current command:

```js
    // Fortschritt = wie viele Commands der Sequenz erledigt
    ctx.fillStyle = "#30363d"; ctx.fillRect(-this.r, -this.r - 26, this.r * 2, 6);
    ctx.fillStyle = "#56b6c2"; ctx.fillRect(-this.r, -this.r - 26, this.r * 2 * (this.seq / this.commands.length), 6);
    ctx.fillStyle = "#8b949e"; ctx.font = "12px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(this.label, 0, -this.r - 32);
    const cmd = this.command;
    const done = cmd.slice(0, this.typedLen);
    const w = ctx.measureText(cmd).width;
    ctx.textAlign = "left";
    ctx.fillStyle = "#7ee787"; ctx.fillText(done, -w / 2, -this.r - 12);
    ctx.fillStyle = "#c9d1d9"; ctx.fillText(cmd.slice(this.typedLen), -w / 2 + ctx.measureText(done).width, -this.r - 12);
```

- [ ] **Step 4: Make `Beam` directional** in `entities.js`. Replace the whole `Beam` class (`entities.js:61-86`) with:

```js
export class Beam {
  // Kosmetischer "Execute"-Strahl: fliegt von (x,y) Richtung Ziel (tx,ty).
  constructor(x, y, tx, ty) {
    this.x = x; this.y = y;
    const dx = tx - x, dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    this.vx = (dx / d) * CONFIG.beam.speed;
    this.vy = (dy / d) * CONFIG.beam.speed;
    this.len = CONFIG.beam.len;
    this.width = CONFIG.beam.width;
    this.ttl = d / CONFIG.beam.speed + 0.03;   // stirbt ~beim Erreichen des Ziels
    this.dead = false;
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.ttl -= dt; if (this.ttl <= 0) this.dead = true; }
  draw(ctx) {
    const d = Math.hypot(this.vx, this.vy) || 1;
    const bx = this.x - (this.vx / d) * this.len;   // Schweif entgegen Flugrichtung
    const by = this.y - (this.vy / d) * this.len;
    ctx.save();
    ctx.strokeStyle = "#7ee787";
    ctx.lineWidth = this.width;
    ctx.lineCap = "round";
    ctx.shadowColor = "#7ee787";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }
}
```

> Note: `beamHitsBug` in `mechanics.js` stays exported and unit-tested (its 1 test stays green) but is no longer called — kills are command-driven now. Leaving tested code in place is intentional, not dead-code to delete.

- [ ] **Step 5: Verify syntax**

Run: `node --check config.js && node --check entities.js && node --test tests/mechanics.test.js`
Expected: no output from `--check` (success), tests still 13/13.

- [ ] **Step 6: Commit**

```bash
git add config.js entities.js
git commit -m "feat(pivot): slash-command content + command-aware Bug/Boss/Beam"
git push
```

---

### Task 3: Typing + targeting logic in `Game` (`game.js`)

**Files:**
- Modify: `game.js` (reset state, new handlers, rewritten `update`, no autofire/collision-damage)
- Test: `node --check game.js` + `node --test tests/mechanics.test.js`

**Interfaces:**
- Consumes: `matchCommand`, `pickTarget` (Task 1); `Bug.command/typedLen`, `Boss.command/advance/typedLen`, `Beam(x,y,tx,ty)` (Task 2).
- Produces (used by `main.js` in Task 5 and render in Task 4):
  - `Game.typed: string` — live buffer.
  - `Game.target: Bug|Boss|null` — locked entity.
  - `Game.handleChar(ch: string): void` — process one printable char.
  - `Game.handleBackspace(): void` — delete last buffer char; release lock if buffer empties.

- [ ] **Step 1: Add typing state to `reset()`** — in `game.js` `reset()`, after `this.fireCd = 0;` (line 33) add:

```js
    this.typed = "";          // live getippter Command
    this.target = null;       // gelockter Bug/Boss
```

- [ ] **Step 2: Add the import** — extend the `mechanics.js` import at `game.js:3-6` to include the new functions:

```js
import {
  waveBudget, waveSpeedMultiplier, isBossWave,
  bugReachedFloor, beamHitsBug, comboMultiplier, scoreForKill,
  matchCommand, pickTarget,
} from "./mechanics.js";
```

- [ ] **Step 3: Add `handleChar` / `handleBackspace` / helpers** — insert after `confirm()` (after `game.js:59`):

```js
  releaseTarget() {
    if (this.target) this.target.typedLen = 0;
    this.target = null;
    this.typed = "";
  }

  // Tippfehler: Combo bricht + Glitch/Buzz, aber Lock & Buffer BLEIBEN (nur das Falsch-Zeichen verpufft).
  // (Premortem End-User-Mitigation: ein Fehlanschlag auf /refactor soll nicht allen Fortschritt löschen.)
  syntaxError() {
    this.combo = 0;
    this.shake = Math.max(this.shake, 0.18);
    this.sound?.damage();
  }

  handleBackspace() {
    if (!this.target) return;
    this.typed = this.typed.slice(0, -1);
    this.target.typedLen = this.typed.length;
    if (this.typed.length === 0) this.releaseTarget();
  }

  handleChar(ch) {
    if (this.state !== STATE.PLAYING) return;
    ch = ch.toLowerCase();          // CapsLock egal (Commands sind lowercase)
    if (ch === " ") return;         // Space ist kein Command-Zeichen → ignorieren, nicht als Fehler werten
    // verwaistes Ziel (tot/entkommen/weg) → Lock fallen lassen
    if (this.target && (this.target.dead || this.target.escaped || !this.bugs.includes(this.target))) {
      this.releaseTarget();
    }
    // Kein Ziel: per erstem Zeichen das tiefste passende Bug locken
    if (!this.target) {
      const idx = pickTarget(this.bugs, ch);
      if (idx < 0) return;              // kein passender Bug → Eingabe verpufft
      this.target = this.bugs[idx];
      this.typed = "";
    }
    const r = matchCommand(this.target.command, this.typed, ch);
    if (!r.ok) { this.syntaxError(); return; }
    this.typed = r.buffer;
    this.target.typedLen = this.typed.length;
    // pro korrektem Zeichen ein Execute-Strahl von der Ente zum Ziel
    const m = this.duck.muzzle();
    this.beams.push(new Beam(m.x, m.y, this.target.x, this.target.y));
    this.duck.triggerRecoil();
    this.fireCd = CONFIG.beam.cooldown;
    this.sound?.fire();
    if (r.complete) this.executeTarget();
  }

  // Command fertig getippt: Boss schreitet in der Sequenz voran, sonst Kill.
  executeTarget() {
    const t = this.target;
    if (t.isBoss && t.seq < t.commands.length - 1) {
      t.advance();                 // nächster Command, teleport
      this.sound?.bossHit();
      this.releaseTarget();
      return;
    }
    t.dead = true;
    this.onKill(t);
    this.releaseTarget();
  }
```

- [ ] **Step 4: Rewrite the firing + collision block in `update()`** — replace the autofire block and the Beam×Bug collision loop (`game.js:140-170`, from `this.duck.update` through `this.beams = this.beams.filter(...)`) with:

```js
    // Ente zielt automatisch: gleitet unter das gelockte Ziel, sonst zur Mitte
    this.input.mouseX = this.target ? this.target.x : this.W / 2;
    this.duck.update(dt, this.input);

    // Beams sind rein kosmetisch (in handleChar gespawnt) → nur fortbewegen
    this.fireCd -= dt;
    for (const b of this.beams) b.update(dt);
    for (const bug of this.bugs) bug.update(dt, this.time);
    this.beams = this.beams.filter((b) => !b.dead);
```

- [ ] **Step 5: Drop the lock when the locked bug escapes** — in the Bug×Boden loop (`game.js:173-175`), expand the escape branch to release a locked target so a corrupted target doesn't keep the buffer alive:

```js
    for (const bug of this.bugs) {
      if (!bug.dead && bugReachedFloor(bug, CONFIG.floorY)) {
        bug.escaped = true;
        if (bug === this.target) this.releaseTarget();
        this.onEscape(bug);
      }
    }
```

- [ ] **Step 6: Verify syntax + tests**

Run: `node --check game.js && node --test tests/mechanics.test.js`
Expected: `--check` silent, tests 13/13.

- [ ] **Step 7: Commit**

```bash
git add game.js
git commit -m "feat(pivot): typing buffer + auto-lock targeting + execute-on-complete"
git push
```

---

### Task 4: Terminal prompt + screen copy (`game.js` render)

**Files:**
- Modify: `game.js` (`drawTerminal`, call in `drawPlayfield`, title/gameover copy)
- Test: `node --check game.js`

**Interfaces:**
- Consumes: `Game.typed`, `Game.target` (Task 3).
- Produces: on-canvas terminal strip showing the live command; updated instructions referencing typing.

- [ ] **Step 1: Add `drawTerminal(ctx)`** — insert before `drawHud` (before `game.js:226`):

```js
  drawTerminal(ctx) {
    const y = CONFIG.floorY + 30;
    ctx.textAlign = "left";
    ctx.font = "20px ui-monospace, monospace";
    ctx.fillStyle = "#7ee787";
    ctx.fillText("›", 18, y);
    ctx.fillStyle = "#c9d1d9";
    ctx.fillText(this.typed, 40, y);
    // blinkender Cursor hinter dem Getippten
    if ((Math.floor(this.time * 2) % 2) === 0) {
      const w = ctx.measureText(this.typed).width;
      ctx.fillStyle = "#7ee787";
      ctx.fillRect(42 + w, y - 15, 9, 18);
    }
    if (!this.target) {
      ctx.fillStyle = "#6e7681";
      ctx.font = "13px ui-monospace, monospace";
      ctx.fillText("tipp einen /command, um einen Bug zu fixen", 40, y + 22);
    }
  }
```

- [ ] **Step 2: Call it** — in `drawPlayfield` add `this.drawTerminal(ctx);` right after `this.drawHud(ctx);` (`game.js:250`).

- [ ] **Step 3: Update TITLE copy** — in `drawTitle`, replace the two instruction lines (`game.js:267-269`) with typing controls:

```js
    ctx.fillStyle = "#8b949e"; ctx.font = "15px ui-monospace, monospace";
    ctx.fillText("Tippe die /commands, die auf den Bugs stehen   •   Backspace = korrigieren", this.W / 2, 300);
    ctx.fillText("Erstes Zeichen lockt den tiefsten Bug. Tippfehler bricht die Combo.", this.W / 2, 326);
```

- [ ] **Step 4: Update GAMEOVER copy** — in `drawGameOver`, the restart hint (`game.js:292`) referencing click → change to Enter/click:

```js
    ctx.fillText("Enter / Klick = neu starten", this.W / 2, 420);
```

- [ ] **Step 5: Verify**

Run: `node --check game.js`
Expected: silent (success).

- [ ] **Step 6: Commit**

```bash
git add game.js
git commit -m "feat(pivot): live terminal prompt + typing-control screen copy"
git push
```

---

### Task 5: Input remap (`main.js`)

**Files:**
- Modify: `main.js` (keyboard → typing; drop mouse-aim/click-fire/space-fire/arrow-move)
- Test: `node --check main.js`

**Interfaces:**
- Consumes: `Game.handleChar`, `Game.handleBackspace`, `Game.confirm`, `Game.togglePause` (Task 3 & existing).

- [ ] **Step 1: Replace the input listeners** — replace `main.js:21-38` (the `mousemove`/`mousedown`/`mouseup`/`keydown`/`keyup` block) with:

```js
canvas.addEventListener("mousedown", () => {
  if (game.state !== STATE.PLAYING) game.confirm();   // Klick = Start/Skip/Restart, NICHT feuern
});

window.addEventListener("keydown", (e) => {
  // Pause / weiter
  if (e.code === "Escape") { e.preventDefault(); game.togglePause(); return; }
  if (game.state !== STATE.PLAYING) {
    // Auf Intro/Title/GameOver: Enter/Space/Buchstabe = los
    if (e.code === "Enter" || e.code === "Space" || e.key.length === 1) { e.preventDefault(); game.confirm(); }
    return;
  }
  // PLAYING: Tippen
  if (e.code === "Backspace") { e.preventDefault(); game.handleBackspace(); return; }
  // ein druckbares Zeichen (inkl. "/") → Buffer; Modifier-Kombis ignorieren
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    game.handleChar(e.key);
  }
});
```

- [ ] **Step 2: Keep audio unlock + hi-DPI untouched; delete unused `toCanvasX`** — `main.js:10-13` (audio unlock) and `main.js:43-50` (`setupHiDPI`) stay. `toCanvasX` (`main.js:16-19`) is now unused → delete those 4 lines.

- [ ] **Step 3: Verify**

Run: `node --check main.js`
Expected: silent (success).

- [ ] **Step 4: Manual smoke (Calvin/browser)** — `python3 -m http.server 8000 --directory .` → open `http://localhost:8000`, start, type a visible `/command`, confirm bug pops, typo breaks combo, Backspace edits, Esc pauses. Console must be error/404-free.

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat(pivot): keyboard typing input, drop mouse-aim/click-fire"
git push
```

---

### Task 6: "Hey Claude" intro screen (`game.js`, `main.js`)

**Files:**
- Modify: `game.js` (`STATE.INTRO`, intro model kept out of `reset`, `updateIntro`, `drawIntro`, `confirm`, `draw` branch)
- Test: `node --check game.js`

**Interfaces:**
- Consumes: nothing new (Task-5 input already routes non-PLAYING keys/clicks to `confirm`).
- Produces: `STATE.INTRO` as the initial state; typewriter dialog → `TITLE`.

- [ ] **Step 1: Add the state** — extend the `STATE` object (`game.js:8`):

```js
export const STATE = { INTRO: "INTRO", TITLE: "TITLE", PLAYING: "PLAYING", PAUSED: "PAUSED", GAMEOVER: "GAMEOVER" };
```

- [ ] **Step 2: Boot into INTRO + intro model** — in the constructor (`game.js`), change `this.state = STATE.TITLE;` to `this.state = STATE.INTRO;` and after `this.reset();` (line 18) add the intro model (kept OUT of `reset()` so a restart skips the intro):

```js
    this.intro = {
      lines: [
        { who: "you",    text: "Hey Claude, lass uns ein Spiel bauen." },
        { who: "claude", text: "Klar. Bug-Debugger mit Gummiente: tipp die /commands, kill die Bugs, rette den Build. 🦆" },
      ],
      li: 0, ci: 0, t: 0, cps: 38, holdAfter: 1.1, holdT: 0,
    };
```

- [ ] **Step 3: Branch `update` for INTRO** — at the very top of `update(dt)` (before `if (this.state !== STATE.PLAYING) return;`, `game.js:129`) insert:

```js
    if (this.state === STATE.INTRO) { this.time += dt; this.updateIntro(dt); return; }
```

- [ ] **Step 4: Add `updateIntro` + `finishIntro`** — insert after `confirm()` in the class:

```js
  updateIntro(dt) {
    const it = this.intro;
    const line = it.lines[it.li];
    if (it.ci < line.text.length) {
      it.t += dt;
      while (it.t >= 1 / it.cps && it.ci < line.text.length) { it.t -= 1 / it.cps; it.ci += 1; }
    } else if (it.li < it.lines.length - 1) {
      it.li += 1; it.ci = 0; it.t = 0;       // nächste Zeile
    } else {
      it.holdT += dt;
      if (it.holdT >= it.holdAfter) this.finishIntro();
    }
  }
  finishIntro() { this.state = STATE.TITLE; }
```

- [ ] **Step 5: Skip on input** — in `confirm()` (`game.js:56-59`) add an INTRO branch as the first check:

```js
  confirm() {
    if (this.state === STATE.INTRO) { this.finishIntro(); return; }
    if (this.state === STATE.TITLE) this.start();
    else if (this.state === STATE.GAMEOVER) this.start();
  }
```

- [ ] **Step 6: Add `drawIntro`** — insert before `drawTitle` (`game.js:259`):

```js
  drawIntro(ctx) {
    ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = "left";
    ctx.font = "16px ui-monospace, monospace";
    ctx.fillStyle = "#6e7681";
    ctx.fillText("claude-code · rubber-duck-debugger", 40, 70);
    const it = this.intro;
    let y = 150;
    for (let i = 0; i <= it.li; i++) {
      const line = it.lines[i];
      const shown = i < it.li ? line.text : line.text.slice(0, it.ci);
      ctx.font = "14px ui-monospace, monospace";
      ctx.fillStyle = line.who === "you" ? "#7ee787" : "#e5c07b";
      ctx.fillText(line.who === "you" ? "you ›" : "claude ›", 40, y);
      ctx.fillStyle = "#c9d1d9";
      ctx.font = "18px ui-monospace, monospace";
      const wrapped = shown.match(/.{1,62}(\s|$)/g) || [shown];   // grober Umbruch bei ~62 Zeichen
      for (const w of wrapped) { ctx.fillText(w, 110, y); y += 28; }
      y += 16;
    }
    // Cursor an der aktiven Zeile
    if ((Math.floor(this.time * 2) % 2) === 0) {
      ctx.fillStyle = "#7ee787"; ctx.fillRect(110, y - 36, 9, 18);
    }
    ctx.fillStyle = "#6e7681"; ctx.font = "13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Enter / Klick = überspringen", this.W / 2, this.H - 40);
  }
```

- [ ] **Step 7: Branch `draw` for INTRO** — in `draw()`, make the state branch (`game.js:303`) start with INTRO:

```js
    if (this.state === STATE.INTRO) {
      this.drawIntro(ctx);
    } else if (this.state === STATE.PLAYING) {
```

(keep the rest of the `else if` chain intact).

- [ ] **Step 8: Verify**

Run: `node --check game.js`
Expected: silent (success).

- [ ] **Step 9: Manual smoke (Calvin/browser)** — reload page: intro types the two lines, then drops to TITLE; pressing a key/click mid-intro skips to TITLE; after Game Over, `Enter`/click restarts straight into PLAYING (no intro replay).

- [ ] **Step 10: Commit**

```bash
git add game.js main.js
git commit -m "feat(intro): typed 'Hey Claude' Claude-Code dialog before title"
git push
```

---

### Task 7: Playtest tuning + deploy (Calvin / browser — non-code)

**Files:**
- Modify (only if playtest demands): `config.js` values (`beam.cooldown`, `waves.*`, `bugTypes.*.vy`).

- [ ] **Step 1: Full playtest** — 3–4 rounds. Watch: are commands readable as bugs fall? Is `vy` slow enough to type tank commands (`/refactor`) before they hit the floor? Does the boss sequence feel fair? Adjust only `config.js` numbers.
- [ ] **Step 2: Console check** — DevTools console clean (no errors/404) through intro → play → boss → game over → restart.
- [ ] **Step 3: Commit any tuning** — `git add config.js && git commit -m "tune(pivot): playtest config" && git push origin pivot-typing`.
- [ ] **Step 4: Merge to `main` (only after playtest passes)** — `git checkout main && git merge --no-ff pivot-typing -m "feat: command-typing pivot + intro" && git push origin main`. Until this step `main` stayed the deployable static fallback.
- [ ] **Step 5: Deploy** — `! npx vercel` (interactive login, Calvin triggers). Static, preset "Other", no build step. Verify live URL == local. Put repo + live link in the submission thread **before Di 18:00**.

---

## Self-Review

**1. Spec coverage (AUDIT pivot design):**
- Bugs sink with slash-command label → Task 2 (config commands, Bug.command). ✓
- Type command, first char auto-locks nearest bug → Task 1 `pickTarget` + Task 3 `handleChar`. ✓
- Each correct char fires execute-beam → Task 3 (Beam spawn per keystroke). ✓
- Command complete = bug pops → Task 3 `executeTarget`. ✓
- Typo = syntax error, combo break, red glitch → Task 3 `syntaxError` (combo=0, shake, damage sound). ✓
- Terminal prompt shows live input → Task 4 `drawTerminal`. ✓
- Stays: Duck/Bug/Boss/Beam/Particle/FloatingText, waves, score/combo/lives/gameover, IDE-BG, juice, hi-DPI, all mechanics tests → untouched + Task 1 keeps tests green. ✓
- Out: mouse-move, autofire, click-firing → Task 3 + Task 5. ✓
- Boss = multi-command sequence `/triage`→`/rollback`→`/ship`, teleports → Task 2 `Boss.advance` + Task 3 boss branch. ✓
- Command pool by tier → Task 2 config. ✓
- Intro "Hey Claude" (idea 1) → Task 6. ✓

**2. Placeholder scan:** No "TBD"/"handle errors"/"similar to Task N" — every code step has full code. ✓

**3. Type consistency:** `command` (string) on Bug + Boss-getter; `typedLen` (number) set by Game, read by draw; `matchCommand`→`{ok,buffer,complete}`; `pickTarget`→index; `Beam(x,y,tx,ty)`; `handleChar`/`handleBackspace`/`releaseTarget`/`syntaxError`/`executeTarget`/`updateIntro`/`finishIntro`/`drawTerminal`/`drawIntro` names used consistently across Tasks 3–6. ✓

## Risk notes (carry into premortem)
- Browser-only render/input (Tasks 3–6) is gated by `node --check` + **manual** playtest — Playwright bridge is not connected (AUDIT blocker). Logic core is the only part with automated tests.
- Always-nearest auto-lock means the player can't pick targets; intended (beginner-friendly default) but verify it doesn't feel frustrating with two same-prefix bugs.
- Tank commands are long (`/refactor`); if `vy` is too high they're unkillable → Task 7 tuning is load-bearing, not optional.
- Fallback: static T1–T12 game on `main` history stays submittable if the pivot slips past Di 18:00.
