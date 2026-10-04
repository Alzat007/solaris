import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { Euler, Group, Vector3 } from "three";
import { InteractionController } from "../src/interaction/InteractionController";
import { InteractionStateMachine } from "../src/interaction/InteractionStateMachine";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { assets, destinations } from "../src/exploration/content";
import {
  bodyTransforms,
  facingRotation,
  geographicPoint,
} from "../src/exploration/sceneState";
import type { PlanetId } from "../src/data/planets";

const beijing = "earth-beijing-central-axis";
const olympus = "mars-olympus-mons";

function setup(t: TestContext) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  bodyTransforms.clear();
  const controller = new InteractionController();
  controller.ready();
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
    activeStoryId: null,
    explorationError: "",
    locationResourcesReady: false,
  });
  Object.assign(particles, {
    focus: 0,
    assembly: 0,
    sunInterior: 0,
    collapse: 0,
    explosion: 0,
    locationApproach: 0,
    targetScale: 1,
    dragging: false,
    rotationVelocity: 0,
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => {
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    bodyTransforms.clear();
    t.mock.timers.reset();
  });
  return controller;
}

function timeline(controller: InteractionController) {
  const result = (
    controller as unknown as { transition: gsap.core.Timeline | null }
  ).transition;
  assert.ok(result, "an accepted action creates a real GSAP timeline");
  result.pause();
  return result;
}

function finish(controller: InteractionController) {
  timeline(controller).progress(1);
  gsap.ticker.sleep();
}

function focus(controller: InteractionController, id: PlanetId) {
  const body = new Group();
  body.rotation.set(0.2, 0.6, 0.3);
  bodyTransforms.set(id, body);
  assert.equal(controller.select(id), true);
  finish(controller);
  return body;
}

function directory(controller: InteractionController, id: PlanetId = "earth") {
  const body = focus(controller, id);
  assert.equal(controller.browse(), true);
  return body;
}

function deferredLoad() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  const calls: string[][] = [];
  return {
    resolve,
    reject,
    load: (paths: string[]) => {
      calls.push(paths);
      return promise;
    },
    calls,
  };
}

test("the FSM admits a directory only from planet focus and makes location transitions cancellable", () => {
  const machine = new InteractionStateMachine();
  assert.equal(machine.send("BROWSE"), false);
  machine.send("READY");
  assert.equal(machine.send("ENTER_LOCATION"), false);
  machine.send("SELECT");
  assert.equal(machine.send("BROWSE"), false);
  machine.send("TRANSITION_END");
  assert.equal(machine.send("BROWSE"), true);
  assert.equal(machine.state, "EXPLORATION_DIRECTORY");
  assert.equal(machine.send("ENTER_LOCATION"), true);
  assert.equal(machine.locked, true);
  for (const event of [
    "ENTER_LOCATION",
    "SELECT",
    "SCALE",
    "INFO",
    "BROWSE",
  ] as const)
    assert.equal(machine.send(event), false);
  assert.equal(machine.send("LOCATION_CANCEL"), true);
  assert.equal(machine.state, "EXPLORATION_DIRECTORY");
  assert.equal(machine.locked, false);
  machine.send("ENTER_LOCATION");
  machine.send("LOCATION_READY");
  assert.equal(machine.state, "LOCATION_VIEW");
  assert.equal(machine.send("LOCATION_CANCEL"), true);
  assert.equal(machine.send("EXIT_DIRECTORY"), true);
  assert.equal(machine.state, "PLANET_FOCUS");
});

test("a real selected planet is required and browsing cancels the old information reveal timer", (t) => {
  const controller = setup(t);
  assert.equal(controller.browse(), false);
  focus(controller, "earth");
  assert.equal(controller.browse(), true);
  t.mock.timers.tick(2000);
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
  assert.equal(store.get().infoVisible, false);
  assert.equal(controller.browse(), false);
});

