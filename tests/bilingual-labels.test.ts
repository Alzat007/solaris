import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mapping from "../data/bilingual-label-mapping.json" with { type: "json" };
import ui from "../data/bilingual-ui-candidates.json" with { type: "json" };
import {
  bilingualName,
  getBilingualAliases,
  getPendingBilingualCandidates,
  mergeBilingualLabel,
  uiText,
} from "../src/exploration/bilingualLabels";
import {
  earthDirectory,
  getEarthCity,
  searchEarthCities,
} from "../src/exploration/earthDirectory";
import {
  getPlanetAnnotations,
  getPlanetStory,
  getVisiblePlanetAnnotations,
  searchPlanetAnnotations,
} from "../src/exploration/planetAtlasCatalog";
import { PlanetAnnotations } from "../src/exploration/PlanetAnnotations";
import type { AtlasView } from "../src/exploration/earthAtlasProjection";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { planets } from "../src/data/planets";

test("explicit identity decisions cover all candidates without sequence inference", () => {
  const records = Object.values(mapping.mappings).flat();
  const count = (status: string) =>
    records.filter((x) => x.status === status).length;
  assert.equal(records.length, 235);
  assert.equal(count("confirmed"), 159);
  assert.equal(count("new"), 8);
  assert.equal(count("ambiguous"), 4);
  assert.equal(count("not_adopted"), 64);
  for (const records of Object.values(mapping.mappings)) {
    assert.equal(
      new Set(records.map((x) => x.externalId)).size,
      records.length,
    );
    for (const record of records) {
      assert.ok(record.identityBasis);
      if (record.status !== "confirmed") {
        assert.equal(record.currentId, null);
        assert.equal(record.runtimeEligible, false);
      }
    }
  }
});

test("same-object conflicts keep both existing names and nested content references", () => {
  const gallery = Object.freeze([{ path: "existing.jpg", license: "CC BY" }]);
  const review = Object.freeze({ humanReview: "pending" });
  const original = Object.freeze({
    id: "city-washington-dc",
    name: Object.freeze({ zh: "华盛顿", en: "Washington, D.C." }),
    latitude: 38.9,
    longitude: -77.03,
    gallery,
    review,
    storyId: "original-story",
    capital: true,
  });
  const result = mergeBilingualLabel(original);
  assert.equal(result.id, original.id);
  assert.strictEqual(result.name, original.name);
  assert.strictEqual(result.gallery, gallery);
  assert.strictEqual(result.review, review);
  assert.equal(result.latitude, original.latitude);
  assert.equal(result.longitude, original.longitude);
  assert.equal(result.storyId, original.storyId);
  assert.equal(result.capital, original.capital);
  assert.ok(result.aliases?.includes("华盛顿哥伦比亚特区"));
});

test("only a missing locale on an explicitly confirmed ID can be filled", () => {
  const original = Object.freeze({
    id: "city-beijing",
    name: Object.freeze({ zh: "北京", en: "" }),
    coordinates: null,
    images: Object.freeze([]),
  });
  const result = mergeBilingualLabel(original);
  assert.deepEqual(result.name, { zh: "北京", en: "Beijing" });
  assert.equal(original.name.en, "");
  assert.strictEqual(result.coordinates, original.coordinates);
  assert.strictEqual(result.images, original.images);
});

test("nonempty current names and UI text are never treated as candidate placeholders", () => {
  const original = Object.freeze({
    id: "city-beijing",
    name: Object.freeze({ zh: "<现有名称>", en: "Existing <name>" }),
  });
  assert.strictEqual(mergeBilingualLabel(original).name, original.name);
  assert.equal(
    uiText("overview", "en", { zh: "现有简介", en: "<Existing text>" }),
    "<Existing text>",
  );
});

test("external IDs, new objects and ambiguous entries never activate content", () => {
  for (const id of [
    "earth-city-beijing",
    "mercury-rembrandt-basin",
    "mars-mars-3-mission",
    "jupiter-equatorial-zone",
    "earth-city-johannesburg",
    "city-unknown",
  ]) {
    const original = Object.freeze({
      id,
      name: Object.freeze({ zh: "", en: "" }),
    });
    assert.strictEqual(mergeBilingualLabel(original), original);
    assert.deepEqual(getBilingualAliases(id), []);
  }
  assert.equal(getPendingBilingualCandidates().length, 12);
  assert.equal(getPlanetAnnotations("earth").length, 52);
  assert.equal(getPlanetAnnotations("mercury").length, 2);
});

test("repeated merges preserve ordering and cannot duplicate aliases or entities", () => {
  const entries = [
    ...earthDirectory.cities,
    ...planets.flatMap((planet) => getPlanetAnnotations(planet.id)),
    ...getVisiblePlanetAnnotations("earth", "city-tokyo"),
  ];
  for (const entry of entries) {
    const once = mergeBilingualLabel(entry);
    const twice = mergeBilingualLabel(once);
    assert.deepEqual(twice, once);
    assert.strictEqual(twice, once);
    assert.equal(twice.id, entry.id);
  }
});

test("existing aliases are retained, case variants of existing names are not added", () => {
  const original = {
    id: "city-beijing",
    name: { zh: "北京", en: "BEIJING" },
    aliases: ["Peking", "用户别名"],
  };
  assert.strictEqual(mergeBilingualLabel(original), original);
  assert.deepEqual(original.aliases, ["Peking", "用户别名"]);
});

test("Raditladi retains its own identity and never borrows Rembrandt metadata", () => {
  const entry = getPlanetAnnotations("mercury").find(
    (x) => x.id === "region-mercury-raditladi",
  )!;
  const story = getPlanetStory("mercury", entry.id)!;
  assert.equal(entry.name.en, "Raditladi Basin");
  assert.equal(story.name.en, "Raditladi Basin");
  assert.deepEqual(searchPlanetAnnotations("mercury", "Rembrandt"), []);
  assert.ok(story.gallery.length >= 2);
  assert.deepEqual(getBilingualAliases(entry.id), []);
});

