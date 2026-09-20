import test from "node:test";
import assert from "node:assert/strict";
import {
  IndexTriggerSelection,
  type IndexSelectionUpdate,
} from "../src/gesture/IndexTriggerSelection";
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
  indexAngle: 170,
  indexAngleValid: true,
  indexAngularVelocity: 0,
  indexState: "EXTENDED",
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
const flex = (
  angle: number,
  velocity = -250,
  overrides: Partial<HandFeatures> = {},
) =>
  hand({
    gesture: "NONE",
    indexAngle: angle,
    indexState: angle < 115 ? "BENT" : "BETWEEN",
    indexAngularVelocity: velocity,
    ...overrides,
  });

function lock(
  selection: IndexTriggerSelection,
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

function press(selection: IndexTriggerSelection, start = 250) {
  assert.equal(
    selection.update(flex(150), earth, start + 50).triggered,
    undefined,
  );
  assert.equal(
    selection.update(flex(130), null, start + 100).triggered,
    undefined,
  );
  assert.equal(selection.state, "INDEX_PRESSING");
  return selection.update(flex(110), mars, start + 150);
}

test("stable pointing exposes hover and locking before acquiring one target at 250 ms", () => {
  const selection = new IndexTriggerSelection();
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
  assert.equal(selection.lockProgress, 1);
  for (let time = 300; time < 3000; time += 50)
    assert.equal(selection.update(hand(), earth, time).triggered, undefined);
  assert.equal(selection.state, "TARGET_LOCKED");
  assert.equal(selection.needsRelease, false);
});

test("fast sweeps, blank space and changing targets cannot accumulate a shared lock", () => {
  const selection = new IndexTriggerSelection();
  for (let time = 0; time <= 500; time += 50)
    selection.update(
      hand({ pointerVelocity: { x: 0.351, y: 0 } }),
      earth,
      time,
    );
  assert.equal(selection.state, "POINT_HOVER");
  assert.equal(selection.lockProgress, 0);
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
  assert.equal(selection.lockedTarget, null);
  selection.update(hand(), earth, 1150);
  selection.update(hand(), earth, 1200);
  assert.deepEqual(selection.lockedTarget, earth);
});

test("pointer speed, point evidence and release angle must all qualify before lock", () => {
  for (const overrides of [
    { pointerVelocity: undefined },
    { pointerVelocity: { x: NaN, y: 0 } },
    { pointerVelocity: { x: 0.3, y: 0.3 } },
    { pointConfidence: 0.599 },
    { indexAngle: 145 },
    { gesture: "NONE" as const },
  ]) {
    const selection = new IndexTriggerSelection();
    for (let time = 0; time <= 700; time += 50)
      assert.equal(
        selection.update(hand(overrides), earth, time).triggered,
        undefined,
      );
    assert.equal(selection.lockedTarget, null);
    assert.equal(selection.owned, false);
  }
  const selection = new IndexTriggerSelection();
  lock(selection, earth, 0, {
    pointConfidence: 0.6,
    indexAngle: 146,
    pointerVelocity: { x: config.POINT_STABILITY_THRESHOLD, y: 0 },
    velocity: { x: 9, y: 9 },
  });
});

test("target identity uses kind and id, while label changes do not restart a hold", () => {
  const selection = new IndexTriggerSelection();
  selection.update(hand(), earth, 0);
  selection.update(hand(), { ...earth, label: "Earth" }, 100);
  selection.update(hand(), earth, 200);
  selection.update(hand(), earth, 250);
  assert.equal(selection.lockedTarget?.id, "earth");
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

test("a quick bend before locking can never trigger a selection", () => {
  const selection = new IndexTriggerSelection();
  selection.update(hand(), earth, 0);
  selection.update(hand(), earth, 100);
  assert.equal(selection.update(flex(110), earth, 150).triggered, undefined);
  assert.equal(selection.lockedTarget, null);
  assert.equal(selection.owned, false);
});

test("a light press selects the captured body or HUD even when the fingertip leaves it", () => {
  for (const target of [earth, sun, help]) {
    const selection = new IndexTriggerSelection();
    lock(selection, target);
    const result = press(selection);
    assert.deepEqual(result.triggered, target);
    assert.equal(result.owned, true);
    assert.equal(selection.state, "INDEX_TRIGGERED");
    assert.deepEqual(selection.lockedTarget, target);
    assert.equal(selection.hoverTarget?.id, "mars");
    assert.equal(selection.pressProgress, 1);
    assert.equal(selection.needsRelease, true);
  }
});

test("a held bend triggers only once, then WAIT_RELEASE does not own other gestures", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  assert.equal(press(selection).triggered?.id, "earth");
  for (let time = 450; time <= 1800; time += 50) {
    const result = selection.update(flex(105, 0), mars, time);
    assert.equal(result.triggered, undefined);
    assert.equal(result.owned, false);
    assert.equal(selection.state, "WAIT_RELEASE");
    assert.equal(selection.needsRelease, true);
    assert.equal(selection.lockedTarget, null);
  }
});

test("release needs more than 145 degrees continuously for 100 ms before the next lock", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  press(selection);
  selection.update(hand({ indexAngle: 146 }), mars, 450);
  selection.update(hand({ indexAngle: 145 }), mars, 500);
  selection.update(hand({ indexAngle: 146 }), mars, 550);
  selection.update(hand({ indexAngle: 146 }), mars, 649);
  assert.equal(selection.needsRelease, true);
  assert.equal(selection.state, "WAIT_RELEASE");
  selection.update(hand({ indexAngle: 146 }), mars, 650);
  assert.equal(selection.needsRelease, false);
  assert.equal(selection.state, "POINT_HOVER");
  selection.update(hand(), mars, 750);
  selection.update(hand(), mars, 850);
  selection.update(hand(), mars, 900);
  assert.equal(selection.lockedTarget?.id, "mars");
  assert.equal(selection.update(flex(110), null, 950).triggered?.id, "mars");
});

test("press and release use their own hysteresis rather than a geometry-state label", () => {
  const selection = new IndexTriggerSelection();
  lock(selection, earth, 0, { indexState: "BENT" });
  assert.equal(selection.update(flex(115), earth, 300).triggered, undefined);
  assert.equal(selection.state, "INDEX_PRESSING");
  assert.equal(selection.needsRelease, false);
  assert.equal(
    selection.update(flex(114, -80, { indexState: "EXTENDED" }), earth, 350)
      .triggered?.id,
    "earth",
  );
  selection.update(
    hand({ indexAngle: 144, indexState: "EXTENDED" }),
    earth,
    400,
  );
  selection.update(
    hand({ indexAngle: 144, indexState: "EXTENDED" }),
    earth,
    500,
  );
  assert.equal(selection.needsRelease, true);
  selection.update(hand({ indexState: "BENT" }), earth, 550);
  selection.update(hand({ indexState: "BENT" }), earth, 650);
  assert.equal(selection.needsRelease, false);
});

test("small angle jitter and slow relaxation cannot fire or turn into a delayed noisy press", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  for (let time = 300; time <= 650; time += 50)
    assert.equal(
      selection.update(
        hand({ indexAngle: time % 100 ? 168 : 171 }),
        earth,
        time,
      ).triggered,
      undefined,
    );
  assert.equal(selection.lockedTarget?.id, "earth");
  assert.equal(
    selection.update(flex(130, -20), earth, 700).triggered,
    undefined,
  );
  assert.equal(
    selection.update(flex(114, -20), earth, 750).triggered,
    undefined,
  );
  assert.equal(selection.needsRelease, true);
  for (let time = 800; time <= 1050; time += 50)
    assert.equal(
      selection.update(flex(time % 100 ? 114 : 116, -100), earth, time)
        .triggered,
      undefined,
    );
});

