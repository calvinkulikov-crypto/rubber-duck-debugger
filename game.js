import { CONFIG } from "./config.js";
import { Duck, Beam, Bug, Boss, Particle, FloatingText } from "./entities.js";
import {
  waveBudget, waveSpeedMultiplier, isBossWave,
  bugReachedFloor, beamHitsBug, comboMultiplier, scoreForKill,
  pickTargetByBuffer,
} from "./mechanics.js";

export const STATE = { INTRO: "INTRO", TITLE: "TITLE", PLAYING: "PLAYING", PAUSED: "PAUSED", GAMEOVER: "GAMEOVER" };

export class Game {
  constructor(sound = null) {
    this.W = CONFIG.canvas.w;
    this.H = CONFIG.canvas.h;
    this.sound = sound;
    this.state = STATE.INTRO;
    this.input = { mouseX: this.W / 2, firing: false, left: false, right: false };
    this.best = this.loadBest();
    this.reset();
    // Intro-Dialog (bewusst NICHT in reset() → Restart überspringt das Intro)
    this.intro = {
      lines: [
        { who: "you",    text: "Hey Claude, lass uns ein Spiel bauen." },
        { who: "claude", text: "Klar. Bug-Debugger mit Gummiente: tipp die /commands, kill die Bugs, rette den Build. 🦆" },
      ],
      li: 0, ci: 0, t: 0, cps: 38, holdAfter: 1.1, holdT: 0,
    };
  }

  reset() {
    this.score = 0;
    this.wave = 0;
    this.lives = CONFIG.lives;
    this.combo = 0;
    this.comboTimer = 0;
    this.bugs = [];
    this.beams = [];
    this.particles = [];
    this.texts = [];
    this.shake = 0;
    this.duck = new Duck();
    this.fireCd = 0;
    this.typed = "";          // live getippter Command
    this.target = null;       // gelockter Bug/Boss
    this.time = 0;
    this.toSpawn = 0;          // verbleibendes Bug-Budget der aktuellen Welle
    this.spawnTimer = 0;
    this.banner = 0;           // > 0 = Wellen-Banner sichtbar, kein Spawn
    this.speedMult = 1;
    this.bossPending = false;
    this.codeLines = [
      "function fixBug(duck) {", "  while (bugs.length) {", "    duck.explain(bug);",
      "    if (bug.solved) ship();", "  }", "  return clean;", "}",
      "const debugDuck = new Duck();", "debugDuck.quack();", "// TODO: more tests",
    ];
    this.corrupted = [];     // Indizes korrumpierter Zeilen
  }

  start() { this.reset(); this.state = STATE.PLAYING; }

  togglePause() {
    if (this.state === STATE.PLAYING) this.state = STATE.PAUSED;
    else if (this.state === STATE.PAUSED) this.state = STATE.PLAYING;
  }

  // Klick/Taste-"bestätigen" je nach State
  confirm() {
    if (this.state === STATE.INTRO) { this.finishIntro(); return; }
    if (this.state === STATE.TITLE) this.start();
    else if (this.state === STATE.GAMEOVER) this.start();
  }

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

  releaseTarget() {
    if (this.target) this.target.typedLen = 0;
    this.target = null;
    this.typed = "";
  }

  // Tippfehler: Combo bricht + Glitch/Buzz, aber Lock & Buffer BLEIBEN (nur das Falsch-Zeichen verpufft).
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
    ch = ch.toLowerCase();
    if (ch === " ") return;
    // verwaistes Ziel → Lock fallen lassen
    if (this.target && (this.target.dead || this.target.escaped || !this.bugs.includes(this.target))) {
      this.releaseTarget();
    }
    // Targeting folgt dem vollen Buffer → Spieler wählt Bug durch den Command den er tippt
    const candidate = this.typed + ch;
    const idx = pickTargetByBuffer(this.bugs, candidate);
    if (idx < 0) {
      if (this.typed.length > 0) this.syntaxError();  // teilweiser Command, kein Match → Fehler
      return;
    }
    const newTarget = this.bugs[idx];
    if (this.target && this.target !== newTarget) {
      this.target.typedLen = 0;  // altes Ziel-Fortschritts-Label zurücksetzen
    }
    this.target = newTarget;
    this.typed = candidate;
    this.target.typedLen = this.typed.length;
    // pro korrektem Zeichen ein Execute-Strahl von der Ente zum Ziel
    const m = this.duck.muzzle();
    this.beams.push(new Beam(m.x, m.y, this.target.x, this.target.y));
    this.duck.triggerRecoil();
    this.fireCd = CONFIG.beam.cooldown;
    this.sound?.fire();
    if (candidate === this.target.command) this.executeTarget();
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