test("ready, draft, unknown and cross-planet entry checks do not invoke the loader for rejected entries", async (t) => {
  const controller = setup(t);
  directory(controller, "mercury");
  let calls = 0;
  const load = async () => {
    calls++;
  };
  const before = store.get();
  assert.equal(
    await controller.enterDestination("mercury-caloris", load),
    false,
  );
  assert.equal(
    await controller.enterDestination("missing-destination", load),
    false,
  );
  assert.equal(await controller.enterDestination(olympus, load), false);
  assert.equal(store.get(), before);
  assert.equal(calls, 0);
  controller.return();
  controller.return();
  finish(controller);
  focus(controller, "mars");
  assert.equal(
    await controller.enterDestination(olympus, load),
    false,
    "directory state is required even for a ready destination",
  );
  assert.equal(controller.browse(), true);
  assert.equal(await controller.enterDestination(olympus, load), true);
  assert.equal(calls, 1);
  finish(controller);
  assert.equal(store.get().mode, "LOCATION_VIEW");
});

test("ready resources are loaded before a location can finish and skip stays disabled while loading", async (t) => {
  const controller = setup(t);
  directory(controller);
  const resource = deferredLoad();
  const action = controller.enterDestination(beijing, resource.load);
  assert.equal(store.get().mode, "LOCATION_TRANSITION");
  assert.equal(store.get().transitioning, true);
  assert.equal(store.get().locationResourcesReady, false);
  assert.equal(controller.skipLocationTransition(), false);
  const expected = destinations
    .find((entry) => entry.id === beijing)!
    .assetIds.map((id) => assets.find((asset) => asset.id === id)!.path);
  assert.deepEqual(resource.calls, [expected]);
  resource.resolve();
  assert.equal(await action, true);
  assert.equal(store.get().mode, "LOCATION_TRANSITION");
  assert.equal(store.get().locationResourcesReady, true);
  assert.equal(controller.skipLocationTransition(), true);
  assert.equal(store.get().mode, "LOCATION_VIEW");
  assert.equal(store.get().transitioning, false);
  assert.equal(particles.locationApproach, 1);
  assert.equal(controller.skipLocationTransition(), false);
});

test("busy location loading rejects duplicates and conflicting scene actions without changing the target", async (t) => {
  const controller = setup(t);
  directory(controller, "mars");
  const resource = deferredLoad();
  const action = controller.enterDestination(olympus, resource.load);
  const before = store.get();
  assert.equal(
    await controller.enterDestination("mars-viking-1", resource.load),
    false,
  );
  assert.equal(controller.select("earth"), false);
  assert.equal(controller.next(1), false);
  assert.equal(controller.info(), false);
  assert.equal(controller.scale(2), false);
  assert.equal(controller.browse(), false);
  assert.equal(controller.openStory("story-olympus-orbital-view"), false);
  assert.equal(store.get(), before);
  assert.equal(resource.calls.length, 1);
  resource.resolve();
  assert.equal(await action, true);
});

test("cancelling a pending load restores the directory and a late successful load cannot re-enter", async (t) => {
  const controller = setup(t);
  const body = directory(controller);
  const pose = body.rotation.clone();
  store.set({ explorationCityId: "city-beijing" });
  const resource = deferredLoad();
  const action = controller.enterDestination(beijing, resource.load);
  assert.equal(controller.return(), true);
  const afterCancel = store.get();
  assert.equal(afterCancel.mode, "EXPLORATION_DIRECTORY");
  assert.equal(afterCancel.explorationCityId, "city-beijing");
  assert.equal(afterCancel.destinationId, null);
  assert.equal(afterCancel.locationResourcesReady, false);
  assert.equal(afterCancel.transitioning, false);
  assert.deepEqual(body.rotation.toArray(), pose.toArray());
  resource.resolve();
  assert.equal(await action, false);
  assert.equal(store.get(), afterCancel);
  assert.equal(particles.locationApproach, 0);
});

