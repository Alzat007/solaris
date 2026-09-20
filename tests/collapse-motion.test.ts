import test from "node:test";
import assert from "node:assert/strict";
import { SolarEffectGesture } from "../src/gesture/GestureMotion";
import type { HandFeatures } from "../src/gesture/GestureTypes";

function palm(x: number): HandFeatures {
  return {
    center: { x, y: 0.5 },
    pointer: { x, y: 0.3 },
    velocity: { x: 0, y: 0 },
    scale: 0.18,
    openness: 0.8,
    pinchDistance: 1,
    pinchStrength: 0,
    gesture: "OPEN_PALM",
    confidence: 0.88,
    landmarks: [],
    palmFacing: false,
    palmDirection: [1, 0, 0.2],
  };
}
function replay() {
  const effect = new SolarEffectGesture();
  let time = 1000;
  let mode: "overview" | "collapse" = "overview";
  const events: string[] = [];
  return {
    effect,
    events,
    mode(value: typeof mode) {
      mode = value;
    },
    frame(span: number, noisyPose = false) {
      time += 50;
      const a = palm(0.5 - span / 2),
        b = palm(0.5 + span / 2);
      if (noisyPose) {
        a.gesture = "NONE";
        a.confidence = 0.4;
      }
      const event = effect.update(a, b, mode, time);
      if (event) events.push(event);
    },
    singleMoving(span: number) {
      time += 50;
      const event = effect.update(palm(0.2), palm(0.2 + span), mode, time);
      if (event) events.push(event);
    },
  };
}

test("natural inward motion with small jitter confirms before palms touch", () => {
  const r = replay();
  for (let i = 0; i < 8; i++) r.frame(0.58);
  for (let i = 0; i < 24; i++)
    r.frame(0.58 - 0.25 * Math.min(1, i / 17) + Math.sin(i * 2) * 0.008);
  assert.deepEqual(r.events, ["COLLAPSE"]);
  assert.equal(r.effect.progress, 1);
  for (let i = 0; i < 20; i++) r.frame(0.33);
  assert.equal(r.events.length, 1);
});

test("a 150ms uncertain palm pauses progress instead of restarting or firing", () => {
  const r = replay();
  for (let i = 0; i < 8; i++) r.frame(0.56);
  for (let i = 0; i < 12; i++) r.frame(0.56 - i * 0.015);
  const before = r.effect.progress;
  for (let i = 0; i < 3; i++) r.frame(0.39, true);
  assert.equal(r.effect.stage, "PAUSED");
  assert.equal(r.effect.progress, before);
  assert.equal(r.events.length, 0);
  for (let i = 0; i < 18; i++) r.frame(0.31);
  assert.deepEqual(r.events, ["COLLAPSE"]);
});

test("long uncertainty cancels accumulated confirmation", () => {
  const r = replay();
  for (let i = 0; i < 8; i++) r.frame(0.56);
  for (let i = 0; i < 14; i++) r.frame(0.56 - i * 0.015);
  for (let i = 0; i < 7; i++) r.frame(0.31, true);
  assert.equal(r.effect.progress, 0);
  for (let i = 0; i < 30; i++) r.frame(0.31);
  assert.equal(r.events.length, 0);
});

test("stationary close hands and an impossible closure jump never collapse", () => {
  const r = replay();
  for (let i = 0; i < 10; i++) r.frame(0.6);
  for (let i = 0; i < 40; i++) r.frame(0.17);
  assert.equal(r.events.length, 0);
});

test("moving only one palm cannot complete bilateral collapse", () => {
  const r = replay();
  for (let i = 0; i < 8; i++) r.singleMoving(0.6);
  for (let i = 0; i < 24; i++) r.singleMoving(0.6 - 0.29 * Math.min(1, i / 20));
  for (let i = 0; i < 20; i++) r.singleMoving(0.31);
  assert.equal(r.events.length, 0);
});

test("relative closing threshold supports wide framing without hand overlap", () => {
  const r = replay();
  for (let i = 0; i < 8; i++) r.frame(0.8);
  for (let i = 0; i < 27; i++) r.frame(0.8 - 0.33 * Math.min(1, i / 20));
  assert.deepEqual(r.events, ["COLLAPSE"]);
});

test("rebirth accepts separated palms at the core then requires outward travel", () => {
  const r = replay();
  r.mode("collapse");
  for (let i = 0; i < 8; i++) r.frame(0.36);
  for (let i = 0; i < 18; i++) r.frame(0.36 + i * 0.02);
  assert.deepEqual(r.events, ["REBIRTH"]);
});
