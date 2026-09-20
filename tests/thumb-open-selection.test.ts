import test from "node:test";
import assert from "node:assert/strict";
import {
  ThumbOpenSelection,
  type ThumbSelectionUpdate,
} from "../src/gesture/ThumbOpenSelection";
import { gestureConfig as config } from "../src/gesture/gestureConfig";
import type { Gesture, HandFeatures } from "../src/gesture/GestureTypes";
import type { GestureTarget } from "../src/gesture/gestureFeedback";

const earth: GestureTarget = { kind: "body", id: "earth", label: "地球" };
const mars: GestureTarget = { kind: "body", id: "mars", label: "火星" };
const sun: GestureTarget = { kind: "body", id: "sun", label: "太阳" };
const help: GestureTarget = { kind: "ui", id: "help", label: "帮助" };
const hand = (overrides: Partial<HandFeatures> = {}): HandFeatures => ({
  gesture: "POINT",
  confidence: 0.9,
  pointConfidence: 0.9,
  trackingConfidence: 1,
  thumbSpread: 0.1,
  thumbReach: 0.8,
  thumbGeometryValid: true,
  pointerVelocity: { x: 0, y: 0 },
  handedness: "Right",
  center: { x: 0.5, y: 0.5 },
  pointer: { x: 0.5, y: 0.3 },
  velocity: { x: 0, y: 0 },
  scale: 0.2,
  openness: 0.3,
  pinchDistance: 0.8,
  pinchStrength: 0,
  landmarks: [],
  palmFacing: true,
  palmDirection: [0, 0, 1],
  ...overrides,
});
const opened = (overrides: Partial<HandFeatures> = {}) =>
  hand({ thumbSpread: 0.7, thumbReach: 0.85, ...overrides });

function lock(
  selection: ThumbOpenSelection,
  target: GestureTarget = earth,
  start = 0,
  overrides: Partial<HandFeatures> = {},
) {
  for (let elapsed = 0; elapsed <= config.TARGET_LOCK_TIME; elapsed += 50) {
    const result = selection.update(hand(overrides), target, start + elapsed);
    assert.equal(result.triggered, undefined);
    if (elapsed === 0) assert.equal(selection.state, "POINT_HOVER");
  }
  assert.equal(selection.state, "TARGET_LOCKED");
  assert.equal(selection.owned, true);
  assert.deepEqual(selection.lockedTarget, target);
  return start + config.TARGET_LOCK_TIME;
}

function open(selection: ThumbOpenSelection, start = 250) {
  assert.equal(
    selection.update(opened(), null, start + 50).triggered,
    undefined,
  );
  assert.equal(selection.state, "THUMB_OPENING");
  selection.update(opened(), mars, start + 100);
  assert.equal(selection.pressProgress, 50 / config.THUMB_OPEN_HOLD);
  return selection.update(opened(), mars, start + 130);
}

test("closed-thumb Point exposes hover and locking before capturing the target at 250 ms", () => {
  const selection = new ThumbOpenSelection();
  assert.equal(selection.update(hand(), earth, 0).owned, false);
  assert.equal(selection.state, "POINT_HOVER");
  assert.equal(selection.lockProgress, 0);
  selection.update(hand(), earth, 50);
  assert.equal(selection.state, "TARGET_LOCKING");
  assert.equal(selection.lockProgress, 0.2);
  selection.update(hand(), earth, 150);
  assert.equal(selection.lockProgress, 0.6);
  selection.update(hand(), earth, 249);
  assert.equal(selection.lockedTarget, null);
  assert.equal(selection.update(hand(), earth, 250).owned, true);
  assert.equal(selection.state, "TARGET_LOCKED");
});

test("a stable closed thumb can wait indefinitely, including negative spread and closed-range jitter", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  for (let time = 300; time <= 3000; time += 50) {
    const result = selection.update(
      hand({ thumbSpread: time % 100 ? -0.3 : 0.25 }),
      earth,
      time,
    );
    assert.equal(result.triggered, undefined);
    assert.equal(result.owned, true);
    assert.equal(selection.state, "TARGET_LOCKED");
  }
  assert.equal(selection.needsRelease, false);
});

