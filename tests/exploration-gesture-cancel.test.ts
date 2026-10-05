import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { Group } from "three";
import { GestureController } from "../src/gesture/GestureController";
import type { Gesture, HandFeatures } from "../src/gesture/GestureTypes";
import { gestureConfig as config } from "../src/gesture/gestureConfig";
import { gestureFeedback } from "../src/gesture/gestureFeedback";
import { gestureTargets } from "../src/gesture/gestureTargets";
import { interaction } from "../src/interaction/InteractionController";
import { InteractionStateMachine } from "../src/interaction/InteractionStateMachine";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { bodyTransforms } from "../src/exploration/sceneState";

const beijing = "beijing";

function hand(
  gesture: Gesture,
  patch: Partial<HandFeatures> = {},
): HandFeatures {
  return {
    id: "hand-1",
    handedness: "Right",
    gesture,
    confidence: 0.99,
    trackingConfidence: 1,
    center: { x: 0.5, y: 0.5 },
    pointer: { x: 0.5, y: 0.3 },
    pointerVelocity: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    scale: 0.2,
    openness: 0.5,
    pinchDistance: 0.8,
    pinchStrength: 0,
    landmarks: [],
    palmFacing: true,
    palmDirection: [0, 0, 1],
    thumbGeometryValid: true,
    thumbSpread: 0,
    thumbReach: 0.8,
    indexAngle: 170,
    indexAngleValid: true,
    indexState: "EXTENDED",
    pointConfidence: 1,
    vConfidence: 0.99,
    palmRoll: 0,
    palmRollValid: true,
    ...patch,
  };
}

function setup(t: TestContext) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  bodyTransforms.clear();
  const gestures = new GestureController();
  interaction.machine = new InteractionStateMachine();
  interaction.ready();
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    hover: null,
    transitioning: false,
    infoVisible: false,
    help: false,
    welcome: false,
    heldUniverse: false,
    webglError: false,
    sound: false,
    destinationId: null,
    explorationCityId: null,
    explorationContinentId: null,
    explorationCountryId: null,
    activeHotspotId: null,
    activeStoryId: null,
    explorationError: "",
    locationResourcesReady: false,
    tracking: "online",
  });
  Object.assign(particles, {
    focus: 0,
    assembly: 0,
    sunInterior: 0,
    collapse: 0,
    explosion: 0,
    locationApproach: 0,
    targetScale: 1,
    scale: 1,
    dragging: false,
    rotationVelocity: 0,
  });
  gestures.reset();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let time = 1000;
  const send = (
    pose: Gesture = "POINT",
    patch: Partial<HandFeatures> = {},
    dt = 50,
  ) => {
    time += dt;
    gestures.update({ hands: [hand(pose, patch)], time });
    timeline()?.pause();
    gsap.ticker.sleep();
  };
  const hold = (
    pose: Gesture,
    duration: number,
    patch: Partial<HandFeatures> = {},
  ) => {
    send(pose, patch);
    for (let elapsed = 0; elapsed < duration; elapsed += 50) send(pose, patch);
  };
  const timeline = () =>
    (interaction as unknown as { transition: gsap.core.Timeline | null })
      .transition;
  const finish = () => {
    assert.ok(timeline());
    timeline()!.progress(1);
    gsap.ticker.sleep();
  };
  const focus = () => {
    bodyTransforms.set("earth", new Group());
    assert.equal(interaction.select("earth"), true);
    finish();
  };
  const directory = () => {
    focus();
    assert.equal(interaction.browse(), true);
    assert.equal(interaction.chooseContinent("asia"), true);
    assert.equal(interaction.chooseCountry("cn"), true);
    hold("POINT", config.HAND_REENTRY_DELAY + 150);
    assert.equal(gestureFeedback.get().readiness, "READY");
  };
  const enter = () => {
    let resolve!: () => void;
    const loaded = new Promise<void>((done) => {
      resolve = done;
    });
    const result = interaction.enterDestination(beijing, () => loaded);
    assert.equal(store.get().mode, "DESCENT_TRANSITION");
    assert.equal(interaction.isLocked(), true);
    return { resolve, result };
  };
  t.after(() => {
    if (store.get().mode === "DESCENT_TRANSITION") interaction.return();
    gestures.reset();
    bodyTransforms.clear();
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    gestureTargets.set(null);
    t.mock.timers.reset();
  });
  return {
    send,
    hold,
    focus,
    directory,
    enter,
    finish,
    empty() {
      time += 50;
      gestures.update({ hands: [], time });
    },
  };
}

test("a ready fresh fist cancels a locked location load only after 600 ms and ignores late resources", async (t) => {
  const s = setup(t);
  s.directory();
  const pending = s.enter();
  s.send("FIST");
  for (let elapsed = 0; elapsed < 550; elapsed += 50) s.send("FIST");
  s.send("FIST", {}, 49);
  assert.equal(store.get().mode, "DESCENT_TRANSITION");
  assert.equal(interaction.isLocked(), true);
  s.send("FIST", {}, 1);
  assert.equal(store.get().mode, "EARTH_CITY_PICKER");
  assert.equal(interaction.isLocked(), false);
  assert.equal(gestureFeedback.get().lastAction, "FIST_BACK");
  pending.resolve();
  assert.equal(await pending.result, false);
  assert.equal(store.get().destinationId, null);
});

