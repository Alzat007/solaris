import test from "node:test";
import assert from "node:assert/strict";
import { InteractionStateMachine } from "../src/interaction/InteractionStateMachine";
import {
  GestureStabilizer,
  GestureRecognizer,
} from "../src/gesture/GestureRecognizer";
import { planets } from "../src/data/planets";

test("intro and transition states reject conflicting gestures", () => {
  const sm = new InteractionStateMachine();
  assert.equal(sm.send("COLLAPSE"), false);
  assert.equal(sm.send("READY"), true);
  assert.equal(sm.send("SELECT"), true);
  for (const e of [
    "COLLAPSE",
    "SELECT",
    "RETURN",
    "SCALE",
    "ENTER_SUN",
  ] as const)
    assert.equal(sm.send(e), false);
  assert.equal(sm.send("TRANSITION_END"), true);
  assert.equal(sm.state, "PLANET_FOCUS");
});
test("joined hands collapse, rapid expansion enters the sun, and V can return", () => {
  const sm = new InteractionStateMachine();
  sm.send("READY");
  sm.send("COLLAPSE");
  assert.equal(sm.state, "COLLAPSE");
  assert.equal(sm.send("SELECT"), false);
  assert.equal(sm.send("SCALE"), false);
  assert.equal(sm.send("ENTER_SUN"), true);
  assert.equal(sm.state, "SUN_INTERIOR");
  assert.equal(sm.send("ENTER_SUN"), false);
  assert.equal(sm.send("INFO"), false);
  assert.equal(sm.send("SELECT"), false);
  assert.equal(sm.send("RETURN"), true);
  assert.equal(sm.state, "SOLAR_SYSTEM");
});
test("the sun interior can collapse again and collapse has a direct return", () => {
  const sm = new InteractionStateMachine();
  sm.send("READY");
  sm.send("ENTER_SUN");
  assert.equal(sm.send("COLLAPSE"), true);
  assert.equal(sm.send("RETURN"), true);
  assert.equal(sm.state, "SOLAR_SYSTEM");
});
test("information, scale and return have explicit exits", () => {
  const sm = new InteractionStateMachine();
  sm.send("READY");
  sm.send("SELECT");
  sm.send("TRANSITION_END");
  sm.send("INFO");
  assert.equal(sm.state, "INFO");
  sm.send("INFO");
  assert.equal(sm.state, "PLANET_FOCUS");
  sm.send("SCALE");
  sm.send("SCALE_END");
  assert.equal(sm.state, "PLANET_FOCUS");
  assert.equal(sm.send("RETURN"), true);
});
test("fist needs 250 ms and fires only once while held", () => {
  const s = new GestureStabilizer();
  assert.equal(s.update("FIST", 0, 0.95), null);
  assert.equal(s.update("FIST", 249, 0.95), null);
  assert.equal(s.update("FIST", 250, 0.95), "FIST");
  assert.equal(s.update("FIST", 900, 0.95), null);
  s.update("NONE", 1000, 1);
  s.update("FIST", 1100, 1);
  assert.equal(s.update("FIST", 1350, 0.95), "FIST");
});
test("pinch releases and hold reset during lost tracking", () => {
  const s = new GestureStabilizer();
  s.update("PINCH", 0, 1);
  assert.equal(s.update("PINCH", 70, 1), "PINCH");
  s.reset();
  assert.equal(s.update("PINCH", 1000, 1), null);
  assert.equal(s.update("PINCH", 1070, 1), "PINCH");
});
test("brief open-palm noise cannot interrupt another gesture", () => {
  const s = new GestureStabilizer();
  s.update("OPEN_PALM", 0, 0.9);
  assert.equal(s.update("OPEN_PALM", 149, 0.9), null);
  s.update("FIST", 150, 0.9);
  assert.equal(s.update("OPEN_PALM", 250, 0.9), null);
  assert.equal(s.update("OPEN_PALM", 469, 0.9), null);
  assert.equal(s.update("OPEN_PALM", 470, 0.9), "OPEN_PALM");
});
test("geometry remains finite for degenerate or small hands", () => {
  const recognizer = new GestureRecognizer();
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const frame = recognizer.analyze(points, undefined, 0);
  assert.ok(Number.isFinite(frame.pinchDistance));
  assert.ok(Number.isFinite(frame.velocity.x));
  assert.ok(Number.isFinite(frame.confidence));
});
test("planet visual sizes and physical data stay separate and ordered", () => {
  assert.deepEqual(
    planets.map((p) => p.id),
    [
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
    ],
  );
  planets.forEach((p, i) => {
    assert.ok(p.realRadius > 1000);
    assert.ok(p.visualRadius < 2);
    if (i) assert.ok(p.distance > planets[i - 1].distance);
  });
});
test("low-confidence frames interrupt a continuous gesture hold", () => {
  const s = new GestureStabilizer();
  s.update("FIST", 0, 0.9);
  s.update("FIST", 200, 0.2);
  assert.equal(s.update("FIST", 260, 0.9), null);
  assert.equal(s.update("FIST", 510, 0.9), "FIST");
});

test("releasing a two-hand zoom preserves an open information panel", () => {
  const sm = new InteractionStateMachine();
  sm.send("READY");
  sm.send("SELECT");
  sm.send("TRANSITION_END");
  sm.send("INFO");
  assert.equal(sm.send("SCALE"), true);
  assert.equal(sm.send("SCALE_END"), true);
  assert.equal(sm.state, "INFO");
});
