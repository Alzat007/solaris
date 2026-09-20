import test from "node:test";
import assert from "node:assert/strict";
import { GestureRecognizer } from "../src/gesture/GestureRecognizer";
import { handFixture } from "./fixtures/hands";
import { gestureConfig } from "../src/gesture/gestureConfig";
const classified = (pose: string) =>
  pose === "V_SIGN" ? "V_GESTURE" : pose === "THREE" ? "NONE" : pose;

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
      assert.equal(hand.gesture, classified(pose));
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

test("all five fingertips gathered outside the palm classify as FIVE_PINCH", () => {
  for (const mirror of [false, true])
    for (const yaw of [-0.9, 0, 0.9]) {
      const recognizer = new GestureRecognizer();
      for (let frame = 0; frame < 14; frame++) {
        const fixture = handFixture("FIVE_PINCH", {
          mirror,
          yaw,
          pitch: 0.5,
          rotation: -0.4,
          noise: 0.0004,
          depthNoise: 0.0015,
          frame,
        });
        const hand = recognizer.analyze(
          fixture.points,
          fixture.world,
          frame * 50,
        );
        assert.equal(hand.gesture, "FIVE_PINCH");
        assert.ok(hand.gripAperture! < 0.1);
        assert.ok(hand.gripConfidence! >= 0.75);
      }
    }
});

test("five-tip aperture is invariant under camera distance, translation and 3D rotation", () => {
  const baseline = new GestureRecognizer();
  const original = handFixture("FIVE_PINCH", { gripSpread: 0.45 });
  const expected = baseline.analyze(
    original.points,
    original.world,
    0,
  ).gripAperture!;
  for (const scale of [0.45, 0.8, 1.7])
    for (const yaw of [-1.1, 0.85]) {
      const fixture = handFixture("FIVE_PINCH", {
        gripSpread: 0.45,
        yaw,
        pitch: -0.6,
        rotation: 0.7,
        mirror: true,
      });
      fixture.world.forEach((p) => {
        p.x = p.x * scale + 0.18;
        p.y = p.y * scale - 0.13;
        p.z = p.z * scale + 0.2;
      });
      fixture.points.forEach((p) => {
        p.x = (p.x - 0.5) * scale + 0.62;
        p.y = (p.y - 0.4) * scale + 0.36;
        p.z *= scale;
      });
      const hand = new GestureRecognizer().analyze(
        fixture.points,
        fixture.world,
        0,
      );
      assert.ok(Math.abs(hand.gripAperture! - expected) < 1e-12);
      assert.ok(hand.gripConfidence! >= 0.6);
    }
});

test("slow five-finger opening and closing keep continuous evidence through every intermediate aperture", () => {
  for (const relaxed of [false, true]) {
    const recognizer = new GestureRecognizer();
    const sequence = [
      ...Array.from({ length: 51 }, (_, i) => i / 50),
      ...Array.from({ length: 51 }, (_, i) => 1 - i / 50),
    ];
    let previous = -Infinity;
    sequence.forEach((spread, frame) => {
      const fixture = handFixture("FIVE_PINCH", {
        gripSpread: spread,
        relaxed,
        yaw: 0.8,
        pitch: 0.45,
        rotation: -0.3,
        noise: 0.00025,
        depthNoise: 0.001,
        frame,
      });
      const hand = recognizer.analyze(
        fixture.points,
        fixture.world,
        frame * 50,
      );
      assert.ok(
        hand.gripConfidence! >= 0.6,
        `spread=${spread}, frame=${frame}, gesture=${hand.gesture}, confidence=${hand.gripConfidence}`,
      );
      assert.notEqual(hand.gesture, "PINCH");
      assert.notEqual(hand.gesture, "FIST");
      if (frame <= 50) assert.ok(hand.gripAperture! >= previous - 0.02);
      else assert.ok(hand.gripAperture! <= previous + 0.02);
      previous = hand.gripAperture!;
    });
  }
});

test("ordinary fist, pointing, two-finger pinch, V and THREE do not claim five-finger zoom", () => {
  for (const pose of ["FIST", "POINT", "PINCH", "V_SIGN", "THREE"] as const) {
    for (const foldedPinch of [false, true]) {
      const recognizer = new GestureRecognizer();
      for (let frame = 0; frame < 12; frame++) {
        const fixture = handFixture(pose, {
          relaxed: true,
          foldedPinch,
          yaw: 0.8,
          pitch: -0.5,
          noise: 0.0004,
          depthNoise: 0.0015,
          frame,
        });
        const hand = recognizer.analyze(
          fixture.points,
          fixture.world,
          frame * 50,
        );
        assert.notEqual(hand.gesture, "FIVE_PINCH");
        assert.equal(hand.gripConfidence, 0, pose);
      }
    }
  }
});

