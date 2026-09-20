import test from "node:test";
import assert from "node:assert/strict";
import { GestureRecognizer } from "../src/gesture/GestureRecognizer";
import { handFixture } from "./fixtures/hands";
import { gestureConfig } from "../src/gesture/gestureConfig";
const classified = (pose: string) =>
  pose === "V_SIGN" || pose === "THREE" ? "NONE" : pose;

for (const gesture of [
  "OPEN_PALM",
  "POINT",
  "PINCH",
  "FIST",
  "V_SIGN",
  "THREE",
] as const) {
  test(`${gesture} maps to ${classified(gesture)} across rotations, mirroring and submillimetre noise`, () => {
    for (const rotation of [0, -0.4, 0.5]) {
      for (const mirror of [false, true]) {
        const recognizer = new GestureRecognizer();
        for (let frame = 0; frame < 10; frame++) {
          const { points, world } = handFixture(gesture, {
            rotation,
            mirror,
            noise: 0.0003,
            frame,
          });
          const result = recognizer.analyze(points, world, frame * 50);
          assert.equal(
            result.gesture,
            classified(gesture),
            `rotation=${rotation}, mirror=${mirror}, frame=${frame}`,
          );
          assert.ok(
            result.confidence > 0.5,
            `action confidence: ${result.confidence}`,
          );
        }
      }
    }
  });
}

for (const gesture of ["OPEN_PALM", "POINT", "V_SIGN", "THREE"] as const) {
  test(`${gesture} maps to ${classified(gesture)} with naturally relaxed fingers`, () => {
    const recognizer = new GestureRecognizer();
    for (let frame = 0; frame < 12; frame++) {
      const { points, world } = handFixture(gesture, {
        relaxed: true,
        noise: 0.0003,
        frame,
      });
      const result = recognizer.analyze(points, world, frame * 50);
      assert.equal(result.gesture, classified(gesture));
      assert.ok(result.confidence > 0.5);
    }
  });
}

test("a folded fist touching its thumb is not classified as pinch", () => {
  const { points, world } = handFixture("FIST");
  const result = new GestureRecognizer().analyze(points, world, 0);
  assert.ok(result.pinchDistance < 0.28);
  assert.equal(result.gesture, "FIST");
});

test("pointing then pinching works with the other three fingers still folded", () => {
  for (const rotation of [0, -0.4, 0.5]) {
    for (const mirror of [false, true]) {
      const recognizer = new GestureRecognizer();
      const point = handFixture("POINT", { rotation, mirror, relaxed: true });
      assert.equal(
        recognizer.analyze(point.points, point.world, 0).gesture,
        "POINT",
      );
      const pinch = handFixture("PINCH", {
        rotation,
        mirror,
        foldedPinch: true,
      });
      assert.equal(
        recognizer.analyze(pinch.points, pinch.world, 50).gesture,
        "PINCH",
      );
    }
  }
});

test("thumb-index contact takes priority over three extended fingers", () => {
  const { points, world } = handFixture("THREE");
  points[4] = { ...points[8] };
  world[4] = { ...world[8] };
  assert.equal(
    new GestureRecognizer().analyze(points, world, 0).gesture,
    "PINCH",
  );
});

test("switching between open fingers, folded fingers and pinch clears hysteresis", () => {
  const recognizer = new GestureRecognizer();
  const poses = [
    "OPEN_PALM",
    "FIST",
    "POINT",
    "PINCH",
    "V_SIGN",
    "THREE",
    "OPEN_PALM",
  ] as const;
  poses.forEach((gesture, frame) => {
    const { points, world } = handFixture(gesture, { relaxed: true });
    assert.equal(
      recognizer.analyze(points, world, frame * 50).gesture,
      classified(gesture),
    );
  });
});

test("aspect-corrected screen landmarks work when world landmarks are unavailable", () => {
  for (const gesture of [
    "OPEN_PALM",
    "POINT",
    "PINCH",
    "FIST",
    "V_SIGN",
    "THREE",
  ] as const) {
    const { points } = handFixture(gesture, { relaxed: true });
    assert.equal(
      new GestureRecognizer().analyze(points, undefined, 0, 4 / 3).gesture,
      classified(gesture),
    );
  }
});

