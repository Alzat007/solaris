import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";
import { gsap } from "gsap";
import { Group, PerspectiveCamera, Vector2, Vector3 } from "three";
import { planetById, planets } from "../src/data/planets";
import { InteractionController } from "../src/interaction/InteractionController";
import { store } from "../src/interaction/store";
import { parseTextCommand } from "../src/interaction/textCommands";
import { particles } from "../src/particles/ParticleEngine";
import { pickPlanet } from "../src/scene/planetPicking";
import { geographicPoint } from "../src/exploration/sceneState";
import {
  getPlanetAtlasRotation,
  isPlanetAutoRotating,
  setPlanetAutoRotate,
} from "../src/exploration/planetAtlasState";

function controllerFor(t: TestContext) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    transitioning: false,
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
    targetScale: 1,
    dragging: false,
    rotationVelocity: 0,
  });
  const controller = new InteractionController();
  controller.ready();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => {
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    t.mock.timers.reset();
    getPlanetAtlasRotation("moon").discardPending();
  });
  const finish = () => {
    (
      controller as unknown as { transition: gsap.core.Timeline }
    ).transition.progress(1);
    gsap.ticker.sleep();
  };
  return { controller, finish };
}

test("Moon is appended as an independently selectable terrestrial satellite, not a ninth solar-orbit planet", () => {
  assert.deepEqual(
    planets.map((body) => body.id),
    [
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
      "moon",
    ],
  );
  const moon = planetById("moon")!;
  assert.equal(moon.parentId, "earth");
  assert.equal(moon.realRadius, 1737.4);
  assert.equal(moon.diameter, "3,474.8 公里");
  assert.match(moon.orbitalPeriod, /27\.3.*绕地球/);
  assert.match(moon.distanceFromParent!, /384,400/);
  assert.equal(planets.filter((body) => !body.parentId).length, 8);
  for (const request of ["月球", "Moon", "带我去月球", "go to moon"])
    assert.deepEqual(parseTextCommand(request), {
      type: "select",
      planetId: "moon",
    });
});

test("Moon uses the current selection and transition lifecycle from solar overview and can return", (t) => {
  const { controller, finish } = controllerFor(t);
  assert.equal(controller.selectBody("moon"), true);
  assert.equal(store.get().selected, "moon");
  assert.equal(store.get().mode, "PLANET_TRANSITION");
  finish();
  assert.equal(store.get().selected, "moon");
  assert.equal(store.get().mode, "PLANET_OVERVIEW");
  assert.equal(controller.return(), true);
  finish();
  assert.equal(store.get().selected, null);
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
});

test("Moon slow rotation, manual pitch and drag reuse an independent shared atlas motor", () => {
  store.set({ selected: "moon", earthAutoRotate: false, planetAutoRotate: {} });
  const motor = getPlanetAtlasRotation("moon");
  assert.notEqual(motor, getPlanetAtlasRotation("earth"));
  motor.discardPending();
  const body = new Group();
  motor.step(body, {
    delta: 1 / 60,
    dragDelta: 0,
    automatic: isPlanetAutoRotating(store.get()),
    dragging: false,
    paused: false,
  });
  assert.ok(body.rotation.y > 0 && body.rotation.y < 0.001);
  motor.dragPitch(0.02);
  assert.equal(
    motor.step(body, {
      delta: 1 / 60,
      dragDelta: 0.3,
      automatic: true,
      dragging: true,
      paused: false,
    }),
    true,
  );
  assert.ok(body.rotation.x > 0);
  assert.ok(body.rotation.y >= 0.3);
  setPlanetAutoRotate("moon", false);
  assert.equal(isPlanetAutoRotating(store.get()), false);
  assert.equal(store.get().earthAutoRotate, false);
  motor.discardPending();
});

test("disc picking identifies the Moon separately from Earth", () => {
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 100);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const earth = new Group();
  earth.scale.setScalar(0.53);
  earth.updateMatrixWorld();
  const moon = new Group();
  moon.position.set(1.2, 0, 0);
  moon.scale.setScalar(0.145);
  moon.updateMatrixWorld();
  const center = moon.position.clone().project(camera);
  assert.equal(
    pickPlanet(
      new Vector2(center.x, center.y),
      camera,
      1280,
      800,
      new Map([
        ["earth", earth],
        ["moon", moon],
      ]),
    ),
    "moon",
  );
});

test("Moon bitmap convention matches east-longitude geographic anchors without a shifted seam", () => {
  for (const [latitude, longitude] of [
    [0, 0],
    [-43.3, -11.22],
    [9.62, -20.08],
    [45, 120],
  ]) {
    const u = 0.5 + longitude / 360;
    const v = 0.5 + latitude / 180;
    const phi = u * Math.PI * 2;
    const theta = (1 - v) * Math.PI;
    const sphereGeometryPoint = new Vector3(
      -Math.cos(phi) * Math.sin(theta),
      Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
    );
    assert.ok(
      sphereGeometryPoint.distanceTo(geographicPoint(latitude, longitude)) <
        1e-12,
    );
  }
  const moonSource = readFileSync(
    new URL("../src/planets/Moon.tsx", import.meta.url),
    "utf8",
  );
  assert.match(moonSource, /<PlanetBase id="moon" surface=/);
  assert.match(moonSource, /textures\/moon-day\.jpg/);
  assert.match(moonSource, /texture2D\(uMap,vUv\)/);
  const earthSource = readFileSync(
    new URL("../src/planets/Earth.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    earthSource,
    /ref=\{moon\}|sphereGeometry args=\{\[0\.12/,
  );
  const baseSource = readFileSync(
    new URL("../src/planets/PlanetBase.tsx", import.meta.url),
    "utf8",
  );
  assert.match(baseSource, /if \(!parent \|\| !parent\.visible\) return;/);
});