test("fast sweeps, blank space and target changes reset lock accumulation", () => {
  const selection = new ThumbOpenSelection();
  for (let time = 0; time <= 500; time += 50)
    selection.update(
      hand({ pointerVelocity: { x: 0.351, y: 0 } }),
      earth,
      time,
    );
  assert.equal(selection.lockProgress, 0);
  assert.equal(selection.lockedTarget, null);
  selection.update(hand(), earth, 550);
  selection.update(hand(), earth, 650);
  assert.equal(selection.lockProgress, 0.4);
  selection.update(hand(), null, 700);
  assert.equal(selection.state, "POINT_IDLE");
  selection.update(hand(), earth, 750);
  selection.update(hand(), earth, 850);
  selection.update(hand(), mars, 900);
  assert.equal(selection.state, "POINT_HOVER");
  assert.equal(selection.lockProgress, 0);
  selection.update(hand(), earth, 950);
  selection.update(hand(), earth, 1050);
  selection.update(hand(), earth, 1150);
  selection.update(hand(), earth, 1200);
  assert.deepEqual(selection.lockedTarget, earth);
});

test("stable Point uses finger cursor velocity and accepts exact confidence and closed boundaries", () => {
  for (const pointerVelocity of [
    undefined,
    { x: NaN, y: 0 },
    { x: 0.3, y: 0.3 },
  ]) {
    const selection = new ThumbOpenSelection();
    for (let time = 0; time < 600; time += 50)
      selection.update(hand({ pointerVelocity }), earth, time);
    assert.equal(selection.lockedTarget, null);
  }
  const selection = new ThumbOpenSelection();
  lock(selection, earth, 0, {
    pointConfidence: config.POINT_MIN_CONFIDENCE,
    thumbSpread: config.THUMB_CLOSED_THRESHOLD,
    pointerVelocity: { x: config.POINT_STABILITY_THRESHOLD, y: 0 },
    velocity: { x: 9, y: -9 },
  });
});

test("target kind/id determine identity while label changes do not restart locking", () => {
  const selection = new ThumbOpenSelection();
  selection.update(hand(), earth, 0);
  selection.update(hand(), { ...earth, label: "Earth" }, 100);
  selection.update(hand(), earth, 200);
  selection.update(hand(), earth, 250);
  assert.deepEqual(selection.lockedTarget, earth);
  selection.reset();
  selection.update(hand(), earth, 0);
  selection.update(hand(), earth, 150);
  selection.update(
    hand(),
    { kind: "ui", id: "earth", label: "Earth HUD" },
    200,
  );
  assert.equal(selection.lockProgress, 0);
  assert.equal(selection.state, "POINT_HOVER");
});

test("opening before target lock cannot confirm and requires a deliberate closed release", () => {
  const selection = new ThumbOpenSelection();
  selection.update(hand(), earth, 0);
  selection.update(hand(), earth, 100);
  assert.equal(selection.update(opened(), earth, 150).triggered, undefined);
  assert.equal(selection.lockedTarget, null);
  assert.equal(selection.needsRelease, true);
  assert.equal(selection.state, "WAIT_RELEASE");
});

test("an already-open thumb entering the camera cannot lock or fire until closed for 100 ms", () => {
  const selection = new ThumbOpenSelection();
  for (let time = 0; time <= 800; time += 50) {
    assert.equal(selection.update(opened(), earth, time).triggered, undefined);
    assert.equal(selection.owned, false);
    assert.equal(selection.needsRelease, true);
  }
  selection.update(hand({ thumbSpread: 0.25 }), earth, 850);
  selection.update(hand({ thumbSpread: 0.25 }), earth, 949);
  assert.equal(selection.needsRelease, true);
  selection.update(hand({ thumbSpread: 0.25 }), earth, 950);
  assert.equal(selection.state, "POINT_HOVER");
  assert.equal(selection.lockProgress, 0);
  selection.update(hand(), earth, 1050);
  selection.update(hand(), earth, 1150);
  selection.update(hand(), earth, 1200);
  assert.equal(selection.state, "TARGET_LOCKED");
  assert.equal(open(selection, 1200).triggered?.id, "earth");
});

test("opening and holding for 80 ms confirms the frozen body or HUD after cursor departure", () => {
  for (const target of [earth, sun, help]) {
    const selection = new ThumbOpenSelection();
    lock(selection, target);
    const result = open(selection);
    assert.deepEqual(result.triggered, target);
    assert.equal(result.owned, true);
    assert.equal(selection.state, "THUMB_TRIGGERED");
    assert.deepEqual(selection.lockedTarget, target);
    assert.equal(selection.hoverTarget?.id, "mars");
    assert.equal(selection.pressProgress, 1);
    assert.equal(selection.needsRelease, true);
  }
});

