import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { GestureController } from "../src/gesture/GestureController";
import { HandIdentityTracker } from "../src/gesture/HandIdentityTracker";
import { gestureConfig as config } from "../src/gesture/gestureConfig";
import {
  gestureFeedback,
  type GestureTarget,
} from "../src/gesture/gestureFeedback";
import { gestureTargets } from "../src/gesture/gestureTargets";
import { interaction } from "../src/interaction/InteractionController";
import { InteractionStateMachine } from "../src/interaction/InteractionStateMachine";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { handFixture } from "./fixtures/hands";

type Pose = Parameters<typeof handFixture>[0];
type Geometry = NonNullable<Parameters<typeof handFixture>[1]>;
const earth: GestureTarget = { kind: "body", id: "earth", label: "地球" };
const mars: GestureTarget = { kind: "body", id: "mars", label: "火星" };
const sun: GestureTarget = { kind: "body", id: "sun", label: "太阳" };

/** Real landmark extraction, identity, action arbitration and scene state.
 * Synthetic anatomy cannot validate a laptop camera's detection accuracy. */
function setup(t: TestContext, mirror = false) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  const tracker = new HandIdentityTracker();
  const controller = new GestureController();
  interaction.machine = new InteractionStateMachine();
  interaction.ready();
  store.set({
    mode: "SOLAR_SYSTEM",
    tracking: "online",
    transitioning: false,
    selected: null,
    hover: null,
    infoVisible: false,
    heldUniverse: false,
    sound: false,
  });
  Object.assign(particles, {
    targetScale: 1,
    scale: 1,
    focus: 0,
    collapse: 0,
    sunInterior: 0,
    explosion: 0,
    dragging: false,
    rotationVelocity: 0,
  });
  controller.reset();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let time = 1000;
  let frame = 0;
  const timeline = () =>
    (interaction as unknown as { transition: gsap.core.Timeline | null })
      .transition;
  const deliver = (fixture: ReturnType<typeof handFixture> | null, dt = 50) => {
    time += dt;
    const hands = tracker.update(
      {
        landmarks: fixture ? [fixture.points] : [],
        worldLandmarks: fixture ? [fixture.world] : [],
        handedness: fixture
          ? [[{ categoryName: mirror ? "Left" : "Right", score: 0.99 }]]
          : [],
      },
      time,
    );
    controller.update({ hands, time });
    particles.scale = particles.targetScale;
    if (interaction.isLocked()) timeline()?.pause();
    gsap.ticker.sleep();
    return hands[0];
  };
  const send = (pose: Pose = "POINT", geometry: Geometry = {}, dx = 0) => {
    const fixture = handFixture(pose, {
      relaxed: true,
      foldedPinch: true,
      mirror,
      yaw: 0.6,
      pitch: -0.3,
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
    for (const p of fixture.points) p.x += dx;
    return deliver(fixture);
  };
  const hold = (pose: Pose, duration: number, geometry: Geometry = {}) => {
    for (let elapsed = 0; elapsed < duration; elapsed += 50)
      send(pose, geometry);
  };
  const warm = () => hold("POINT", config.HAND_REENTRY_DELAY + 150);
  const lock = (target: GestureTarget = earth) => {
    gestureTargets.set(target);
    hold("POINT", config.TARGET_LOCK_TIME + 50);
    assert.equal(gestureFeedback.get().selectionPhase, "TARGET_LOCKED");
    assert.equal(gestureFeedback.get().lockedTarget?.id, target.id);
  };
  const openThumb = () => {
    send("POINT", { thumbOpening: 0.4 });
    let hand = send("POINT", { thumbOpening: 1 });
    for (let elapsed = 0; elapsed < config.THUMB_OPEN_HOLD; elapsed += 50)
      hand = send("POINT", { thumbOpening: 1 });
    return hand;
  };
  const finish = () => {
    assert.ok(timeline(), "a real scene animation must have started");
    timeline()!.progress(1);
    gsap.ticker.sleep();
    t.mock.timers.tick(config.INFO_REVEAL_DELAY);
  };
  const focusEarth = () => {
    warm();
    lock(earth);
    openThumb();
    hold("POINT", 500, { indexPipAngle: 165 });
    finish();
    assert.equal(store.get().mode, "PLANET_FOCUS");
    assert.equal(store.get().infoVisible, true);
  };
  t.after(() => {
    controller.reset();
    tracker.reset();
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    t.mock.timers.reset();
    gestureTargets.set(null);
  });
  return {
    send,
    hold,
    warm,
    lock,
    openThumb,
    finish,
    focusEarth,
    empty: () => deliver(null),
    getTime: () => time,
  };
}

for (const mirror of [false, true]) {
  for (const target of [earth, sun]) {
    test(`${mirror ? "left" : "right"} Point plus thumb opening enters ${target.id} once while the index stays straight`, (t) => {
      const s = setup(t, mirror);
      s.warm();
      s.lock(target);
      const pulse = gestureFeedback.get().pulseId;
      const hand = s.openThumb();
      assert.equal(hand.gesture, "POINT");
      assert.ok(hand.indexAngle! > 160);
      assert.ok(hand.thumbSpread! >= config.THUMB_OPEN_THRESHOLD);
      assert.equal(gestureFeedback.get().lastAction, "THUMB_OPEN");
      assert.equal(gestureFeedback.get().pulseId, pulse + 1);
      assert.equal(
        store.get().mode,
        target.id === "earth" ? "PLANET_TRANSITION" : "SUN_FOCUS",
      );
      s.hold("POINT", 800, { thumbOpening: 1 });
      s.finish();
      s.hold("POINT", 800, { thumbOpening: 1 });
      assert.equal(
        store.get().mode,
        target.id === "earth" ? "PLANET_FOCUS" : "SUN_INTERIOR",
      );
      assert.equal(gestureFeedback.get().pulseId, pulse + 1);
    });
  }
  test(`${mirror ? "left" : "right"} a fully bent index can never replace opening the thumb`, (t) => {
    const s = setup(t, mirror);
    s.warm();
    s.lock();
    const pulse = gestureFeedback.get().pulseId;
    for (const indexPipAngle of [135, 105, 85, 75])
      s.send("POINT", { indexPipAngle });
    s.hold("POINT", 1000, { indexPipAngle: 75 });
    assert.equal(store.get().selected, null);
    assert.equal(store.get().mode, "SOLAR_SYSTEM");
    assert.equal(gestureFeedback.get().pulseId, pulse);
  });
  test(`${mirror ? "left" : "right"} arriving with an already open thumb requires closing and opening again`, (t) => {
    const s = setup(t, mirror);
    gestureTargets.set(earth);
    s.hold("POINT", 1500, { thumbOpening: 1 });
    assert.equal(store.get().selected, null);
    assert.equal(gestureFeedback.get().lockedTarget, null);
    assert.equal(gestureFeedback.get().thumbNeedsRelease, true);
    s.hold("POINT", 500, { thumbOpening: 0 });
    assert.equal(gestureFeedback.get().lockedTarget?.id, "earth");
    s.openThumb();
    assert.equal(store.get().selected, "earth");
  });
}

test("a fast Point scan and early thumb opening do not acquire an incidental planet", (t) => {
  const s = setup(t);
  s.warm();
  gestureTargets.set(earth);
  s.send("POINT", {}, 0.15);
  s.send("POINT", {}, -0.05);
  s.openThumb();
  assert.equal(store.get().selected, null);
});

test("opening the thumb keeps the captured Earth even if hover slips onto Mars", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  gestureTargets.set(null);
  s.send("POINT", { thumbOpening: 0.4 }, 0.025);
  assert.equal(gestureFeedback.get().lockedTarget?.id, "earth");
  gestureTargets.set(mars);
  s.hold("POINT", 150, { thumbOpening: 1 });
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().mode, "PLANET_TRANSITION");
});

