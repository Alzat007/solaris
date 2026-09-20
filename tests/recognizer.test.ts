import test from "node:test";
import assert from "node:assert/strict";
import {
  GestureRecognizer,
  GestureStabilizer,
} from "../src/gesture/GestureRecognizer";
import { handFixture } from "./fixtures/hands";

for (const gesture of [
  "OPEN_PALM",
  "POINT",
  "PINCH",
  "FIST",
  "V_SIGN",
  "THREE",
] as const) {
  test(`${gesture} recognizes anatomical landmarks, rotations, mirroring and submillimetre noise`, () => {
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
            gesture,
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
  test(`${gesture} recognizes naturally relaxed fingers without first requiring rigid straight fingers`, () => {
    const recognizer = new GestureRecognizer();
    for (let frame = 0; frame < 12; frame++) {
      const { points, world } = handFixture(gesture, {
        relaxed: true,
        noise: 0.0003,
        frame,
      });
      const result = recognizer.analyze(points, world, frame * 50);
      assert.equal(result.gesture, gesture);
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
      gesture,
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
      gesture,
    );
  }
});

test("center and pointer stay in mirrored screen coordinates independent of aspect", () => {
  const { points, world } = handFixture("POINT");
  const palmX = [0, 5, 9, 13, 17].reduce((sum, i) => sum + points[i].x / 5, 0);
  const palmY = [0, 5, 9, 13, 17].reduce((sum, i) => sum + points[i].y / 5, 0);
  for (const aspect of [9 / 16, 4 / 3, 16 / 9]) {
    const result = new GestureRecognizer().analyze(points, world, 0, aspect);
    assert.deepEqual(result.center, { x: 1 - palmX, y: palmY });
    assert.deepEqual(result.pointer, { x: 1 - points[8].x, y: points[8].y });
  }
});

test("one marginal confidence frame does not restart a deliberate gesture hold", () => {
  const stabilizer = new GestureStabilizer();
  for (const [time, confidence] of [
    [0, 0.9],
    [50, 0.9],
    [100, 0.48],
    [150, 0.9],
    [200, 0.9],
  ]) {
    assert.equal(stabilizer.update("FIST", time, confidence), null);
  }
  assert.equal(stabilizer.update("FIST", 250, 0.9), "FIST");
  assert.equal(stabilizer.update("FIST", 300, 0.48), null);
  assert.equal(stabilizer.update("FIST", 600, 0.9), null);
});

test("prolonged uncertainty cannot complete a hold", () => {
  const stabilizer = new GestureStabilizer();
  stabilizer.update("OPEN_PALM", 0, 0.9);
  for (const time of [50, 100, 150, 200, 250, 300]) {
    assert.equal(stabilizer.update("OPEN_PALM", time, 0.48), null);
  }
  assert.equal(stabilizer.update("OPEN_PALM", 350, 0.9), null);
  assert.equal(stabilizer.update("OPEN_PALM", 570, 0.9), "OPEN_PALM");
});