test("directory alias supplementation never promotes a city to available story", () => {
  const city = getEarthCity("city-bern")!;
  assert.equal(city.contentStatus, "pending");
  assert.ok(searchEarthCities("Berne").some((x) => x.id === city.id));
  assert.equal(
    getPlanetAnnotations("earth").some((x) => x.id === city.id),
    false,
  );
  const legacy = getPlanetStory("earth", city.id)!;
  assert.deepEqual(legacy.gallery, []);
  assert.deepEqual(legacy.events, []);
  assert.equal(legacy.humanReview, "pending");
});

test("explicit aliases match accent and Markdown spelling without changing displayed names", () => {
  for (const query of ["Sensō-ji Temple", "Senso-ji Temple", "Sensoji"]) {
    const found = searchPlanetAnnotations("earth", query, "city-tokyo");
    assert.ok(found.some((x) => x.id === "city-landmark-tokyo-sensoji"));
  }
  const story = getPlanetStory("earth", "city-landmark-tokyo-sensoji")!;
  assert.equal(story.name.en, "Senso-ji");
});

test("UI candidates preserve existing phrases and only fill missing locale text", () => {
  const original = Object.freeze({
    zh: "返回太阳系",
    en: "Return to solar system",
  });
  assert.equal(uiText("backToSolarSystem", "en", original), original.en);
  assert.equal(
    uiText("zoomIn", "en", { zh: "放大", en: "Zoom in" }),
    "Zoom in",
  );
  assert.equal(
    uiText("backToSolarSystem", "en", { zh: "返回太阳系", en: "" }),
    "Back to Solar System",
  );
  assert.deepEqual(original, {
    zh: "返回太阳系",
    en: "Return to solar system",
  });
});

test("31 UI candidates have complete locales and matching interpolation variables", () => {
  assert.equal(Object.keys(ui.ui).length, 31);
  const placeholders = (value: string) =>
    [...value.matchAll(/\{([^}]+)\}/g)].map((x) => x[1]).sort();
  for (const value of Object.values(ui.ui)) {
    assert.ok(value.zh.trim() && value.en.trim());
    assert.deepEqual(placeholders(value.zh), placeholders(value.en));
  }
});

test("Sun English fills the existing logical scene name without adding a planet", () => {
  assert.deepEqual(bilingualName("sun", { zh: "太阳", en: "" }), {
    zh: "太阳",
    en: "Sun",
  });
  assert.equal(planets.length, 8);
  assert.equal(
    planets.some((x) => String(x.id) === "sun"),
    false,
  );
  assert.equal(
    bilingualName("mercury", { zh: "水星", en: "MERCURY" }).en,
    "MERCURY",
  );
});

test("changing existing language state keeps IDs, selection, open story and motion unchanged", (t) => {
  const original = store.get();
  t.after(() => store.set(original));
  const motion = () => [
    particles.rotation,
    particles.targetRotation,
    particles.scale,
    particles.targetScale,
    ...particles.anchor.toArray(),
    ...particles.targetAnchor.toArray(),
  ];
  for (const planet of planets) {
    const storyId = getPlanetAnnotations(planet.id)[0].id;
    store.set({
      language: "zh",
      selected: planet.id,
      mode: "INFO_PANEL_OPEN",
      activeStoryId: storyId,
    });
    const before = store.get();
    const pose = motion();
    const ids = getPlanetAnnotations(planet.id).map((x) => x.id);
    for (const language of ["en", "zh"] as const) {
      store.set({ language });
      assert.deepEqual({ ...store.get(), language: before.language }, before);
      assert.deepEqual(motion(), pose);
      assert.deepEqual(
        getPlanetAnnotations(planet.id).map((x) => x.id),
        ids,
      );
      assert.equal(
        getPlanetStory(planet.id, store.get().activeStoryId!)?.id,
        storyId,
      );
    }
  }
});

test("annotation locale rendering changes text, never marker IDs or projected positions", () => {
  const entry = getPlanetAnnotations("earth").find(
    (x) => x.id === "city-beijing",
  )!;
  const view: AtlasView = {
    width: 900,
    height: 600,
    focusId: entry.id,
    scopeCityId: null,
    showBoundaries: true,
    countries: { state: "ready", featureCount: 0, lineCount: 0 },
    points: [{ id: entry.id, x: 400, y: 300, featured: true }],
    labels: [
      {
        id: entry.id,
        x: 400,
        y: 300,
        width: 120,
        height: 32,
        left: 420,
        top: 260,
        dx: 20,
        dy: -40,
        elbow: { x: 415, y: 275 },
        endpoint: { x: 420, y: 275 },
      },
    ],
  };
  const render = (language: "zh" | "en") =>
    renderToStaticMarkup(
      createElement(PlanetAnnotations, {
        entries: [entry],
        view,
        language,
        hoverId: null,
        label: "Labels",
        markerProps: (id: string, suffix = "") => ({
          className: "bilingual-test-marker",
          "data-gesture-id": `${id}${suffix}`,
        }),
      }),
    );
  const zh = render("zh"),
    en = render("en");
  assert.ok(zh.includes(entry.label.zh));
  assert.ok(en.includes(entry.label.en));
  for (const markup of [zh, en]) {
    assert.ok(markup.includes('data-gesture-id="city-beijing"'));
    assert.ok(markup.includes("left:420px;top:260px;width:120px;height:32px"));
    assert.ok(markup.includes('points="400,300 415,275 420,275"'));
  }
});
