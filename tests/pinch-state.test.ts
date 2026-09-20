import test from "node:test";
import assert from "node:assert/strict";
import {
  PinchStateMachine,
  HoldStateMachine,
} from "../src/gesture/GestureStateMachine";
import { gestureConfig as c } from "../src/gesture/gestureConfig";

test("pinch has explicit start, hold and release phases and one held edge", () => {
  const p = new PinchStateMachine();
  assert.equal(p.update(0.2, 1, 0, true), "PINCH_START");
  assert.equal(p.justStarted, true);
  assert.equal(p.update(0.2, 1, c.PINCH_HOLD_TIME - 1, true), "PINCH_START");
  assert.equal(p.update(0.2, 1, c.PINCH_HOLD_TIME, true), "PINCH_HOLD");
  assert.equal(p.justHeld, true);
  p.update(0.2, 1, 1000, true);
  assert.equal(p.justHeld, false);
  assert.equal(p.update(0.5, 1, 1050, true), "PINCH_RELEASE");
  assert.equal(p.justReleased, true);
  assert.equal(p.update(0.5, 1, 1100, true), "IDLE");
});
test("hysteresis keeps a hold across the start boundary until the release threshold", () => {
  const p = new PinchStateMachine();
  p.update(0.27, 1, 0, true);
  p.update(0.34, 1, 150, true);
  assert.equal(p.phase, "PINCH_HOLD");
  p.update(0.42, 1, 200, true);
  assert.equal(p.phase, "PINCH_HOLD");
  p.update(0.44, 1, 250, true);
  assert.equal(p.phase, "PINCH_RELEASE");
});
test("a short pinch is cancelled before it can click", () => {
  const p = new PinchStateMachine();
  p.update(0.1, 1, 0, true);
  p.update(0.6, 1, 80, true);
  assert.equal(p.justHeld, false);
  assert.equal(p.progress, 0);
});
test("a pinch seen while locked must release before it can arm", () => {
  const p = new PinchStateMachine();
  p.update(0.1, 1, 0, false);
  p.update(0.1, 1, 1000, true);
  assert.equal(p.phase, "IDLE");
  assert.equal(p.needsRelease, true);
  p.update(0.6, 1, 1050, true);
  p.update(0.1, 1, 1100, true);
  p.update(0.1, 1, 1250, true);
  assert.equal(p.justHeld, true);
});
test("unreliable geometry and a folded fist cannot manufacture a pinch", () => {
  const p = new PinchStateMachine();
  p.update(0.1, 1, 0, true, false);
  assert.equal(p.phase, "IDLE");
  p.update(0.1, 1, 100, true);
  p.update(0.1, 0.3, 200, true);
  p.update(0.1, 1, 1000, true);
  assert.equal(p.phase, "IDLE");
  assert.equal(p.needsRelease, true);
});
test("fist progress cancels immediately when the pose is released", () => {
  const f = new HoldStateMachine();
  f.update(true, 0, c.FIST_HOLD_TIME);
  f.update(true, 300, c.FIST_HOLD_TIME);
  assert.equal(f.progress, 0.5);
  f.update(false, 350, c.FIST_HOLD_TIME);
  assert.equal(f.progress, 0);
  assert.equal(f.update(true, 400, c.FIST_HOLD_TIME), false);
  assert.equal(f.update(true, 1000, c.FIST_HOLD_TIME), true);
  assert.equal(f.update(true, 1700, c.FIST_HOLD_TIME), false);
});
