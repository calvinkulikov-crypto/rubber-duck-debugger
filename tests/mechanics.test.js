import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clamp, comboMultiplier, scoreForKill,
  waveBudget, waveSpeedMultiplier, isBossWave,
  bugReachedFloor, beamHitsBug,
  matchCommand, pickTarget, pickTargetByBuffer,
  tokenizeLine,
} from "../mechanics.js";
import { Bug } from "../entities.js";
import { CONFIG } from "../config.js";

test("clamp begrenzt nach unten/oben", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test("comboMultiplier steigt pro Tier, gedeckelt", () => {
  assert.equal(comboMultiplier(0, 5, 8), 1);
  assert.equal(comboMultiplier(4, 5, 8), 1);
  assert.equal(comboMultiplier(5, 5, 8), 2);
  assert.equal(comboMultiplier(34, 5, 8), 7);
  assert.equal(comboMultiplier(1000, 5, 8), 8);   // cap
});

test("scoreForKill = base * multiplier", () => {
  assert.equal(scoreForKill(100, 3), 300);
});

test("waveBudget = base + wave*per (1-indexiert)", () => {
  assert.equal(waveBudget(1, 4, 2), 6);
  assert.equal(waveBudget(3, 4, 2), 10);
});

test("waveSpeedMultiplier wächst exponentiell ab Welle 1", () => {
  assert.equal(waveSpeedMultiplier(1, 1.08), 1);
  assert.ok(Math.abs(waveSpeedMultiplier(2, 1.08) - 1.08) < 1e-9);
});

test("isBossWave bei Vielfachen von every", () => {
  assert.equal(isBossWave(5, 5), true);
  assert.equal(isBossWave(10, 5), true);
  assert.equal(isBossWave(7, 5), false);
});

test("bugReachedFloor wenn Unterkante >= floorY", () => {
  assert.equal(bugReachedFloor({ y: 500, r: 18 }, 540), false);
  assert.equal(bugReachedFloor({ y: 525, r: 18 }, 540), true);
});

test("beamHitsBug: vertikales Segment vs Kreis", () => {
  const bug = { x: 400, y: 200, r: 18 };
  assert.equal(beamHitsBug({ x: 400, y: 215, len: 26, width: 6 }, bug), true);   // direkt drunter, überlappt
  assert.equal(beamHitsBug({ x: 460, y: 215, len: 26, width: 6 }, bug), false);  // seitlich daneben
  assert.equal(beamHitsBug({ x: 400, y: 400, len: 26, width: 6 }, bug), false);  // zu weit weg vertikal
});

test("matchCommand: korrekter nächster Buchstabe schreitet voran", () => {
  assert.deepEqual(matchCommand("/fix", "", "/"), { ok: true, buffer: "/", complete: false });
  assert.deepEqual(matchCommand("/fix", "/fi", "x"), { ok: true, buffer: "/fix", complete: true });
});

test("matchCommand: falscher Buchstabe = Syntax-Error, Buffer unverändert", () => {
  assert.deepEqual(matchCommand("/fix", "/f", "z"), { ok: false, buffer: "/f", complete: false });
});

test("pickTarget: tiefster (größtes y) Bug mit passendem ersten Zeichen", () => {
  const bugs = [
    { command: "/fix", y: 100, dead: false },
    { command: "/test", y: 300, dead: false },
    { command: "/fix", y: 250, dead: false },
  ];
  assert.equal(pickTarget(bugs, "/"), 1); // y=300 am tiefsten
});

test("pickTarget: kein passender Bug → -1", () => {
  assert.equal(pickTarget([{ command: "/fix", y: 100, dead: false }], "x"), -1);
});

test("pickTarget: tote Bugs werden ignoriert", () => {
  const bugs = [{ command: "/fix", y: 400, dead: true }, { command: "/fix", y: 100, dead: false }];
  assert.equal(pickTarget(bugs, "/"), 1);
});

test("pickTargetByBuffer: tiefster Bug dessen command mit buffer beginnt", () => {
  const bugs = [
    { command: "/fix",      y: 100, dead: false },
    { command: "/refactor", y: 300, dead: false },
    { command: "/fix",      y: 250, dead: false },
  ];
  assert.equal(pickTargetByBuffer(bugs, "/fi"), 2);   // y=250 tiefer als y=100, /refactor passt nicht
  assert.equal(pickTargetByBuffer(bugs, "/ref"), 1);  // nur /refactor passt
});

test("pickTargetByBuffer: kein passender Bug → -1", () => {
  assert.equal(pickTargetByBuffer([{ command: "/fix", y: 100, dead: false }], "/test"), -1);
});

test("pickTargetByBuffer: tote Bugs werden ignoriert", () => {
  const bugs = [{ command: "/fix", y: 400, dead: true }, { command: "/fix", y: 100, dead: false }];
  assert.equal(pickTargetByBuffer(bugs, "/fix"), 1);
});

test("Bug special: Spec überschreibt command/effect/flag, hp=1", () => {
  const clear = CONFIG.specials.find((s) => s.effect === "clear");
  const bug = new Bug(null, 100, 1, 0.5, clear);
  assert.equal(bug.special, true);
  assert.equal(bug.effect, "clear");
  assert.equal(bug.command, clear.command);
  assert.equal(bug.hp, 1);
  assert.equal(bug.isBoss, false);
});

test("Bug normal: special bleibt false, command aus typeKey-Pool", () => {
  const bug = new Bug("standard", 100, 1, 0.5);
  assert.equal(bug.special, false);
  assert.equal(bug.effect, null);
  assert.ok(CONFIG.bugTypes.standard.commands.includes(bug.command));
});

test("pickTargetByBuffer trennt /c-Spezial-Commands sauber", () => {
  const bugs = [
    { command: "/clear",   y: 200, dead: false },
    { command: "/compact", y: 300, dead: false },
    { command: "/cost",    y: 250, dead: false },
  ];
  assert.equal(pickTargetByBuffer(bugs, "/cl"), 0);  // nur /clear
  assert.equal(pickTargetByBuffer(bugs, "/com"), 1); // nur /compact
  assert.equal(pickTargetByBuffer(bugs, "/cos"), 2); // nur /cost
});

test("tokenizeLine reconstructs the original line exactly", () => {
  const line = "const debugDuck = new Duck();";
  const toks = tokenizeLine(line);
  assert.equal(toks.map((t) => t.text).join(""), line);
});

test("tokenizeLine colors keywords and comments", () => {
  const kw = tokenizeLine("  return clean;");
  const ret = kw.find((t) => t.text === "return");
  assert.equal(ret.color, "#ff7b72");
  const c = tokenizeLine("// TODO: more tests");
  assert.equal(c[0].text, "// TODO: more tests");
  assert.equal(c[0].color, "#8b949e");
});

test("tokenizeLine flags function-call names", () => {
  const toks = tokenizeLine("debugDuck.quack();");
  const quack = toks.find((t) => t.text === "quack");
  assert.equal(quack.color, "#d2a8ff");
});
