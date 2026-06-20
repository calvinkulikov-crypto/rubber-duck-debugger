import { CONFIG } from "./config.js";
import { Duck, Beam, Bug } from "./entities.js";
import {
  waveBudget, waveSpeedMultiplier, isBossWave,
  bugReachedFloor, beamHitsBug, comboMultiplier, scoreForKill,
} from "./mechanics.js";

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
    this.time = 0;
    this.toSpawn = 0;          // verbleibendes Bug-Budget der aktuellen Welle
    this.spawnTimer = 0;
    this.banner = 0;           // > 0 = Wellen-Banner sichtbar, kein Spawn
    this.speedMult = 1;
    this.bossPending = false;
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

  update(dt) {
    if (this.state !== STATE.PLAYING) return;
    this.time += dt;
    if (this.wave === 0) this.startWave();          // erste Welle starten

    if (this.banner > 0) {
      this.banner -= dt;
    } else if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnBug(); this.toSpawn -= 1; this.spawnTimer = this.spawnInterval(); }
    }

    this.duck.update(dt, this.input);

    // Feuern (Autofire bei gehaltenem Button/Space, per Cooldown gedrosselt)
    this.fireCd -= dt;
    if (this.input.firing && this.fireCd <= 0) {
      const m = this.duck.muzzle();
      this.beams.push(new Beam(m.x, m.y));
      this.duck.triggerRecoil();
      this.fireCd = CONFIG.beam.cooldown;
      this.sound?.fire();
    }
    for (const b of this.beams) b.update(dt);

    for (const bug of this.bugs) bug.update(dt, this.time);

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

    // Bug × Boden (Korruption) + tote/entkommene entfernen
    for (const bug of this.bugs) {
      if (!bug.dead && bugReachedFloor(bug, CONFIG.floorY)) { bug.escaped = true; this.onEscape(bug); }
    }
    this.bugs = this.bugs.filter((b) => !b.dead && !b.escaped);

    // Combo-Timeout
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Welle vorbei? → nächste
    if (this.banner <= 0 && this.toSpawn === 0 && this.bugs.length === 0 && !this.bossPending) {
      this.startWave();
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
      ctx.fillStyle = "#f85149";
      ctx.fillText("BUILD BROKEN", this.W / 2, 230);
      ctx.fillStyle = "#c9d1d9";
      ctx.font = "20px ui-monospace, monospace";
      ctx.fillText(`Score: ${this.score}`, this.W / 2, 290);
      ctx.fillText(`Best: ${this.best}`, this.W / 2, 322);
      ctx.fillText("R / Klick = neu", this.W / 2, 380);
    } else if (this.state === STATE.PAUSED) {
      ctx.font = "32px ui-monospace, monospace";
      ctx.fillText("Pause", this.W / 2, this.H / 2);
    } else {
      // PLAYING
      for (const bug of this.bugs) bug.draw(ctx, this.time);
      for (const b of this.beams) b.draw(ctx);
      this.duck.draw(ctx);
      this.drawHud(ctx);
      if (this.banner > 0) {
        ctx.fillStyle = "#c9d1d9";
        ctx.font = "32px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`Welle ${this.wave}`, this.W / 2, this.H / 2);
      }
    }
  }
}