test("stationary bent geometry with stale negative velocity cannot count as a fresh press", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  selection.update(flex(110, 0), earth, 300);
  assert.equal(
    selection.update(flex(110, -500), earth, 350).triggered,
    undefined,
  );
  assert.equal(
    selection.update(flex(111, -500), earth, 400).triggered,
    undefined,
  );
});

test("POINT, contextual NONE/FIST and INDEX_PRESS can complete a locked light press", () => {
  for (const gesture of ["POINT", "NONE", "FIST", "INDEX_PRESS"] as const) {
    const selection = new IndexTriggerSelection();
    lock(selection);
    const result = selection.update(
      flex(110, -300, { gesture, pointConfidence: 0 }),
      null,
      300,
    );
    assert.equal(result.triggered?.id, "earth", gesture);
  }
});

test("V, open palms and pinches cannot trigger index selection or steal an existing lock", () => {
  for (const gesture of [
    "V_GESTURE",
    "V_SIGN",
    "OPEN_PALM",
    "PINCH",
    "FIVE_PINCH",
    "THREE",
  ] as Gesture[]) {
    const selection = new IndexTriggerSelection();
    lock(selection);
    for (let time = 300; time < 750; time += 50) {
      const result = selection.update(flex(100, -300, { gesture }), mars, time);
      assert.equal(result.triggered, undefined, gesture);
      assert.equal(result.owned, true, gesture);
      assert.equal(selection.lockedTarget?.id, "earth");
    }
    assert.equal(
      selection.update(flex(100, -300, { gesture }), mars, 750).owned,
      false,
    );
    assert.equal(selection.lockedTarget, null);
  }
});

