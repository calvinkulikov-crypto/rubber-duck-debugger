import { CONFIG } from "./config.js";
import { clamp } from "./mechanics.js";

export class Duck {
  constructor() {
    this.x = CONFIG.canvas.w / 2;
    this.y = CONFIG.duck.y;
    this.w = CONFIG.duck.w;
    this.h = CONFIG.duck.h;
    this.recoil = 0;          // 0..recoilTime, zählt runter
    this.bobT = 0;            // Wasser-Schaukel-Phase (akkumuliert in update)
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
    this.bobT += dt;          // sanftes Auf-und-Ab + Schaukeln auf dem Wasser
  }

  triggerRecoil() { this.recoil = CONFIG.duck.recoilTime; }

  // Mündung des Strahls (oben an der Ente)
  muzzle() { return { x: this.x, y: this.y - this.h / 2 }; }

  draw(ctx) {
    const squash = this.recoil > 0 ? 1 + (this.recoil / CONFIG.duck.recoilTime) * 0.18 : 1;
    const w = this.w, h = this.h / squash;
    const bob = Math.sin(this.bobT * 2.2) * 2.2;   // Wellengang
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(Math.sin(this.bobT * 1.6) * 0.04);  // leichtes Schaukeln auf dem Wasser
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

export class Bug {
  // typeKey: "standard" | "fast" | "tank"; speedMult skaliert vy pro Welle.
  // special: optionales Spec-Objekt aus CONFIG.specials → Effekt-Bug (typeKey wird ignoriert).
  constructor(typeKey, x, speedMult, phase, special = null) {
    const t = special || CONFIG.bugTypes[typeKey];
    this.type = special ? "special" : typeKey;
    this.special = !!special;
    this.effect = special ? special.effect : null;
    this.x = x;
    this.y = -t.r;
    this.r = t.r;
    this.vy = t.vy * speedMult;
    this.hp = special ? 1 : t.hp;
    this.maxHp = this.hp;
    this.points = t.points;
    this.color = t.color;
    this.command = special
      ? special.command
      : t.commands[Math.floor((phase * 97) % t.commands.length)]; // deterministische Wahl
    this.typedLen = 0;           // wie viele Zeichen des Commands schon getippt (vom Game gesetzt)
    this.label = this.command;   // Alias für FloatingText beim Kill
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
    // Spezial-Bug: pulsierender Leucht-Ring, damit der Spieler ihn sofort erkennt
    if (this.special) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45 * pulse;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = this.color; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, 0, this.r + 6 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
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
    // Command-Label: getippter Teil grün, Rest grau
    ctx.font = "12px ui-monospace, monospace";
    const cmd = this.command;
    const done = cmd.slice(0, this.typedLen);
    const x0 = -ctx.measureText(cmd).width / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "#7ee787";
    ctx.fillText(done, x0, -this.r - 6);
    ctx.fillStyle = "#8b949e";
    ctx.fillText(cmd.slice(this.typedLen), x0 + ctx.measureText(done).width, -this.r - 6);
    ctx.restore();
  }
}

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
    this.commands = b.commands;
    this.seq = 0;
    this.typedLen = 0;
    this.flash = 0;
    this.dead = false;
    this.escaped = false;
    this.isBoss = true;
  }
  get command() { return this.commands[this.seq]; }   // aktueller Command der Sequenz
  advance() {
    this.seq += 1;
    this.typedLen = 0;
    this.flash = 0.1;
    const margin = this.r + 20;       // teleport wie bisher beim Treffer
    this.x = margin + (Math.abs(this.seq * 137 + Math.floor(this.y) * 7) % (CONFIG.canvas.w - 2 * margin));
    if (this.seq >= this.commands.length) this.dead = true;
  }
  update(dt, time) {
    this.y += this.vy * dt;
    this.x += Math.sin(time * 1.6) * 40 * dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
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
    ctx.restore();
  }
}

export class Particle {
  constructor(x, y, color) {
    // echter Radial-Burst (Browser-only, nie unit-getestet → Math.random ok)
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 180;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp - 40;          // leichter Aufwärts-Bias
    this.life = 0.4 + Math.random() * 0.35;
    this.max = this.life; this.color = color; this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 380 * dt;   // Gravitation
    this.life -= dt; if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}

// Fallendes Code-Zeichen beim Bug-Kill: der Bug „zerfällt" sichtbar in Quelltext-Trümmer.
// Erst nach oben/außen geschleudert, dann zieht Gravitation es runter → es regnet Code.
export class CodeBit {
  static GLYPHS = ["{", "}", "(", ")", ";", "/", "<", ">", "=", "0", "1", "*", "+", "$", "_", "λ"];
  static COLORS = ["#7ee787", "#79c0ff", "#d2a8ff", "#ffd23f", "#ff7b72"];   // Syntax-Palette
  constructor(x, y) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 130;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp * 0.65;
    this.vy = Math.sin(a) * sp - 130;                                   // Aufwärts-Bias → Bogen
    this.char = CodeBit.GLYPHS[(Math.random() * CodeBit.GLYPHS.length) | 0];
    this.color = CodeBit.COLORS[(Math.random() * CodeBit.COLORS.length) | 0];
    this.size = 12 + ((Math.random() * 7) | 0);
    this.rot = Math.random() * Math.PI * 2;
    this.vr = (Math.random() * 2 - 1) * 7;                              // Drehung im Flug
    this.life = 0.8 + Math.random() * 0.55;
    this.max = this.life; this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 520 * dt;  // Gravitation
    this.vx *= 0.99;
    this.rot += this.vr * dt;
    this.life -= dt; if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(this.char, 0, 0);
    ctx.restore();
  }
}

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
