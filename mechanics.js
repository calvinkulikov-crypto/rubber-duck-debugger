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