test("a held cancellation fist cannot cascade into city or planet Back without release", async (t) => {
  const s = setup(t);
  s.directory();
  const pending = s.enter();
  s.hold("FIST", config.FIST_HOLD_TIME);
  assert.equal(store.get().explorationCityId, "city-beijing");
  s.hold("FIST", config.BACK_COOLDOWN + config.FIST_HOLD_TIME + 100);
  assert.equal(store.get().mode, "EARTH_CITY_PICKER");
  assert.equal(store.get().explorationCityId, "city-beijing");
  s.hold("POINT", 150);
  s.hold("FIST", config.FIST_HOLD_TIME);
  assert.equal(store.get().explorationCityId, null);
  assert.equal(store.get().mode, "EARTH_COUNTRY_PICKER");
  pending.resolve();
  assert.equal(await pending.result, false);
});

test("location cancellation respects cooldown and requires release after a fist held during it", async (t) => {
  const s = setup(t);
  s.directory();
  const first = s.enter();
  s.hold("FIST", config.FIST_HOLD_TIME);
  first.resolve();
  assert.equal(await first.result, false);
  const second = s.enter();
  s.hold("POINT", 150);
  s.hold("FIST", config.BACK_COOLDOWN + config.FIST_HOLD_TIME);
  assert.equal(store.get().mode, "DESCENT_TRANSITION");
  assert.equal(gestureFeedback.get().fistProgress, 0);
  s.hold("POINT", 150);
  s.hold("FIST", config.FIST_HOLD_TIME);
  assert.equal(store.get().mode, "EARTH_CITY_PICKER");
  second.resolve();
  assert.equal(await second.result, false);
});

test("a fist already held before entering the location and a tracking re-entry require release", async (t) => {
  const s = setup(t);
  s.directory();
  s.hold("FIST", 200);
  const pending = s.enter();
  s.hold("FIST", config.FIST_HOLD_TIME + 100);
  assert.equal(store.get().mode, "DESCENT_TRANSITION");
  s.send("POINT");
  s.empty();
  s.hold("FIST", config.HAND_REENTRY_DELAY + config.FIST_HOLD_TIME + 100);
  assert.equal(store.get().mode, "DESCENT_TRANSITION");
  s.hold("POINT", 150);
  s.hold("FIST", config.FIST_HOLD_TIME);
  assert.equal(store.get().mode, "EARTH_CITY_PICKER");
  pending.resolve();
  assert.equal(await pending.result, false);
});

test("locked location gestures never select UI or planets, zoom, swipe or drag", async (t) => {
  const s = setup(t);
  s.directory();
  const pending = s.enter();
  const activate = t.mock.method(gestureTargets, "activateUI", () => true);
  gestureTargets.set({ kind: "ui", id: "cancel", label: "取消" });
  s.hold("POINT", 1000);
  s.hold("POINT", 1000, { thumbSpread: 1 });
  gestureTargets.set({ kind: "body", id: "mars", label: "火星" });
  s.hold("POINT", 1000);
  s.hold("POINT", 1000, { thumbSpread: 1 });
  s.hold("V_GESTURE", 1000, { palmRoll: 0.9 });
  s.hold("PINCH", 1000, {
    pinchDistance: 0.01,
    pinchStrength: 1,
    pointerVelocity: { x: 2, y: 0 },
    velocity: { x: 2, y: 0 },
  });
  s.hold("OPEN_PALM", 1000, {
    velocity: { x: 3, y: 0 },
    pointerVelocity: { x: 3, y: 0 },
    center: { x: 0.8, y: 0.5 },
  });
  assert.equal(activate.mock.callCount(), 0);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().mode, "DESCENT_TRANSITION");
  assert.equal(interaction.isLocked(), true);
  assert.equal(particles.targetScale, 1);
  assert.equal(particles.dragging, false);
  assert.equal(particles.rotationVelocity, 0);
  assert.equal(gestureFeedback.get().thumbOpenProgress, 0);
  assert.equal(gestureFeedback.get().zoomActive, false);
  assert.equal(interaction.return(), true);
  pending.resolve();
  assert.equal(await pending.result, false);
});

test("low-confidence fists and normal planet animations cannot use the cancellation channel", async (t) => {
  const s = setup(t);
  s.directory();
  const pending = s.enter();
  s.hold("FIST", 1000, { confidence: 0.1 });
  s.hold("FIST", 1000, { trackingConfidence: 0.1 });
  assert.equal(store.get().mode, "DESCENT_TRANSITION");
  assert.equal(gestureFeedback.get().fistProgress, 0);
  assert.equal(interaction.return(), true);
  pending.resolve();
  assert.equal(await pending.result, false);
  assert.equal(interaction.return(), true);
  assert.equal(interaction.return(), true);
  assert.equal(interaction.return(), true);
  assert.equal(store.get().mode, "PLANET_OVERVIEW");
  assert.equal(interaction.next(1), true);
  assert.equal(store.get().mode, "PLANET_TRANSITION");
  s.hold("POINT", 400);
  s.hold("FIST", 1000);
  assert.equal(store.get().mode, "PLANET_TRANSITION");
  assert.equal(interaction.isLocked(), true);
  assert.equal(gestureFeedback.get().fistProgress, 0);
  s.finish();
});
