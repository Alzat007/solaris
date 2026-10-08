import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { gsap } from "gsap";
import { Group } from "three";
import { planets, type PlanetId } from "../src/data/planets";
import { InteractionController } from "../src/interaction/InteractionController";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { bodyTransforms } from "../src/exploration/sceneState";
import { getPlanetAnnotations } from "../src/exploration/planetAtlasCatalog";
import {
  getPlanetAtlasRotation,
  isPlanetAutoRotating,
  setPlanetAutoRotate,
} from "../src/exploration/planetAtlasState";

function setup(t: TestContext, bodyId: PlanetId) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    transitioning: false,
    help: false,
    activeStoryId: null,
    activeHotspotId: null,
    infoVisible: false,
    webglError: false,
    sound: false,
    earthAutoRotate: true,
    planetAutoRotate: {},
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
  bodyTransforms.set(bodyId, body);
  const controller = new InteractionController();
  controller.machine.send("READY");
  const finish = () => {
    (
      controller as unknown as { transition: gsap.core.Timeline }
    ).transition.progress(1);
    gsap.ticker.sleep();
  };
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => {
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    bodyTransforms.clear();
    getPlanetAtlasRotation(bodyId).discardPending();
    t.mock.timers.reset();
    Reflect.deleteProperty(globalThis, "location");
  });
  controller.select(bodyId);
  finish();
  return { controller, body };
}

test("presentation keeps scene locked through exit and allows the same story to reverse exit", (t) => {
  const { controller, body } = setup(t, "earth");
  const id = getPlanetAnnotations("earth")[0].id;
  const pose = body.rotation.toArray();
  controller.openPlanetStory(id);
  let closes = 0;
  let reopens = 0;
  const unbind = controller.bindPlanetStoryPresentation({
    id,
    close: () => closes++,
    reopen: () => reopens++,
  });
  assert.equal(controller.return(), true);
  assert.equal(controller.return(), true);
  assert.equal(closes, 2);
  assert.equal(store.get().mode, "INFO_PANEL_OPEN");
  assert.equal(store.get().activeStoryId, id);
  assert.equal(isPlanetAutoRotating(store.get()), false);
  assert.equal(controller.scale(2), false);
  assert.equal(controller.openPlanetStory(id), true);
  assert.equal(reopens, 1);
  assert.equal(
    controller.openPlanetStory(getPlanetAnnotations("earth")[1].id),
    false,
  );
  assert.equal(controller.finishPlanetStoryClose("wrong-story"), false);
  assert.equal(controller.finishPlanetStoryClose(id), true);
  assert.equal(controller.finishPlanetStoryClose(id), false);
  assert.equal(isPlanetAutoRotating(store.get()), true);
  assert.deepEqual(body.rotation.toArray(), pose);
  unbind();
});

test("an old presenter cleanup cannot remove a new presenter, and rendering failure closes synchronously", (t) => {
  const { controller } = setup(t, "mars");
  const id = getPlanetAnnotations("mars")[0].id;
  controller.openPlanetStory(id);
  const old = controller.bindPlanetStoryPresentation({
    id,
    close() {},
    reopen() {},
  });
  let closes = 0;
  const current = controller.bindPlanetStoryPresentation({
    id,
    close: () => closes++,
    reopen() {},
  });
  old();
  controller.return();
  assert.equal(closes, 1);
  assert.equal(store.get().mode, "INFO_PANEL_OPEN");
  store.set({ webglError: true });
  assert.equal(controller.openPlanetStory(id), false);
  controller.return();
  assert.equal(store.get().mode, "PLANET_OVERVIEW");
  assert.equal(closes, 1);
  current();
});

test("completed close cannot reuse a stale presenter when the same ID is opened synchronously", (t) => {
  const { controller } = setup(t, "saturn");
  const id = getPlanetAnnotations("saturn")[0].id;
  controller.openPlanetStory(id);
  let closes = 0;
  const unbind = controller.bindPlanetStoryPresentation({
    id,
    close: () => closes++,
    reopen() {},
  });
  assert.equal(controller.finishPlanetStoryClose(id), true);
  assert.equal(controller.openPlanetStory(id), true);
  assert.equal(controller.return(), true);
  assert.equal(closes, 0);
  assert.equal(store.get().mode, "PLANET_OVERVIEW");
  unbind();
});

for (const planet of planets) {
  test(`${planet.id}: story ownership, freeze, close and cancelled return preserve the original planet`, (t) => {
    const { controller, body } = setup(t, planet.id);
    const entries = getPlanetAnnotations(planet.id);
    assert.equal(controller.openPlanetStory("region-not-a-real-place"), false);
    const wrongPlanet = planet.id === "mars" ? "jupiter" : "mars";
    assert.equal(
      controller.openPlanetStory(getPlanetAnnotations(wrongPlanet)[0].id),
      false,
    );
    const before = body.rotation.toArray();
    const motor = getPlanetAtlasRotation(planet.id);
    motor.focus(48, 2);
    motor.dragPitch(0.08);
    particles.targetScale = 1.9;
    particles.targetRotation = 2.3;
    particles.targetAnchor.set(3, 2, 1);
    assert.equal(controller.openPlanetStory(entries[0].id), true);
    assert.equal(store.get().activeStoryId, entries[0].id);
    assert.equal(store.get().mode, "INFO_PANEL_OPEN");
    assert.equal(isPlanetAutoRotating(store.get()), false);
    assert.equal(particles.targetScale, particles.scale);
    assert.equal(particles.targetRotation, particles.rotation);
    assert.deepEqual(
      particles.targetAnchor.toArray(),
      particles.anchor.toArray(),
    );
    assert.equal(controller.openPlanetStory(entries[1].id), false);
    assert.equal(controller.scale(1.8), false);
    assert.equal(controller.select(wrongPlanet), false);
    assert.equal(controller.return(), true);
    assert.equal(store.get().mode, "PLANET_OVERVIEW");
    assert.equal(store.get().selected, planet.id);
    assert.equal(store.get().activeStoryId, null);
    assert.equal(isPlanetAutoRotating(store.get()), true);
    motor.step(body, {
      delta: 1 / 60,
      dragDelta: 0,
      automatic: false,
      dragging: false,
      paused: false,
    });
    assert.deepEqual(body.rotation.toArray(), before);
    assert.equal(particles.scale, 1.2);
    setPlanetAutoRotate(planet.id, false);
    assert.equal(controller.return(), true);
    assert.equal(store.get().mode, "TRANSITION");
    body.rotation.y += 0.5;
    assert.equal(controller.return(), true);
    assert.deepEqual(body.rotation.toArray(), before);
    assert.equal(store.get().selected, planet.id);
  });
  test(`${planet.id}: closing a story preserves an explicitly disabled automatic rotation preference`, (t) => {
    const { controller, body } = setup(t, planet.id);
    setPlanetAutoRotate(planet.id, false);
    const before = body.rotation.toArray();
    assert.equal(
      controller.openPlanetStory(getPlanetAnnotations(planet.id)[0].id),
      true,
    );
    assert.equal(isPlanetAutoRotating(store.get()), false);
    assert.equal(controller.return(), true);
    assert.equal(isPlanetAutoRotating(store.get()), false);
    assert.deepEqual(body.rotation.toArray(), before);
  });
}