test("closing the thumb for 100ms permits a fresh target and another opening", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  s.openThumb();
  s.hold("POINT", 700, { thumbOpening: 1 });
  s.finish();
  gestureTargets.set(mars);
  s.send("POINT");
  s.send("POINT");
  assert.equal(gestureFeedback.get().thumbNeedsRelease, true);
  s.send("POINT");
  assert.equal(gestureFeedback.get().thumbNeedsRelease, false);
  s.hold("POINT", config.TARGET_LOCK_TIME + 50);
  s.openThumb();
  assert.equal(store.get().selected, "mars");
});

test("the transition blocks competing actions and observes a closed thumb release", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  s.openThumb();
  const pulse = gestureFeedback.get().pulseId;
  for (const pose of ["FIST", "V_GESTURE", "OPEN_PALM", "PINCH"] as const) {
    gestureTargets.set(mars);
    s.hold(pose, 700);
    assert.equal(store.get().mode, "PLANET_TRANSITION");
    assert.equal(store.get().selected, "earth");
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
    assert.equal(gestureFeedback.get().pulseId, pulse);
  }
  s.hold("POINT", 150);
  assert.equal(gestureFeedback.get().thumbNeedsRelease, false);
  s.finish();
  s.lock(mars);
  s.openThumb();
  assert.equal(store.get().selected, "mars");
});