test("center and pointer stay in mirrored screen coordinates independent of aspect", () => {
  const { points, world } = handFixture("POINT");
  const palmX = [0, 5, 9, 13, 17].reduce((sum, i) => sum + points[i].x / 5, 0);
  const palmY = [0, 5, 9, 13, 17].reduce((sum, i) => sum + points[i].y / 5, 0);
  for (const aspect of [9 / 16, 4 / 3, 16 / 9]) {
    const result = new GestureRecognizer().analyze(points, world, 0, aspect);
    assert.ok(Math.abs(result.center.x - (1 - palmX)) < 1e-10);
    assert.ok(Math.abs(result.center.y - palmY) < 1e-10);
    assert.deepEqual(result.pointer, { x: 1 - points[8].x, y: points[8].y });
  }
});

test("pointing filters tiny hand jitter and smooths deliberate movement", () => {
  const recognizer = new GestureRecognizer();
  const initial = handFixture("POINT");
  const first = recognizer.analyze(initial.points, initial.world, 0);
  const tremor = handFixture("POINT");
  tremor.points[8].x += gestureConfig.CURSOR_DEAD_ZONE / 2;
  const jittered = recognizer.analyze(tremor.points, tremor.world, 50);
  assert.deepEqual(jittered.pointer, first.pointer);
  const moved = handFixture("POINT");
  moved.points[8].x += 0.1;
  const result = recognizer.analyze(moved.points, moved.world, 100);
  const rawX = 1 - moved.points[8].x;
  assert.ok(result.pointer.x < first.pointer.x);
  assert.ok(result.pointer.x > rawX);
  // Returned history is not the recognizer's reused geometry scratch memory.
  assert.deepEqual(first.pointer, {
    x: 1 - initial.points[8].x,
    y: initial.points[8].y,
  });
  assert.deepEqual(first.landmarks, initial.points);
});

test("pinch midpoint is mirrored and independent of frame aspect", () => {
  for (const aspect of [9 / 16, 4 / 3, 16 / 9]) {
    const { points, world } = handFixture("PINCH");
    const result = new GestureRecognizer().analyze(points, world, 0, aspect);
    assert.deepEqual(result.pinchPoint, {
      x: 1 - (points[4].x + points[8].x) / 2,
      y: (points[4].y + points[8].y) / 2,
    });
  }
});

test("debug finger states describe each measured pose even when it is not a command", () => {
  for (const pose of [
    "OPEN_PALM",
    "POINT",
    "V_SIGN",
    "THREE",
    "FIST",
  ] as const) {
    const { points, world } = handFixture(pose);
    const result = new GestureRecognizer().analyze(points, world, 0);
    assert.ok(result.fingerState);
    assert.equal(result.fingerState.index, pose !== "FIST");
    assert.equal(
      result.fingerState.middle,
      ["OPEN_PALM", "V_SIGN", "THREE"].includes(pose),
    );
    assert.equal(
      result.fingerState.ring,
      ["OPEN_PALM", "THREE"].includes(pose),
    );
    assert.equal(result.fingerState.pinky, pose === "OPEN_PALM");
    if (pose === "OPEN_PALM") assert.equal(result.fingerState.thumb, true);
    if (pose === "FIST") assert.equal(result.fingerState.thumb, false);
  }
});

test("a long frame gap discards prior smoothing and velocity", () => {
  const recognizer = new GestureRecognizer();
  const first = handFixture("POINT");
  recognizer.analyze(first.points, first.world, 0);
  const second = handFixture("POINT");
  second.points.forEach((point) => (point.x += 0.2));
  const result = recognizer.analyze(
    second.points,
    second.world,
    gestureConfig.FRAME_GAP_RESET + 1,
  );
  assert.deepEqual(result.velocity, { x: 0, y: 0 });
  assert.deepEqual(result.pointer, {
    x: 1 - second.points[8].x,
    y: second.points[8].y,
  });
});

test("open palms tolerate progressive natural flexion and one softer pinky", () => {
  for (const flexion of [20, 35, 50, 60]) {
    for (const softPinky of [flexion, Math.min(70, flexion + 15)]) {
      const recognizer = new GestureRecognizer();
      for (let frame = 0; frame < 16; frame++) {
        const fixture = handFixture("OPEN_PALM", {
          flexion,
          softPinky,
          noise: 0.0004,
          depthNoise: 0.0015,
          frame,
        });
        const hand = recognizer.analyze(
          fixture.points,
          fixture.world,
          frame * 50,
        );
        assert.equal(
          hand.gesture,
          "OPEN_PALM",
          `flexion=${flexion}, pinky=${softPinky}, frame=${frame}`,
        );
        assert.ok(
          hand.confidence >= gestureConfig.TWO_HAND_MIN_CONFIDENCE,
          `relaxed palm confidence=${hand.confidence}`,
        );
      }
    }
  }
});

