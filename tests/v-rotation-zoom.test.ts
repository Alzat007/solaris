import test from "node:test";
import assert from "node:assert/strict";
import { VRotationZoom } from "../src/gesture/VRotationZoom";
import { gestureConfig as config } from "../src/gesture/gestureConfig";
import type { Gesture, HandFeatures } from "../src/gesture/GestureTypes";

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const hand = (
  degrees = 0,
  overrides: Partial<HandFeatures> = {},
): HandFeatures => ({
  gesture: "V_GESTURE",
  confidence: 0.9,
  trackingConfidence: 1,
  vConfidence: 0.9,
  palmRoll: radians(degrees),
  palmRollValid: true,
  handedness: "Right",
  center: { x: 0.5, y: 0.5 },
  pointer: { x: 0.5, y: 0.3 },
  velocity: { x: 0, y: 0 },
  scale: 0.2,
  openness: 0.5,
  pinchDistance: 0.8,
  pinchStrength: 0,
  landmarks: [],
  palmFacing: true,
  palmDirection: [0, 0, 1],
  ...overrides,
});

function arm(
  dial: VRotationZoom,
  degrees = 0,
  overrides: Partial<HandFeatures> = {},
) {
  for (let time = 0; time < 250; time += 50)
    assert.equal(
      dial.update(hand(degrees, overrides), time, 1).started,
      undefined,
    );
  const result = dial.update(hand(degrees, overrides), 250, 1);
  assert.equal(result.started, true);
  assert.equal(dial.state, "ZOOM_DIAL_ARMED");
  assert.equal(dial.active, false);
  assert.equal(dial.owned, true);
  dial.update(hand(degrees, overrides), 300, 1);
  assert.equal(dial.state, "ZOOM_DIAL_ACTIVE");
  assert.equal(dial.active, true);
  return 300;
}

test("a continuous V captures its baseline only at confirmation and exposes ARMED", () => {
  const dial = new VRotationZoom();
  dial.update(hand(5), 0, 1);
  assert.equal(dial.state, "V_DETECTED");
  assert.equal(dial.baseAngle, null);
  dial.update(hand(12), 100, 1);
  dial.update(hand(20), 200, 1);
  assert.equal(dial.progress, 0.8);
  const result = dial.update(hand(23), 250, 1);
  assert.equal(result.started, true);
  assert.equal(dial.state, "ZOOM_DIAL_ARMED");
  assert.ok(Math.abs(dial.baseAngle! - radians(23)) < 1e-12);
  assert.equal(dial.delta, 0);
  dial.update(hand(30), 300, 1);
  assert.equal(dial.state, "ZOOM_DIAL_ACTIVE");
  assert.ok(Math.abs(dial.baseAngle! - radians(23)) < 1e-12);
});

test("static V, five-degree jitter and whole-hand translation cannot zoom", () => {
  const dial = new VRotationZoom();
  arm(dial);
  for (let frame = 1; frame < 30; frame++) {
    const result = dial.update(
      hand(frame % 2 ? 5 : -5, {
        center: { x: frame / 30, y: 0.6 },
        pointer: { x: 1 - frame / 30, y: 0.1 },
        velocity: { x: 8, y: -5 },
        scale: frame / 5,
      }),
      300 + frame * 50,
      1,
    );
    assert.equal(result.scale, 1);
    assert.equal(dial.speed, 0);
    assert.equal(dial.direction, "NONE");
  }
});

test("rotation uses a quadratic rate, increasing gently before its capped maximum", () => {
  for (const [degrees, expected] of [
    [20, 0.65 / 9],
    [30, (0.65 * 4) / 9],
    [40, 0.65],
    [100, 0.65],
  ]) {
    const dial = new VRotationZoom();
    arm(dial);
    for (let frame = 1; frame <= 40; frame++)
      dial.update(hand(degrees), 300 + frame * 50, 1);
    assert.ok(
      Math.abs(dial.speed - expected) < 1e-8,
      `${degrees} degrees: ${dial.speed}`,
    );
    assert.equal(dial.direction, "IN");
    assert.ok(dial.speed <= config.V_ZOOM_MAX_SPEED);
  }
});

