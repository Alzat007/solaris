import test from "node:test";
import assert from "node:assert/strict";
import { SingleHandZoom } from "../src/gesture/SingleHandZoom";
import type { Gesture, HandFeatures } from "../src/gesture/GestureTypes";

const hand = (
  aperture: number,
  gesture: Gesture = "FIVE_PINCH",
): HandFeatures => ({
  center: { x: 0.5, y: 0.5 },
  pointer: { x: 0.5, y: 0.3 },
  velocity: { x: 0, y: 0 },
  scale: 0.2,
  openness: 0,
  pinchDistance: gesture === "FIVE_PINCH" ? 0.05 : 0.8,
  pinchStrength: 1,
  gesture,
  confidence: 0.9,
  trackingConfidence: 1,
  landmarks: [],
  palmFacing: true,
  palmDirection: [0, 0, 1],
  gripAperture: aperture,
  gripConfidence: 0.9,
});
test("five-finger clutch needs deliberate hold; open palm alone never zooms", () => {
  const zoom = new SingleHandZoom();
  assert.equal(zoom.update(hand(0.8, "OPEN_PALM"), 0).owned, false);
  assert.equal(zoom.update(hand(0.04), 50).scale, undefined);
  assert.equal(zoom.update(hand(0.04), 200).scale, undefined);
  assert.equal(zoom.update(hand(0.04), 250).scale, 0.35);
  assert.equal(zoom.active, true);
});
test("cancelled starts cannot transfer ownership to a two-finger pinch", () => {
  const zoom = new SingleHandZoom();
  zoom.update(hand(0.04), 0);
  zoom.update(hand(0.1, "PINCH"), 50);
  assert.equal(zoom.needsRelease, true);
  assert.equal(zoom.update(hand(0.04), 500).scale, undefined);
  zoom.update(hand(0.8, "OPEN_PALM"), 550);
  zoom.update(hand(0.04), 600);
  assert.equal(zoom.update(hand(0.04), 800).scale, 0.35);
});
test("translation and hand image scale have no influence on five-finger scale", () => {
  const a = new SingleHandZoom(),
    b = new SingleHandZoom();
  for (let time = 0; time <= 1200; time += 50) {
    const h = hand(time < 250 ? 0.04 : 0.4, time < 250 ? "FIVE_PINCH" : "NONE");
    const moved = {
      ...h,
      center: { x: 0.1 + time / 2000, y: 0.7 },
      scale: 3,
      velocity: { x: 5, y: 4 },
    };
    assert.equal(a.update(h, time).scale, b.update(moved, time).scale);
  }
});
test("brief invalid geometry pauses scale; persistent uncertainty ends and requires release", () => {
  const zoom = new SingleHandZoom();
  zoom.update(hand(0.04), 0);
  zoom.update(hand(0.04), 200);
  const weak = { ...hand(0.5, "NONE"), gripConfidence: 0.3 };
  assert.equal(zoom.update(weak, 250).scale, undefined);
  assert.equal(zoom.active, true);
  assert.ok(zoom.update(hand(0.5, "NONE"), 350).scale! > 0.35);
  assert.equal(zoom.update(weak, 400).ended, false);
  assert.equal(zoom.update(weak, 600).ended, true);
  assert.equal(zoom.needsRelease, true);
});
test("fully open exit needs continuous valid hold and does not count uncertain time", () => {
  const zoom = new SingleHandZoom();
  zoom.update(hand(0.04), 0);
  zoom.update(hand(0.04), 200);
  zoom.update(hand(0.8, "OPEN_PALM"), 250);
  zoom.update({ ...hand(0.8, "OPEN_PALM"), gripConfidence: 0.2 }, 400);
  zoom.update(hand(0.8, "OPEN_PALM"), 450);
  assert.equal(zoom.update(hand(0.8, "OPEN_PALM"), 700).ended, false);
  assert.equal(zoom.update(hand(0.8, "OPEN_PALM"), 900).ended, true);
  assert.equal(zoom.active, false);
  assert.equal(zoom.needsRelease, false);
});
