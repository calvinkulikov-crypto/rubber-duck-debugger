// Synthetisierte Effekte. Kein Asset, kein 404. Bei fehlendem WebAudio: still.
export class Sound {
  constructor() { this.ctx = null; this.ok = false; this.muted = false; }
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC(); this.ok = true;
    } catch { this.ok = false; }
  }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }
  blip(freq, dur, type = "square", gain = 0.06, slideTo = null) {
    if (!this.ok || this.muted) return;
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
  setMuted(m) { this.muted = m; }
  keyClick(combo) { this.blip(300 + Math.min(combo, 14) * 36, 0.035, "square", 0.025); }
  comboUp(tier) {
    const base = 480 + tier * 55;
    for (let i = 0; i < 3; i++) this.blip(base * (1 + i * 0.26), 0.09, "sine", 0.035);
  }
  fire()      { this.blip(680, 0.08, "square", 0.04, 880); }
  pop()       { this.blip(420, 0.12, "triangle", 0.07, 120); }
  // Gummiente quakt beim Bug-Kill: nasaler Abwärts-Sweep (Sägezahn durch Bandpass),
  // Tonhöhe steigt mit der Combo → „quak-quak-quak"-Crescendo beim Chainen.
  quack(combo = 0) {
    if (!this.ok || this.muted) return;
    const t = this.ctx.currentTime;
    const base = 300 + Math.min(combo, 14) * 16;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 7;   // nasalisiert → entenartig
    o.type = "sawtooth";
    o.frequency.setValueAtTime(base * 1.7, t);
    o.frequency.exponentialRampToValueAtTime(base, t + 0.11);       // charakteristisches „waaak" runter
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(f); f.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.16);
  }
  tankHit()   { this.blip(160, 0.08, "sawtooth", 0.05); }
  bossHit()   { this.blip(240, 0.1, "sawtooth", 0.06, 90); }
  damage()    { this.blip(90, 0.3, "sawtooth", 0.09, 50); }
  waveClear() { this.blip(523, 0.1, "sine", 0.05, 784); }
  // /ultrathink-Superpower: aufsteigender Glitzer-Akkord → „Power entfesselt"
  ultrathink() {
    if (!this.ok || this.muted) return;
    const steps = [523, 659, 784, 1047, 1319];   // C-Dur-Arpeggio aufwärts
    for (let i = 0; i < steps.length; i++) this.blip(steps[i], 0.22, "sine", 0.05, steps[i] * 1.5);
  }
  gameOver()  { this.blip(330, 0.6, "sine", 0.08, 70); }
}