test("counterclockwise rotation zooms out and target values stay within both limits", () => {
  for (const direction of [-1, 1]) {
    const dial = new VRotationZoom();
    arm(dial);
    let scale = 1;
    for (let frame = 1; frame <= 100; frame++) {
      const result = dial.update(hand(direction * 70), 300 + frame * 50, scale);
      scale = result.scale!;
      assert.ok(scale >= 0.35 && scale <= 1.75);
    }
    assert.equal(scale, direction > 0 ? 1.75 : 0.35);
    assert.equal(dial.direction, direction > 0 ? "IN" : "OUT");
  }
});

test("returning inside the raw dead zone stops even while the angle filter trails", () => {
  const dial = new VRotationZoom();
  arm(dial);
  for (let time = 350; time <= 850; time += 50) dial.update(hand(70), time, 1);
  assert.ok(dial.speed > 0.6);
  const result = dial.update(hand(0), 900, 1);
  assert.ok(dial.delta > 10, "filter deliberately still outside the dead zone");
  assert.equal(dial.speed, 0);
  assert.equal(dial.direction, "NONE");
  assert.equal(result.scale, 1);
});

test("crossing plus/minus pi is continuous in both directions", () => {
  for (const sign of [-1, 1]) {
    const dial = new VRotationZoom();
    arm(dial, sign * 175);
    const baseline = dial.baseAngle;
    dial.update(hand(sign * 179), 350, 1);
    dial.update(hand(sign * -177), 400, 1);
    dial.update(hand(sign * -165), 450, 1);
    assert.ok(
      Math.abs(dial.currentAngle! - baseline! - radians(sign * 20)) < 1e-12,
    );
    assert.ok(Math.abs(dial.delta) < 20);
    assert.equal(Math.sign(dial.delta), sign);
    assert.equal(dial.baseAngle, baseline);
  }
});

test("left and right hands preserve the same rotation sign and ignore label jitter", () => {
  const right = new VRotationZoom(),
    left = new VRotationZoom();
  arm(right, 0, { handedness: "Right" });
  arm(left, -180, { handedness: "Left" });
  assert.ok(Math.abs(right.baseAngle! - left.baseAngle!) < 1e-12);
  for (let frame = 1; frame <= 20; frame++) {
    const degrees = frame < 10 ? 35 : -35;
    const a = right.update(
      hand(degrees, { handedness: frame % 2 ? "Right" : "Left" }),
      300 + frame * 50,
      1,
    );
    const b = left.update(
      hand(degrees - 180, { handedness: frame % 2 ? "Left" : "Right" }),
      300 + frame * 50,
      1,
    );
    assert.ok(Math.abs(a.scale! - b.scale!) < 1e-12);
    assert.ok(Math.abs(right.delta - left.delta) < 1e-10);
    assert.equal(right.direction, left.direction);
  }
});

test("unknown or missing samples stop immediately and recover without catch-up movement", () => {
  const dial = new VRotationZoom();
  arm(dial);
  dial.update(hand(45), 350, 1);
  dial.update(hand(45), 400, 1);
  const baseline = dial.baseAngle;
  assert.equal(dial.update(null, 450, 1).scale, undefined);
  assert.equal(dial.speed, 0);
  assert.equal(dial.direction, "NONE");
  assert.equal(dial.active, true);
  assert.equal(
    dial.update(hand(45, { palmRollValid: false }), 500, 1).ended,
    undefined,
  );
  assert.equal(dial.update(hand(45), 550, 1).scale, 1);
  assert.equal(dial.baseAngle, baseline);
  assert.ok(dial.update(hand(45), 600, 1).scale! > 1);
});