test("open spread and reach thresholds are inclusive and no angular speed is required", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  const exact = opened({
    thumbSpread: config.THUMB_OPEN_THRESHOLD,
    thumbReach: config.THUMB_MIN_REACH,
  });
  selection.update(exact, earth, 300);
  assert.equal(selection.update(exact, earth, 379).triggered, undefined);
  assert.equal(selection.update(exact, earth, 380).triggered?.id, "earth");
});

test("insufficient thumb reach or spread cannot accumulate the open hold", () => {
  for (const overrides of [{ thumbReach: 0.649 }, { thumbSpread: 0.549 }]) {
    const selection = new ThumbOpenSelection();
    lock(selection);
    for (let time = 300; time <= 700; time += 50) {
      assert.equal(
        selection.update(opened(overrides), earth, time).triggered,
        undefined,
      );
      assert.equal(selection.pressProgress, 0);
    }
    assert.equal(selection.update(opened(overrides), earth, 750).owned, false);
    assert.equal(selection.needsRelease, true);
  }
});

test("dropping below the open threshold resets all 80 ms rather than pausing it", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  selection.update(opened(), earth, 300);
  selection.update(opened(), earth, 350);
  assert.equal(selection.pressProgress, 0.625);
  selection.update(hand({ thumbSpread: 0.54 }), earth, 360);
  assert.equal(selection.pressProgress, 0);
  selection.update(opened(), earth, 400);
  assert.equal(selection.update(opened(), earth, 479).triggered, undefined);
  assert.equal(selection.update(opened(), earth, 480).triggered?.id, "earth");
});

test("losing Point or sufficient reach resets the opening hold", () => {
  for (const interrupted of [
    opened({ gesture: "NONE" }),
    opened({ thumbReach: 0.6 }),
  ]) {
    const selection = new ThumbOpenSelection();
    lock(selection);
    selection.update(opened(), earth, 300);
    selection.update(opened(), earth, 350);
    selection.update(interrupted, earth, 360);
    assert.equal(selection.pressProgress, 0);
    selection.update(opened(), earth, 400);
    assert.equal(selection.update(opened(), earth, 479).triggered, undefined);
    assert.equal(selection.update(opened(), earth, 480).triggered?.id, "earth");
  }
});

test("holding an open thumb triggers only once and WAIT_RELEASE is not exclusive", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  assert.equal(open(selection).triggered?.id, "earth");
  for (let time = 400; time <= 2000; time += 50) {
    const result = selection.update(opened(), mars, time);
    assert.equal(result.triggered, undefined);
    assert.equal(result.owned, false);
    assert.equal(selection.state, "WAIT_RELEASE");
    assert.equal(selection.needsRelease, true);
    assert.equal(selection.lockedTarget, null);
  }
});

test("release requires closed spread for 100 ms and the intermediate band never releases", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  open(selection);
  selection.update(hand(), mars, 400);
  selection.update(hand(), mars, 450);
  selection.update(hand({ thumbSpread: 0.251 }), mars, 480);
  for (let time = 500; time <= 800; time += 50) {
    selection.update(hand({ thumbSpread: 0.4 }), mars, time);
    assert.equal(selection.needsRelease, true);
  }
  selection.update(hand({ thumbSpread: 0.25 }), mars, 850);
  selection.update(hand({ thumbSpread: 0.25 }), mars, 949);
  assert.equal(selection.needsRelease, true);
  selection.update(hand({ thumbSpread: 0.25 }), mars, 950);
  assert.equal(selection.needsRelease, false);
  assert.equal(selection.state, "POINT_HOVER");
  selection.update(hand(), mars, 1050);
  selection.update(hand(), mars, 1150);
  selection.update(hand(), mars, 1200);
  assert.equal(open(selection, 1200).triggered?.id, "mars");
});

test("bending the index without opening the thumb can never select", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  for (let time = 300; time <= 700; time += 50)
    assert.equal(
      selection.update(
        hand({ indexAngle: 30, indexAngularVelocity: -900 }),
        earth,
        time,
      ).triggered,
      undefined,
    );
  assert.equal(selection.pressProgress, 0);
  assert.equal(selection.needsRelease, false);
});

