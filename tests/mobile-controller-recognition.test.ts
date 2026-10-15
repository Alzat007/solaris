import test from "node:test";
import assert from "node:assert/strict";
import { RemoteGestureSink } from "../src/controller/RemoteGestureSink";
import { CONTROLLER_CAMERA_FPS } from "../src/controller/ControllerCameraSession";
import { HandIdentityTracker } from "../src/gesture/HandIdentityTracker";
import { gestureConfig as config } from "../src/gesture/gestureConfig";
import {
  REMOTE_ACTIONS,
  validateActionPayload,
  type RemoteAction,
  type RemotePayload,
  type RemoteViewState,
} from "../src/remote/controlProtocol";
import { handFixture } from "./fixtures/hands";

type Pose = Parameters<typeof handFixture>[0];
type Geometry = NonNullable<Parameters<typeof handFixture>[1]>;
const frameInterval = 1000 / CONTROLLER_CAMERA_FPS;
const target = { id: "body-earth", kind: "body", label: "Earth" } as const;

/** Existing synthetic anatomy exercises real extraction, identity and mobile
 * intent handling. It does not model MediaPipe accuracy or an iPhone camera. */
function setup(mirror = false, worldLandmarks = true) {
  const tracker = new HandIdentityTracker();
  const calls: { action: RemoteAction; payload?: RemotePayload }[] = [];
  const sink = new RemoteGestureSink({
    send(action, payload) {
      calls.push({ action, payload });
      return true;
    },
  });
  let time = 1000;
  let frame = 0;
  let view: RemoteViewState = {
    mode: "PLANET_OVERVIEW",
    selected: "earth",
    available: [...REMOTE_ACTIONS],
    focusTarget: null,
  };
  sink.setContext(true, view);
  const focus = (value: RemoteViewState["focusTarget"]) => {
    view = { ...view, focusTarget: value };
    sink.setContext(true, view);
  };
  const send = (pose: Pose, geometry: Geometry = {}, dx = 0, dy = 0) => {
    const fixture = handFixture(pose, {
      relaxed: true,
      foldedPinch: true,
      mirror,
      yaw: 0.6,
      pitch: -0.3,
      noise: 0.0003,
      ...(pose === "POINT"
        ? {
            indexPipAngle: 165,
            otherFingerFlexion: 55,
            thumbOpening: 0,
          }
        : {}),
      ...geometry,
      frame: frame++,
    });
    for (const point of fixture.points) {
      point.x += dx;
      point.y += dy;
    }
    time += frameInterval;
    const hands = tracker.update(
      {
        landmarks: [fixture.points],
        worldLandmarks: worldLandmarks ? [fixture.world] : undefined,
        handedness: [
          [{ categoryName: mirror ? "Left" : "Right", score: 0.99 }],
        ],
      },
      time,
    );
    assert.equal(
      hands.length,
      1,
      "valid anatomical fixture must remain tracked",
    );
    sink.update({ hands, time });
    return hands[0];
  };
  const hold = (pose: Pose, duration: number, geometry: Geometry = {}) => {
    let hand;
    for (let elapsed = 0; elapsed < duration; elapsed += frameInterval)
      hand = send(pose, geometry);
    return hand!;
  };
  const ready = () => hold("POINT", config.HAND_REENTRY_DELAY + 200);
  const lock = () => {
    focus(target);
    const hand = hold("POINT", config.TARGET_LOCK_TIME + 200);
    assert.equal(hand.gesture, "POINT");
    assert.ok(hand.thumbSpread! <= config.THUMB_CLOSED_THRESHOLD);
  };
  const open = () => {
    send("POINT", { thumbOpening: 0.4 });
    const hand = hold("POINT", config.THUMB_OPEN_HOLD + 150, {
      thumbOpening: 1,
    });
    assert.equal(hand.gesture, "POINT");
    assert.ok(hand.thumbSpread! >= config.THUMB_OPEN_THRESHOLD);
    return hand;
  };
  const empty = () => {
    time += frameInterval;
    const hands = tracker.update({ landmarks: [] }, time);
    assert.equal(hands.length, 0);
    sink.update({ hands, time });
  };
  return {
    calls,
    send,
    hold,
    ready,
    lock,
    open,
    empty,
    action: (action: RemoteAction) =>
      calls.filter((call) => call.action === action),
  };
}

