// Synthetisierte Effekte. Kein Asset, kein 404. Bei fehlendem WebAudio: still.
export class Sound {
  constructor() { this.ctx = null; this.ok = false; this.muted = false; this.drone = null; this.music = null; }
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
  setMuted(m) { this.muted = m; if (m) { this.stopDrone(); this.stopMusic(); } }

  // Einzelne, zeitlich GEPLANTE Note (blip nutzt currentTime → reicht für den Sequencer nicht).
  tone(freq, startT, dur, gain, type = "triangle") {
    if (!this.ok) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, startT);
    g.gain.setValueAtTime(0.0001, startT);
    g.gain.exponentialRampToValueAtTime(gain, startT + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(startT); o.stop(startT + dur + 0.03);
  }

  // Permanente Hintergrund-Melodie: sanfter Pentatonik-Arpeggio + Bass, leise (unter den Effekten).
  // Lookahead-Scheduler (setTimeout + 0.25s Vorlauf) → robustes Timing trotz Frame-Jank/Tab-Wechsel.
  startMusic() {
    if (!this.ok || this.muted || this.music) return;
    const NOTES = [220.00, 261.63, 329.63, 392.00, 329.63, 261.63, 196.00, 246.94,
                   220.00, 261.63, 329.63, 261.63, 174.61, 220.00, 261.63, 220.00];
    const STEP = 0.28;
    this.music = { step: 0, next: this.ctx.currentTime + 0.08, timer: null };
    const tick = () => {
      const m = this.music;
      if (!m) return;
      if (this.muted) { this.stopMusic(); return; }
      const now = this.ctx.currentTime;
      if (m.next < now) m.next = now + 0.05;                       // Resync nach Jank/Tab-Wechsel
      while (m.next < now + 0.25) {                                // 250ms Lookahead
        const f = NOTES[m.step % NOTES.length];
        this.tone(f, m.next, STEP * 0.9, 0.020, "triangle");      // weicher Arpeggio-Pluck
        if (m.step % 4 === 0) this.tone(f / 2, m.next, STEP * 1.9, 0.016, "sine");  // Bass alle 4 Steps
        m.next += STEP;
        m.step += 1;
      }
      m.timer = setTimeout(tick, 60);
    };
    tick();
  }
  stopMusic() {
    if (!this.music) return;
    if (this.music.timer) clearTimeout(this.music.timer);
    this.music = null;
  }
  // Boss-Tension-Drone: tiefer, dumpfer Dauerton solang der Boss lebt (Game steuert Start/Stop).
  //  • Sägezahn-Grundton (55 Hz) + Sinus-Quinte, durch Lowpass → bedrohlich-dumpf
  //  • langsames Tremolo (0.7 Hz) → „atmende" Spannung
  // Idempotent: startDrone() ohne Effekt wenn schon läuft, stopDrone() wenn keiner läuft.
  startDrone() {
    if (!this.ok || this.muted || this.drone) return;
    const t = this.ctx.currentTime;
    const o1 = this.ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 55;
    const o2 = this.ctx.createOscillator(); o2.type = "sine";     o2.frequency.value = 82.5;
    const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.8);            // langsam einblenden
    const lfo = this.ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.7;
    const lfoDepth = this.ctx.createGain(); lfoDepth.gain.value = 0.02;
    lfo.connect(lfoDepth); lfoDepth.connect(g.gain);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.ctx.destination);
    o1.start(t); o2.start(t); lfo.start(t);
    this.drone = { o1, o2, lfo, g };
  }
  stopDrone() {
    if (!this.drone) return;
    const { o1, o2, lfo, g } = this.drone;
    this.drone = null;
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);         // sauber ausblenden
    o1.stop(t + 0.32); o2.stop(t + 0.32); lfo.stop(t + 0.32);
  }
  keyClick(combo) { this.blip(300 + Math.min(combo, 14) * 36, 0.035, "square", 0.025); }
  comboUp(tier) {
    const base = 480 + tier * 55;
    for (let i = 0; i < 3; i++) this.blip(base * (1 + i * 0.26), 0.09, "sine", 0.035);
  }
  fire()      { this.blip(680, 0.08, "square", 0.04, 880); }
  pop()       { this.blip(420, 0.12, "triangle", 0.07, 120); }
  // Gummiente quakt beim Bug-Kill. Aufbau für echten "Quack"-Charakter:
  //  • zwei leicht verstimmte Sägezähne → rauer, "rotziger" Grundton (kein dünner Sinus)
  //  • Pitch-Kontur kurz rauf ("qu") dann runter ("ack")
  //  • Bandpass-Formant sweept runter → nasaler Vokal (offen→geschlossen)
  //  • schnelles Tremolo auf der Amplitude → typisches Enten-Schnattern
  // Grundton steigt mit Combo → "quak-quak-quak"-Crescendo. Gain hoch genug über fire/keyClick.
  quack(combo = 0) {
    if (!this.ok || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.22;
    const base = 235 + Math.min(combo, 14) * 10;
    const o1 = this.ctx.createOscillator(); o1.type = "sawtooth";
    const o2 = this.ctx.createOscillator(); o2.type = "sawtooth"; o2.detune.value = 22;
    for (const o of [o1, o2]) {
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * 1.65, t + 0.045);    // "qu-"
      o.frequency.exponentialRampToValueAtTime(base * 0.72, t + dur); // "-ack" runter
    }
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = 4.5;
    f.frequency.setValueAtTime(1500, t);
    f.frequency.exponentialRampToValueAtTime(650, t + dur);           // Formant schließt
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // Tremolo-Schnatter: Sinus-LFO addiert sich auf die Haupt-Gain
    const lfo = this.ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 30;
    const lfoDepth = this.ctx.createGain(); lfoDepth.gain.value = 0.04;
    lfo.connect(lfoDepth); lfoDepth.connect(g.gain);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.ctx.destination);
    o1.start(t); o2.start(t); lfo.start(t);
    o1.stop(t + dur); o2.stop(t + dur); lfo.stop(t + dur);
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
