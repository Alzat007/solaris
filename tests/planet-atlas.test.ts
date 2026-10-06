import assert from "node:assert/strict";
import test from "node:test";
import { Euler, Group, Matrix4, OrthographicCamera, Vector3 } from "three";
import { planets } from "../src/data/planets";
import { cityStories } from "../src/exploration/cityStories";
import { immersiveSites } from "../src/exploration/immersiveCatalog";
import { isGalleryStory } from "../src/exploration/galleryStory";
import {
  getPlanetAnnotations,
  getPlanetStory,
  planetStories,
  ringAnchor,
  type AtlasAnnotation,
} from "../src/exploration/planetAtlasCatalog";
import {
  getPlanetAtlasRotation,
  isPlanetAtlasVisible,
  isPlanetStoryOpen,
  isPlanetAutoRotating,
  setPlanetAutoRotate,
} from "../src/exploration/planetAtlasState";
import {
  atlasProjectionSignature,
  projectAtlasCities,
} from "../src/exploration/earthAtlasProjection";
import { store } from "../src/interaction/store";

test("all eight planets have separate annotations and real multi-image story records", () => {
  for (const planet of planets) {
    const entries = getPlanetAnnotations(planet.id);
    assert.ok(entries.length >= 2, `${planet.id} annotations`);
    const featured = entries.filter((entry) => entry.featured);
    assert.ok(featured.length >= 2);
    for (const entry of featured) {
      const story = getPlanetStory(planet.id, entry.id)!;
      assert.ok(isGalleryStory(story));
      assert.ok(story.gallery.length >= 2, entry.id);
      assert.equal(
        new Set(story.gallery.map((image) => image.path)).size,
        story.gallery.length,
      );
      assert.ok(story.events.length >= 1);
      assert.ok(
        story.sourceUrls.every((url) => new URL(url).protocol === "https:"),
      );
      assert.equal(story.humanReview, "pending");
      for (const event of story.events) {
        assert.ok(event.imageIndices.length >= 1);
        assert.ok(
          event.imageIndices.every(
            (index) => index >= 0 && index < story.gallery.length,
          ),
        );
      }
    }
  }
  assert.equal(
    new Set(planetStories.map((story) => story.id)).size,
    planetStories.length,
  );
});

test("shared gallery shape supports city, planet and legacy single-image content", () => {
  assert.equal(isGalleryStory(cityStories[0]), true);
  assert.equal(isGalleryStory(planetStories[0]), true);
  assert.equal(isGalleryStory(immersiveSites[0].hotspots[0]), false);
});

test("atlas visibility and modal ownership are validated for each selected body", () => {
  for (const planet of planets) {
    const entry = getPlanetAnnotations(planet.id)[0];
    const state = {
      selected: planet.id,
      mode: "PLANET_OVERVIEW" as const,
      activeStoryId: null,
    };
    assert.equal(isPlanetAtlasVisible(state), true);
    assert.equal(isPlanetStoryOpen(state), false);
    const open = {
      ...state,
      mode: "INFO_PANEL_OPEN" as const,
      activeStoryId: entry.id,
    };
    assert.equal(isPlanetStoryOpen(open), true);
    assert.equal(isPlanetAtlasVisible(open), true);
    assert.equal(
      isPlanetStoryOpen({ ...open, activeStoryId: "region-not-a-real-place" }),
      false,
    );
    assert.equal(
      isPlanetAtlasVisible({ ...state, mode: "DESCENT_TRANSITION" }),
      false,
    );
  }
  const mars = planetStories.find((story) => story.bodyId === "mars")!;
  assert.equal(getPlanetStory("jupiter", mars.id), undefined);
  assert.equal(
    isPlanetAtlasVisible({
      selected: null,
      mode: "SOLAR_SYSTEM",
      activeStoryId: null,
    }),
    false,
  );
});

