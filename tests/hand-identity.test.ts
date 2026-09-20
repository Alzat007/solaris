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

test("malformed geometry clears a hand and requires a fresh identity", () => {
  for (const invalid of ["nonfinite", "incomplete", "flat"] as const) {
    const tracker = new HandIdentityTracker();
    const first = tracker.update(frame(detected()), 0)[0];
    const bad = detected();
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

test("low handedness scores preserve valid geometry, confidence and stable identity", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(frame(detected()), 0)[0];
  for (let step = 1; step <= 12; step++) {
    const hand = tracker.update(
      frame(
        detected(
          step * 0.005,
          0,
          step % 2 ? "Left" : "Right",
          0.3 + step * 0.025,
        ),
      ),
      step * 50,
    )[0];
    assert.equal(hand.id, first.id);
    assert.equal(hand.handedness, "Right");
    assert.equal(hand.trackingConfidence, 1);
    assert.ok(
      hand.confidence > 0.8,
      "left/right certainty cannot lower pointing evidence",
    );
  }
});

test("a transient handedness classifier flip cannot drop a continuously visible hand", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(frame(detected()), 0)[0];
  const flipped = tracker.update(frame(detected(0.005, 0, "Left")), 50)[0];
  assert.equal(flipped.id, first.id);
  assert.equal(flipped.handedness, "Right");
  assert.equal(tracker.update(frame(detected(0.01)), 100)[0].id, first.id);
});

test("unknown poses and relaxed palms keep identity instead of causing a reconnection", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(frame(detected()), 0)[0];
  const poses = ["V_SIGN", "OPEN_PALM", "THREE", "POINT"] as const;
  poses.forEach((pose, i) => {
    const fixture = handFixture(pose, {
      relaxed: true,
      flexion: 55,
      softPinky: 65,
    });
    const result = tracker.update(
      {
        landmarks: [fixture.points],
        worldLandmarks: [fixture.world],
        handedness: [[{ categoryName: "Right", score: 0.53 }]],
      },
      (i + 1) * 50,
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].id, first.id);
    assert.equal(result[0].trackingConfidence, 1);
    if (pose === "V_SIGN") assert.equal(result[0].gesture, "V_GESTURE");
    if (pose === "THREE") assert.equal(result[0].gesture, "NONE");
  });
});

test("a malformed second hand does not drop the continuous first hand", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(
    frame(detected(-0.1, 0, "Left"), detected(0.1)),
    0,
  );
  const bad = detected(0.11);
  bad.points[8].z = NaN;
  const next = tracker.update(frame(detected(-0.09, 0, "Left"), bad), 50);
  assert.equal(next.length, 1);
  assert.equal(next[0].id, first[0].id);
});

test("an unavailable world estimate falls back to valid screen geometry", () => {
  const tracker = new HandIdentityTracker();
  const badWorld = detected();
  badWorld.world[8].z = NaN;
  const hand = tracker.update(frame(badWorld), 0)[0];
  assert.equal(hand.gesture, "POINT");
  assert.equal(hand.trackingConfidence, 1);
});

function detectedPose(pose: "V_GESTURE" | "PINCH", x = 0) {
  const fixture = handFixture(pose, { relaxed: true });
  for (const p of fixture.points) p.x += x;
  return { ...fixture, category: [{ categoryName: "Right", score: 0.99 }] };
}

test("a single held V retains identity through one or two natural empty detections", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(frame(detectedPose("V_GESTURE")), 0)[0];
  assert.equal(first.gesture, "V_GESTURE");
  assert.deepEqual(tracker.update(frame(), 50), []);
  assert.deepEqual(tracker.update(frame(), 100), []);
  const returned = tracker.update(
    frame(detectedPose("V_GESTURE", 0.006)),
    150,
  )[0];
  assert.equal(returned.id, first.id);
  assert.equal(returned.gesture, "V_GESTURE");
});

test("repeated misses cannot refresh V identity grace or preserve it beyond 150ms", () => {
  for (const finalEmptyFrame of [false, true]) {
    const tracker = new HandIdentityTracker();
    const first = tracker.update(frame(detectedPose("V_GESTURE")), 0)[0];
    tracker.update(frame(), 50);
    tracker.update(frame(), 100);
    tracker.update(frame(), 150);
    if (finalEmptyFrame) tracker.update(frame(), 151);
    const returned = tracker.update(frame(detectedPose("V_GESTURE")), 200)[0];
    assert.notEqual(returned.id, first.id);
  }
});

