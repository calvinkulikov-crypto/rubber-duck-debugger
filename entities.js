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