test("a late failed load after cancellation cannot display an error over a newer navigation state", async (t) => {
  const controller = setup(t);
  directory(controller, "mars");
  const resource = deferredLoad();
  const action = controller.enterDestination(olympus, resource.load);
  controller.return();
  controller.return();
  controller.return();
  finish(controller);
  focus(controller, "earth");
  const newer = store.get();
  resource.reject(new Error("late network failure"));
  assert.equal(await action, false);
  assert.equal(store.get(), newer);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().explorationError, "");
});

test("cancelling an active GSAP approach restores all body axes and invalidates its old completion", async (t) => {
  const controller = setup(t);
  const body = directory(controller);
  const pose = body.rotation.clone();
  assert.equal(
    await controller.enterDestination(beijing, async () => {}),
    true,
  );
  const active = timeline(controller);
  const onComplete = active.eventCallback("onComplete");
  active.progress(0.5);
  assert.ok(particles.locationApproach > 0);
  assert.notDeepEqual(body.rotation.toArray(), pose.toArray());
  assert.equal(controller.return(), true);
  const afterCancel = store.get();
  assert.deepEqual(body.rotation.toArray(), pose.toArray());
  assert.equal(particles.locationApproach, 0);
  onComplete?.();
  assert.equal(store.get(), afterCancel);
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
});

test("a resource rejection recovers without entering an empty destination and retry remains possible", async (t) => {
  const controller = setup(t);
  const body = directory(controller);
  const pose = body.rotation.clone();
  assert.equal(
    await controller.enterDestination(beijing, async () => {
      throw new Error("offline");
    }),
    false,
  );
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
  assert.equal(store.get().destinationId, null);
  assert.equal(store.get().transitioning, false);
  assert.equal(store.get().locationResourcesReady, false);
  assert.match(store.get().explorationError, /Location resources unavailable/);
  assert.deepEqual(body.rotation.toArray(), pose.toArray());
  assert.equal(
    await controller.enterDestination(beijing, async () => {}),
    true,
  );
  assert.equal(store.get().explorationError, "");
  finish(controller);
  assert.equal(store.get().mode, "LOCATION_VIEW");
});

