import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { HandIdentityTracker } from "../src/gesture/HandIdentityTracker";
import { GestureController } from "../src/gesture/GestureController";
import { interaction } from "../src/interaction/InteractionController";
import { InteractionStateMachine } from "../src/interaction/InteractionStateMachine";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { gestureFeedback } from "../src/gesture/gestureFeedback";
import { gestureTargets } from "../src/gesture/gestureTargets";
import { gestureConfig as config } from "../src/gesture/gestureConfig";
import { handFixture } from "./fixtures/hands";

type Pose = Parameters<typeof handFixture>[0];
type Geometry = NonNullable<Parameters<typeof handFixture>[1]>;
type Sample = Geometry & {
  visualRoll?: number;
  x?: number;
  y?: number;
  dt?: number;
};

/** Anatomical landmarks pass through the production identity tracker (which
 * owns GestureRecognizer), arbitration, and real scene scale/selection methods.
 * Animation time, render-following and the facts timer are advanced explicitly.
 * This verifies integration, not real-camera model accuracy. */
function setup(t: TestContext, fixtureOptions: Geometry = {}) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  const controller = new GestureController();
  const tracker = new HandIdentityTracker();
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
  const sample = (pose: Pose, options: Sample = {}) => {
    const { visualRoll = 0, x = 0, y = 0, dt: _dt, ...geometry } = options;
    const mirror = geometry.mirror ?? fixtureOptions.mirror ?? false;
    const fixture = handFixture(pose, {
      foldedPinch: true,
      relaxed: true,
      yaw: 0.5,
      pitch: 0.3,
      ...fixtureOptions,
      ...geometry,
      // The fixture mirrors after rotating. Convert from the user's visible
      // clockwise direction, which must work identically for both hands.
      rotation: ((visualRoll * Math.PI) / 180) * (mirror ? 1 : -1),
      frame: frame++,
    });
    for (const point of fixture.points) {
      point.x += x;
      point.y += y;
    }
    return { ...fixture, handedness: mirror ? "Left" : "Right" };
  };
  const deliver = (samples: ReturnType<typeof sample>[], dt = 50) => {
    time += dt;
    const hands = tracker.update(
      {
        landmarks: samples.map((s) => s.points),
        worldLandmarks: samples.map((s) => s.world),
        handedness: samples.map((s) => [
          { categoryName: s.handedness, score: 0.99 },
        ]),
      },
      time,
    );
    controller.update({ hands, time });
    // There is no WebGL render loop in this test. Let the visual scale catch
    // its real target so stop-settling sees an up-to-date rendered position.
    particles.scale = particles.targetScale;
    return hands;
  };
  const send = (pose: Pose, options: Sample = {}) =>
    deliver([sample(pose, options)], options.dt)[0];
  const hold = (pose: Pose, duration: number, options: Sample = {}) => {
    for (let elapsed = 0; elapsed < duration; elapsed += 50)
      send(pose, options);
  };
  const pair = (pose: Pose) =>
    deliver([
      sample(pose, { mirror: false, x: -0.18 }),
      sample(pose, { mirror: true, x: 0.18 }),
    ]);
  const withCompanion = (pose: Pose | null, options: Sample = {}) =>
    deliver([
      ...(pose ? [sample(pose, options)] : []),
      sample("OPEN_PALM", { mirror: true, x: 0.22 }),
    ]);
  const timeline = () =>
    (interaction as unknown as { transition: gsap.core.Timeline }).transition;
  const selectEarth = () => {
    hold("POINT", 400);
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    send("POINT");
    hold("PINCH", 200);
    assert.equal(store.get().selected, "earth");
    assert.equal(store.get().mode, "PLANET_TRANSITION");
    assert.equal(interaction.isLocked(), true);
    timeline().pause();
    gsap.ticker.sleep();
  };
  const finishAndRevealFacts = () => {
    timeline().progress(1);
    gsap.ticker.sleep();
    assert.equal(store.get().mode, "PLANET_FOCUS");
    assert.equal(interaction.isLocked(), false);
    assert.equal(store.get().infoVisible, false);
    t.mock.timers.tick(config.INFO_REVEAL_DELAY);
    assert.equal(store.get().infoVisible, true);
    assert.equal(store.get().mode, "PLANET_FOCUS");
  };
  const focusEarth = () => {
    selectEarth();
    hold("OPEN_PALM", 500);
    finishAndRevealFacts();
  };
  const empty = (dt = 50) => deliver([], dt);
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
    pair,
    withCompanion,
    selectEarth,
    finishAndRevealFacts,
    focusEarth,
    empty,
  };
}

