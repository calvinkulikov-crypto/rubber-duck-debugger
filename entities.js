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
    ctx.save();
    ctx.translate(this.x, this.y);
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
