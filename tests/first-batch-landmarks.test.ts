import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Group, PerspectiveCamera, Vector3 } from "three";
import { firstBatchCities } from "../src/exploration/firstBatchEarth";
import {
  cityLandmarks,
  getCityLandmarks,
  pendingCityLandmarks,
} from "../src/exploration/cityLandmarks";
import {
  getPlanetAnnotation,
  getPlanetStory,
  getVisiblePlanetAnnotations,
} from "../src/exploration/planetAtlasCatalog";
import { projectAtlasCities } from "../src/exploration/earthAtlasProjection";
import { facingRotation } from "../src/exploration/sceneState";
import {
  isPlanetStoryOpen,
  isPlanetAtlasVisible,
} from "../src/exploration/planetAtlasState";

test("the first batch contains all 58 requested city landmarks, with no empty story entries", () => {
  assert.equal(cityLandmarks.length, 58);
  assert.equal(pendingCityLandmarks.length, 0);
  assert.equal(new Set(cityLandmarks.map((landmark) => landmark.id)).size, 58);
  assert.equal(
    new Set(cityLandmarks.map((landmark) => landmark.cityId)).size,
    16,
  );
  for (const landmark of cityLandmarks) {
    assert.ok(firstBatchCities.some((city) => city.id === landmark.cityId));
    assert.ok(landmark.gallery.length >= 2, landmark.id);
    assert.ok(landmark.sourceUrls.length >= 2, landmark.id);
    assert.equal(landmark.humanReview, "pending");
    assert.ok(landmark.introduction.zh && landmark.introduction.en);
    assert.equal(getPlanetStory("earth", landmark.id), landmark);
    assert.equal(getPlanetStory("mars", landmark.id), undefined);
    assert.equal(
      getPlanetAnnotation("earth", landmark.id)?.cityId,
      landmark.cityId,
    );
  }
});

test("real landmark photos match source checksums, distinct original files and stated licenses", () => {
  const records = JSON.parse(
    readFileSync(
      new URL(
        "../public/exploration/first-batch/landmarks/source-records.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const record of records) {
    assert.equal(record.images.length, 2, record.id);
    assert.equal(
      new Set(
        record.images.map((image: { sourceSha1: string }) => image.sourceSha1),
      ).size,
      2,
      record.id,
    );
    assert.equal(
      new Set(record.images.map((image: { sha256: string }) => image.sha256))
        .size,
      2,
      record.id,
    );
    for (const image of record.images) {
      const bytes = readFileSync(
        new URL(`../public/${image.path}`, import.meta.url),
      );
      assert.equal(bytes[0], 0xff);
      assert.equal(bytes[1], 0xd8);
      assert.equal(bytes.length, image.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        image.sha256,
      );
      assert.ok(
        image.sourceUrl.startsWith("https://commons.wikimedia.org/wiki/File:"),
      );
      assert.match(image.license, /^(CC BY|CC0|Public domain)/);
      assert.ok(image.author.trim());
      assert.ok(image.licenseUrl.startsWith("https://"));
    }
  }
});

test("each city scope has only its own landmarks, while the original world directory remains separate", () => {
  assert.equal(getVisiblePlanetAnnotations("earth", null).length, 52);
  for (const city of firstBatchCities) {
    const entries = getVisiblePlanetAnnotations("earth", city.id);
    assert.equal(entries[0].id, city.id);
    assert.deepEqual(
      entries.slice(1).map((entry) => entry.id),
      getCityLandmarks(city.id).map((landmark) => landmark.id),
    );
    assert.ok(entries.slice(1).every((entry) => entry.cityId === city.id));
  }
  const beijing = getVisiblePlanetAnnotations("earth", "city-beijing");
  assert.equal(beijing.length, 6);
  assert.equal(getVisiblePlanetAnnotations("earth", "city-shanghai").length, 5);
  assert.equal(
    getVisiblePlanetAnnotations("mars", "city-beijing").some((entry) =>
      entry.id.startsWith("city-"),
    ),
    false,
  );
});

test("landmark labels follow the existing globe transform and never project through its back", () => {
  const camera = new PerspectiveCamera(45, 1440 / 960, 0.1, 100);
  camera.position.set(0, 3.5, 17);
  camera.lookAt(new Vector3(0, 0, 0));
  const body = new Group();
  body.scale.setScalar(2.6);
  const entries = getVisiblePlanetAnnotations("earth", "city-beijing");
  const rotation = facingRotation(39.92, 116.38);
  body.rotation.set(rotation.x, rotation.y, 0);
  const viewport = {
    width: 1440,
    height: 960,
    insetTop: 220,
    insetBottom: 160,
  };
  const first = projectAtlasCities(
    camera,
    body,
    entries,
    viewport,
    "city-landmark-beijing-tiananmen",
  );
  assert.ok(
    first.labels.some(
      (label) => label.id === "city-landmark-beijing-tiananmen",
    ),
  );
  body.rotation.y += 0.1;
  const changed = projectAtlasCities(camera, body, entries, viewport);
  assert.notEqual(first.points[0].x, changed.points[0].x);
  body.rotation.y += Math.PI;
  assert.equal(
    projectAtlasCities(camera, body, entries, viewport).points.length,
    0,
  );
});

test("Earth landmarks share modal ownership and retain the current Earth background", () => {
  const state = {
    selected: "earth" as const,
    mode: "INFO_PANEL_OPEN" as const,
    activeStoryId: "city-landmark-beijing-tiananmen",
  };
  assert.equal(isPlanetStoryOpen(state), true);
  assert.equal(isPlanetAtlasVisible(state), true);
  assert.equal(isPlanetStoryOpen({ ...state, selected: "mars" }), false);
});

test("every requested landmark has separate factual sources and a locked photo snapshot", () => {
  const load = (path: string) =>
    JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
  const specs = load("../data/first-batch-landmark-spec.json");
  const facts = load("../data/first-batch-landmark-facts.json");
  const review = load("../data/first-batch-landmark-review.json");
  assert.deepEqual(
    Object.keys(facts).sort(),
    specs.map((spec: { id: string }) => spec.id).sort(),
  );
  for (const spec of specs) {
    assert.equal(review[spec.id].length, 2);
    assert.ok(facts[spec.id].length >= 1);
    assert.ok(
      facts[spec.id].every((url: string) => new URL(url).protocol === "https:"),
    );
  }
  // The misnamed food photo cannot inherit the landmark's successful audit.
  assert.equal(
    Object.values(review)
      .flat()
      .includes("4007026ce1ad94775eed30efe7562a10d974ee09"),
    false,
  );
});

test("corrected landmark captions distinguish source dates, context and garden interiors", () => {
  const tower = getCityLandmarks("city-seoul").find((entry) =>
    entry.id.endsWith("seoul-namsan-tower"),
  )!;
  assert.match(tower.gallery[0].caption.zh, /不是塔楼近景/);
  assert.match(tower.gallery[1].caption.zh, /2008-09-26/);
  const garden = getCityLandmarks("city-shanghai").find((entry) =>
    entry.id.endsWith("shanghai-yu-garden"),
  )!;
  assert.match(garden.gallery[0].caption.zh, /豫园内部/);
  assert.match(garden.gallery[1].caption.zh, /内园古戏台/);
});