test("persistent release enters observable RELEASE and the next update can start afresh", () => {
  const dial = new VRotationZoom();
  arm(dial);
  dial.update(hand(30), 350, 1);
  dial.update(hand(30, { gesture: "OPEN_PALM" }), 400, 1);
  assert.equal(dial.update(null, 500, 1).ended, undefined);
  const end = dial.update(hand(30, { gesture: "FIST" }), 550, 1);
  assert.equal(end.owned, true);
  assert.equal(end.ended, true);
  assert.equal(dial.state, "ZOOM_DIAL_RELEASE");
  assert.equal(dial.speed, 0);
  dial.update(hand(-25), 600, 1);
  assert.equal(dial.state, "V_DETECTED");
  assert.equal(dial.baseAngle, null);
  assert.equal(dial.progress, 0);
  dial.update(hand(-25), 750, 1);
  dial.update(hand(-25), 850, 1);
  assert.ok(Math.abs(dial.baseAngle! - radians(-25)) < 1e-12);
});

test("a valid V returning after grace cannot revive an expired dial", () => {
  const dial = new VRotationZoom();
  arm(dial);
  dial.update(null, 350, 1);
  dial.update(null, 450, 1);
  const result = dial.update(hand(40), 510, 1);
  assert.equal(result.ended, true);
  assert.equal(result.scale, undefined);
  assert.equal(dial.state, "ZOOM_DIAL_RELEASE");
  dial.update(hand(40), 560, 1);
  assert.equal(dial.state, "V_DETECTED");
  assert.equal(dial.progress, 0);
});

test("candidate uncertainty resets its hold and does not get active-release grace", () => {
  const dial = new VRotationZoom();
  dial.update(hand(), 0, 1);
  dial.update(hand(), 150, 1);
  dial.update(hand(0, { vConfidence: 0.2 }), 200, 1);
  assert.equal(dial.state, "IDLE");
  dial.update(hand(), 250, 1);
  dial.update(hand(), 400, 1);
  assert.equal(dial.state, "V_DETECTED");
  assert.equal(dial.update(hand(), 500, 1).started, true);
});

test("only a reliable V with a measurable palm axis can arm", () => {
  for (const gesture of [
    "FIVE_PINCH",
    "FIST",
    "PINCH",
    "OPEN_PALM",
    "NONE",
    "V_SIGN",
  ] as Gesture[]) {
    const dial = new VRotationZoom();
    for (let time = 0; time <= 800; time += 50)
      assert.equal(dial.update(hand(0, { gesture }), time, 1).owned, false);
    assert.equal(dial.state, "IDLE");
  }
  for (const invalid of [
    { vConfidence: 0.59 },
    { palmRollValid: false },
    { palmRoll: NaN },
    { trackingConfidence: 0 },
  ]) {
    const dial = new VRotationZoom();
    for (let time = 0; time <= 800; time += 50)
      assert.equal(dial.update(hand(0, invalid), time, 1).owned, false);
  }
});

test("long gaps and backward clocks cancel without integrating or counting missed time", () => {
  for (const time of [800, 200]) {
    const dial = new VRotationZoom();
    arm(dial);
    dial.update(hand(70), 350, 1);
    const result = dial.update(hand(70), time, 1);
    assert.equal(result.ended, true);
    assert.equal(result.scale, undefined);
    assert.equal(dial.speed, 0);
    assert.equal(dial.state, "ZOOM_DIAL_RELEASE");
    dial.update(hand(70), time + 50, 1);
    assert.equal(dial.state, "V_DETECTED");
    assert.equal(dial.progress, 0);
  }
  const candidate = new VRotationZoom();
  candidate.update(hand(), 0, 1);
  assert.equal(candidate.update(hand(), 300, 1).scale, undefined);
  assert.equal(candidate.baseAngle, null);
});

test("duplicate timestamps cannot move scale and cancel fully resets dial ownership", () => {
  const dial = new VRotationZoom();
  assert.equal(dial.cancel(), false);
  arm(dial);
  const result = dial.update(hand(80), 300, 1);
  assert.equal(result.scale, 1);
  assert.equal(dial.cancel(), true);
  assert.equal(dial.owned, false);
  assert.equal(dial.active, false);
  assert.equal(dial.baseAngle, null);
  assert.equal(dial.currentAngle, null);
  assert.equal(dial.delta, 0);
  assert.equal(dial.speed, 0);
  assert.equal(dial.direction, "NONE");
});