  startWave() {
    this.wave += 1;
    this.speedMult = waveSpeedMultiplier(this.wave, CONFIG.waves.speedMult);
    this.banner = CONFIG.waves.bannerTime;
    if (this.wave > 1) this.sound?.waveClear();
    if (isBossWave(this.wave, CONFIG.waves.bossEvery)) {
      this.bugs.push(new Boss());  // Boss zählt als normaler bugs-Eintrag (gleiche Felder)
      this.toSpawn = 3;            // wenige Begleit-Bugs
      this.bossPending = false;
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

  multiplier() { return comboMultiplier(this.combo, CONFIG.combo.perTier, CONFIG.combo.multCap); }

  onKill(bug) {
    this.combo += 1;
    this.comboTimer = CONFIG.combo.timeout;
    this.score += scoreForKill(bug.points, this.multiplier());
    const burst = bug.isBoss ? 28 : 10;
    for (let i = 0; i < burst; i++) this.particles.push(new Particle(bug.x, bug.y, bug.color));
    this.texts.push(new FloatingText(bug.x, bug.y, bug.label, "#c9d1d9"));
    const mult = this.multiplier();
    if (mult > 1) this.texts.push(new FloatingText(bug.x, bug.y - 18, `×${mult}`, "#7ee787"));
    if (bug.isBoss) this.shake = Math.max(this.shake, 0.3);
    this.sound?.[bug.isBoss ? "bossHit" : "pop"]();
  }

  onEscape(bug) {
    this.lives -= 1;
    this.combo = 0;
    this.shake = 0.4;
    this.sound?.damage();
    // eine Code-Zeile korrumpieren (visuell), keine Dubletten
    for (let k = 0; k < this.codeLines.length; k++) {
      const idx = (this.corrupted.length * 3 + 2 + k) % this.codeLines.length;
      if (!this.corrupted.includes(idx)) { this.corrupted.push(idx); break; }
    }
    if (this.lives <= 0) this.gameOver();
  }

  gameOver() {
    this.state = STATE.GAMEOVER;
    if (this.score > this.best) this.best = this.score;
    this.saveBest();
    this.sound?.gameOver();
  }

  loadBest() { try { return parseInt(localStorage.getItem("rdd_best") || "0", 10) || 0; } catch { return 0; } }
  saveBest() { try { localStorage.setItem("rdd_best", String(this.best)); } catch { /* privater modus: nur in-memory */ } }

  update(dt) {
    if (this.state === STATE.INTRO) { this.time += dt; this.updateIntro(dt); return; }
    if (this.state !== STATE.PLAYING) return;
    this.time += dt;
    if (this.wave === 0) this.startWave();          // erste Welle starten

    if (this.banner > 0) {
      this.banner -= dt;
    } else if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnBug(); this.toSpawn -= 1; this.spawnTimer = this.spawnInterval(); }
    }

    // Ente zielt automatisch: gleitet unter das gelockte Ziel, sonst zur Mitte
    this.input.mouseX = this.target ? this.target.x : this.W / 2;
    this.duck.update(dt, this.input);

    // Beams sind rein kosmetisch (in handleChar gespawnt) → nur fortbewegen
    this.fireCd -= dt;
    for (const b of this.beams) b.update(dt);
    for (const bug of this.bugs) bug.update(dt, this.time);
    this.beams = this.beams.filter((b) => !b.dead);

    // Bug × Boden (Korruption) + tote/entkommene entfernen
    for (const bug of this.bugs) {
      if (!bug.dead && bugReachedFloor(bug, CONFIG.floorY)) {
        bug.escaped = true;
        if (bug === this.target) this.releaseTarget();
        this.onEscape(bug);
      }
    }
    this.bugs = this.bugs.filter((b) => !b.dead && !b.escaped);

    // Combo-Timeout
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Juice: Partikel/Texte tickern, Screen-Shake abklingen
    for (const p of this.particles) p.update(dt);
    for (const t of this.texts) t.update(dt);
    this.particles = this.particles.filter((p) => !p.dead);
    this.texts = this.texts.filter((t) => !t.dead);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);