test("unreviewed image metadata cannot call the loader or start an approach", async (t) => {
  const controller = setup(t);
  directory(controller);
  const entry = destinations.find((destination) => destination.id === beijing)!;
  const asset = assets.find((candidate) => candidate.id === entry.assetIds[0])!;
  const status = asset.review.status;
  t.after(() => {
    asset.review.status = status;
  });
  asset.review.status = "pending";
  let calls = 0;
  assert.equal(
    await controller.enterDestination(beijing, async () => {
      calls++;
    }),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
  assert.equal(store.get().locationResourcesReady, false);
});

test("story, location, city, directory and planet returns follow separate layers and restore the original pose", async (t) => {
  const controller = setup(t);
  const body = focus(controller, "earth");
  const pose = body.rotation.clone();
  store.set({ infoVisible: true });
  assert.equal(controller.browse(), true);
  store.set({ explorationCityId: "city-beijing" });
  assert.equal(
    await controller.enterDestination(beijing, async () => {}),
    true,
  );
  finish(controller);
  assert.equal(body.rotation.z, 0);
  assert.equal(controller.openStory("unrelated-story"), false);
  assert.equal(controller.openStory("story-beijing-axis-heritage"), true);
  assert.equal(controller.return(), true);
  assert.equal(store.get().activeStoryId, null);
  assert.equal(store.get().mode, "LOCATION_VIEW");
  assert.equal(store.get().destinationId, beijing);
  assert.equal(controller.return(), true);
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
  assert.equal(store.get().explorationCityId, "city-beijing");
  assert.deepEqual(body.rotation.toArray(), pose.toArray());
  assert.equal(controller.return(), true);
  assert.equal(store.get().explorationCityId, null);
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
  assert.equal(controller.return(), true);
  assert.equal(store.get().mode, "PLANET_FOCUS");
  assert.equal(store.get().infoVisible, true);
  assert.equal(store.get().selected, "earth");
  assert.equal(controller.return(), true);
  finish(controller);
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
  assert.equal(store.get().selected, null);
});

test("returning from a directory entered through INFO restores that exact stable state", (t) => {
  const controller = setup(t);
  focus(controller, "earth");
  assert.equal(controller.machine.send("INFO"), true);
  store.set({ mode: "INFO", infoVisible: true });
  assert.equal(controller.browse(), true);
  assert.equal(controller.return(), true);
  assert.equal(controller.machine.state, "INFO");
  assert.equal(store.get().mode, "INFO");
  assert.equal(store.get().infoVisible, true);
});

test("WebGL failures prevent browsing and entry without invoking resource loading", async (t) => {
  const controller = setup(t);
  focus(controller, "earth");
  store.set({ webglError: true });
  assert.equal(controller.browse(), false);
  store.set({ webglError: false });
  assert.equal(controller.browse(), true);
  store.set({ webglError: true });
  const before = store.get();
  let calls = 0;
  assert.equal(
    await controller.enterDestination(beijing, async () => {
      calls++;
    }),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(store.get(), before);
});

test("a WebGL failure during resource loading rolls back before starting a camera approach", async (t) => {
  const controller = setup(t);
  directory(controller);
  const resource = deferredLoad();
  const action = controller.enterDestination(beijing, resource.load);
  store.set({ webglError: true });
  resource.resolve();
  assert.equal(await action, false);
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
  assert.equal(store.get().destinationId, null);
  assert.equal(store.get().transitioning, false);
  assert.equal(particles.locationApproach, 0);
});

test("skip and ordinary completion cannot report a location view after a WebGL failure", async (t) => {
  const controller = setup(t);
  directory(controller);
  assert.equal(
    await controller.enterDestination(beijing, async () => {}),
    true,
  );
  store.set({ webglError: true });
  assert.equal(controller.skipLocationTransition(), false);
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
  assert.equal(store.get().destinationId, null);
  store.set({ webglError: false });
  assert.equal(
    await controller.enterDestination(beijing, async () => {}),
    true,
  );
  store.set({ webglError: true });
  finish(controller);
  assert.equal(store.get().mode, "EXPLORATION_DIRECTORY");
  assert.equal(store.get().transitioning, false);
  assert.match(store.get().explorationError, /Scene unavailable/);
});

test("geographic positions preserve radius, poles and signed east-longitude orientation", () => {
  const close = (a: Vector3, b: Vector3) => assert.ok(a.distanceTo(b) < 1e-10);
  close(geographicPoint(0, 0), new Vector3(1, 0, 0));
  close(geographicPoint(0, 90), new Vector3(0, 0, -1));
  close(geographicPoint(0, -90), new Vector3(0, 0, 1));
  close(geographicPoint(90, 0), new Vector3(0, 1, 0));
  close(geographicPoint(-90, 45), new Vector3(0, -1, 0));
  for (const [latitude, longitude] of [
    [39.907222, 116.391389],
    [-33.9, 18.4],
    [18.65, -133.8],
    [0, 180],
  ])
    assert.ok(
      Math.abs(geographicPoint(latitude, longitude, 2.6).length() - 2.6) <
        1e-10,
    );
});

test("facing rotations bring geographic points to the shared front-facing camera latitude", () => {
  const angle = (13.3 * Math.PI) / 180;
  const forward = new Vector3(0, Math.sin(angle), Math.cos(angle));
  for (const [latitude, longitude] of [
    [39.907222, 116.391389],
    [-33.9, 18.4],
    [18.65, -133.8],
    [0, 180],
    [90, 0],
    [-90, 0],
  ]) {
    const pose = facingRotation(latitude, longitude);
    const point = geographicPoint(latitude, longitude).applyEuler(
      new Euler(pose.x, pose.y, 0, "XYZ"),
    );
    assert.ok(point.distanceTo(forward) < 1e-10, `${latitude}, ${longitude}`);
    assert.ok(point.z > 0, "the selected marker is on the front hemisphere");
  }
});
