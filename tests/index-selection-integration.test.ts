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
            thumbPose: "tucked" as const,
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
    assert.equal(gestureFeedback.get().indexPhase, "TARGET_LOCKED");
    assert.equal(gestureFeedback.get().lockedTarget?.id, target.id);
  };
  const press = () => {
    send("POINT", { indexPipAngle: 135 });
    return send("POINT", { indexPipAngle: 105 });
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
    press();
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
    press,
    finish,
    focusEarth,
    empty: () => deliver(null),
    getTime: () => time,
  };
}

for (const mirror of [false, true]) {
  for (const target of [earth, sun]) {
    test(`${mirror ? "left" : "right"} natural Point locks and presses ${target.id} through the same real selection path`, (t) => {
      const s = setup(t, mirror);
      s.warm();
      s.lock(target);
      assert.equal(
        store.get().mode,
        "SOLAR_SYSTEM",
        "aiming alone cannot enter",
      );
      const beforePulse = gestureFeedback.get().pulseId;
      const bent = s.press();
      assert.equal(bent.indexState, "BENT");
      assert.ok(bent.indexAngle! < config.INDEX_PRESS_THRESHOLD_DEG);
      assert.equal(gestureFeedback.get().lastAction, "INDEX_PRESS");
      assert.equal(gestureFeedback.get().pulseId, beforePulse + 1);
      assert.equal(store.get().gesture, "INDEX_PRESS");
      assert.equal(
        store.get().mode,
        target.id === "earth" ? "PLANET_TRANSITION" : "SUN_FOCUS",
      );
      assert.equal(
        store.get().selected,
        target.id === "earth" ? "earth" : null,
      );
      assert.equal(interaction.isLocked(), true);
      s.hold("POINT", 700, { indexPipAngle: 105 });
      assert.equal(
        gestureFeedback.get().pulseId,
        beforePulse + 1,
        "a held bend cannot repeat",
      );
      s.finish();
      assert.equal(
        store.get().mode,
        target.id === "earth" ? "PLANET_FOCUS" : "SUN_INTERIOR",
      );
    });
  }
}

test("a fast scan and an early index curl cannot lock or select an incidental target", (t) => {
  const s = setup(t);
  s.warm();
  gestureTargets.set(earth);
  s.send("POINT", {}, 0.15);
  s.send("POINT", {}, -0.05);
  assert.notEqual(gestureFeedback.get().indexPhase, "TARGET_LOCKED");
  gestureTargets.set(mars);
  s.send("POINT", { indexPipAngle: 135 });
  s.send("POINT", { indexPipAngle: 105 });
  assert.equal(store.get().selected, null);
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
  assert.equal(gestureFeedback.get().lockedTarget, null);
});

test("a locked Earth remains selected when index flexion moves the tip and hover onto Mars", (t) => {
  const s = setup(t);
  s.warm();
  s.lock(earth);
  gestureTargets.set(null);
  s.send("POINT", { indexPipAngle: 135 }, 0.025);
  assert.equal(gestureFeedback.get().indexPhase, "INDEX_PRESSING");
  assert.equal(gestureFeedback.get().lockedTarget?.id, "earth");
  gestureTargets.set(mars);
  s.send("POINT", { indexPipAngle: 105 }, 0.035);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().mode, "PLANET_TRANSITION");
});

test("the transition blocks every competing action and a held bend cannot return or select again after it", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  s.press();
  const pulse = gestureFeedback.get().pulseId;
  for (const pose of ["FIST", "V_GESTURE", "OPEN_PALM", "PINCH"] as const) {
    gestureTargets.set(mars);
    s.hold(pose, 700);
    assert.equal(store.get().mode, "PLANET_TRANSITION");
    assert.equal(store.get().selected, "earth");
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
    assert.equal(particles.targetScale, 1);
    assert.equal(gestureFeedback.get().pulseId, pulse);
  }
  s.hold("POINT", 200, { indexPipAngle: 105 });
  s.finish();
  gestureTargets.set(mars);
  s.hold("POINT", 800, { indexPipAngle: 105 });
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(store.get().selected, "earth");
  assert.equal(gestureFeedback.get().pulseId, pulse);
});

test("a full 100ms explicit extension permits a new lock and a second deliberate selection", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  s.press();
  s.hold("POINT", 700, { indexPipAngle: 105 });
  s.finish();
  gestureTargets.set(mars);
  s.send("POINT");
  s.send("POINT");
  assert.equal(
    gestureFeedback.get().indexNeedsRelease,
    true,
    "only 50ms of release evidence",
  );
  s.send("POINT");
  assert.equal(gestureFeedback.get().indexNeedsRelease, false);
  s.hold("POINT", config.TARGET_LOCK_TIME + 100);
  assert.equal(gestureFeedback.get().lockedTarget?.id, "mars");
  s.press();
  assert.equal(store.get().selected, "mars");
  assert.equal(store.get().mode, "PLANET_TRANSITION");
});

test("a real thumb-index pinch over a body never enters, even after a previous Point lock", (t) => {
  const s = setup(t);
  s.warm();
  gestureTargets.set(earth);
  s.hold("PINCH", 900);
  assert.equal(store.get().selected, null);
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
  s.hold("POINT", 600);
  assert.equal(gestureFeedback.get().lockedTarget?.id, "earth");
  s.hold("PINCH", 900);
  assert.equal(store.get().selected, null);
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
});