test("sideways and pitched palms retain open/point/pinch/fist geometry with depth noise", () => {
  for (const pose of ["OPEN_PALM", "POINT", "PINCH", "FIST"] as const) {
    for (const yaw of [-1, 0.8]) {
      for (const pitch of [-0.65, 0.5]) {
        const recognizer = new GestureRecognizer();
        for (let frame = 0; frame < 12; frame++) {
          const fixture = handFixture(pose, {
            yaw,
            pitch,
            rotation: 0.35,
            relaxed: true,
            foldedPinch: true,
            noise: 0.0004,
            depthNoise: 0.0015,
            frame,
          });
          const hand = recognizer.analyze(
            fixture.points,
            fixture.world,
            frame * 50,
          );
          assert.equal(
            hand.gesture,
            pose,
            `${pose}, yaw=${yaw}, pitch=${pitch}, frame=${frame}`,
          );
        }
      }
    }
  }
});

test("compact thumb-side pinches work while the remaining fingers stay folded", () => {
  for (const mirror of [false, true]) {
    for (const yaw of [-0.8, 0, 0.8]) {
      for (let frame = 0; frame < 12; frame++) {
        const fixture = handFixture("PINCH", {
          foldedPinch: true,
          compactPinch: true,
          mirror,
          yaw,
          pitch: 0.5,
          noise: 0.0003,
          depthNoise: 0.001,
          frame,
        });
        const hand = new GestureRecognizer().analyze(
          fixture.points,
          fixture.world,
          frame * 50,
        );
        assert.equal(
          hand.gesture,
          "PINCH",
          `compact pinch mirror=${mirror}, yaw=${yaw}, frame=${frame}`,
        );
        assert.equal(hand.fingerState!.middle, false);
        assert.equal(hand.fingerState!.ring, false);
        assert.equal(hand.fingerState!.pinky, false);
      }
    }
  }
});

test("relaxing V/THREE with noisy depth still cannot masquerade as an open palm", () => {
  for (const pose of ["V_SIGN", "THREE"] as const) {
    const recognizer = new GestureRecognizer();
    for (let frame = 0; frame < 16; frame++) {
      const fixture = handFixture(pose, {
        flexion: 55,
        yaw: 0.8,
        pitch: -0.6,
        noise: 0.0004,
        depthNoise: 0.0015,
        frame,
      });
      const hand = recognizer.analyze(
        fixture.points,
        fixture.world,
        frame * 50,
      );
      assert.equal(hand.gesture, "NONE");
    }
  }
});

test("a uniformly cupped hand cannot become POINT from one finger crossing hysteresis", () => {
  const recognizer = new GestureRecognizer();
  for (let frame = 0; frame < 24; frame++) {
    const fixture = handFixture("OPEN_PALM", {
      flexion: 65 + (frame % 3) * 3,
      noise: 0.0004,
      depthNoise: 0.0015,
      frame,
    });
    const hand = recognizer.analyze(fixture.points, fixture.world, frame * 50);
    assert.notEqual(hand.gesture, "POINT");
    assert.notEqual(hand.gesture, "PINCH");
  }
});

test("a fist with lateral thumb/index overlap remains a fist across camera angles", () => {
  for (const yaw of [-0.9, 0, 0.9]) {
    for (let frame = 0; frame < 12; frame++) {
      const fixture = handFixture("FIST", {
        yaw,
        pitch: 0.5,
        noise: 0.0004,
        depthNoise: 0.0015,
        frame,
      });
      // Move the contacting index/thumb sideways together by up to 7 mm,
      // below actual opposition, rather than using a perfectly centered fist.
      for (const i of [4, 8]) {
        fixture.world[i].x -= 0.007 * Math.cos(yaw);
        fixture.world[i].z += 0.007 * Math.sin(yaw);
      }
      const hand = new GestureRecognizer().analyze(
        fixture.points,
        fixture.world,
        frame * 50,
      );
      assert.equal(hand.gesture, "FIST");
    }
  }
});
