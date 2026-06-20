import { CONFIG } from "./config.js";
import { Game, STATE } from "./game.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const game = new Game();

// CSS-Pixel → interne Canvas-Koordinaten (Canvas wird per CSS skaliert)
function toCanvasX(clientX) {
  const r = canvas.getBoundingClientRect();
  return ((clientX - r.left) / r.width) * CONFIG.canvas.w;
}

canvas.addEventListener("mousemove", (e) => { game.input.mouseX = toCanvasX(e.clientX); });
canvas.addEventListener("mousedown", () => {
  if (game.state === STATE.PLAYING) game.input.firing = true;
  else game.confirm();
});
window.addEventListener("mouseup", () => { game.input.firing = false; });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") game.input.left = true;
  if (e.code === "ArrowRight") game.input.right = true;
  if (e.code === "Space") { e.preventDefault(); if (game.state === STATE.PLAYING) game.input.firing = true; else game.confirm(); }
  if (e.code === "KeyR" && game.state === STATE.GAMEOVER) game.start();
  if (e.code === "KeyP" || e.code === "Escape") game.togglePause();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") game.input.left = false;
  if (e.code === "ArrowRight") game.input.right = false;
  if (e.code === "Space") game.input.firing = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === STATE.PLAYING) game.state = STATE.PAUSED;
});

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1 / 30) dt = 1 / 30;
  game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
