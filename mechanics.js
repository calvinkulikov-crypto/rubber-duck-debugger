// Reine, DOM-freie Funktionen — von Browser UND node:test importierbar.
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const comboMultiplier = (combo, perTier, cap) =>
  Math.min(cap, 1 + Math.floor(combo / perTier));

export const scoreForKill = (basePoints, multiplier) => basePoints * multiplier;

export const waveBudget = (wave, base, per) => base + wave * per;

export const waveSpeedMultiplier = (wave, speedMult) => Math.pow(speedMult, wave - 1);

export const isBossWave = (wave, every) => wave % every === 0;

export const bugReachedFloor = (bug, floorY) => bug.y + bug.r >= floorY;

// beam: vertikales Segment von (x, y) nach oben bis (x, y-len), Dicke width.
// bug: Kreis (x, y, r). Treffer, wenn Abstand Kreismitte→Segment <= r + width/2.
export const beamHitsBug = (beam, bug) => {
  const yTop = beam.y - beam.len;
  const cy = clamp(bug.y, yTop, beam.y);     // nächster Punkt auf Segment in y
  const dx = beam.x - bug.x;
  const dy = cy - bug.y;
  const rad = bug.r + beam.width / 2;
  return dx * dx + dy * dy <= rad * rad;
};

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

// Ziel-Wahl per Buffer: tiefster lebender Bug, dessen command mit buffer beginnt; -1 wenn keiner.
export const pickTargetByBuffer = (bugs, buffer) => {
  let best = -1, bestY = -Infinity;
  for (let i = 0; i < bugs.length; i++) {
    const b = bugs[i];
    if (b.dead || !b.command) continue;
    if (b.command.startsWith(buffer) && b.y > bestY) { bestY = b.y; best = i; }
  }
  return best;
};

// Zerlegt eine Code-Zeile in farbige Tokens (GitHub-Dark-Palette). Rein → unit-testbar.
// Join aller token.text ergibt exakt die Eingabe (inkl. Whitespace).
export function tokenizeLine(line) {
  const KEYWORDS = ["function", "while", "if", "else", "return", "const", "let", "var", "new", "for"];
  const re = /(\/\/.*$)|("[^"]*"|'[^']*'|`[^`]*`)|([A-Za-z_$][\w$]*)|(\d+)|(\s+)|([^\w\s])/g;
  const tokens = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m[1]) tokens.push({ text: m[1], color: "#8b949e" });            // Kommentar
    else if (m[2]) tokens.push({ text: m[2], color: "#a5d6ff" });       // String
    else if (m[3]) {
      if (KEYWORDS.includes(m[3])) tokens.push({ text: m[3], color: "#ff7b72" });
      else {
        const after = line.slice(re.lastIndex);                         // Funktionsname wenn "(" folgt
        tokens.push({ text: m[3], color: /^\s*\(/.test(after) ? "#d2a8ff" : "#c9d1d9" });
      }
    } else if (m[4]) tokens.push({ text: m[4], color: "#79c0ff" });     // Zahl
    else if (m[5]) tokens.push({ text: m[5], color: "#c9d1d9" });       // Whitespace (zeichnet nichts)
    else if (m[6]) tokens.push({ text: m[6], color: "#c9d1d9" });       // Satzzeichen/Operator
  }
  return tokens;
}
