import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { GestureRecognizer } from "../src/gesture/GestureRecognizer";
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

/** Replay anatomical landmarks through the production recognizer, gesture
 * arbitration and real scene scale/selection methods. Only animation time and
 * the automatic facts timer are advanced explicitly; no action is stubbed. */
function setup(t: TestContext) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  const controller = new GestureController();
  const recognizer = new GestureRecognizer();
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
  const send = (pose: Pose, gripSpread = 0, dt = 50) => {
    time += dt;
    const fixture = handFixture(pose, {
      gripSpread,
      foldedPinch: true,
      relaxed: true,
      yaw: 0.5,
      pitch: 0.3,
      frame: frame++,
    });
    const hand = recognizer.analyze(fixture.points, fixture.world, time);
    hand.id = "continuous-first-hand";
    controller.update({ hands: [hand], time });
    return hand;
  };
  const hold = (pose: Pose, duration: number, gripSpread = 0) => {
    for (let elapsed = 0; elapsed < duration; elapsed += 50)
      send(pose, gripSpread);
  };
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
    // Automatic facts are orthogonal UI state, not an unsupported scene mode.
    assert.equal(store.get().mode, "PLANET_FOCUS");
  };
  const empty = () => {
    time += 50;
    controller.update({ hands: [], time });
  };
  t.after(() => {
    controller.reset();
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    t.mock.timers.reset();
    gestureTargets.set(null);
  });
  return { send, hold, selectEarth, finishAndRevealFacts, empty };
}

function assertFreshConfirmation(send: ReturnType<typeof setup>["send"]) {
  send("FIVE_PINCH");
  for (
    let elapsed = 50;
    elapsed < config.ONE_HAND_ZOOM_HOLD_TIME;
    elapsed += 50
  ) {
    send("FIVE_PINCH");
    assert.equal(gestureFeedback.get().zoomActive, false);
    assert.equal(particles.targetScale, 1);
    assert.equal(store.get().mode, "PLANET_FOCUS");
  }
  send("FIVE_PINCH");
  assert.equal(gestureFeedback.get().zoomActive, true);
  assert.equal(store.get().mode, "UNIVERSE_SCALE");
  assert.equal(particles.targetScale, config.ZOOM_MIN);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().infoVisible, true);
}

test("a five-finger gesture released during the selection animation can zoom on the first fresh post-animation attempt", (t) => {
  const s = setup(t);
  s.selectEarth();
  s.hold("FIVE_PINCH", 400);
  assert.equal(particles.targetScale, 1);
  s.hold("OPEN_PALM", 400);
  assert.equal(particles.targetScale, 1);
  s.finishAndRevealFacts();
  assertFreshConfirmation(s.send);
});

test("a five-finger hold crossing the camera animation starts only after fresh confirmation in planet focus", (t) => {
  const s = setup(t);
  s.selectEarth();
  for (let elapsed = 0; elapsed < 1000; elapsed += 50) {
    s.send("FIVE_PINCH");
    assert.equal(particles.targetScale, 1);
    assert.equal(gestureFeedback.get().zoomActive, false);
    assert.equal(store.get().mode, "PLANET_TRANSITION");
  }
  s.finishAndRevealFacts();
  assertFreshConfirmation(s.send);
});

test("a natural five-finger bunch followed immediately by trusted intermediate opening completes one zoom cycle", (t) => {
  const s = setup(t);
  s.selectEarth();
  s.hold("OPEN_PALM", 500);
  s.finishAndRevealFacts();
  assert.equal(s.send("FIVE_PINCH", 0).gesture, "FIVE_PINCH");
  const intermediate = s.send("FIVE_PINCH", 0.35);
  assert.equal(intermediate.gesture, "NONE");
  assert.ok(
    intermediate.gripConfidence! >= config.ONE_HAND_ZOOM_MIN_CONFIDENCE,
  );
  s.send("FIVE_PINCH", 0.5);
  s.send("FIVE_PINCH", 0.6);
  assert.equal(particles.targetScale, 1);
  assert.equal(gestureFeedback.get().zoomActive, false);
  s.send("FIVE_PINCH", 0.7);
  assert.equal(gestureFeedback.get().zoomActive, true);
  assert.equal(store.get().mode, "UNIVERSE_SCALE");
  assert.equal(store.get().selected, "earth");
  s.hold("OPEN_PALM", 700);
  assert.ok(particles.targetScale > config.ZOOM_MAX - 0.02);
  assert.equal(gestureFeedback.get().zoomActive, false);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().infoVisible, true);
});

test("a two-finger selection pinch held across the same animation cannot select a second planet", (t) => {
  const s = setup(t);
  s.selectEarth();
  s.hold("PINCH", 800);
  s.finishAndRevealFacts();
  gestureTargets.set({ kind: "body", id: "mars", label: "火星" });
  s.hold("PINCH", 800);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(gestureFeedback.get().zoomActive, false);
  assert.equal(particles.targetScale, 1);
  s.send("POINT");
  s.hold("PINCH", 200);
  assert.equal(store.get().selected, "mars");
  assert.equal(store.get().mode, "PLANET_TRANSITION");
});

test("turning a pending five-finger zoom into a fist cannot scale or accidentally return", (t) => {
  const s = setup(t);
  s.selectEarth();
  s.hold("OPEN_PALM", 500);
  s.finishAndRevealFacts();
  s.send("FIVE_PINCH");
  s.hold("FIST", 900);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(store.get().selected, "earth");
  assert.equal(gestureFeedback.get().zoomActive, false);
  assert.equal(particles.targetScale, 1);
  s.send("OPEN_PALM");
  assertFreshConfirmation(s.send);
});

test("a lost hand still requires an explicit release before focused five-finger zoom can restart", (t) => {
  const s = setup(t);
  s.selectEarth();
  s.hold("OPEN_PALM", 500);
  s.finishAndRevealFacts();
  s.empty();
  s.hold("FIVE_PINCH", 1000);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(gestureFeedback.get().zoomActive, false);
  assert.equal(particles.targetScale, 1);
  s.send("OPEN_PALM");
  assertFreshConfirmation(s.send);
});