function armDial(s: ReturnType<typeof setup>, options: Sample = {}) {
  const originalScale = particles.targetScale;
  assert.equal(s.send("V_GESTURE", options).gesture, "V_GESTURE");
  for (let elapsed = 50; elapsed < config.V_GESTURE_HOLD_TIME; elapsed += 50) {
    s.send("V_GESTURE", options);
    assert.equal(gestureFeedback.get().zoomMode, "V_DETECTED");
    assert.equal(gestureFeedback.get().zoomActive, false);
    assert.equal(particles.targetScale, originalScale);
  }
  s.send("V_GESTURE", options);
  assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ARMED");
  assert.equal(
    particles.targetScale,
    originalScale,
    "arming must not snap to a zoom limit",
  );
  s.send("V_GESTURE", options);
  assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ACTIVE");
  assert.equal(store.get().mode, "UNIVERSE_SCALE");
  assert.equal(particles.targetScale, originalScale);
  return gestureFeedback.get().zoomBaseAngle;
}

test("a held V spanning the planet-entry animation starts a fresh 250ms baseline after unlock", (t) => {
  const s = setup(t);
  s.selectEarth();
  for (let frame = 0; frame < 20; frame++) {
    s.send("V_GESTURE", { visualRoll: frame > 10 ? 25 : 0 });
    assert.equal(particles.targetScale, 1);
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
    assert.equal(store.get().mode, "PLANET_TRANSITION");
  }
  s.finishAndRevealFacts();
  armDial(s, { visualRoll: 25 });
  s.hold("V_GESTURE", 500, { visualRoll: 25 });
  assert.equal(
    particles.targetScale,
    1,
    "the held pose becomes the fresh neutral angle",
  );
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().infoVisible, true);
});

test("a neutral V, five-degree tremor, and fast lateral V movement cannot zoom or swipe", (t) => {
  const s = setup(t);
  s.focusEarth();
  const base = armDial(s);
  for (let frame = 0; frame < 30; frame++) {
    s.send("V_GESTURE", {
      visualRoll: frame % 2 ? -5 : 5,
      x: Math.sin(frame * 0.5) * 0.2,
    });
    assert.equal(particles.targetScale, 1);
    assert.equal(gestureFeedback.get().zoomSpeed, 0);
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    assert.equal(store.get().mode, "UNIVERSE_SCALE");
    assert.equal(store.get().selected, "earth");
    assert.equal(store.get().infoVisible, true);
  }
});

for (const mirror of [false, true]) {
  test(`${mirror ? "left" : "right"} hand rotates clockwise to enlarge Earth and counterclockwise to shrink`, (t) => {
    const s = setup(t, { mirror, flexion: 55, thumbPose: "tucked" });
    s.focusEarth();
    const base = armDial(s);
    s.hold("V_GESTURE", 600, { visualRoll: 35 });
    const enlarged = particles.targetScale;
    assert.ok(enlarged > 1.1, `clockwise scale=${enlarged}`);
    assert.equal(gestureFeedback.get().zoomDirection, "IN");
    assert.ok(Math.abs(gestureFeedback.get().zoomDelta - 35) < 0.1);
    s.hold("V_GESTURE", 800, { visualRoll: -35 });
    assert.ok(particles.targetScale < enlarged - 0.1);
    assert.equal(gestureFeedback.get().zoomDirection, "OUT");
    assert.ok(Math.abs(gestureFeedback.get().zoomDelta + 35) < 0.1);
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    assert.equal(store.get().selected, "earth");
    assert.equal(store.get().infoVisible, true);
  });
}

test("releasing V stops immediately, preserves facts, returns to focus, and permits a fresh neutral angle", (t) => {
  const s = setup(t);
  s.focusEarth();
  const oldBase = armDial(s);
  s.hold("V_GESTURE", 600, { visualRoll: 30 });
  const stoppedScale = particles.targetScale;
  s.send("OPEN_PALM");
  assert.equal(gestureFeedback.get().zoomSpeed, 0);
  assert.equal(particles.targetScale, stoppedScale);
  s.hold("OPEN_PALM", config.V_GESTURE_RELEASE_GRACE);
  assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_RELEASE");
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().infoVisible, true);
  assert.equal(particles.targetScale, stoppedScale);
  const newBase = armDial(s, { visualRoll: 20 });
  assert.notEqual(newBase, oldBase);
  s.hold("V_GESTURE", 500, { visualRoll: 20 });
  assert.equal(particles.targetScale, stoppedScale);
});

