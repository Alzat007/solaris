import test from "node:test";
import assert from "node:assert/strict";
import { HandIdentityTracker } from "../src/gesture/HandIdentityTracker";
import { gestureConfig } from "../src/gesture/gestureConfig";
import { handFixture } from "./fixtures/hands";

function detected(x = 0, y = 0, handedness = "Right", score = 0.99) {
  const { points, world } = handFixture("POINT");
  for (const point of points) {
    point.x += x;
    point.y += y;
  }
  return { points, world, category: [{ categoryName: handedness, score }] };
}
function frame(...hands: ReturnType<typeof detected>[]) {
  return {
    landmarks: hands.map((h) => h.points),
    worldLandmarks: hands.map((h) => h.world),
    handedness: hands.map((h) => h.category),
  };
}

test("detection order changes preserve left/right identity and motion", () => {
  const tracker = new HandIdentityTracker();
  const initial = tracker.update(
    frame(detected(-0.15, 0, "Left"), detected(0.15)),
    0,
  );
  const next = tracker.update(
    frame(detected(0.16), detected(-0.14, 0, "Left")),
    50,
  );
  assert.deepEqual(
    next.map((h) => h.id),
    initial.map((h) => h.id),
  );
  assert.deepEqual(
    next.map((h) => h.handedness),
    ["Left", "Right"],
  );
  assert.ok(next.every((h) => h.velocity.x < 0));
  assert.ok(next.every((h) => Math.abs(h.velocity.x) < 0.2));
});

test("left and right hands crossing retain identities instead of inheriting each other's history", () => {
  const tracker = new HandIdentityTracker();
  const initial = tracker.update(
    frame(detected(-0.1, 0, "Left"), detected(0.1)),
    0,
  );
  const leftId = initial[0].id,
    rightId = initial[1].id;
  for (let step = 1; step <= 4; step++) {
    const hands = tracker.update(
      frame(
        detected(0.1 - step * 0.06),
        detected(-0.1 + step * 0.06, 0, "Left"),
      ),
      step * 50,
    );
    assert.equal(hands.find((h) => h.handedness === "Left")?.id, leftId);
    assert.equal(hands.find((h) => h.handedness === "Right")?.id, rightId);
    assert.ok(hands.find((h) => h.handedness === "Left")!.velocity.x < 0);
    assert.ok(hands.find((h) => h.handedness === "Right")!.velocity.x > 0);
  }
});

test("one disappearing hand does not replace the other continuously tracked hand", () => {
  const tracker = new HandIdentityTracker();
  const initial = tracker.update(
    frame(detected(-0.1, 0, "Left"), detected(0.1)),
    0,
  );
  const rightId = initial.find((h) => h.handedness === "Right")!.id;
  const surviving = tracker.update(frame(detected(0.11)), 50);
  assert.equal(surviving[0].id, rightId);
  const returned = tracker.update(
    frame(detected(-0.1, 0, "Left"), detected(0.12)),
    100,
  );
  assert.equal(returned.find((h) => h.handedness === "Right")!.id, rightId);
  assert.notEqual(
    returned.find((h) => h.handedness === "Left")!.id,
    initial[0].id,
  );
  assert.deepEqual(returned.find((h) => h.handedness === "Left")!.velocity, {
    x: 0,
    y: 0,
  });
});

test("low confidence, non-finite and incomplete frames clear hands and require fresh identities", () => {
  for (const invalid of [
    "confidence",
    "nonfinite",
    "incomplete",
    "flat",
  ] as const) {
    const tracker = new HandIdentityTracker();
    const first = tracker.update(frame(detected()), 0)[0];
    const bad = detected();
    if (invalid === "confidence")
      bad.category[0].score = gestureConfig.MIN_CONFIDENCE - 0.01;
    if (invalid === "nonfinite") bad.points[8].x = NaN;
    if (invalid === "incomplete") bad.points.pop();
    if (invalid === "flat") bad.points[17] = { ...bad.points[5] };
    assert.deepEqual(tracker.update(frame(bad), 50), []);
    const recovered = tracker.update(frame(detected()), 100)[0];
    assert.notEqual(recovered.id, first.id);
    assert.deepEqual(recovered.velocity, { x: 0, y: 0 });
  }
});

test("a lost hand and a stalled detection feed both discard velocity and identity", () => {
  for (const explicitLoss of [false, true]) {
    const tracker = new HandIdentityTracker();
    const first = tracker.update(frame(detected()), 0)[0];
    if (explicitLoss) assert.deepEqual(tracker.update(frame(), 50), []);
    const returned = tracker.update(
      frame(detected(0.1)),
      gestureConfig.FRAME_GAP_RESET + 1,
    )[0];
    assert.notEqual(returned.id, first.id);
    assert.deepEqual(returned.velocity, { x: 0, y: 0 });
  }
});

test("unknown hands at an ambiguous crossing receive new IDs instead of guessed continuity", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(
    frame(detected(-0.01, 0, "Unknown"), detected(0.01, 0, "Unknown")),
    0,
  );
  const next = tracker.update(
    frame(detected(0, 0, "Unknown"), detected(0, 0, "Unknown")),
    50,
  );
  assert.ok(next.every((h) => !first.some((old) => old.id === h.id)));
  assert.ok(next.every((h) => h.velocity.x === 0 && h.velocity.y === 0));
});

test("a sudden spatial jump is treated as a new hand even with the same handedness", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(frame(detected(-0.2)), 0)[0];
  const jumped = tracker.update(frame(detected(0.2)), 50)[0];
  assert.notEqual(jumped.id, first.id);
  assert.deepEqual(jumped.velocity, { x: 0, y: 0 });
});

test("returned frame features remain unchanged after recognizer scratch buffers are reused", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(frame(detected()), 0)[0];
  const snapshot = structuredClone(first);
  for (let i = 1; i <= 5; i++)
    tracker.update(frame(detected(i * 0.01)), i * 50);
  assert.deepEqual(first, snapshot);
});