test("ordinary Fist holds return after 600ms, while an already locked index press takes priority", (t) => {
  const s = setup(t);
  s.focusEarth();
  gestureTargets.set(null);
  s.hold("FIST", config.FIST_HOLD_TIME);
  assert.equal(
    store.get().mode,
    "PLANET_FOCUS",
    "600ms hold counts from the first observed fist",
  );
  s.send("FIST");
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
  assert.equal(store.get().mode, "TRANSITION");
  assert.equal(store.get().selected, null);
  s.hold("POINT", 800);
  s.finish();
  s.lock(earth);
  s.press();
  s.hold("POINT", 500);
  s.finish();
  s.lock(mars);
  s.send("FIST");
  assert.equal(gestureFeedback.get().lastAction, "INDEX_PRESS");
  assert.equal(store.get().mode, "PLANET_TRANSITION");
  assert.equal(store.get().selected, "mars");
  s.hold("FIST", 800);
  assert.equal(store.get().selected, "mars");
});

test("a locked index excludes V zoom, and an owned V dial excludes a new index lock", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  s.hold("V_GESTURE", 350);
  assert.equal(gestureFeedback.get().zoomMode, "IDLE");
  assert.equal(gestureFeedback.get().lockedTarget?.id, "earth");
  assert.equal(store.get().selected, null);
  s.empty();
  gestureTargets.set(null);
  s.hold("POINT", config.HAND_REENTRY_DELAY + 150);
  s.hold("V_GESTURE", config.V_GESTURE_HOLD_TIME + 100);
  assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ACTIVE");
  gestureTargets.set(earth);
  s.send("POINT");
  s.send("POINT", { indexPipAngle: 135 });
  s.send("POINT", { indexPipAngle: 105 });
  assert.equal(gestureFeedback.get().lockedTarget, null);
  assert.equal(store.get().selected, null);
  assert.equal(gestureFeedback.get().lastAction, "V_ZOOM");
});

test("losing a locked hand discards its target and enforces a fresh 250ms re-entry lock", (t) => {
  const s = setup(t);
  s.warm();
  s.lock();
  const oldHand = s.send("POINT");
  s.empty();
  assert.equal(gestureFeedback.get().lockedTarget, null);
  gestureTargets.set(earth);
  const returning = s.send("POINT", { indexPipAngle: 105 });
  assert.notEqual(returning.id, oldHand.id);
  for (let elapsed = 50; elapsed < config.HAND_REENTRY_DELAY; elapsed += 50) {
    s.send("POINT", { indexPipAngle: 105 });
    assert.equal(gestureFeedback.get().readiness, "RECONNECTING");
    assert.equal(gestureFeedback.get().lockedTarget, null);
    assert.equal(store.get().selected, null);
  }
  s.send("POINT", { indexPipAngle: 105 });
  assert.equal(gestureFeedback.get().readiness, "READY");
  assert.equal(gestureFeedback.get().indexNeedsRelease, true);
  assert.equal(store.get().selected, null);
  s.hold("POINT", config.INDEX_RELEASE_HOLD + config.TARGET_LOCK_TIME + 150);
  assert.equal(gestureFeedback.get().lockedTarget?.id, "earth");
  s.press();
  assert.equal(store.get().selected, "earth");
});

test("a fist entering after mouse navigation starts its 600ms Back hold only after the 250ms re-entry delay", (t) => {
  const s = setup(t);
  assert.equal(interaction.selectBody("earth"), true);
  s.finish();
  s.send("FIST");
  s.hold("FIST", config.HAND_REENTRY_DELAY);
  assert.equal(gestureFeedback.get().readiness, "READY");
  assert.equal(gestureFeedback.get().fistProgress, 0);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  s.hold("FIST", config.FIST_HOLD_TIME - 50);
  assert.equal(
    store.get().mode,
    "PLANET_FOCUS",
    "re-entry time cannot count toward Back",
  );
  s.send("FIST");
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
  assert.equal(store.get().mode, "TRANSITION");
});

test("a fresh deliberate fist can return after relaxed hand re-entry without an unrelated index release", (t) => {
  const s = setup(t);
  assert.equal(interaction.selectBody("earth"), true);
  s.finish();
  s.hold("POINT", 500, { indexPipAngle: 135 });
  assert.equal(gestureFeedback.get().readiness, "READY");
  assert.equal(
    gestureFeedback.get().indexNeedsRelease,
    true,
    "selection still requires explicit release",
  );
  s.hold("FIST", config.FIST_HOLD_TIME);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  s.send("FIST");
  assert.equal(store.get().mode, "TRANSITION");
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
});

test("a fist held through a real scene transition still must release before it can return", (t) => {
  const s = setup(t);
  assert.equal(interaction.selectBody("earth"), true);
  s.hold("FIST", 800);
  s.finish();
  s.hold("FIST", 900);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(store.get().selected, "earth");
  s.hold("POINT", config.INDEX_RELEASE_HOLD + 50);
  s.hold("FIST", config.FIST_HOLD_TIME + 50);
  assert.equal(store.get().mode, "TRANSITION");
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
});

test("a locked index crossing that is too slow to select still cannot turn its held press into Back", (t) => {
  const s = setup(t);
  s.focusEarth();
  s.lock(mars);
  s.send("POINT", { indexPipAngle: 116 });
  s.hold("POINT", 350, { indexPipAngle: 116 });
  s.send("POINT", { indexPipAngle: 114 });
  assert.equal(gestureFeedback.get().indexNeedsRelease, true);
  assert.equal(gestureFeedback.get().indexPhase, "INDEX_PRESSING");
  assert.equal(
    store.get().selected,
    "earth",
    "a slow crossing is not a select",
  );
  s.hold("FIST", 1100);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(store.get().selected, "earth");
  gestureTargets.set(null);
  s.hold("POINT", config.INDEX_RELEASE_HOLD + 50);
  s.hold("FIST", config.FIST_HOLD_TIME + 50);
  assert.equal(store.get().mode, "TRANSITION");
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
});
