import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { InteractionController } from "../src/interaction/InteractionController";
import { particles } from "../src/particles/ParticleEngine";
import { store } from "../src/interaction/store";
import { gestureConfig as config } from "../src/gesture/gestureConfig";

function setup(t: TestContext) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  const controller = new InteractionController();
  controller.machine.send("READY");
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    hover: null,
    transitioning: false,
    infoVisible: false,
    heldUniverse: false,
    sound: false,
  });
  Object.assign(particles, {
    sunInterior: 0,
    collapse: 0,
    focus: 0,
    explosion: 0,
    targetScale: 1,
    dragging: false,
    rotationVelocity: 0,
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => {
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    t.mock.timers.reset();
  });
  return controller;
}
function timeline(controller: InteractionController) {
  return (controller as unknown as { transition: gsap.core.Timeline })
    .transition;
}
function finish(controller: InteractionController) {
  timeline(controller).progress(1);
  gsap.ticker.sleep();
}
function rejected(controller: InteractionController) {
  assert.equal(controller.isLocked(), true);
  assert.equal(store.get().transitioning, true);
  assert.equal(controller.return(), false);
  assert.equal(controller.selectBody("earth"), false);
  assert.equal(controller.selectBody("sun"), false);
  assert.equal(controller.collapse(), false);
  assert.equal(controller.rebirth(), false);
  assert.equal(controller.scale(1.3), false);
  assert.equal(controller.next(1), false);
  assert.equal(controller.info(), false);
}
test("selecting Sun flies inward, and entry and return both retain the full animation lock", (t) => {
  const controller = setup(t);
  assert.equal(controller.selectBody("sun"), true);
  assert.equal(store.get().mode, "SUN_FOCUS");
  timeline(controller).progress(0.8);
  rejected(controller);
  finish(controller);
  assert.equal(store.get().mode, "SUN_INTERIOR");
  assert.equal(controller.isLocked(), false);
  assert.equal(particles.sunInterior, 1);
  assert.equal(controller.scale(1.3), false);
  assert.equal(controller.selectBody("earth"), false);
  assert.equal(controller.return(), true);
  timeline(controller).progress(0.8);
  rejected(controller);
  finish(controller);
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
  assert.equal(store.get().selected, null);
  assert.equal(particles.sunInterior, 0);
});
test("planet data fades in only 400 ms after the camera finishes", (t) => {
  const controller = setup(t);
  controller.selectBody("earth");
  timeline(controller).progress(0.99);
  rejected(controller);
  t.mock.timers.tick(1000);
  assert.equal(store.get().infoVisible, false);
  finish(controller);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  t.mock.timers.tick(config.INFO_REVEAL_DELAY - 1);
  assert.equal(store.get().infoVisible, false);
  t.mock.timers.tick(1);
  assert.equal(store.get().infoVisible, true);
});
test("a stale pending info reveal is cancelled on switching or returning", (t) => {
  const controller = setup(t);
  controller.select("earth");
  finish(controller);
  t.mock.timers.tick(250);
  assert.equal(controller.next(1), true);
  assert.equal(store.get().selected, "mars");
  t.mock.timers.tick(400);
  assert.equal(store.get().infoVisible, false);
  finish(controller);
  assert.equal(controller.return(), true);
  t.mock.timers.tick(500);
  assert.equal(store.get().infoVisible, false);
  finish(controller);
  t.mock.timers.tick(500);
  assert.equal(store.get().infoVisible, false);
});
test("swipes do nothing in overview, and left/right navigation follows next/previous order", (t) => {
  const controller = setup(t);
  assert.equal(controller.next(1), false);
  controller.select("earth");
  finish(controller);
  assert.equal(controller.next(1), true);
  assert.equal(store.get().selected, "mars");
  finish(controller);
  assert.equal(controller.next(-1), true);
  assert.equal(store.get().selected, "earth");
});
test("collapse and 3.8-second rebirth stay locked through their whole effects", (t) => {
  const controller = setup(t);
  controller.collapse();
  timeline(controller).progress(0.99);
  rejected(controller);
  finish(controller);
  assert.equal(store.get().mode, "COLLAPSE");
  assert.equal(particles.collapse, 1);
  assert.equal(controller.selectBody("sun"), false);
  assert.equal(controller.rebirth(), true);
  assert.equal(timeline(controller).duration(), 3.8);
  timeline(controller).progress(0.8);
  rejected(controller);
  assert.equal(particles.state, "EXPLODE");
  finish(controller);
  assert.equal(controller.isLocked(), false);
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
  assert.equal(particles.collapse, 0);
  assert.equal(particles.explosion, 0);
  assert.equal(particles.sunInterior, 0);
});
test("zoom clamps bounds and releasing preserves size, selection and automatic information", (t) => {
  const controller = setup(t);
  controller.select("earth");
  finish(controller);
  t.mock.timers.tick(400);
  assert.equal(controller.scale(0.01), true);
  assert.equal(particles.targetScale, config.ZOOM_MIN);
  assert.equal(controller.select("mars"), false);
  controller.scale(100);
  assert.equal(particles.targetScale, config.ZOOM_MAX);
  controller.scale(0.65);
  assert.equal(controller.endScale(), true);
  assert.equal(particles.targetScale, 0.65);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(store.get().infoVisible, true);
});
test("pointing and invalid zoom samples cannot alter navigation", (t) => {
  const controller = setup(t);
  controller.point();
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
  assert.equal(controller.scale(NaN), false);
  assert.equal(controller.scale(Infinity), false);
  assert.equal(particles.targetScale, 1);
});
