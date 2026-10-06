import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { Group } from "three";
import { InteractionController } from "../src/interaction/InteractionController";
import { particles } from "../src/particles/ParticleEngine";
import { store } from "../src/interaction/store";
import { bodyTransforms } from "../src/exploration/sceneState";
import { earthAtlasRotation } from "../src/exploration/earthAtlasState";

function setup(t: TestContext) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  const controller = new InteractionController();
  controller.machine.send("READY");
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    transitioning: false,
    help: false,
    infoVisible: false,
    activeStoryId: null,
    activeHotspotId: null,
    webglError: false,
    earthAutoRotate: true,
    sound: false,
  });
  Object.assign(particles, {
    focus: 0,
    assembly: 0,
    sunInterior: 0,
    collapse: 0,
    explosion: 0,
    burst: 0,
    rotation: 0.7,
    targetRotation: 0.7,
    rotationVelocity: 0,
    dragging: false,
    scale: 1.2,
    targetScale: 1.2,
  });
  particles.anchor.set(0, 0, 0);
  particles.targetAnchor.set(0, 0, 0);
  const body = new Group();
  body.rotation.set(0.4, -0.8, 0.1);
  bodyTransforms.set("earth", body);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => {
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    bodyTransforms.clear();
    t.mock.timers.reset();
    Reflect.deleteProperty(globalThis, "location");
  });
  const finish = () => {
    (
      controller as unknown as { transition: gsap.core.Timeline }
    ).transition.progress(1);
    gsap.ticker.sleep();
  };
  return { controller, body, finish };
}

test("city stories reject unknown, non-Earth, unready and explicit legacy map requests", (t) => {
  const { controller, finish } = setup(t);
  assert.equal(controller.openCityStory("city-beijing"), false);
  controller.select("mars");
  finish();
  assert.equal(controller.openCityStory("city-beijing"), false);
  controller.select("earth");
  assert.equal(controller.openCityStory("city-beijing"), false);
  finish();
  assert.equal(controller.openCityStory("city-made-up"), false);
  Object.assign(globalThis, { location: { search: "?earth=map" } });
  assert.equal(controller.openCityStory("city-beijing"), false);
  Reflect.deleteProperty(globalThis, "location");
  store.set({ webglError: true });
  assert.equal(controller.openCityStory("city-beijing"), false);
  assert.equal(store.get().activeStoryId, null);
});

test("opening and closing a city story freezes existing motion targets without resetting the Earth", (t) => {
  const { controller, body, finish } = setup(t);
  controller.select("earth");
  finish();
  particles.scale = 1.22;
  particles.targetScale = 1.6;
  particles.anchor.set(0.12, 0.2, -0.3);
  particles.targetAnchor.set(1, 2, 3);
  particles.targetRotation = 1.9;
  particles.rotationVelocity = 0.4;
  const before = body.rotation.toArray();
  earthAtlasRotation.focus(48.8, 2.3);
  earthAtlasRotation.dragPitch(0.08);
  assert.equal(controller.openCityStory("city-beijing"), true);
  assert.equal(store.get().mode, "INFO_PANEL_OPEN");
  assert.equal(store.get().earthAutoRotate, false);
  assert.equal(particles.targetScale, particles.scale);
  assert.equal(particles.targetRotation, particles.rotation);
  assert.deepEqual(
    particles.targetAnchor.toArray(),
    particles.anchor.toArray(),
  );
  assert.equal(particles.rotationVelocity, 0);
  assert.equal(controller.openCityStory("city-paris"), false);
  assert.equal(controller.scale(1.6), false);
  assert.equal(controller.select("mars"), false);
  assert.equal(controller.next(1), false);
  assert.equal(controller.return(), true);
  assert.equal(store.get().mode, "PLANET_OVERVIEW");
  assert.equal(store.get().activeStoryId, null);
  earthAtlasRotation.step(body, {
    delta: 1 / 60,
    dragDelta: 0,
    dragging: false,
    automatic: false,
    paused: false,
  });
  assert.deepEqual(body.rotation.toArray(), before);
  assert.equal(particles.scale, 1.22);
  assert.equal(particles.targetScale, 1.22);
});

test("cancelling a return restores the paused Earth's original orientation", (t) => {
  const { controller, body, finish } = setup(t);
  controller.select("earth");
  finish();
  store.set({ earthAutoRotate: false });
  const before = body.rotation.toArray();
  assert.equal(controller.return(), true);
  assert.equal(store.get().mode, "TRANSITION");
  body.rotation.y += 0.5;
  assert.equal(controller.return(), true);
  assert.equal(store.get().mode, "PLANET_OVERVIEW");
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().earthAutoRotate, false);
  assert.deepEqual(body.rotation.toArray(), before);
});
