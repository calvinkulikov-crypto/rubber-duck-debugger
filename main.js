import { CONFIG } from "./config.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1 / 30) dt = 1 / 30;            // großen Sprung (Tab-Blur) clampen
  // Platzhalter bis Task 3 die Game-Loop bringt:
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
  ctx.fillStyle = "#8b949e";
  ctx.font = "20px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("Scaffolding ok — Bootstrap läuft", CONFIG.canvas.w / 2, CONFIG.canvas.h / 2);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