test("an unlocked full fist, V or pinch never starts a press latch that would block their own action", () => {
  for (const gesture of [
    "FIST",
    "V_GESTURE",
    "OPEN_PALM",
    "PINCH",
    "FIVE_PINCH",
    "INDEX_PRESS",
  ] as Gesture[]) {
    const selection = new IndexTriggerSelection();
    for (let time = 0; time <= 1000; time += 50) {
      assert.equal(
        selection.update(flex(100, -100, { gesture }), earth, time).triggered,
        undefined,
      );
      assert.equal(selection.owned, false);
      assert.equal(selection.needsRelease, false);
    }
  }
});

test("the first hover departure starts a fixed grace deadline that re-hover cannot renew", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  selection.update(hand(), null, 300);
  selection.update(hand(), mars, 350);
  selection.update(hand(), earth, 400);
  selection.update(hand(), earth, 500);
  selection.update(hand(), earth, 600);
  selection.update(hand(), earth, 700);
  assert.equal(selection.lockedTarget?.id, "earth");
  assert.equal(selection.update(flex(110), earth, 750).triggered, undefined);
  assert.equal(selection.lockedTarget, null);
  assert.equal(selection.needsRelease, true);
});

test("movement starts grace even while hovering the same body", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  selection.update(hand({ pointerVelocity: { x: 0.6, y: 0 } }), earth, 300);
  for (let time = 350; time <= 700; time += 50)
    selection.update(hand(), earth, time);
  assert.equal(selection.update(hand(), earth, 750).owned, false);
  assert.equal(selection.lockedTarget, null);
});

test("straight-finger jitter cannot start a grace timeout while stable on the same target", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  for (let time = 300; time <= 2500; time += 50) {
    const result = selection.update(
      hand({
        indexAngle: time % 100 ? 155 : 165,
        indexAngularVelocity: time % 100 ? -200 : 200,
      }),
      earth,
      time,
    );
    assert.equal(result.triggered, undefined);
    assert.equal(result.owned, true);
    assert.equal(selection.state, "TARGET_LOCKED");
  }
  assert.equal(selection.update(flex(110), null, 2550).triggered?.id, "earth");
});

test("disabled scene frames clear locks, observe release and never accumulate a new hold", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  selection.update(flex(130), earth, 300);
  assert.equal(
    selection.update(flex(120), earth, 350, false).triggered,
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

test("selection-triggered animation can observe a straight release without selecting again", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  press(selection);
  selection.update(flex(110, 0), mars, 450, false);
  selection.update(hand(), mars, 500, false);
  selection.update(hand(), mars, 600, false);
  assert.equal(selection.needsRelease, false);
  assert.equal(selection.state, "POINT_IDLE");
  selection.update(hand(), mars, 700, false);
  selection.update(hand(), mars, 800);
  assert.equal(selection.state, "POINT_HOVER");
  assert.equal(selection.lockProgress, 0);
});

test("hand loss clears the frozen target and requires release plus a fresh enabled lock", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  assert.equal(selection.update(null, earth, 300).owned, false);
  assert.equal(selection.lockedTarget, null);
  assert.equal(selection.needsRelease, true);
  for (let time = 350; time <= 550; time += 50)
    assert.equal(
      selection.update(flex(100), earth, time, false).triggered,
      undefined,
    );
  selection.update(hand(), earth, 600, false);
  selection.update(hand(), earth, 700, false);
  assert.equal(selection.needsRelease, false);
  lock(selection, earth, 750);
  assert.equal(selection.update(flex(110), null, 1050).triggered?.id, "earth");
});