test("a selection pinch held across the entry animation cannot select another planet", (t) => {
  const s = setup(t);
  s.selectEarth();
  s.hold("PINCH", 800);
  s.finishAndRevealFacts();
  gestureTargets.set({ kind: "body", id: "mars", label: "火星" });
  s.hold("PINCH", 800);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(gestureFeedback.get().zoomMode, "IDLE");
  assert.equal(particles.targetScale, 1);
  s.send("POINT");
  s.hold("PINCH", 200);
  assert.equal(store.get().selected, "mars");
  assert.equal(store.get().mode, "PLANET_TRANSITION");
});

test("simultaneous two-hand pinches never select Earth or start zoom", (t) => {
  const s = setup(t);
  s.hold("POINT", 400);
  for (let frame = 0; frame < 16; frame++) {
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    const hands = s.pair("PINCH");
    assert.equal(hands.length, 2);
    assert.ok(hands.every((hand) => hand.gesture === "PINCH"));
    assert.equal(store.get().selected, null);
    assert.equal(store.get().mode, "SOLAR_SYSTEM");
    assert.equal(particles.targetScale, 1);
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
  }
});

test("legacy five-tip gathering and opening remain diagnostic and never scale the focused planet", (t) => {
  const s = setup(t);
  s.focusEarth();
  gestureTargets.set({ kind: "body", id: "mars", label: "火星" });
  for (const gripDirection of ["forward", "camera"] as const) {
    assert.equal(s.send("FIVE_PINCH", { gripDirection }).gesture, "FIVE_PINCH");
    s.hold("FIVE_PINCH", 600, { gripDirection });
    for (let step = 0; step <= 20; step++) {
      s.send("FIVE_PINCH", { gripDirection, gripSpread: step / 20 });
      assert.equal(particles.targetScale, 1);
      assert.equal(gestureFeedback.get().zoomMode, "IDLE");
      assert.equal(store.get().mode, "PLANET_FOCUS");
      assert.equal(store.get().selected, "earth");
      assert.equal(store.get().infoVisible, true);
    }
  }
});

for (const missedFrames of [1, 2]) {
  test(`${missedFrames} genuine empty model frame(s) preserve V identity, baseline and scale on recovery`, (t) => {
    const s = setup(t);
    s.focusEarth();
    const base = armDial(s);
    s.hold("V_GESTURE", 500, { visualRoll: 30 });
    const lastHand = s.send("V_GESTURE", { visualRoll: 30 });
    const frozenScale = particles.targetScale;
    for (let frame = 0; frame < missedFrames; frame++) {
      s.empty();
      assert.equal(gestureFeedback.get().zoomSpeed, 0);
      assert.equal(gestureFeedback.get().zoomBaseAngle, base);
      assert.equal(particles.targetScale, frozenScale);
    }
    const recovered = s.send("V_GESTURE", { visualRoll: 30 });
    assert.equal(recovered.id, lastHand.id);
    assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ACTIVE");
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    assert.equal(
      particles.targetScale,
      frozenScale,
      "recovery cannot replay the missing interval",
    );
    s.send("V_GESTURE", { visualRoll: 30 });
    assert.ok(particles.targetScale > frozenScale);
    assert.equal(store.get().selected, "earth");
    assert.equal(store.get().infoVisible, true);
  });
}

test("an active V owner can disappear briefly while the second hand stays visible without losing its dial", (t) => {
  const s = setup(t);
  s.focusEarth();
  const base = armDial(s);
  s.hold("V_GESTURE", 500, { visualRoll: 30 });
  const together = s.withCompanion("V_GESTURE", { visualRoll: 30 });
  const ownerId = together.find((hand) => hand.gesture === "V_GESTURE")!.id;
  const companionId = together.find((hand) => hand.gesture === "OPEN_PALM")!.id;
  const frozenScale = particles.targetScale;
  for (let frame = 0; frame < 2; frame++) {
    const partial = s.withCompanion(null);
    assert.equal(partial.length, 1);
    assert.equal(partial[0].id, companionId);
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    assert.equal(gestureFeedback.get().zoomSpeed, 0);
    assert.equal(particles.targetScale, frozenScale);
  }
  const returned = s.withCompanion("V_GESTURE", { visualRoll: 30 });
  assert.equal(
    returned.find((hand) => hand.gesture === "V_GESTURE")!.id,
    ownerId,
  );
  assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ACTIVE");
  assert.equal(gestureFeedback.get().zoomBaseAngle, base);
  assert.equal(particles.targetScale, frozenScale);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().infoVisible, true);
});
