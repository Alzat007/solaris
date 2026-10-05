import test from "node:test";
import assert from "node:assert/strict";
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Ellipsoid,
  Ray,
  type Viewer,
} from "cesium";
import {
  BEIJING,
  GlobeCameraActions,
  MAX_HEIGHT,
  MIN_HEIGHT,
  type GlobeCameraOptions,
} from "../src/globeLab/GlobeCameraActions";
import { geographicCameraPose } from "../src/globeLab/cameraPose";

interface StubFlight {
  destination: Cartesian3;
  orientation: { direction: Cartesian3; up: Cartesian3 };
  complete(): void;
}

/** 确定性的本地传输替身，不代表真实渲染或 ion 连接。 */
function fixture(options: GlobeCameraOptions = {}) {
  let ground: number | undefined;
  let terrainHit: Cartesian3 | undefined;
  let ellipsoidHit: Cartesian3 | undefined = Cartesian3.fromDegrees(
    BEIJING.longitude,
    BEIJING.latitude,
  );
  let terrainPicks = 0;
  let ellipsoidPicks = 0;
  let renders = 0;
  let stops = 0;
  let orientationWrites = 0;
  let lastFlight: StubFlight | null = null;
  const camera = {
    position: new Cartesian3(),
    direction: new Cartesian3(0, 0, -1),
    up: new Cartesian3(0, 1, 0),
    right: new Cartesian3(1, 0, 0),
    get positionWC(): Cartesian3 {
      return camera.position;
    },
    get directionWC(): Cartesian3 {
      return camera.direction;
    },
    get upWC(): Cartesian3 {
      return camera.up;
    },
    get positionCartographic(): Cartographic {
      return Cartographic.fromCartesian(camera.position, Ellipsoid.WGS84);
    },
    heading: 0,
    pitch: -Math.PI / 2,
    lookAtTransform: () => {},
    pickEllipsoid: (_pixel: Cartesian2, ellipsoid: Ellipsoid) => {
      assert.equal(ellipsoid, Ellipsoid.WGS84);
      ellipsoidPicks++;
      return ellipsoidHit;
    },
    getPickRay: (_pixel: Cartesian2) =>
      new Ray(camera.position, camera.direction),
    cancelFlight: () => {
      stops++;
    },
    flyTo: (flight: StubFlight) => {
      lastFlight = flight;
    },
    setView: () => {
      orientationWrites++;
    },
  };
  const viewer = {
    camera,
    canvas: { clientWidth: 1440, clientHeight: 900 },
    scene: {
      screenSpaceCameraController: { enableInputs: true },
      globe: {
        pick: () => {
          terrainPicks++;
          return terrainHit;
        },
        getHeight: (_position: Cartographic) => ground,
      },
      requestRender: () => {
        renders++;
      },
    },
  };
  const actions = new GlobeCameraActions(viewer as unknown as Viewer, options);
  return {
    actions,
    camera,
    viewer,
    setGround(value: number | undefined) {
      ground = value;
    },
    setTerrainHit(value: Cartesian3 | undefined) {
      terrainHit = value;
    },
    setEllipsoidHit(value: Cartesian3 | undefined) {
      ellipsoidHit = value;
    },
    get terrainPicks() {
      return terrainPicks;
    },
    get ellipsoidPicks() {
      return ellipsoidPicks;
    },
    get renders() {
      return renders;
    },
    get stops() {
      return stops;
    },
    get orientationWrites() {
      return orientationWrites;
    },
    get lastFlight(): StubFlight {
      assert.ok(lastFlight);
      return lastFlight;
    },
  };
}

const positionTuple = (point: Cartesian3): [number, number, number] => [
  point.x,
  point.y,
  point.z,
];

function closeVector(actual: number[], expected: number[], epsilon = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) <= epsilon,
      `${value} differs from ${expected[index]}`,
    );
  });
}

test("an incoming main-scene pose is retained instead of forcing the Beijing home view", () => {
  const initialPose = geographicCameraPose({
    longitude: -73.9857,
    latitude: -20,
    height: 12_000_000,
  }, 15);
  const before = JSON.stringify(initialPose);
  const f = fixture({ initialPose });
  const captured = f.actions.capture();
  assert.deepEqual(captured.position, initialPose.position);
  closeVector(captured.direction, initialPose.direction);
  closeVector(captured.up, initialPose.up);
  assert.equal(captured.focus, "地球");
  assert.equal(f.actions.maximumHeight, MAX_HEIGHT);
  assert.equal(f.actions.status().mode, "MANUAL");
  assert.equal(f.viewer.scene.screenSpaceCameraController.enableInputs, false);
  assert.equal(JSON.stringify(initialPose), before);
  assert.equal(f.stops, 0);
});

