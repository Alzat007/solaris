import assert from "node:assert/strict";
import test from "node:test";
import { Group, OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { InteractionStateMachine } from "../src/interaction/InteractionStateMachine";
import type { EarthCity } from "../src/exploration/earthDirectory";
import {
  atlasCities,
  buildAtlasCities,
  featuredAtlasIds,
  getAtlasCity,
  getAtlasStory,
  type AtlasCity,
} from "../src/exploration/earthAtlasCatalog";
import {
  EarthAtlasRotation,
  isEarthAtlasVisible,
  isEarthStoryOpen,
  usesLightEarth,
} from "../src/exploration/earthAtlasState";
import {
  earthAtlasView,
  projectAtlasCities,
} from "../src/exploration/earthAtlasProjection";
import { facingRotation } from "../src/exploration/sceneState";

const stepOptions = {
  delta: 1 / 60,
  dragDelta: 0,
  automatic: false,
  dragging: false,
  paused: false,
};

function initializedRotation() {
  const body = new Group();
  const rotation = new EarthAtlasRotation();
  assert.equal(rotation.focus(0, -90), true);
  rotation.step(body, stepOptions);
  return { body, rotation };
}

function city(id: string, longitude = -90, latitude = 0): AtlasCity {
  return {
    id,
    latitude,
    longitude,
    name: { zh: id, en: id },
    label: { zh: id, en: id },
    countryName: { zh: "测试", en: "Test" },
    featured: false,
    capital: true,
  };
}

function perspectiveCamera(width = 800, height = 600) {
  const camera = new PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

test("light Earth is the default while explicit map/ion routes remain available", () => {
  assert.equal(usesLightEarth(""), true);
  assert.equal(usesLightEarth("?qa=1&v=anything"), true);
  assert.equal(usesLightEarth("?earth=atlas"), true);
  assert.equal(usesLightEarth("?earth=map"), false);
  assert.equal(usesLightEarth("?data=ion"), false);
});

test("automatic Earth rotation advances only when no manual drag is being applied", () => {
  const { body, rotation } = initializedRotation();
  const initial = body.rotation.y;
  assert.equal(
    rotation.step(body, { ...stepOptions, delta: 1, automatic: true }),
    false,
  );
  assert.ok(Math.abs(body.rotation.y - initial - 0.05 * 0.012) < 1e-12);
  const automaticPose = body.rotation.y;
  assert.equal(
    rotation.step(body, { ...stepOptions, automatic: true, dragDelta: 0.3 }),
    true,
  );
  assert.ok(Math.abs(body.rotation.y - automaticPose - 0.3) < 1e-12);
  const manualPose = body.rotation.y;
  assert.equal(
    rotation.step(body, { ...stepOptions, automatic: true, dragging: true }),
    true,
  );
  assert.equal(body.rotation.y, manualPose);
});

test("manual pitch/yaw are retained with automatic rotation disabled and pitch is bounded", () => {
  const { body, rotation } = initializedRotation();
  const initialPitch = body.rotation.x;
  rotation.dragPitch(0.1);
  assert.equal(
    rotation.step(body, { ...stepOptions, automatic: true, dragDelta: -0.2 }),
    true,
  );
  assert.ok(Math.abs(body.rotation.x - initialPitch - 0.4) < 1e-12);
  assert.ok(Math.abs(body.rotation.y + 0.2) < 1e-12);
  for (let i = 0; i < 20; i += 1) {
    rotation.dragPitch(100);
    rotation.step(body, stepOptions);
  }
  assert.equal(body.rotation.x, 1.48);
  for (let i = 0; i < 20; i += 1) {
    rotation.dragPitch(-100);
    rotation.step(body, stepOptions);
  }
  assert.equal(body.rotation.x, -1.48);
  const pose = body.quaternion.clone();
  rotation.dragPitch(NaN);
  rotation.dragPitch(Infinity);
  rotation.step(body, { ...stepOptions, dragDelta: NaN });
  assert.deepEqual(body.quaternion.toArray(), pose.toArray());
});

test("paused frames and a manual resume preserve the exact latest Earth pose", () => {
  const { body, rotation } = initializedRotation();
  rotation.dragPitch(0.03);
  rotation.step(body, { ...stepOptions, dragDelta: 0.72 });
  const saved = body.rotation.clone();
  for (let i = 0; i < 20; i += 1) {
    rotation.step(body, {
      ...stepOptions,
      automatic: true,
      dragging: true,
      dragDelta: 0.2,
      paused: true,
    });
    assert.deepEqual(body.rotation.toArray(), saved.toArray());
  }
  rotation.step(body, stepOptions);
  assert.deepEqual(body.rotation.toArray(), saved.toArray());
});

test("discarding queued focus and pitch preserves the current pose after a story closes", () => {
  for (const initialized of [false, true]) {
    const body = new Group();
    const rotation = new EarthAtlasRotation();
    if (initialized) rotation.step(body, stepOptions);
    body.rotation.set(0.31, 0.87, 0.12);
    const saved = body.rotation.toArray();
    assert.equal(rotation.focus(48.87, 2.33), true);
    rotation.dragPitch(0.035);
    rotation.discardPending();
    rotation.step(body, { ...stepOptions, paused: true });
    assert.deepEqual(body.rotation.toArray(), saved);
    rotation.step(body, stepOptions);
    assert.deepEqual(body.rotation.toArray(), saved);
    assert.equal(rotation.focus(35.67, 139.75), true);
    rotation.step(body, stepOptions);
    const next = facingRotation(35.67, 139.75);
    assert.equal(body.rotation.x, next.x);
    assert.equal(body.rotation.y, next.y);
    assert.equal(body.rotation.z, 0);
  }
});

test("invalid geographic targets are rejected without replacing the latest valid target", () => {
  const body = new Group();
  const rotation = new EarthAtlasRotation();
  assert.equal(rotation.focus(48.87, 2.33), true);
  for (const [lat, lon] of [
    [91, 0],
    [-91, 0],
    [0, 181],
    [0, -181],
    [NaN, 0],
    [0, Infinity],
  ]) {
    assert.equal(rotation.focus(lat, lon), false);
  }
  rotation.step(body, stepOptions);
  const expected = facingRotation(48.87, 2.33);
  assert.ok(Math.abs(body.rotation.x - expected.x) < 1e-12);
  assert.ok(Math.abs(body.rotation.y - expected.y) < 1e-12);
  assert.equal(rotation.focus(90, 180), true);
  assert.equal(rotation.focus(-90, -180), true);
});

test("atlas visibility distinguishes Earth city stories from old local hotspots", () => {
  const overview = {
    selected: "earth" as const,
    mode: "PLANET_OVERVIEW" as const,
    activeStoryId: null,
  };
  assert.equal(isEarthAtlasVisible(overview), true);
  assert.equal(isEarthStoryOpen(overview), false);
  assert.equal(isEarthAtlasVisible({ ...overview, selected: "mars" }), false);
  assert.equal(
    isEarthAtlasVisible({ ...overview, mode: "PLANET_TRANSITION" }),
    false,
  );
  const story = {
    ...overview,
    mode: "INFO_PANEL_OPEN" as const,
    activeStoryId: "city-beijing",
  };
  assert.equal(isEarthStoryOpen(story), true);
  assert.equal(isEarthAtlasVisible(story), true);
  assert.equal(
    isEarthStoryOpen({ ...story, activeStoryId: "beijing-tiananmen" }),
    false,
  );
  assert.equal(isEarthAtlasVisible({ ...story, activeStoryId: null }), false);
});

test("245 unique atlas cities retain valid coordinates and exactly ten featured stories", () => {
  assert.equal(atlasCities.length, 245);
  assert.equal(new Set(atlasCities.map((entry) => entry.id)).size, 245);
  assert.deepEqual(
    new Set(
      atlasCities.filter((entry) => entry.featured).map((entry) => entry.id),
    ),
    new Set(featuredAtlasIds),
  );
  for (const entry of atlasCities) {
    assert.ok(
      Number.isFinite(entry.latitude) && Math.abs(entry.latitude) <= 90,
    );
    assert.ok(
      Number.isFinite(entry.longitude) && Math.abs(entry.longitude) <= 180,
    );
    assert.ok(
      entry.name.zh && entry.name.en && entry.label.zh && entry.label.en,
    );
  }
  assert.equal(getAtlasCity("city-shanghai")?.capital, false);
  assert.equal(getAtlasCity("missing-city"), undefined);
  assert.equal(getAtlasStory("missing-city"), undefined);
});

test("ten story entries have galleries and dated events, while other entries remain honest metadata only", () => {
  const complete = atlasCities.filter(
    (entry) => getAtlasStory(entry.id)!.events.length > 0,
  );
  assert.equal(complete.length, 10);
  for (const entry of complete) {
    const story = getAtlasStory(entry.id)!;
    assert.ok(story.gallery.length >= 2);
    assert.ok(story.introduction.zh && story.introduction.en);
    assert.ok(
      story.events.every((event) => event.date && event.sourceUrls.length > 0),
    );
    assert.equal(story.humanReview, "pending");
  }
  const directoryOnly = atlasCities.filter(
    (entry) => !complete.includes(entry),
  );
  assert.equal(directoryOnly.length, 235);
  for (const entry of directoryOnly) {
    const story = getAtlasStory(entry.id)!;
    assert.deepEqual(story.gallery, []);
    assert.deepEqual(story.events, []);
    assert.deepEqual(story.paragraphs, []);
    assert.equal(story.image, undefined);
    assert.equal(story.date, "");
    assert.equal(story.humanReview, "pending");
    assert.match(story.relation.zh, /尚未录入/);
    assert.match(story.relation.en, /not a completed story entry/);
    assert.match(story.introduction.en, /pending individual review/);
  }
});

test("catalog filtering cannot create markers from absent, nonfinite or out-of-range coordinates", () => {
  const directoryCity = {
    id: "city-test-valid",
    name: { zh: "测试", en: "Test" },
    countryIds: ["cn"],
    tags: ["capital"],
    coordinates: { latitude: 0, longitude: 0 },
  } as EarthCity;
  const bad = [
    null,
    { latitude: NaN, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: 0, longitude: Infinity },
  ].map(
    (coordinates, i) =>
      ({
        ...directoryCity,
        id: `city-test-bad-${i}`,
        coordinates,
      }) as EarthCity,
  );
  const built = buildAtlasCities([directoryCity, ...bad]);
  assert.deepEqual(
    new Set(built.map((entry) => entry.id)),
    new Set(["city-test-valid", "city-shanghai"]),
  );
  assert.ok(
    built
      .find((entry) => entry.id === directoryCity.id)
      ?.label.zh.includes("中国"),
  );
});

test("world projection follows body rotation and removes labels on the far side of Earth", () => {
  const camera = perspectiveCamera();
  const body = new Group();
  const entries = [city("front", -90), city("back", 90)];
  const first = projectAtlasCities(camera, body, entries, {
    width: 800,
    height: 600,
  });
  assert.deepEqual(
    first.points.map((point) => point.id),
    ["front"],
  );
  assert.ok(Math.abs(first.points[0].x - 400) < 1e-10);
  assert.ok(Math.abs(first.points[0].y - 300) < 1e-10);
  assert.equal(first.labels[0].id, "front");
  body.rotation.y = 0.25;
  const moved = projectAtlasCities(camera, body, entries, {
    width: 800,
    height: 600,
  });
  assert.ok(moved.points[0].x > first.points[0].x + 20);
  body.rotation.y = Math.PI;
  const reversed = projectAtlasCities(camera, body, entries, {
    width: 800,
    height: 600,
  });
  assert.deepEqual(
    reversed.points.map((point) => point.id),
    ["back"],
  );
  assert.deepEqual(
    reversed.labels.map((label) => label.id),
    ["back"],
  );
});

test("projection includes parent translation and uniform scale instead of treating Earth as world origin", () => {
  const parent = new Group();
  parent.position.set(2, 1, -1);
  parent.scale.setScalar(1.7);
  const body = new Group();
  parent.add(body);
  const camera = perspectiveCamera();
  camera.position.copy(parent.position).add(new Vector3(0, 0, 6));
  camera.lookAt(parent.position);
  const projected = projectAtlasCities(camera, body, [city("city-center")], {
    width: 800,
    height: 600,
  });
  assert.equal(projected.points.length, 1);
  assert.ok(Math.abs(projected.points[0].x - 400) < 1e-10);
  assert.ok(Math.abs(projected.points[0].y - 300) < 1e-10);
});

test("view/frustum boundaries reject offscreen anchors and keep mobile labels inside reserved UI space", () => {
  const body = new Group();
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 100);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const clipped = projectAtlasCities(
    camera,
    body,
    [city("center"), city("outside", -30)],
    { width: 800, height: 600 },
  );
  assert.deepEqual(
    clipped.points.map((point) => point.id),
    ["center"],
  );
  camera.far = 2;
  camera.updateProjectionMatrix();
  assert.deepEqual(
    projectAtlasCities(camera, body, [city("center")], {
      width: 800,
      height: 600,
    }).points,
    [],
  );
  const perspective = perspectiveCamera(390, 844);
  const many = Array.from({ length: 16 }, (_, i) =>
    city(`city-${i}`, -110 + i * 3, -30 + (i % 6) * 12),
  );
  const mobile = projectAtlasCities(perspective, body, many, {
    width: 390,
    height: 844,
    insetTop: 100,
    insetBottom: 120,
  });
  assert.ok(mobile.labels.length > 0 && mobile.labels.length <= 5);
  for (const label of mobile.labels) {
    assert.ok(label.left >= 12 && label.left + label.width <= 390 - 12);
    assert.ok(label.top >= 100 && label.top + label.height <= 844 - 120);
  }
  assert.deepEqual(
    projectAtlasCities(perspective, body, many, { width: 0, height: 0 }).points,
    [],
  );
});

test("a focused city takes label priority, and overlay state patches retain boundary visibility", () => {
  const body = new Group();
  const entries = [
    city("ordinary"),
    { ...city("featured"), featured: true },
    city("focused"),
  ];
  const projected = projectAtlasCities(
    perspectiveCamera(),
    body,
    entries,
    { width: 800, height: 600 },
    "focused",
  );
  assert.equal(projected.labels[0].id, "focused");
  const saved = earthAtlasView.get();
  let notifications = 0;
  const unsubscribe = earthAtlasView.subscribe(() => (notifications += 1));
  try {
    earthAtlasView.set({ showBoundaries: false });
    earthAtlasView.set({ points: projected.points, labels: projected.labels });
    assert.equal(earthAtlasView.get().showBoundaries, false);
    assert.equal(notifications, 2);
    unsubscribe();
    earthAtlasView.set({ showBoundaries: true });
    assert.equal(notifications, 2);
  } finally {
    unsubscribe();
    earthAtlasView.set(saved);
  }
});

test("overview and INFO story panels close to their exact FSM origin without entering a local location", () => {
  const machine = new InteractionStateMachine();
  assert.equal(machine.send("READY"), true);
  assert.equal(machine.send("SELECT"), true);
  assert.equal(machine.send("TRANSITION_END"), true);
  assert.equal(machine.state, "PLANET_OVERVIEW");
  assert.equal(machine.send("OPEN_HOTSPOT"), true);
  assert.equal(machine.state, "INFO_PANEL_OPEN");
  assert.equal(machine.send("OPEN_HOTSPOT"), false);
  assert.equal(machine.send("SELECT"), false);
  assert.equal(machine.send("CLOSE_HOTSPOT"), true);
  assert.equal(machine.state, "PLANET_OVERVIEW");
  assert.equal(machine.send("INFO"), true);
  assert.equal(machine.send("OPEN_HOTSPOT"), true);
  assert.equal(machine.send("CLOSE_HOTSPOT"), true);
  assert.equal(machine.state, "INFO");
});

test("legacy local exploration still closes its panel locally and returns to the original region picker", () => {
  const machine = new InteractionStateMachine();
  for (const event of [
    "READY",
    "SELECT",
    "TRANSITION_END",
    "BROWSE",
    "ENTER_LOCATION",
    "LOCATION_READY",
  ] as const) {
    assert.equal(machine.send(event), true);
  }
  assert.equal(machine.state, "LOCATION_OVERVIEW");
  assert.equal(machine.send("OPEN_HOTSPOT"), true);
  assert.equal(machine.send("CLOSE_HOTSPOT"), true);
  assert.equal(machine.state, "LOCATION_OVERVIEW");
  assert.equal(machine.send("LOCATION_CANCEL"), true);
  assert.equal(machine.state, "PLANET_REGION_PICKER");
  for (const event of [
    "RETURN",
    "BROWSE_EARTH",
    "PICK_CONTINENT",
    "PICK_COUNTRY",
    "ENTER_LOCATION",
    "LOCATION_READY",
  ] as const) {
    assert.equal(machine.send(event), true);
  }
  assert.equal(machine.send("OPEN_HOTSPOT"), true);
  assert.equal(machine.send("CLOSE_HOTSPOT"), true);
  assert.equal(machine.state, "LOCATION_OVERVIEW");
  assert.equal(machine.send("LOCATION_CANCEL"), true);
  assert.equal(machine.state, "EARTH_CITY_PICKER");
});
