// tests/smoke.mjs — headless Render/Update-Smoke gegen Stub-ctx (kein DOM nötig).
import { Game, STATE } from "../game.js";

function stubCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(_, p) {
      if (p === "measureText") return (s) => ({ width: String(s).length * 7 });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => grad;
      if (p === "createPattern") return () => ({});
      return () => {};            // jede Methode = no-op
    },
    set() { return true; },        // jede Property-Zuweisung schlucken
  });
}

const ctx = stubCtx();
const g = new Game(null);          // ohne Sound

// 1) jeden State zeichnen
for (const s of Object.values(STATE)) { g.state = s; g.draw(ctx); }

// 2) eine Runde simulieren (Spawns, Wellen, Boss, Escapes, GameOver-Pfad)
g.start();
for (let i = 0; i < 1800; i++) {
  g.update(1 / 60);
  if (i % 7 === 0) g.handleChar("/");   // Typing-Pfad + syntaxError anstoßen
  if (i % 7 === 1) g.handleChar("h");
  if (i % 50 === 0) g.handleBackspace();
  g.draw(ctx);
}

console.log("smoke ok");