test("pinching over a locked body never enters it", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  s.hold("PINCH", 1000);
  assert.equal(store.get().selected, null);
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
});

test("a fist after Point lock does not select another planet and may later return", (t) => {
  const s = setup(t);
  s.focusEarth();
  s.lock(mars);
  s.hold("FIST", 350);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().mode, "PLANET_FOCUS");
  s.hold("FIST", 900);
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
  assert.equal(store.get().selected, null);
});

test("an owned V dial excludes thumb selection and an owned target excludes new V zoom", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  s.hold("V_GESTURE", 350);
  assert.equal(gestureFeedback.get().zoomMode, "IDLE");
  assert.equal(gestureFeedback.get().lockedTarget?.id, "earth");
  s.empty();
  gestureTargets.set(null);
  s.warm();
  s.hold("V_GESTURE", config.V_GESTURE_HOLD_TIME + 100);
  assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ACTIVE");
  gestureTargets.set(earth);
  s.openThumb();
  assert.equal(store.get().selected, null);
  assert.equal(gestureFeedback.get().lastAction, "V_ZOOM");
});

test("a missing hand drops its target and an open-thumb re-entry cannot select", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  s.empty();
  gestureTargets.set(earth);
  s.hold("POINT", 1000, { thumbOpening: 1 });
  assert.equal(gestureFeedback.get().readiness, "READY");
  assert.equal(gestureFeedback.get().lockedTarget, null);
  assert.equal(store.get().selected, null);
  s.hold("POINT", 500);
  s.openThumb();
  assert.equal(store.get().selected, "earth");
});

test("a first-visible fist after mouse navigation still waits 250ms then a fresh 600ms to return", (t) => {
  const s = setup(t);
  interaction.selectBody("earth");
  s.finish();
  s.send("FIST");
  s.hold("FIST", config.HAND_REENTRY_DELAY);
  assert.equal(gestureFeedback.get().fistProgress, 0);
  s.hold("FIST", config.FIST_HOLD_TIME - 50);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  s.send("FIST");
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
});

test("a fist held during camera transition must still be released before Back", (t) => {
  const s = setup(t);
  interaction.selectBody("earth");
  s.hold("FIST", 800);
  s.finish();
  s.hold("FIST", 900);
  assert.equal(store.get().selected, "earth");
  s.hold("POINT", 200);
  s.hold("FIST", config.FIST_HOLD_TIME + 50);
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
});