test("home restores the exact incoming pose and cancels a guided flight without replaying it", () => {
  const initialPose = geographicCameraPose({
    longitude: 25,
    latitude: -35,
    height: 9_000_000,
  }, 10);
  const f = fixture({ initialPose });
  const home = f.actions.capture();
  assert.equal(f.actions.flyToBeijing(), true);
  const staleComplete = f.lastFlight.complete;
  Cartesian3.clone(Cartesian3.fromDegrees(100, 20, 2_000_000), f.camera.position);
  f.camera.direction = new Cartesian3(1, 0, 0);
  f.camera.up = new Cartesian3(0, 1, 0);
  f.actions.home();
  assert.equal(f.stops, 1);
  assert.equal(f.actions.status().mode, "MANUAL");
  const restored = f.actions.capture();
  assert.deepEqual(restored.position, home.position);
  closeVector(restored.direction, home.direction, 1e-12);
  closeVector(restored.up, home.up, 1e-12);
  assert.equal(restored.focus, home.focus);
  staleComplete();
  assert.deepEqual(f.actions.capture(), restored);
  assert.equal(f.actions.status().mode, "MANUAL");
});

test("an above-default incoming altitude sets a per-instance limit and its first zoom stays continuous", () => {
  const initialPose = geographicCameraPose({
    longitude: 30,
    latitude: 10,
    height: 60_000_000,
  });
  const f = fixture({ initialPose });
  const initialHeight = f.camera.positionCartographic.height;
  assert.ok(initialHeight > MAX_HEIGHT);
  assert.ok(Math.abs(f.actions.maximumHeight - initialHeight * 1.05) < 1e-5);
  f.actions.zoom(1);
  const zoomedHeight = f.camera.positionCartographic.height;
  assert.ok(zoomedHeight < initialHeight - 1_000_000);
  assert.ok(zoomedHeight > MAX_HEIGHT);
  assert.equal(f.actions.status().atBoundary, false);
  f.actions.home();
  assert.deepEqual(f.actions.capture().position, initialPose.position);
  for (let index = 0; index < 80; index++) f.actions.zoom(-1);
  assert.ok(f.camera.positionCartographic.height <= f.actions.maximumHeight + 1e-5);
  assert.ok(f.camera.positionCartographic.height >= f.actions.maximumHeight - 1);
  assert.equal(f.actions.status().atBoundary, true);
  assert.equal(fixture().actions.maximumHeight, MAX_HEIGHT);
});

test("standalone camera keeps its original Beijing home pose and default altitude bounds", () => {
  const f = fixture();
  const expected = geographicCameraPose({ ...BEIJING, height: 18_000_000 });
  const home = f.actions.capture();
  closeVector(home.position, expected.position, 1e-6);
  closeVector(home.direction, expected.direction);
  closeVector(home.up, expected.up);
  assert.equal(f.actions.minimumHeight, MIN_HEIGHT);
  assert.equal(f.actions.maximumHeight, MAX_HEIGHT);
  assert.ok(Math.abs(f.camera.positionCartographic.height - 18_000_000) < 1e-5);
  f.actions.zoom(1);
  assert.notDeepEqual(f.actions.capture().position, home.position);
  f.actions.home();
  assert.deepEqual(f.actions.capture(), home);
});

test("local camera owns inputs and preserves its ellipsoid-only observation boundary", () => {
  const f = fixture();
  assert.equal(f.viewer.scene.screenSpaceCameraController.enableInputs, false);
  assert.equal(f.actions.minimumHeight, MIN_HEIGHT);
  const hit = f.actions.pick(0.5, 0.5);
  assert.ok(hit);
  assert.equal(f.terrainPicks, 0);
  assert.equal(f.ellipsoidPicks, 1);
  for (let i = 0; i < 80; i++) f.actions.zoom(1);
  assert.ok(f.camera.positionCartographic.height >= MIN_HEIGHT - 1e-5);
  assert.ok(f.camera.positionCartographic.height <= MIN_HEIGHT + 1);
  assert.equal(f.actions.status().atBoundary, true);
  for (let i = 0; i < 80; i++) f.actions.zoom(-1);
  assert.ok(f.camera.positionCartographic.height <= MAX_HEIGHT + 1e-5);
  assert.ok(f.camera.positionCartographic.height >= MAX_HEIGHT - 1);
});

test("terrain camera picks the loaded geographic surface before the ellipsoid", () => {
  const f = fixture({ terrain: true, minimumHeight: 100 });
  const terrain = Cartesian3.fromDegrees(
    BEIJING.longitude,
    BEIJING.latitude,
    1800,
  );
  f.setTerrainHit(terrain);
  assert.equal(f.actions.pick(0.25, 0.3), terrain);
  assert.equal(f.terrainPicks, 1);
  assert.equal(f.ellipsoidPicks, 0);
});

test("a missing terrain intersection falls back without manufacturing a surface hit", () => {
  const f = fixture({ terrain: true, minimumHeight: 100 });
  assert.ok(f.actions.pick(0.5, 0.5));
  assert.equal(f.terrainPicks, 1);
  assert.equal(f.ellipsoidPicks, 1);
  f.setEllipsoidHit(undefined);
  assert.equal(f.actions.pick(0.9, 0.1), null);
});

test("terrain zoom respects loaded ground height plus configured clearance", () => {
  const f = fixture({ terrain: true, minimumHeight: 100 });
  f.setGround(500);
  f.setTerrainHit(
    Cartesian3.fromDegrees(BEIJING.longitude, BEIJING.latitude, 500),
  );
  for (let i = 0; i < 100; i++) f.actions.zoom(1);
  assert.ok(f.camera.positionCartographic.height >= 600 - 1e-5);
  assert.ok(f.camera.positionCartographic.height <= 601);
  assert.equal(f.actions.status().atBoundary, true);
});

