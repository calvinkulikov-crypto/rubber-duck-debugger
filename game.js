import { CONFIG } from "./config.js";
import { Duck, Beam } from "./entities.js";

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
    this.duck = new Duck();
    this.fireCd = 0;
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
    this.beams = this.beams.filter((b) => !b.dead);
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
      // PLAYING
      for (const b of this.beams) b.draw(ctx);
      this.duck.draw(ctx);
    }
  }
}