test("a bent-finger NONE or FIST cannot confirm even when the thumb is fully spread", () => {
  for (const gesture of ["NONE", "FIST"] as const) {
    const selection = new ThumbOpenSelection();
    lock(selection);
    for (let time = 300; time < 750; time += 50) {
      const result = selection.update(
        opened({ gesture, indexAngle: 70 }),
        mars,
        time,
      );
      assert.equal(result.triggered, undefined);
      assert.equal(result.owned, true);
      assert.equal(selection.pressProgress, 0);
    }
    assert.equal(selection.update(opened({ gesture }), mars, 750).owned, false);
  }
});

test("V, open palms, pinch and other poses cannot lock or confirm thumb selection", () => {
  const poses: Gesture[] = [
    "V_GESTURE",
    "V_SIGN",
    "OPEN_PALM",
    "PINCH",
    "FIVE_PINCH",
    "THREE",
    "NONE",
    "FIST",
  ];
  for (const gesture of poses) {
    const idle = new ThumbOpenSelection();
    for (let time = 0; time <= 600; time += 50) {
      assert.equal(
        idle.update(hand({ gesture }), earth, time).triggered,
        undefined,
      );
      assert.equal(idle.owned, false);
      assert.equal(idle.needsRelease, false);
    }
    const locked = new ThumbOpenSelection();
    lock(locked);
    for (let time = 300; time <= 700; time += 50) {
      assert.equal(
        locked.update(opened({ gesture }), earth, time).triggered,
        undefined,
      );
      assert.equal(locked.pressProgress, 0);
    }
  }
});

test("the first departure fixes a grace deadline that re-hover and repeated opening cannot renew", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  selection.update(hand(), null, 300);
  selection.update(hand(), earth, 350);
  selection.update(hand({ thumbSpread: 0.4 }), mars, 400);
  selection.update(hand(), earth, 450);
  selection.update(hand(), earth, 550);
  selection.update(hand(), earth, 650);
  selection.update(opened(), earth, 700);
  assert.equal(selection.update(opened(), earth, 750).triggered, undefined);
  assert.equal(selection.owned, false);
  assert.equal(selection.needsRelease, true);
});

test("fast movement or opening beyond the closed boundary starts grace on the same target", () => {
  for (const departure of [
    hand({ pointerVelocity: { x: 0.6, y: 0 } }),
    hand({ thumbSpread: 0.251 }),
  ]) {
    const selection = new ThumbOpenSelection();
    lock(selection);
    selection.update(departure, earth, 300);
    for (let time = 350; time <= 700; time += 50)
      selection.update(hand(), earth, time);
    assert.equal(selection.update(hand(), earth, 750).owned, false);
    assert.equal(selection.lockedTarget, null);
  }
});

test("disabled frames clear locks but may observe a closed release without accumulating aim", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  selection.update(opened(), earth, 300);
  assert.equal(
    selection.update(opened(), earth, 350, false).triggered,
    undefined,
  );
  assert.equal(selection.state, "WAIT_RELEASE");
  selection.update(hand(), earth, 400, false);
  selection.update(hand(), earth, 450, false);
  selection.update(hand(), earth, 500, false);
  assert.equal(selection.needsRelease, false);
  assert.equal(selection.lockProgress, 0);
  assert.equal(selection.lockedTarget, null);
  selection.update(hand(), earth, 550);
  assert.equal(selection.state, "POINT_HOVER");
  assert.equal(selection.lockProgress, 0);
  selection.update(hand(), earth, 650);
  selection.update(hand(), earth, 750);
  selection.update(hand(), earth, 800);
  assert.equal(selection.state, "TARGET_LOCKED");
});

test("a triggered scene animation can observe thumb release without selecting twice", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  open(selection);
  selection.update(opened(), mars, 400, false);
  selection.update(hand(), mars, 450, false);
  selection.update(hand(), mars, 550, false);
  assert.equal(selection.needsRelease, false);
  assert.equal(selection.state, "POINT_IDLE");
  selection.update(hand(), mars, 650, false);
  selection.update(hand(), mars, 750);
  assert.equal(selection.state, "POINT_HOVER");
});