test("late terrain raises a manual camera to clearance while preserving its direction", () => {
  const f = fixture({ terrain: true, minimumHeight: 100 });
  const pose = geographicCameraPose({ ...BEIJING, height: 900 });
  f.actions.restore({ ...pose, focus: "测试区域" });
  const before = f.actions.capture();
  f.setGround(1000);
  f.actions.enforceTerrainClearance();
  const after = f.actions.capture();
  assert.ok(Math.abs(f.camera.positionCartographic.height - 1100) < 1e-5);
  assert.ok(
    Cartesian3.distance(
      new Cartesian3(...before.direction),
      new Cartesian3(...after.direction),
    ) < 1e-12,
  );
  assert.ok(
    Cartesian3.distance(
      new Cartesian3(...before.up),
      new Cartesian3(...after.up),
    ) < 1e-12,
  );
  assert.equal(after.focus, before.focus);
});

test("disabled camera ignores manual input, guided navigation and clearance writes", () => {
  const f = fixture({ terrain: true, minimumHeight: 100 });
  f.actions.enabled = false;
  const before = f.actions.capture();
  const renders = f.renders;
  f.setGround(20_000_000);
  f.actions.beginDrag(0.5, 0.5);
  f.actions.dragTo(0.6, 0.6);
  f.actions.zoom(1);
  f.actions.pan(0.1, 0.1);
  f.actions.tilt(0.1);
  f.actions.home();
  f.actions.enforceTerrainClearance();
  assert.equal(f.actions.flyToBeijing(), false);
  assert.deepEqual(f.actions.capture(), before);
  assert.equal(f.renders, renders);
  assert.equal(f.orientationWrites, 0);
});

test("cancel restores exact camera vectors and focus and rejects stale completion", () => {
  const f = fixture();
  const before = f.actions.capture();
  assert.equal(f.actions.flyToBeijing(), true);
  const complete = f.lastFlight.complete;
  Cartesian3.clone(
    Cartesian3.fromDegrees(80, 20, 10_000_000),
    f.camera.position,
  );
  assert.equal(f.actions.cancelFlight(), true);
  assert.equal(f.stops, 1);
  assert.deepEqual(f.actions.capture(), before);
  complete();
  assert.equal(f.actions.status().mode, "MANUAL");
  assert.deepEqual(f.actions.capture(), before);
});

test("a missing drag hit cannot cancel a flight but manual zoom takes over its current pose", () => {
  const f = fixture();
  assert.equal(f.actions.flyToBeijing(), true);
  f.setEllipsoidHit(undefined);
  f.actions.beginDrag(0.9, 0.1);
  assert.equal(f.actions.status().mode, "AUTO_FLIGHT");
  const during = f.actions.capture();
  f.actions.zoom(-0.1);
  assert.equal(f.actions.status().mode, "MANUAL");
  assert.equal(f.stops, 1);
  assert.notDeepEqual(f.actions.capture().position, during.position);
});

test("terrain skip and automatic flight endpoints never go below the loaded navigation floor", () => {
  const f = fixture({ terrain: true, minimumHeight: 100 });
  f.setGround(1800);
  const target = { ...BEIJING, height: 100, name: "地形下限测试" };
  assert.equal(f.actions.flyTo(target), true);
  const destination = Cartographic.fromCartesian(
    f.lastFlight.destination,
    Ellipsoid.WGS84,
  );
  assert.ok(
    destination.height >= 1900 - 1e-5,
    `flight endpoint height=${destination.height}`,
  );
  assert.equal(f.actions.skipFlight(), true);
  assert.ok(f.camera.positionCartographic.height >= 1900 - 1e-5);
  assert.deepEqual(
    positionTuple(f.camera.position),
    positionTuple(f.lastFlight.destination),
  );
});

test("guided destinations cannot bypass the maximum navigation height", () => {
  const f = fixture();
  assert.equal(f.actions.flyTo({ ...BEIJING, height: MAX_HEIGHT * 2 }), true);
  const destination = Cartographic.fromCartesian(
    f.lastFlight.destination,
    Ellipsoid.WGS84,
  );
  assert.ok(destination.height <= MAX_HEIGHT + 1e-5);
  f.actions.skipFlight();
  assert.ok(f.camera.positionCartographic.height <= MAX_HEIGHT + 1e-5);
});

test("invalid geographic destinations do not start or move the camera", () => {
  const f = fixture();
  const before = f.actions.capture();
  for (const patch of [
    { latitude: NaN },
    { latitude: 91 },
    { longitude: Infinity },
    { longitude: 181 },
    { height: NaN },
    { height: Infinity },
    { name: "  " },
  ]) {
    assert.equal(f.actions.flyTo({ ...BEIJING, ...patch }), false);
    assert.equal(f.actions.status().mode, "MANUAL");
    assert.deepEqual(f.actions.capture(), before);
  }
});