test("five fingertips gathered inside the palm are not the outward five-finger grip", () => {
  const fixture = handFixture("FIST");
  for (const i of [4, 8, 12, 16, 20]) {
    fixture.world[i] = { x: (0.001 * i) / 4, y: 0.025, z: -0.026 };
  }
  const hand = new GestureRecognizer().analyze(
    fixture.points,
    fixture.world,
    0,
  );
  assert.ok(hand.gripAperture! < 0.1);
  assert.notEqual(hand.gesture, "FIVE_PINCH");
  assert.equal(hand.gripConfidence, 0);
});

test("one fingertip remaining outside the cluster prevents closed-five recognition", () => {
  const fixture = handFixture("FIVE_PINCH");
  const open = handFixture("OPEN_PALM");
  fixture.world[20] = { ...open.world[20] };
  const hand = new GestureRecognizer().analyze(
    fixture.points,
    fixture.world,
    0,
  );
  assert.notEqual(hand.gesture, "FIVE_PINCH");
});

test("five-finger grip has an aspect-correct screen fallback when world landmarks are absent", () => {
  for (const spread of [0, 0.4, 1]) {
    const fixture = handFixture("FIVE_PINCH", {
      gripSpread: spread,
      yaw: 0.6,
      pitch: -0.4,
    });
    const world = new GestureRecognizer().analyze(
      fixture.points,
      fixture.world,
      0,
    );
    const screen = new GestureRecognizer().analyze(
      fixture.points,
      undefined,
      0,
    );
    assert.equal(screen.gesture, world.gesture);
    assert.ok(Math.abs(screen.gripAperture! - world.gripAperture!) < 1e-12);
    assert.ok(Math.abs(screen.gripConfidence! - world.gripConfidence!) < 1e-12);
  }
});

test("a slightly uneven five-tip bunch retains grip evidence without exact fingertip overlap", () => {
  for (let frame = 0; frame < 16; frame++) {
    const fixture = handFixture("FIVE_PINCH", {
      noise: 0.0005,
      depthNoise: 0.0015,
      frame,
    });
    for (const i of [4, 8, 12, 16, 20]) {
      fixture.world[i].y += 0.006;
      fixture.world[i].z -= 0.008;
      fixture.world[i].x += Math.sin(i) * 0.004;
    }
    const hand = new GestureRecognizer().analyze(
      fixture.points,
      fixture.world,
      0,
    );
    assert.equal(hand.gesture, "FIVE_PINCH");
    assert.ok(hand.gripConfidence! >= 0.75);
  }
});