test("ordinary pinch loss and malformed V observations still discard identity immediately", () => {
  const pinch = new HandIdentityTracker();
  const firstPinch = pinch.update(frame(detectedPose("PINCH")), 0)[0];
  pinch.update(frame(), 50);
  assert.notEqual(
    pinch.update(frame(detectedPose("PINCH")), 100)[0].id,
    firstPinch.id,
  );
  const victory = new HandIdentityTracker();
  const firstV = victory.update(frame(detectedPose("V_GESTURE")), 0)[0];
  const bad = detectedPose("V_GESTURE");
  bad.points[8].x = NaN;
  assert.deepEqual(victory.update(frame(bad), 50), []);
  assert.notEqual(
    victory.update(frame(detectedPose("V_GESTURE")), 100)[0].id,
    firstV.id,
  );
});

test("V grace does not preserve identity for a spatially unrelated returning hand", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(frame(detectedPose("V_GESTURE", -0.2)), 0)[0];
  tracker.update(frame(), 50);
  const unrelated = tracker.update(
    frame(detectedPose("V_GESTURE", 0.2)),
    100,
  )[0];
  assert.notEqual(unrelated.id, first.id);
});

test("a missing V beside a continuously visible hand returns with its own identity and no phantom frames", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(
    frame(detectedPose("V_GESTURE", -0.15), detected(0.15, 0, "Left")),
    0,
  );
  const victoryId = first.find((hand) => hand.gesture === "V_GESTURE")!.id;
  const companionId = first.find((hand) => hand.gesture === "POINT")!.id;
  for (const time of [50, 100]) {
    const partial = tracker.update(
      frame(detected(0.15 + time / 5000, 0, "Left")),
      time,
    );
    assert.equal(
      partial.length,
      1,
      "retained identity cannot become a phantom detection",
    );
    assert.equal(partial[0].id, companionId);
  }
  const returned = tracker.update(
    frame(detected(0.18, 0, "Left"), detectedPose("V_GESTURE", -0.14)),
    150,
  );
  assert.equal(
    returned.find((hand) => hand.gesture === "V_GESTURE")!.id,
    victoryId,
  );
  assert.equal(
    returned.find((hand) => hand.gesture === "POINT")!.id,
    companionId,
  );
});

test("a visible companion cannot prolong an occluded V's identity beyond its own last valid timestamp", () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.update(
    frame(detectedPose("V_GESTURE", -0.15), detected(0.15, 0, "Left")),
    0,
  );
  const victoryId = first.find((hand) => hand.gesture === "V_GESTURE")!.id;
  const companionId = first.find((hand) => hand.gesture === "POINT")!.id;
  for (const time of [50, 100, 150, 200]) {
    const partial = tracker.update(frame(detected(0.15, 0, "Left")), time);
    assert.equal(partial.length, 1);
    assert.equal(partial[0].id, companionId);
  }
  const returned = tracker.update(
    frame(detectedPose("V_GESTURE", -0.15), detected(0.15, 0, "Left")),
    250,
  );
  assert.notEqual(
    returned.find((hand) => hand.gesture === "V_GESTURE")!.id,
    victoryId,
  );
  assert.equal(
    returned.find((hand) => hand.gesture === "POINT")!.id,
    companionId,
  );
});

test("partial malformed V geometry and a missing pinch cannot inherit the V-only identity grace", () => {
  for (const pose of ["V_GESTURE", "PINCH"] as const) {
    const tracker = new HandIdentityTracker();
    const first = tracker.update(
      frame(detectedPose(pose, -0.15), detected(0.15, 0, "Left")),
      0,
    );
    const originalId = first.find((hand) => hand.gesture === pose)!.id;
    const companionId = first.find((hand) => hand.gesture === "POINT")!.id;
    const bad = detectedPose(pose, -0.15);
    bad.points[8].z = NaN;
    const partial = tracker.update(
      pose === "V_GESTURE"
        ? frame(bad, detected(0.15, 0, "Left"))
        : frame(detected(0.15, 0, "Left")),
      50,
    );
    assert.equal(partial.length, 1);
    assert.equal(partial[0].id, companionId);
    const returned = tracker.update(
      frame(detectedPose(pose, -0.15), detected(0.15, 0, "Left")),
      100,
    );
    assert.notEqual(
      returned.find((hand) => hand.gesture === pose)!.id,
      originalId,
    );
    assert.equal(
      returned.find((hand) => hand.gesture === "POINT")!.id,
      companionId,
    );
  }
});