test("invalid or transient angle geometry cancels immediately instead of triggering", () => {
  for (const overrides of [
    { indexAngle: NaN },
    { indexAngle: Infinity },
    { indexAngle: -1 },
    { indexAngle: 181 },
    { indexAngleValid: false },
    { indexAngularVelocity: NaN },
    { trackingConfidence: 0.2 },
    { trackingConfidence: NaN },
  ]) {
    const selection = new IndexTriggerSelection();
    lock(selection);
    assert.equal(
      selection.update(flex(110, -500, overrides), earth, 300).triggered,
      undefined,
    );
    assert.equal(selection.lockedTarget, null);
    assert.equal(selection.owned, false);
    assert.equal(selection.needsRelease, true);
  }
});

test("long frame gaps, reversed clocks and duplicate timestamps cannot invent a press or hold", () => {
  for (const time of [500, 200, NaN]) {
    const selection = new IndexTriggerSelection();
    lock(selection);
    assert.equal(selection.update(flex(100), earth, time).triggered, undefined);
    assert.equal(selection.lockedTarget, null);
    assert.equal(selection.needsRelease, true);
  }
  const selection = new IndexTriggerSelection();
  lock(selection);
  assert.equal(selection.update(flex(100), earth, 250).triggered, undefined);
  assert.equal(selection.state, "TARGET_LOCKED");
  assert.equal(selection.needsRelease, false);
  const pending = new IndexTriggerSelection();
  pending.update(hand(), earth, 0);
  for (let repeat = 0; repeat < 20; repeat++) pending.update(hand(), earth, 0);
  assert.equal(pending.state, "POINT_HOVER");
  assert.equal(pending.lockProgress, 0);
});

test("cancel preserves an existing release latch while reset is an explicit full reset", () => {
  const selection = new IndexTriggerSelection();
  lock(selection);
  selection.cancel();
  assert.equal(selection.state, "POINT_IDLE");
  assert.equal(selection.owned, false);
  selection.cancel(true);
  assert.equal(selection.state, "WAIT_RELEASE");
  selection.cancel(false);
  assert.equal(selection.needsRelease, true);
  selection.reset();
  assert.equal(selection.state, "POINT_IDLE");
  assert.equal(selection.needsRelease, false);
  assert.equal(selection.lockedTarget, null);
  assert.equal(selection.hoverTarget, null);
  lock(selection);
});

test("an explicit new release requirement cannot inherit another hand's partial release hold", () => {
  const selection = new IndexTriggerSelection();
  selection.cancel(true);
  selection.update(hand(), earth, 0, false);
  selection.update(hand(), earth, 80, false);
  selection.cancel(true);
  selection.update(hand(), earth, 100, false);
  assert.equal(selection.needsRelease, true);
  selection.update(hand(), earth, 150, false);
  assert.equal(selection.needsRelease, true);
  selection.update(hand(), earth, 200, false);
  assert.equal(selection.needsRelease, false);
});

test("loss and animation cancellation still apply on a duplicate timestamp", () => {
  for (const lost of [true, false]) {
    const selection = new IndexTriggerSelection();
    lock(selection);
    const result: IndexSelectionUpdate = lost
      ? selection.update(null, null, 250)
      : selection.update(hand(), earth, 250, false);
    assert.equal(result.owned, false);
    assert.equal(result.triggered, undefined);
    assert.equal(selection.lockedTarget, null);
  }
});

test("left and right hands share exactly the same angle-based selection and release", () => {
  for (const handedness of ["Left", "Right"] as const) {
    const selection = new IndexTriggerSelection();
    lock(selection, earth, 0, { handedness });
    const result = selection.update(
      flex(110, -180, {
        handedness,
        pointer: { x: handedness === "Left" ? 0.1 : 0.9, y: 0.6 },
      }),
      null,
      300,
    );
    assert.equal(result.triggered?.id, "earth");
    selection.update(hand({ handedness }), null, 350);
    selection.update(hand({ handedness }), null, 450);
    assert.equal(selection.needsRelease, false);
  }
});