    // Welle vorbei? → nächste
    if (this.banner <= 0 && this.toSpawn === 0 && this.bugs.length === 0 && !this.bossPending) {
      this.startWave();
    }
  }

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

  drawHud(ctx) {
    ctx.fillStyle = "#c9d1d9";
    ctx.font = "16px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Score ${this.score}`, 16, 26);
    ctx.textAlign = "center";
    ctx.fillText(`Welle ${this.wave}`, this.W / 2, 26);
    ctx.textAlign = "right";
    ctx.fillText(`Leben ${"♥".repeat(Math.max(0, this.lives))}`, this.W - 16, 26);
    const mult = this.multiplier();
    if (mult > 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#7ee787";
      ctx.fillText(`×${mult}`, this.W / 2, 50);
    }
  }

  drawPlayfield(ctx) {
    this.drawBackground(ctx);
    for (const bug of this.bugs) bug.draw(ctx, this.time);
    for (const b of this.beams) b.draw(ctx);
    this.duck.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const t of this.texts) t.draw(ctx);
    this.drawHud(ctx);
    this.drawTerminal(ctx);
    if (this.banner > 0) {
      ctx.fillStyle = "#c9d1d9";
      ctx.font = "32px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Welle ${this.wave}`, this.W / 2, this.H / 2);
    }
  }

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

  drawTitle(ctx) {
    this.drawBackground(ctx);
    ctx.fillStyle = "rgba(13,17,23,0.78)"; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd23f"; ctx.font = "44px ui-monospace, monospace";
    ctx.fillText("🦆 Rubber Duck Debugger", this.W / 2, 190);
    ctx.fillStyle = "#c9d1d9"; ctx.font = "18px ui-monospace, monospace";
    ctx.fillText("Erklär dem Entchen deinen Bug.", this.W / 2, 230);
    ctx.fillStyle = "#8b949e"; ctx.font = "15px ui-monospace, monospace";
    ctx.fillText("Tippe die /commands, die auf den Bugs stehen   •   Backspace = korrigieren", this.W / 2, 300);
    ctx.fillText("Tippe den /command des Bugs den du killen willst. Tippfehler bricht die Combo.", this.W / 2, 326);
    ctx.fillStyle = "#7ee787"; ctx.font = "20px ui-monospace, monospace";
    ctx.fillText("Klick zum Start", this.W / 2, 400);
    ctx.fillStyle = "#8b949e"; ctx.font = "14px ui-monospace, monospace";
    ctx.fillText(`Best: ${this.best}`, this.W / 2, 440);
    // Touch-Geräte: Hinweis, damit ein Judge am Handy nicht vor totem Spiel sitzt
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      ctx.fillStyle = "#e5c07b"; ctx.font = "14px ui-monospace, monospace";
      ctx.fillText("Am besten am Desktop mit Maus/Tastatur spielen.", this.W / 2, 470);
    }
  }

  drawGameOver(ctx) {
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
    ctx.fillText("Enter / Klick = neu starten", this.W / 2, 420);
  }

  draw(ctx) {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, this.W, this.H);    // BG vor Shake → keine Rand-Lücken beim Jitter
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 14;
      ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);  // echter Frame-Jitter
    }
    if (this.state === STATE.INTRO) {
      this.drawIntro(ctx);
    } else if (this.state === STATE.PLAYING) {
      this.drawPlayfield(ctx);
    } else if (this.state === STATE.PAUSED) {
      this.drawPlayfield(ctx);                 // eingefrorener Frame
      ctx.fillStyle = "rgba(13,17,23,0.6)"; ctx.fillRect(0, 0, this.W, this.H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#c9d1d9"; ctx.font = "34px ui-monospace, monospace";
      ctx.fillText("⏸ Pause", this.W / 2, this.H / 2 - 8);
      ctx.fillStyle = "#8b949e"; ctx.font = "16px ui-monospace, monospace";
      ctx.fillText("Esc = weiter", this.W / 2, this.H / 2 + 24);
    } else if (this.state === STATE.TITLE) {
      this.drawTitle(ctx);
    } else {
      this.drawGameOver(ctx);
    }
    ctx.restore();
  }
}