test("fingertips gathered towards the camera classify despite being behind the MCP row", () => {
  for (const depth of [0.035, 0.045, 0.055]) {
    for (const mirror of [false, true]) {
      for (const yaw of [-0.8, 0, 0.8]) {
        for (const pitch of [-0.55, 0.4]) {
          const recognizer = new GestureRecognizer();
          for (let frame = 0; frame < 12; frame++) {
            const fixture = handFixture("FIVE_PINCH", {
              gripDirection: "camera",
              gripDepth: depth,
              mirror,
              yaw,
              pitch,
              rotation: 0.35,
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
              "FIVE_PINCH",
              `depth=${depth}, mirror=${mirror}, yaw=${yaw}, pitch=${pitch}, frame=${frame}`,
            );
            assert.ok(hand.gripConfidence! >= 0.65);
          }
        }
      }
    }
  }
});

test("camera-facing bunch keeps reliable geometry across slow opening and closing", () => {
  for (const depth of [0.035, 0.045, 0.055]) {
    for (const relaxed of [false, true]) {
      for (const mirror of [false, true]) {
        const recognizer = new GestureRecognizer();
        let previous = -Infinity;
        for (let frame = 0; frame <= 100; frame++) {
          const spread = frame <= 50 ? frame / 50 : (100 - frame) / 50;
          const fixture = handFixture("FIVE_PINCH", {
            gripDirection: "camera",
            gripDepth: depth,
            gripSpread: spread,
            relaxed,
            mirror,
            yaw: mirror ? -0.7 : 0.7,
            pitch: 0.4,
            rotation: -0.3,
            noise: 0.00035,
            depthNoise: 0.0015,
            frame,
          });
          const hand = recognizer.analyze(
            fixture.points,
            fixture.world,
            frame * 50,
          );
          const context = `depth=${depth}, spread=${spread}, mirror=${mirror}, relaxed=${relaxed}, gesture=${hand.gesture}, confidence=${hand.gripConfidence}`;
          assert.ok(hand.gripConfidence! >= 0.65, context);
          assert.notEqual(hand.gesture, "FIST", context);
          assert.notEqual(hand.gesture, "PINCH", context);
          if (frame <= 50)
            assert.ok(hand.gripAperture! >= previous - 0.035, context);
          else assert.ok(hand.gripAperture! <= previous + 0.035, context);
          previous = hand.gripAperture!;
        }
      }
    }
  }
});

test("all five raised fingertips must participate: one uncurled tip prevents camera-facing activation", () => {
  for (const depth of [0.045, 0.055]) {
    for (const excluded of [4, 8, 12, 16, 20]) {
      const fixture = handFixture("FIVE_PINCH", {
        gripDirection: "camera",
        gripDepth: depth,
      });
      const open = handFixture("FIVE_PINCH", {
        gripDirection: "camera",
        gripDepth: depth,
        gripSpread: 1,
      });
      fixture.world[excluded] = { ...open.world[excluded] };
      const hand = new GestureRecognizer().analyze(
        fixture.points,
        fixture.world,
        0,
      );
      assert.notEqual(
        hand.gesture,
        "FIVE_PINCH",
        `depth=${depth}, excluded=${excluded}`,
      );
    }
  }
});

test("camera-facing bunch cannot turn into a compact fist or a two-finger pinch", () => {
  for (const pose of ["FIST", "PINCH", "POINT", "V_SIGN", "THREE"] as const) {
    const recognizer = new GestureRecognizer();
    const bunch = handFixture("FIVE_PINCH", { gripDirection: "camera" });
    assert.equal(
      recognizer.analyze(bunch.points, bunch.world, 0).gesture,
      "FIVE_PINCH",
    );
    for (let frame = 1; frame <= 12; frame++) {
      const other = handFixture(pose, {
        foldedPinch: true,
        compactPinch: true,
        noise: 0.0004,
        depthNoise: 0.0015,
        frame,
      });
      const hand = recognizer.analyze(other.points, other.world, frame * 50);
      assert.equal(hand.gesture, classified(pose));
      assert.equal(hand.gripConfidence, 0, pose);
    }
  }
});

test("a fist with the thumb off the index does not become intermediate five-finger zoom", () => {
  for (let frame = 0; frame < 18; frame++) {
    const fixture = handFixture("FIST", {
      noise: 0.0004,
      depthNoise: 0.0015,
      frame,
    });
    // A loose thumb removes the usual thumb/index overlap. Curl evidence must
    // still reject the fist even if the five-tip spread ratio looks plausible.
    fixture.world[4] = { x: -0.055, y: -0.002, z: -0.034 };
    const hand = new GestureRecognizer().analyze(
      fixture.points,
      fixture.world,
      0,
    );
    assert.equal(hand.gesture, "FIST");
    assert.equal(hand.gripConfidence, 0);
  }
});

test("fists with strongly flexed MCPs and a loose thumb still return FIST", () => {
  for (const bends of [
    [60, 130, 200],
    [60, 135, 205],
    [50, 120, 190],
  ]) {
    for (const thumbGap of [0.016, 0.02, 0.026]) {
      const fixture = handFixture("FIST");
      for (let finger = 0; finger < 4; finger++) {
        const base = 5 + finger * 4;
        const scale = [0.95, 1.08, 1, 0.78][finger];
        for (let joint = 0; joint < 3; joint++) {
          const length = [0.035, 0.022, 0.018][joint] * scale;
          const angle = (bends[joint] * Math.PI) / 180;
          const previous = fixture.world[base + joint];
          fixture.world[base + joint + 1] = {
            x: previous.x,
            y: previous.y - length * Math.cos(angle),
            z: previous.z - length * Math.sin(angle),
          };
        }
      }
      fixture.world[4] = {
        ...fixture.world[8],
        x: fixture.world[8].x - thumbGap,
      };
      fixture.points = fixture.world.map((p) => ({
        x: 0.5 + (p.x * 3) / (4 / 3),
        y: 0.4 + p.y * 3,
        z: (p.z * 3) / (4 / 3),
      }));
      const recognizer = new GestureRecognizer();
      const bunch = handFixture("FIVE_PINCH", { gripDirection: "camera" });
      recognizer.analyze(bunch.points, bunch.world, 0);
      const hand = recognizer.analyze(fixture.points, fixture.world, 50);
      assert.equal(
        hand.gesture,
        "FIST",
        `bends=${bends}, thumbGap=${thumbGap}`,
      );
      assert.equal(hand.gripConfidence, 0);
    }
  }
});

test("camera-facing bunch matches fallback geometry and stays invariant to hand image scale", () => {
  for (const spread of [0, 0.35, 0.65, 1]) {
    const fixture = handFixture("FIVE_PINCH", {
      gripDirection: "camera",
      gripDepth: 0.055,
      gripSpread: spread,
      mirror: true,
      yaw: 0.65,
      pitch: -0.5,
    });
    const world = new GestureRecognizer().analyze(
      fixture.points,
      fixture.world,
      0,
    );
    const screen = new GestureRecognizer().analyze(
      fixture.points,
      undefined,
      0,
    );
    assert.equal(screen.gesture, world.gesture);
    assert.ok(Math.abs(screen.gripAperture! - world.gripAperture!) < 1e-12);
    assert.ok(Math.abs(screen.gripConfidence! - world.gripConfidence!) < 1e-12);
    for (const scale of [0.55, 1.7]) {
      const transformed = fixture.world.map((p) => ({
        x: p.x * scale + 0.13,
        y: p.y * scale - 0.21,
        z: p.z * scale + 0.18,
      }));
      const hand = new GestureRecognizer().analyze(
        fixture.points,
        transformed,
        0,
      );
      assert.equal(hand.gesture, world.gesture);
      assert.ok(Math.abs(hand.gripAperture! - world.gripAperture!) < 1e-12);
    }
  }
});

test("victory tolerates bent extended fingers, a free thumb and laptop-camera tilt", () => {
  for (const flexion of [20, 40, 60]) {
    for (const thumbPose of ["open", "tucked", "index-contact"] as const) {
      for (const mirror of [false, true]) {
        const recognizer = new GestureRecognizer();
        for (let frame = 0; frame < 16; frame++) {
          const fixture = handFixture("V_GESTURE", {
            flexion,
            thumbPose,
            mirror,
            yaw: 0.7,
            pitch: -0.45,
            noise: 0.0004,
            depthNoise: 0.0015,
            frame,
          });
          const hand = recognizer.analyze(
            fixture.points,
            fixture.world,
            frame * 50,
          );
          const context = `flexion=${flexion}, thumb=${thumbPose}, mirror=${mirror}, frame=${frame}`;
          assert.equal(hand.gesture, "V_GESTURE", context);
          assert.ok(
            hand.vConfidence! >= gestureConfig.V_GESTURE_MIN_CONFIDENCE,
            context,
          );
          assert.equal(hand.palmRollValid, true, context);
        }
      }
    }
  }
});

test("a genuinely folded index pinch stays PINCH even with the middle finger extended", () => {
  for (const compactPinch of [false, true]) {
    const fixture = handFixture("PINCH", { foldedPinch: true, compactPinch });
    const victory = handFixture("V_GESTURE");
    for (let i = 9; i <= 12; i++) {
      fixture.points[i] = { ...victory.points[i] };
      fixture.world[i] = { ...victory.world[i] };
    }
    const hand = new GestureRecognizer().analyze(
      fixture.points,
      fixture.world,
      0,
    );
    assert.equal(hand.gesture, "PINCH");
    assert.equal(hand.vConfidence, 0);
  }
});

const wrappedRadians = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

test("palm roll follows the mirrored MCP axis, independent of image aspect", () => {
  for (const aspect of [9 / 16, 4 / 3, 16 / 9]) {
    for (const mirror of [false, true]) {
      const fixture = handFixture("V_GESTURE", { mirror, rotation: 0.35 });
      const points = fixture.world.map((p) => ({
        x: 0.5 + (p.x * 3) / aspect,
        y: 0.4 + p.y * 3,
        z: (p.z * 3) / aspect,
      }));
      const hand = new GestureRecognizer().analyze(
        points,
        fixture.world,
        0,
        aspect,
      );
      const expected = Math.atan2(
        fixture.world[17].y - fixture.world[5].y,
        -(fixture.world[17].x - fixture.world[5].x),
      );
      assert.ok(Math.abs(wrappedRadians(hand.palmRoll! - expected)) < 1e-12);
      assert.equal(hand.palmRollValid, true);
    }
  }
});

test("clockwise in the mirrored preview yields positive roll for either hand", () => {
  for (const mirror of [false, true]) {
    const base = handFixture("V_GESTURE", { mirror });
    const first = new GestureRecognizer().analyze(base.points, base.world, 0);
    for (const visualRotation of [-0.6, -0.2, 0.2, 0.6]) {
      // The fixture mirrors *after* rotating, so reverse its input rotation for
      // the other hand to produce the same visible clockwise motion.
      const fixture = handFixture("V_GESTURE", {
        mirror,
        rotation: visualRotation * (mirror ? 1 : -1),
      });
      const hand = new GestureRecognizer().analyze(
        fixture.points,
        fixture.world,
        0,
      );
      assert.ok(
        Math.abs(
          wrappedRadians(hand.palmRoll! - first.palmRoll!) - visualRotation,
        ) < 1e-12,
      );
    }
  }
});

test("translating the whole V or moving fingertips does not turn the palm dial", () => {
  const original = handFixture("V_GESTURE");
  const first = new GestureRecognizer().analyze(
    original.points,
    original.world,
    0,
  );
  for (const [dx, dy] of [
    [0.2, 0],
    [-0.2, 0.1],
    [0, -0.15],
  ]) {
    const fixture = handFixture("V_GESTURE");
    for (const p of fixture.points) {
      p.x += dx;
      p.y += dy;
    }
    for (const i of [4, 8, 12, 16, 20]) {
      fixture.points[i].x += Math.sin(i) * 0.007;
      fixture.points[i].y += Math.cos(i) * 0.005;
    }
    const hand = new GestureRecognizer().analyze(
      fixture.points,
      fixture.world,
      0,
    );
    assert.equal(hand.gesture, "V_GESTURE");
    assert.ok(
      Math.abs(wrappedRadians(hand.palmRoll! - first.palmRoll!)) < 1e-12,
    );
  }
});

test("roll stays measurable through moderate tilt and rejects severe edge-on palms", () => {
  for (const mirror of [false, true]) {
    for (const [yaw, pitch, valid] of [
      [0.8, 0.5, true],
      [-0.8, -0.5, true],
      [Math.PI / 2, 0, false],
      [0, Math.PI / 2, false],
    ] as const) {
      const fixture = handFixture("V_GESTURE", { mirror, yaw, pitch });
      const hand = new GestureRecognizer().analyze(
        fixture.points,
        fixture.world,
        0,
      );
      assert.equal(
        hand.gesture,
        "V_GESTURE",
        "pose and roll validity are independent",
      );
      assert.equal(hand.palmRollValid, valid, `yaw=${yaw}, pitch=${pitch}`);
    }
  }
  const collapsed = handFixture("V_GESTURE");
  collapsed.points[17] = {
    ...collapsed.points[5],
    x: collapsed.points[5].x + 0.00001,
  };
  const hand = new GestureRecognizer().analyze(
    collapsed.points,
    collapsed.world,
    0,
  );
  assert.equal(hand.palmRollValid, false);
  assert.ok(Number.isFinite(hand.palmRoll));
});

test("palm-axis angles around minus/plus PI retain the correct shortest signed delta", () => {
  for (const mirror of [false, true]) {
    const start = mirror ? Math.PI - 0.07 : 0;
    const end = start + (mirror ? 0.15 : -0.08);
    const first = handFixture("V_GESTURE", { mirror, rotation: start });
    const second = handFixture("V_GESTURE", { mirror, rotation: end });
    const a = new GestureRecognizer().analyze(
      first.points,
      first.world,
      0,
    ).palmRoll!;
    const b = new GestureRecognizer().analyze(
      second.points,
      second.world,
      0,
    ).palmRoll!;
    assert.ok(Math.abs(b - a) > 6, "raw atan2 crosses its branch cut");
    assert.ok(Math.abs(wrappedRadians(b - a) - (mirror ? 0.15 : 0.08)) < 1e-12);
  }
});

test("index-dominant pointing accepts naturally half-bent fingers and a free thumb on either hand", () => {
  for (const mirror of [false, true]) {
    for (const otherFingerFlexion of [45, 55, 75]) {
      for (const thumbPose of ["open", "tucked"] as const) {
        const recognizer = new GestureRecognizer();
        for (let frame = 0; frame < 16; frame++) {
          const fixture = handFixture("POINT", {
            indexPipAngle: 160,
            otherFingerFlexion,
            thumbPose,
            mirror,
            yaw: 0.7,
            pitch: -0.45,
            noise: 0.0003,
            depthNoise: 0.001,
            frame,
          });
          const hand = recognizer.analyze(
            fixture.points,
            fixture.world,
            frame * 50,
          );
          const context = `mirror=${mirror}, half-bend=${otherFingerFlexion}, thumb=${thumbPose}, frame=${frame}`;
          assert.equal(hand.gesture, "POINT", context);
          assert.ok(
            hand.pointConfidence! >= gestureConfig.INDEX_POINT_MIN_CONFIDENCE,
            context,
          );
          assert.equal(hand.indexAngleValid, true);
          assert.equal(hand.indexState, "EXTENDED", context);
        }
      }
    }
  }
});

test("index PIP measurement is a true MCP-PIP-DIP joint angle under rotation, mirror and screen fallback", () => {
  for (const indexPipAngle of [170, 155, 135, 110, 105, 80]) {
    for (const mirror of [false, true]) {
      const fixture = handFixture("POINT", {
        indexPipAngle,
        otherFingerFlexion: 55,
        mirror,
        yaw: 0.8,
        pitch: -0.5,
        rotation: 0.4,
      });
      for (const world of [fixture.world, undefined]) {
        const hand = new GestureRecognizer().analyze(fixture.points, world, 0);
        assert.equal(hand.indexAngleValid, true);
        assert.ok(Math.abs(hand.indexAngle! - indexPipAngle) < 1e-8);
        assert.notEqual(
          hand.gesture,
          "INDEX_PRESS",
          "only a locked selection controller may emit an action",
        );
      }
    }
  }
});

test("the PIP angle ignores fingertip-only motion and prefers world geometry over distorted screen points", () => {
  const fixture = handFixture("POINT", { indexPipAngle: 160 });
  fixture.world[8] = { x: 0.1, y: -0.02, z: -0.06 };
  fixture.points[8] = { x: 0.2, y: 0.8, z: -0.1 };
  fixture.points[7] = { ...fixture.points[5] };
  const hand = new GestureRecognizer().analyze(
    fixture.points,
    fixture.world,
    0,
  );
  assert.equal(hand.indexAngleValid, true);
  assert.ok(Math.abs(hand.indexAngle! - 160) < 1e-8);
});

test("index state uses separate press/release thresholds and retains its state in the middle band", () => {
  const recognizer = new GestureRecognizer();
  const samples = [
    [130, "BETWEEN"],
    [160, "EXTENDED"],
    [144, "EXTENDED"],
    [116, "EXTENDED"],
    [114, "BENT"],
    [116, "BENT"],
    [144, "BENT"],
    [146, "EXTENDED"],
  ] as const;
  samples.forEach(([indexPipAngle, expected], frame) => {
    const fixture = handFixture("POINT", {
      indexPipAngle,
      otherFingerFlexion: 55,
    });
    const hand = recognizer.analyze(fixture.points, fixture.world, frame * 50);
    assert.equal(hand.indexState, expected, `PIP angle ${indexPipAngle}`);
  });
});

test("a light 160-to-105-degree index curl provides negative angular velocity without requiring a fist", () => {
  const recognizer = new GestureRecognizer();
  let time = 0;
  const send = (indexPipAngle: number) => {
    const fixture = handFixture("POINT", {
      indexPipAngle,
      otherFingerFlexion: 55,
    });
    return recognizer.analyze(fixture.points, fixture.world, (time += 50));
  };
  assert.equal(send(160).indexAngularVelocity, 0);
  for (const angle of [145, 130, 110, 105]) {
    const hand = send(angle);
    assert.ok(
      hand.indexAngularVelocity! < -gestureConfig.INDEX_PRESS_MIN_VELOCITY,
    );
    assert.notEqual(hand.gesture, "FIST");
  }
  let held = send(105);
  for (let frame = 0; frame < 14; frame++) held = send(105);
  assert.ok(
    Math.abs(held.indexAngularVelocity!) < 0.1,
    "held curls carry no ongoing press velocity",
  );
  const released = send(160);
  assert.ok(released.indexAngularVelocity! > 0);
  assert.equal(released.indexState, "EXTENDED");
});

test("degenerate PIP geometry and long frame gaps clear derivative history instead of creating a press spike", () => {
  const recognizer = new GestureRecognizer();
  const straight = handFixture("POINT", { indexPipAngle: 160 });
  const bent = handFixture("POINT", { indexPipAngle: 105 });
  recognizer.analyze(straight.points, straight.world, 0);
  assert.ok(
    recognizer.analyze(bent.points, bent.world, 50).indexAngularVelocity! < 0,
  );
  const degenerate = handFixture("POINT", { indexPipAngle: 105 });
  degenerate.world[6] = { ...degenerate.world[5] };
  const invalid = recognizer.analyze(degenerate.points, degenerate.world, 100);
  assert.equal(invalid.indexAngleValid, false);
  assert.equal(invalid.indexState, "BETWEEN");
  assert.equal(invalid.indexAngularVelocity, 0);
  assert.equal(
    recognizer.analyze(bent.points, bent.world, 150).indexAngularVelocity,
    0,
  );
  const reset = recognizer.analyze(
    straight.points,
    straight.world,
    150 + gestureConfig.FRAME_GAP_RESET + 1,
  );
  assert.equal(reset.indexAngularVelocity, 0);
  assert.equal(reset.indexState, "EXTENDED");
  assert.deepEqual(reset.pointerVelocity, { x: 0, y: 0 });
});

test("natural landmark jitter cannot toggle index state while its PIP stays inside the hysteresis band", () => {
  const recognizer = new GestureRecognizer();
  for (const start of [160, 105]) {
    recognizer.reset();
    const initial = handFixture("POINT", { indexPipAngle: start });
    recognizer.analyze(initial.points, initial.world, 0);
    for (let frame = 1; frame <= 30; frame++) {
      const fixture = handFixture("POINT", {
        indexPipAngle: 130,
        otherFingerFlexion: 55,
        noise: 0.0002,
        depthNoise: 0.0005,
        mirror: true,
        yaw: 0.5,
        frame,
      });
      const hand = recognizer.analyze(
        fixture.points,
        fixture.world,
        frame * 50,
      );
      assert.ok(Math.abs(hand.indexAngle! - 130) < 6);
      assert.equal(hand.indexState, start === 160 ? "EXTENDED" : "BENT");
    }
  }
});

test("pointer filtering follows deliberate fast movement more closely and stabilizes slow aim", () => {
  const gains: number[] = [];
  for (const displacement of [0.005, 0.1]) {
    const recognizer = new GestureRecognizer();
    const initial = handFixture("POINT", { indexPipAngle: 160 });
    const first = recognizer.analyze(initial.points, initial.world, 0);
    const moved = handFixture("POINT", { indexPipAngle: 160 });
    moved.points[8].x -= displacement;
    const hand = recognizer.analyze(moved.points, moved.world, 50);
    gains.push((hand.pointer.x - first.pointer.x) / displacement);
    assert.ok(
      hand.pointerVelocity!.x > 0,
      "mirror-space right motion has positive cursor velocity",
    );
    let resting = hand;
    for (let frame = 2; frame <= 20; frame++)
      resting = recognizer.analyze(moved.points, moved.world, frame * 50);
    assert.ok(Math.abs(resting.pointerVelocity!.x) < 0.01);
  }
  assert.ok(gains[0] < 0.5, `slow aim response=${gains[0]}`);
  assert.ok(gains[1] > 0.6 && gains[1] < 1, `fast aim response=${gains[1]}`);
});

test("widened Point recognition never claims V, open palm, real pinch, or a full fist", () => {
  for (const pose of ["V_GESTURE", "OPEN_PALM", "PINCH", "FIST"] as const) {
    for (const mirror of [false, true]) {
      const fixture = handFixture(pose, { mirror, relaxed: true });
      const hand = new GestureRecognizer().analyze(
        fixture.points,
        fixture.world,
        0,
      );
      assert.equal(hand.gesture, pose);
      assert.equal(hand.pointConfidence, 0);
    }
  }
});
