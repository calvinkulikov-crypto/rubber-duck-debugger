import { CONFIG } from "./config.js";
import { Duck, Beam, Bug, Boss, Particle, CodeBit, FloatingText, Ring } from "./entities.js";
import {
  waveBudget, waveSpeedMultiplier, isBossWave,
  bugReachedFloor, beamHitsBug, comboMultiplier, scoreForKill,
  pickTargetByBuffer, tokenizeLine,
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
    this.codeBits = [];        // fallende Code-Zeichen beim Kill (Bug zerfällt in Quelltext)
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
    this.slowmo = 0;           // > 0 = Slow-Mo aktiv (/compact-Effekt), skaliert Bug-Tempo
    this.bossPending = false;
    this.codeLines = [
      "function fixBug(duck) {", "  while (bugs.length) {", "    duck.explain(bug);",
      "    if (bug.solved) ship();", "  }", "  return clean;", "}",
      "const debugDuck = new Duck();", "debugDuck.quack();", "// TODO: more tests",
    ];
    this.corrupted = [];     // Indizes korrumpierter Zeilen
    this.rings = [];
    this.hitstop = 0;       // > 0 = kurzer Impact-Freeze des Spielfelds
    this.typedPunch = 0;    // > 0 = Terminal-Text-Bounce nach Tastendruck
    this.muted = this.sound ? this.sound.muted : false;
    this._mult = 1;         // letzter Multiplikator → Combo-Arpeggio/Flow-Trigger
    this.leaked = 0; this.newBest = false;
    this.skillFlash = 0;    // > 0 = kurzer lila Ganzfeld-Flash nach /ultrathink
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
    else if (this.state === STATE.GAMEOVER) this.state = STATE.TITLE;
  }

  updateIntro(dt) {
    const it = this.intro;
    const line = it.lines[it.li];
    if (it.ci < line.text.length) {
      it.t += dt;
      while (it.t >= 1 / it.cps && it.ci < line.text.length) {
        it.t -= 1 / it.cps; it.ci += 1;
        if (line.text[it.ci - 1] !== " ") this.sound?.keyClick?.(0);   // Tipp-Klick pro Zeichen
      }
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
    this.target.flash = 0.08;                              // Ziel blitzt kurz weiß
    this.shake = Math.max(this.shake, 0.05);               // Mini-Screen-Kick
    this.typedPunch = 0.12;                                // Terminal-Bounce
    // pro korrektem Zeichen ein Execute-Strahl von der Ente zum Ziel
    const m = this.duck.muzzle();
    this.beams.push(new Beam(m.x, m.y, this.target.x, this.target.y));
    this.duck.triggerRecoil();
    this.fireCd = CONFIG.beam.cooldown;
    this.sound?.fire();
    this.sound?.keyClick(this.combo);
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
    // seltener Spezial-Bug (deterministisch-pseudo) → Effekt-Bug aus CONFIG.specials
    if (((this.time * 271) % 1) < CONFIG.specialChance && CONFIG.specials.length) {
      const s = CONFIG.specials[Math.floor((this.time * 53) % CONFIG.specials.length)];
      const x = s.r + ((this.time * 733) % (CONFIG.canvas.w - 2 * s.r));
      this.bugs.push(new Bug(null, x, this.speedMult, this.time, s));
      return;
    }
    const roll = (this.time * 131) % 1;             // deterministisch-pseudo
    const key = roll < 0.18 ? "tank" : roll < 0.5 ? "fast" : "standard";
    const t = CONFIG.bugTypes[key];
    const x = t.r + ((this.time * 733) % (CONFIG.canvas.w - 2 * t.r));
    this.bugs.push(new Bug(key, x, this.speedMult, this.time));
  }

  multiplier() { return comboMultiplier(this.combo, CONFIG.combo.perTier, CONFIG.combo.multCap); }

  // lebt gerade ein Boss auf dem Feld? → Arena-Alarm + Tension-Drone
  bossActive() { return this.bugs.some((b) => b.isBoss && !b.dead && !b.escaped); }

  onKill(bug) {
    this.combo += 1;
    this.hitstop = 0.05;
    this.rings.push(new Ring(bug.x, bug.y, bug.color));
    this.comboTimer = CONFIG.combo.timeout;
    this.score += scoreForKill(bug.points, this.multiplier());
    const burst = bug.isBoss ? 28 : 10;
    for (let i = 0; i < burst; i++) this.particles.push(new Particle(bug.x, bug.y, bug.color));
    // Bug zerfällt in fallende Code-Zeichen (on-theme „Bug wird zu Quelltext")
    const bits = bug.isBoss ? 22 : 9;
    for (let i = 0; i < bits; i++) this.codeBits.push(new CodeBit(bug.x, bug.y));
    this.texts.push(new FloatingText(bug.x, bug.y, bug.label, "#c9d1d9"));
    const mult = this.multiplier();
    if (mult > 1) this.texts.push(new FloatingText(bug.x, bug.y - 18, `×${mult}`, "#7ee787"));
    if (bug.isBoss) this.shake = Math.max(this.shake, 0.3);
    // Ente quakt beim Bug-Kill (Tonhöhe ∝ Combo); Boss bleibt beim wuchtigen bossHit
    if (bug.isBoss) this.sound?.bossHit(); else this.sound?.quack(this.combo);
    if (bug.special) this.applySpecial(bug.effect, bug);
    if (this.combo % CONFIG.skill.comboTrigger === 0) this.useSkill();
  }

  // /ultrathink-Superpower (auto bei comboTrigger): alle Nicht-Boss-Bugs auflösen +
  // kurze Slow-Mo zum Durchatmen. Boss bleibt verschont (muss „von Hand" getippt werden).
  useSkill() {
    if (this.state !== STATE.PLAYING) return false;
    let n = 0;
    for (const b of this.bugs) {
      if (b.dead || b.escaped || b.isBoss) continue;
      b.dead = true; n += 1;
      this.score += scoreForKill(b.points, this.multiplier());
      this.rings.push(new Ring(b.x, b.y, b.color));
      for (let i = 0; i < 8; i++) this.particles.push(new Particle(b.x, b.y, b.color));
    }
    if (this.target && this.target.dead) this.releaseTarget();
    this.slowmo = Math.max(this.slowmo, CONFIG.skill.slowmo);
    this.shake = Math.max(this.shake, 0.45);
    this.hitstop = 0.12;
    this.skillFlash = 0.3;
    this.texts.push(new FloatingText(this.W / 2, this.H / 2 - 20, "⚡ /ultrathink", "#d2a8ff"));
    this.texts.push(new FloatingText(this.W / 2, this.H / 2 + 14, `${n} bugs resolved`, "#7ee787"));
    this.sound?.ultrathink?.();
    return true;
  }

  // Spezial-Bug-Effekte: Claude-Code-Commands mit Spielfeld-Wirkung.
  applySpecial(effect, src) {
    if (effect === "clear") {
      // /clear leert den Kontext → alle anderen lebenden Nicht-Boss-Bugs poppen (Panik-Knopf)
      for (const b of this.bugs) {
        if (b === src || b.dead || b.escaped || b.isBoss) continue;
        b.dead = true;
        for (let i = 0; i < 6; i++) this.particles.push(new Particle(b.x, b.y, b.color));
      }
      this.shake = Math.max(this.shake, 0.3);
      this.texts.push(new FloatingText(this.W / 2, this.H / 2, "CONTEXT CLEARED", "#58a6ff"));
      this.sound?.waveClear?.();
    } else if (effect === "slowmo") {
      // /compact → Verschnaufpause, Bugs in Zeitlupe
      this.slowmo = CONFIG.slowmoTime;
      this.texts.push(new FloatingText(this.W / 2, 150, "/compact — SLOW-MO", "#7ee787"));
    } else if (effect === "bonus") {
      // /cost → Token-Bonus, Score-Windfall
      this.score += CONFIG.bonusScore;
      this.texts.push(new FloatingText(src.x, src.y - 20, `+${CONFIG.bonusScore}`, "#ffd23f"));
    }
  }

  onEscape(bug) {
    this.lives -= 1;
    this.leaked += 1;
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
    this.shake = 0.5;            // crisp Death-Punch → klingt im GAMEOVER-Update kurz aus
    this.newBest = this.score > this.best;
    if (this.newBest) { this.best = this.score; this.saveBest(); }
    this.sound?.gameOver();
    if (this.newBest) this.sound?.waveClear();   // Belohnungs-Chime für neue Bestmarke
  }

  loadBest() { try { return parseInt(localStorage.getItem("rdd_best") || "0", 10) || 0; } catch { return 0; } }
  saveBest() { try { localStorage.setItem("rdd_best", String(this.best)); } catch { /* privater modus: nur in-memory */ } }

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

  update(dt) {
    if (this.state === STATE.INTRO) { this.time += dt; this.updateIntro(dt); return; }
    if (this.state === STATE.GAMEOVER) {
      this.time += dt;                                                  // Cursor-Blink im Build-Log
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2); // kurz wackeln → still
      this.sound?.stopDrone?.();
      return;
    }
    if (this.state !== STATE.PLAYING) { this.sound?.stopDrone?.(); return; }  // Pause/Title → Drone aus
    this.time += dt;
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); dt *= 0.1; }
    if (this.typedPunch > 0) this.typedPunch = Math.max(0, this.typedPunch - dt);
    if (this.skillFlash > 0) this.skillFlash = Math.max(0, this.skillFlash - dt);
    if (this.wave === 0) this.startWave();          // erste Welle starten

    if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - dt);
    const ts = this.slowmo > 0 ? CONFIG.slowmoScale : 1;   // Slow-Mo skaliert Bug-Tempo + Spawn

    if (this.banner > 0) {
      this.banner -= dt;
    } else if (this.toSpawn > 0) {
      this.spawnTimer -= dt * ts;
      if (this.spawnTimer <= 0) { this.spawnBug(); this.toSpawn -= 1; this.spawnTimer = this.spawnInterval(); }
    }

    // Ente zielt automatisch: gleitet unter das gelockte Ziel, sonst zur Mitte
    this.input.mouseX = this.target ? this.target.x : this.W / 2;
    this.duck.update(dt, this.input);

    // Beams sind rein kosmetisch (in handleChar gespawnt) → nur fortbewegen
    this.fireCd -= dt;
    for (const b of this.beams) b.update(dt);
    for (const bug of this.bugs) bug.update(dt * ts, this.time);   // Bugs in Slow-Mo, Strahlen/Juice normal
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

    // Boss-Tension-Drone an Boss-Präsenz koppeln (idempotent → jeder Frame ok)
    if (this.bossActive()) this.sound?.startDrone?.(); else this.sound?.stopDrone?.();

    // Combo-Timeout
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    const mult = this.multiplier();
    if (mult > this._mult) {
      this.sound?.comboUp(mult);
      if (mult >= CONFIG.combo.multCap && this._mult < CONFIG.combo.multCap) {
        this.texts.push(new FloatingText(this.W / 2, this.H / 2 - 60, "⚡ IN THE ZONE", "#7ee787"));
      }
    }
    this._mult = mult;

    // Juice: Partikel/Texte tickern, Screen-Shake abklingen
    for (const p of this.particles) p.update(dt);
    for (const c of this.codeBits) c.update(dt);
    for (const t of this.texts) t.update(dt);
    this.particles = this.particles.filter((p) => !p.dead);
    this.codeBits = this.codeBits.filter((c) => !c.dead);
    this.texts = this.texts.filter((t) => !t.dead);
    for (const r of this.rings) r.update(dt);
    this.rings = this.rings.filter((r) => !r.dead);
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

  // Minimal-Wasser am Editor-Boden: die Gummiente schwimmt auf der "Code-Oberfläche".
  // Bewusst transluzent → Terminal/IDE-Look (Alleinstellungsmerkmal) bleibt lesbar.
  drawWater(ctx) {
    const s = CONFIG.floorY;             // Wasseroberfläche = Editor-Bodenlinie
    const t = this.time;
    ctx.save();
    // transluzenter Wasserkörper (Verlauf nach unten auslaufend)
    const g = ctx.createLinearGradient(0, s, 0, this.H);
    g.addColorStop(0, "rgba(56,139,253,0.12)");
    g.addColorStop(1, "rgba(56,139,253,0.03)");
    ctx.fillStyle = g;
    ctx.fillRect(0, s, this.W, this.H - s);
    // animierte Wellen-Oberfläche (zwei überlagerte Sinus → unregelmäßig)
    ctx.beginPath();
    ctx.moveTo(0, s);
    for (let x = 0; x <= this.W; x += 14) {
      const y = s + Math.sin(x * 0.035 + t * 2) * 2.2 + Math.sin(x * 0.013 - t * 1.3) * 1.6;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(88,166,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(88,166,255,0.5)";
    ctx.shadowBlur = 6;
    ctx.stroke();
    // expandierende Ripple unter der Ente
    ctx.shadowBlur = 0;
    const rp = (t % 1.6) / 1.6;
    ctx.globalAlpha = Math.max(0, 1 - rp) * 0.5;
    ctx.strokeStyle = "rgba(88,166,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(this.duck.x, s + 6, 16 + rp * 26, 3 + rp * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawTerminal(ctx) {
    const y = CONFIG.floorY + 30;
    ctx.textAlign = "left";
    ctx.font = "20px ui-monospace, monospace";
    ctx.fillStyle = "#7ee787";
    ctx.fillText("›", 18, y);
    ctx.fillStyle = "#c9d1d9";
    const dy = this.typedPunch > 0 ? -Math.sin((1 - this.typedPunch / 0.12) * Math.PI) * 3 : 0;
    ctx.fillText(this.typed, 40, y + dy);
    const w = ctx.measureText(this.typed).width;
    // Autocomplete-Ghost: Rest des gelockten Commands grau vorgeschlagen (Claude-Code-Feel) →
    // Cursor sitzt an der Naht zwischen Getipptem und Vorschlag, du tippst über den Ghost.
    if (this.typed && this.target && this.target.command && this.target.command.startsWith(this.typed)) {
      ctx.fillStyle = "#484f58";
      ctx.fillText(this.target.command.slice(this.typed.length), 40 + w, y + dy);
    }
    // blinkender Cursor hinter dem Getippten
    if ((Math.floor(this.time * 2) % 2) === 0) {
      ctx.fillStyle = "#7ee787";
      ctx.fillRect(42 + w, y - 15, 9, 18);
    }
    if (!this.target) {
      ctx.fillStyle = "#6e7681";
      ctx.font = "13px ui-monospace, monospace";
      ctx.fillText("tipp einen /command, um einen Bug zu fixen", 40, y + 22);
    }
  }

  // Boss-Arena-Alarm: solang ein Boss lebt, dunkelt die Arena ab und ein roter Rand-Puls
  // signalisiert „Incident". Screen-space-Overlay über den Entities, unter HUD/Terminal
  // (die bleiben crisp). Mitte bleibt klar → Boss + getippter Command lesbar.
  drawBossAlarm(ctx) {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5.5);
    ctx.fillStyle = `rgba(60,0,0,${0.10 + 0.07 * pulse})`;            // Arena leicht abdunkeln
    ctx.fillRect(0, 0, this.W, this.H);
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.30, this.W / 2, this.H / 2, this.H * 0.74);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(248,81,73,${0.26 + 0.22 * pulse})`);     // roter Rand-Glow, pulsierend
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 15px ui-monospace, monospace";
    ctx.fillStyle = `rgba(248,81,73,${0.55 + 0.45 * pulse})`;
    ctx.fillText("⚠  INCIDENT  ⚠", this.W / 2, 96);
    ctx.restore();
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
    if (this.slowmo > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#7ee787";
      ctx.font = "14px ui-monospace, monospace";
      ctx.fillText("◴ compacting…", 16, 50);
    }
    // /ultrathink — Fortschrittsbalken zur nächsten Auto-Combo-Superpower
    const trig = CONFIG.skill.comboTrigger;
    const prog = this.combo % trig;
    const bx = 16, by = 74, bw = 132, bh = 7;
    ctx.textAlign = "left";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = "#6e7681";
    ctx.fillText(`/ultrathink  ${prog}/${trig}`, bx, by - 5);
    ctx.fillStyle = "#21262d"; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#3f4651";
    ctx.fillRect(bx, by, bw * (prog / trig), bh);
  }

  drawPlayfield(ctx) {
    this.drawBackground(ctx);
    this.drawWater(ctx);
    for (const bug of this.bugs) bug.draw(ctx, this.time);
    for (const b of this.beams) b.draw(ctx);
    this.duck.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const c of this.codeBits) c.draw(ctx);
    for (const r of this.rings) r.draw(ctx);
    for (const t of this.texts) t.draw(ctx);
    if (this.bossActive()) this.drawBossAlarm(ctx);
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
    let caretX = 110, caretY = y;       // Cursor folgt dem Ende der aktiven Tipp-Zeile
    for (let i = 0; i <= it.li; i++) {
      const line = it.lines[i];
      const shown = i < it.li ? line.text : line.text.slice(0, it.ci);
      ctx.font = "14px ui-monospace, monospace";
      ctx.fillStyle = line.who === "you" ? "#7ee787" : "#e5c07b";
      ctx.fillText(line.who === "you" ? "you ›" : "claude ›", 40, y);
      ctx.fillStyle = "#c9d1d9";
      ctx.font = "18px ui-monospace, monospace";
      const wrapped = shown.match(/.{1,62}(\s|$)/g) || [shown];   // grober Umbruch bei ~62 Zeichen
      for (let k = 0; k < wrapped.length; k++) {
        ctx.fillText(wrapped[k], 110, y);
        if (i === it.li && k === wrapped.length - 1) {            // Naht hinter dem letzten Zeichen
          caretX = 110 + ctx.measureText(wrapped[k]).width;
          caretY = y;
        }
        y += 28;
      }
      y += 16;
    }
    // blinkender Cursor sitzt an der Naht der aktiven Zeile → wirkt wie lebendiges Tippen
    if ((Math.floor(this.time * 2) % 2) === 0) {
      ctx.fillStyle = "#7ee787"; ctx.fillRect(caretX + 3, caretY - 15, 9, 18);
    }
    ctx.fillStyle = "#6e7681"; ctx.font = "13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Enter / Klick = überspringen", this.W / 2, this.H - 40);
  }

  drawTitle(ctx) {
    this.drawBackground(ctx);
    ctx.fillStyle = "rgba(13,17,23,0.78)"; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = "center";
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    ctx.save();
    ctx.fillStyle = "#ffd23f";
    ctx.font = "44px ui-monospace, monospace";
    ctx.shadowColor = "#ffd23f";
    ctx.shadowBlur = 12 + pulse * 18;                       // pulsierender Glow
    ctx.fillText("🦆 Rubber Duck Debugger", this.W / 2, 190);
    ctx.restore();
    ctx.fillStyle = "#c9d1d9"; ctx.font = "17px ui-monospace, monospace";
    ctx.fillText("Tippe die Claude-Code-/commands, die auf den Bugs stehen.", this.W / 2, 228);
    ctx.fillStyle = "#8b949e"; ctx.font = "13px ui-monospace, monospace";
    ctx.fillText("Beliebige Reihenfolge  ·  Backspace = korrigieren  ·  Tippfehler bricht Combo", this.W / 2, 256);
    // Trennlinie
    ctx.strokeStyle = "#21262d"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(this.W / 2 - 220, 272); ctx.lineTo(this.W / 2 + 220, 272); ctx.stroke();
    // Sonder-Bugs Legende + /ultrathink
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillStyle = "#6e7681"; ctx.fillText("— Sonder-Bugs —", this.W / 2, 289);
    const lx = this.W / 2 - 160, rx = this.W / 2 - 50;
    ctx.textAlign = "left"; ctx.font = "14px ui-monospace, monospace";
    ctx.fillStyle = "#58a6ff"; ctx.fillText("/clear", lx, 313);
    ctx.fillStyle = "#8b949e"; ctx.fillText("leert das Feld sofort", rx, 313);
    ctx.fillStyle = "#7ee787"; ctx.fillText("/compact", lx, 335);
    ctx.fillStyle = "#8b949e"; ctx.fillText("Bugs in Zeitlupe", rx, 335);
    ctx.fillStyle = "#ffd23f"; ctx.fillText("/cost", lx, 357);
    ctx.fillStyle = "#8b949e"; ctx.fillText("+1500 Bonus-Score", rx, 357);
    // Trennlinie
    ctx.strokeStyle = "#21262d";
    ctx.beginPath(); ctx.moveTo(this.W / 2 - 220, 371); ctx.lineTo(this.W / 2 + 220, 371); ctx.stroke();
    // /ultrathink
    ctx.textAlign = "center"; ctx.font = "12px ui-monospace, monospace";
    ctx.fillStyle = "#6e7681"; ctx.fillText("— Superpower —", this.W / 2, 388);
    ctx.textAlign = "left"; ctx.font = "14px ui-monospace, monospace";
    ctx.fillStyle = "#d2a8ff"; ctx.fillText("⚡ /ultrathink", lx, 410);
    ctx.fillStyle = "#8b949e"; ctx.fillText("× 15 Kombi → Auto-Clear + Slow-Mo", rx, 410);
    ctx.textAlign = "center";
    ctx.fillStyle = "#7ee787"; ctx.font = "20px ui-monospace, monospace";
    if ((Math.floor(this.time * 2) % 2) === 0) ctx.fillText("▶ Klick zum Start", this.W / 2, 448);
    ctx.fillStyle = "#8b949e"; ctx.font = "14px ui-monospace, monospace";
    ctx.fillText(`Best: ${this.best}`, this.W / 2, 476);
    // Touch-Geräte: Hinweis, damit ein Judge am Handy nicht vor totem Spiel sitzt
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      ctx.fillStyle = "#e5c07b"; ctx.font = "14px ui-monospace, monospace";
      ctx.fillText("Am besten am Desktop mit Maus/Tastatur spielen.", this.W / 2, 492);
    }
  }

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
    if ((Math.floor(this.time * 2) % 2) === 0) ctx.fillText("› Enter / Klick = zum Menü", this.W / 2, ly + 40);
  }

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
    // /ultrathink-Flash: kurzer lila Ganzfeld-Wash beim Auslösen der Superpower
    if (this.skillFlash > 0) {
      ctx.fillStyle = `rgba(210,168,255,${this.skillFlash * 0.5})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
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
    if (this.state === STATE.PLAYING) this.drawFlow(ctx);
    this.drawFX(ctx);     // Post-Process zuletzt, screen-space (kein Shake-Jitter)
    this.drawMute(ctx);   // immer sichtbar/klickbar, über dem Post-Process
  }
}