test("automatic rotation settings and queued rotations are isolated between planets", () => {
  store.set({ earthAutoRotate: true, planetAutoRotate: {} });
  setPlanetAutoRotate("mars", false);
  assert.equal(isPlanetAutoRotating(store.get(), "mars"), false);
  assert.equal(isPlanetAutoRotating(store.get(), "jupiter"), true);
  assert.equal(isPlanetAutoRotating(store.get(), "earth"), true);
  setPlanetAutoRotate("earth", false);
  assert.equal(isPlanetAutoRotating(store.get(), "jupiter"), true);
  const mars = getPlanetAtlasRotation("mars");
  const jupiter = getPlanetAtlasRotation("jupiter");
  assert.notEqual(mars, jupiter);
  const body = new Group();
  jupiter.discardPending();
  mars.dragPitch(0.1);
  jupiter.step(body, {
    delta: 1 / 60,
    dragDelta: 0,
    automatic: false,
    dragging: false,
    paused: false,
  });
  assert.equal(body.rotation.x, 0);
  mars.discardPending();
});

test("Saturn ring anchors use the existing ring plane and are attached to its body transform", () => {
  const radius = 1.925;
  const anchor = new Vector3(...ringAnchor(radius, 40));
  assert.ok(Math.abs(anchor.length() - radius) < 1e-12);
  const untilted = anchor
    .clone()
    .applyMatrix4(
      new Matrix4().makeRotationFromEuler(new Euler(0.5, 0, -0.3)).invert(),
    );
  assert.ok(Math.abs(untilted.y) < 1e-12);
  assert.ok(
    planetStories
      .filter((story) => story.anchorKind === "ring")
      .every((story) => story.bodyId === "saturn"),
  );
});

test("ring annotations use sphere occlusion rather than hiding every far-side ring segment", () => {
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  const body = new Group();
  const entry = (
    id: string,
    position: [number, number, number],
  ): AtlasAnnotation => ({
    id,
    localPosition: position,
    latitude: 0,
    longitude: 0,
    name: { zh: id, en: id },
    label: { zh: id, en: id },
    featured: true,
    capital: false,
  });
  const view = projectAtlasCities(
    camera,
    body,
    [
      entry("outer-back", [2, 0, -1]),
      entry("occluded", [0.1, 0, -1.8]),
      entry("front", [0, 0, 1.8]),
    ],
    { width: 1000, height: 800, insetTop: 0, insetBottom: 0 },
  );
  assert.deepEqual(
    view.points.map((point) => point.id),
    ["outer-back", "front"],
  );
});

test("stationary annotation caches invalidate for language, label dimensions and reserved UI space", () => {
  const viewport = {
    width: 1920,
    height: 1080,
    language: "zh" as const,
    insetTop: 130,
    insetBottom: 160,
  };
  const view = { points: [], labels: [] };
  const initial = atlasProjectionSignature("jupiter", viewport, view);
  assert.notEqual(
    initial,
    atlasProjectionSignature("jupiter", { ...viewport, language: "en" }, view),
  );
  assert.notEqual(
    initial,
    atlasProjectionSignature("jupiter", { ...viewport, tv: true }, view),
  );
  assert.notEqual(
    initial,
    atlasProjectionSignature(
      "jupiter",
      { ...viewport, insetBottom: 170 },
      view,
    ),
  );
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  const entry: AtlasAnnotation = {
    id: "fixture",
    name: { zh: "短名", en: "A longer region name" },
    label: { zh: "短名", en: "A longer region name" },
    latitude: 0,
    longitude: -90,
    featured: true,
    capital: false,
  };
  const projected = projectAtlasCities(camera, new Group(), [entry], viewport);
  assert.ok(projected.labels.length > 0);
  const resized = {
    ...projected,
    labels: projected.labels.map((label) => ({
      ...label,
      width: label.width + 20,
    })),
  };
  assert.notEqual(
    atlasProjectionSignature("jupiter", viewport, projected),
    atlasProjectionSignature("jupiter", viewport, resized),
  );
});
