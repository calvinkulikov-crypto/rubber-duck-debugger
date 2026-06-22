import { CONFIG } from "./config.js";
import { Game, STATE } from "./game.js";
import { Sound } from "./audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const sound = new Sound();
const game = new Game(sound);

// AudioContext erst bei erster Nutzer-Geste erzeugen/aufwecken (Browser-Autoplay-Policy)
function unlockAudio() { sound.init(); sound.resume(); }
window.addEventListener("mousedown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });

function eventToCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * CONFIG.canvas.w,
    y: ((e.clientY - r.top) / r.height) * CONFIG.canvas.h,
  };
}

canvas.addEventListener("mousedown", (e) => {
  const p = eventToCanvas(e);
  if (game.hitMute(p.x, p.y)) { game.toggleMute(); return; }   // Mute zuerst, in jedem State
  if (game.state !== STATE.PLAYING) game.confirm();            // sonst Start/Skip/Restart
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") { e.preventDefault(); game.togglePause(); return; }
  // PAUSED: jede Taste (nicht nur Esc) setzt fort — verhindert Verwirrung nach visibilitychange
  if (game.state === STATE.PAUSED) {
    if (e.key.length === 1 || e.code === "Enter" || e.code === "Space") { e.preventDefault(); game.togglePause(); }
    return;
  }
  if (game.state !== STATE.PLAYING) {
    // Auf Intro/Title/GameOver: Enter/Space/Buchstabe = los
    if (e.code === "Enter" || e.code === "Space" || e.key.length === 1) { e.preventDefault(); game.confirm(); }
    return;
  }
  // PLAYING: Tippen
  if (e.code === "Backspace") { e.preventDefault(); game.handleBackspace(); return; }
  // ein druckbares Zeichen (inkl. "/") → Buffer; Modifier-Kombis ignorieren
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    game.handleChar(e.key);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === STATE.PLAYING) game.state = STATE.PAUSED;
});

// Hi-DPI-Schärfe: Backing-Store auf devicePixelRatio hochziehen, in 800x600-Koords zeichnen.
function setupHiDPI() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CONFIG.canvas.w * dpr;
  canvas.height = CONFIG.canvas.h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // draw() nutzt nur save/translate → DPR-Basis bleibt
}
setupHiDPI();

function showError(e) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f85149"; ctx.font = "bold 14px monospace";
  ctx.fillText("JS ERROR:", 20, 30);
  ctx.fillStyle = "#c9d1d9"; ctx.font = "12px monospace";
  String(e?.stack || e).split("\n").forEach((t, i) => ctx.fillText(t.slice(0, 90), 20, 56 + i * 18));
}
window.addEventListener("error", (ev) => showError(ev.error || ev.message));

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1 / 30) dt = 1 / 30;
  try {
    game.update(dt);
    game.draw(ctx);
  } catch (e) { showError(e); return; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
