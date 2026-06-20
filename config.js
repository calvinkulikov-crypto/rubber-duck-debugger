// Alle Tuning-Konstanten an einem Ort. Im Playtest justieren.
export const CONFIG = {
  canvas: { w: 800, h: 600 },
  floorY: 540,                 // ab hier "korrumpiert" ein Bug eine Code-Zeile
  duck: { w: 76, h: 64, y: 542, moveSpeed: 540, recoilTime: 0.12 },
  beam: { speed: 920, width: 6, len: 26, cooldown: 0.16 },
  combo: { perTier: 5, multCap: 8, timeout: 5 },
  lives: 3,
  waves: {
    baseBudget: 4, perWave: 2, speedMult: 1.08, bossEvery: 5,
    bannerTime: 1.6, spawnIntervalBase: 0.9, spawnIntervalMin: 0.28,
  },
  bugTypes: {
    standard: { r: 18, vy: 60,  hp: 1, points: 100, color: "#e06c75",
      labels: ["off-by-one", "typo", "NaN", "undefined", "null ptr"] },
    fast:     { r: 12, vy: 130, hp: 1, points: 150, color: "#e5c07b",
      labels: ["memory leak", "flaky test", "404"] },
    tank:     { r: 26, vy: 45,  hp: 3, points: 300, color: "#c678dd",
      labels: ["race condition", "deadlock", "segfault"] },
  },
  boss: { r: 48, vy: 30, hp: 12, points: 2000, color: "#56b6c2", label: "Heisenbug" },
};