for (const mirror of [false, true]) {
  test(`${mirror ? "left" : "right"} anatomical Point locks and thumb opening confirms once at mobile cadence`, () => {
    const s = setup(mirror);
    const original = s.ready();
    s.lock();
    assert.equal(s.action("SELECT").length, 0);
    const confirmed = s.open();
    assert.equal(confirmed.id, original.id);
    assert.equal(confirmed.handedness, mirror ? "Left" : "Right");
    assert.equal(s.action("SELECT").length, 1);
    assert.deepEqual(s.action("SELECT")[0].payload, {
      expectedTargetId: target.id,
    });
    s.hold("POINT", 1000, { thumbOpening: 1 });
    assert.equal(s.action("SELECT").length, 1);
    assert.equal(s.action("ROTATE_START").length, 0);
    for (const call of s.calls)
      assert.equal(validateActionPayload(call.action, call.payload), true);
    assert.doesNotMatch(JSON.stringify(s.calls), /landmarks|world|hands|video/);
  });

  test(`${mirror ? "left" : "right"} anatomical pinch motion rotates horizontally and release stops it at mobile cadence`, () => {
    const s = setup(mirror);
    const original = s.ready();
    const pinched = s.hold("PINCH", config.PINCH_HOLD_TIME + 150);
    assert.equal(pinched.gesture, "PINCH");
    assert.equal(pinched.id, original.id);
    for (const dx of [0.025, 0.05, 0.075, 0.1, 0.125])
      s.send("PINCH", {}, dx, dx / 2);
    assert.equal(s.action("ROTATE_START").length, 1);
    assert.ok(s.action("ROTATE").length >= 2);
    for (const call of s.action("ROTATE")) {
      assert.ok(
        call.payload!.dx! < 0,
        "mirrored pointer follows screen movement",
      );
      assert.ok(Math.abs(call.payload!.dx!) <= 0.15);
      assert.equal(call.payload!.dy, 0);
    }
    s.send("OPEN_PALM", {}, 0.125);
    assert.equal(s.action("ROTATE_END").length, 1);
    const movement = s.action("ROTATE").length;
    s.hold("OPEN_PALM", 500);
    assert.equal(s.action("ROTATE").length, movement);
    assert.equal(s.action("SELECT").length, 0);
    assert.equal(s.action("BACK").length, 0);
  });
}

test("closed-thumb anatomical tremor cannot confirm, rotate or zoom at mobile cadence", () => {
  const s = setup();
  s.ready();
  s.lock();
  for (let frame = 0; frame < 45; frame++) {
    const hand = s.send(
      "POINT",
      { noise: 0.0001 },
      (Math.sin(frame) * config.CURSOR_DEAD_ZONE) / 4,
    );
    assert.equal(hand.gesture, "POINT");
    assert.ok(hand.thumbSpread! <= config.THUMB_CLOSED_THRESHOLD);
  }
  for (const action of ["SELECT", "ROTATE_START", "ZOOM", "BACK"] as const)
    assert.equal(s.action(action).length, 0);
});

for (const mirror of [false, true]) {
  test(`${mirror ? "left" : "right"} anatomical stationary pinch tremor cannot start a rotation`, () => {
    const s = setup(mirror);
    s.ready();
    for (let frame = 0; frame < 45; frame++) {
      const hand = s.send(
        "PINCH",
        { noise: 0.0001 },
        (Math.sin(frame) * config.CURSOR_DEAD_ZONE) / 4,
      );
      assert.equal(hand.gesture, "PINCH");
    }
    for (const action of ["SELECT", "ROTATE_START", "ROTATE", "BACK"] as const)
      assert.equal(s.action(action).length, 0);
  });
}

test("lost anatomical Point cannot transfer a thumb lock to an already-open replacement", () => {
  const s = setup();
  const original = s.ready();
  s.lock();
  s.empty();
  const replacement = s.hold("POINT", 800, { thumbOpening: 1 });
  assert.notEqual(replacement.id, original.id);
  assert.equal(s.action("SELECT").length, 0);
  s.hold("POINT", config.THUMB_RELEASE_HOLD + config.TARGET_LOCK_TIME + 300);
  s.open();
  assert.equal(s.action("SELECT").length, 1);
});

test("lost anatomical pinch ends rotation and held re-entry cannot inherit movement", () => {
  const s = setup();
  const original = s.ready();
  s.hold("PINCH", config.PINCH_HOLD_TIME + 150);
  for (const dx of [0.025, 0.05, 0.075]) s.send("PINCH", {}, dx);
  assert.equal(s.action("ROTATE_START").length, 1);
  s.empty();
  assert.equal(s.action("ROTATE_END").length, 1);
  const movement = s.action("ROTATE").length;
  let replacement;
  for (let frame = 0; frame < 12; frame++)
    replacement = s.send("PINCH", {}, 0.12 + frame * 0.004);
  assert.notEqual(replacement!.id, original.id);
  assert.equal(s.action("ROTATE_START").length, 1);
  assert.equal(s.action("ROTATE").length, movement);
  s.hold("OPEN_PALM", 200);
  s.hold("PINCH", config.PINCH_HOLD_TIME + 150);
  for (const dx of [0.025, 0.05, 0.075]) s.send("PINCH", {}, dx);
  assert.equal(s.action("ROTATE_START").length, 2);
});

test("aspect-corrected landmark fallback retains mobile Point confirmation without world geometry", () => {
  const s = setup(false, false);
  s.ready();
  s.lock();
  s.open();
  assert.equal(s.action("SELECT").length, 1);
});