test("missing hand cancels immediately and returning open cannot inherit a target", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  selection.update(opened(), earth, 300);
  assert.equal(selection.update(null, earth, 350).owned, false);
  assert.equal(selection.lockedTarget, null);
  assert.equal(selection.needsRelease, true);
  for (let time = 400; time <= 650; time += 50)
    assert.equal(
      selection.update(opened(), earth, time, false).triggered,
      undefined,
    );
  selection.update(hand(), earth, 700, false);
  selection.update(hand(), earth, 800, false);
  assert.equal(selection.needsRelease, false);
  lock(selection, earth, 850);
  assert.equal(open(selection, 1100).triggered?.id, "earth");
});

test("invalid thumb geometry or low Point/tracking confidence clears locks and requires release", () => {
  for (const overrides of [
    { thumbSpread: NaN },
    { thumbSpread: Infinity },
    { thumbSpread: undefined },
    { thumbReach: NaN },
    { thumbReach: -0.1 },
    { thumbReach: undefined },
    { thumbGeometryValid: false },
    { thumbGeometryValid: undefined },
    { pointConfidence: 0.599 },
    { pointConfidence: NaN },
    { trackingConfidence: 0.2 },
    { trackingConfidence: NaN },
  ]) {
    const selection = new ThumbOpenSelection();
    lock(selection);
    selection.update(opened(), earth, 300);
    assert.equal(
      selection.update(opened(overrides), earth, 380).triggered,
      undefined,
    );
    assert.equal(selection.lockedTarget, null);
    assert.equal(selection.owned, false);
    assert.equal(selection.needsRelease, true);
  }
});

test("long gaps and reversed clocks cannot complete an unseen open hold or a release", () => {
  for (const time of [500, 200, NaN]) {
    const selection = new ThumbOpenSelection();
    lock(selection);
    selection.update(opened(), earth, 300);
    assert.equal(selection.update(opened(), earth, time).triggered, undefined);
    assert.equal(selection.lockedTarget, null);
    assert.equal(selection.needsRelease, true);
  }
  const releasing = new ThumbOpenSelection();
  releasing.cancel(true);
  releasing.update(hand(), earth, 0, false);
  releasing.update(hand(), earth, 200, false);
  assert.equal(releasing.needsRelease, true);
});

test("duplicate timestamps cannot count toward opening but loss and disabling still cancel", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  selection.update(opened(), earth, 300);
  for (let repeat = 0; repeat < 20; repeat++) {
    assert.equal(selection.update(opened(), earth, 300).triggered, undefined);
    assert.equal(selection.pressProgress, 0);
  }
  for (const lost of [true, false]) {
    const active = new ThumbOpenSelection();
    lock(active);
    const result: ThumbSelectionUpdate = lost
      ? active.update(null, null, 250)
      : active.update(hand(), earth, 250, false);
    assert.equal(result.owned, false);
    assert.equal(active.lockedTarget, null);
  }
});

test("cancel retains a release latch, new cancellation restarts release timing, and reset clears all", () => {
  const selection = new ThumbOpenSelection();
  lock(selection);
  selection.cancel();
  assert.equal(selection.state, "POINT_IDLE");
  selection.reset();
  selection.cancel(true);
  selection.update(hand(), earth, 0, false);
  selection.update(hand(), earth, 80, false);
  selection.cancel(true);
  selection.update(hand(), earth, 100, false);
  selection.cancel(false);
  selection.update(hand(), earth, 150, false);
  assert.equal(selection.needsRelease, true);
  selection.update(hand(), earth, 200, false);
  assert.equal(selection.needsRelease, false);
  selection.cancel(true);
  selection.reset();
  assert.equal(selection.needsRelease, false);
  assert.equal(selection.state, "POINT_IDLE");
  assert.equal(selection.hoverTarget, null);
  lock(selection);
});

test("left and right hand labels share the same palm-normalized closed-open sequence", () => {
  for (const handedness of ["Left", "Right"] as const) {
    const selection = new ThumbOpenSelection();
    lock(selection, earth, 0, { handedness });
    selection.update(opened({ handedness }), null, 300);
    assert.equal(
      selection.update(opened({ handedness }), null, 380).triggered?.id,
      "earth",
    );
    selection.update(hand({ handedness }), null, 400);
    selection.update(hand({ handedness }), null, 500);
    assert.equal(selection.needsRelease, false);
  }
});
