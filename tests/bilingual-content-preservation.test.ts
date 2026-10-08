import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import baseline from "../data/bilingual-content-baseline.json" with { type: "json" };
import { planets } from "../src/data/planets";
import { earthDirectory } from "../src/exploration/earthDirectory";
import {
  firstBatchCities,
  firstBatchCityStories,
  firstBatchContinents,
  firstBatchCountries,
  firstBatchPendingCityIds,
} from "../src/exploration/firstBatchEarth";
import {
  cityLandmarks,
  pendingCityLandmarks,
} from "../src/exploration/cityLandmarks";
import {
  getPlanetAnnotations,
  getPlanetStory,
  getVisiblePlanetAnnotations,
  planetStories,
} from "../src/exploration/planetAtlasCatalog";
import { atlasCities } from "../src/exploration/earthAtlasCatalog";
import { cityStories } from "../src/exploration/cityStories";
import { explorationContent } from "../src/exploration/content";
import { immersiveSites } from "../src/exploration/immersiveCatalog";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function withoutNames(
  value: object,
  keys: readonly string[] = ["name", "aliases"],
) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );
}

// New Moon content has its own audit tests; retain the immutable original baseline.
const originalPlanetIds = new Set(
  baseline.domains.planets.rows.map((row) => row.id),
);
const originalStoryIds = new Set(
  baseline.domains.planetStories.rows.map((row) => row.id),
);
const originalPlanets = planets.filter((entry) =>
  originalPlanetIds.has(entry.id),
);
const originalPlanetStories = planetStories.filter((entry) =>
  originalStoryIds.has(entry.id),
);

// Only the entry's own display name and aliases are excluded. Nested event text,
// captions, ownership, image order, anchors, rights and review remain protected.
const domains: Record<string, object[]> = {
  planets: originalPlanets.map((entry) =>
    withoutNames(entry, ["name", "chineseName"]),
  ),
  directoryMetadata: [withoutNames(earthDirectory, ["countries", "cities"])],
  directoryCountries: earthDirectory.countries.map((entry) =>
    withoutNames(entry),
  ),
  directoryCities: earthDirectory.cities.map((entry) => withoutNames(entry)),
  continents: firstBatchContinents.map((entry) => withoutNames(entry)),
  countries: firstBatchCountries.map((entry) => withoutNames(entry)),
  cities: firstBatchCities.map((entry) => withoutNames(entry)),
  cityStories: firstBatchCityStories.map((entry) => withoutNames(entry)),
  legacyCityStories: cityStories.map((entry) => withoutNames(entry)),
  landmarks: cityLandmarks.map((entry) => withoutNames(entry)),
  planetStories: originalPlanetStories.map((entry) => withoutNames(entry)),
  legacyAtlasCities: atlasCities.map((entry) => withoutNames(entry)),
  annotations: originalPlanets.map((planet) => ({
    id: planet.id,
    entries: getPlanetAnnotations(planet.id).map((entry) =>
      withoutNames(entry),
    ),
  })),
  scopes: firstBatchCities.map((city) => ({
    id: city.id,
    entries: getVisiblePlanetAnnotations("earth", city.id).map((entry) =>
      withoutNames(entry),
    ),
  })),
  resolvedStories: [
    ...firstBatchCityStories.map((story) => ({
      id: story.id,
      bodyId: "earth",
      story: withoutNames(getPlanetStory("earth", story.id)!),
    })),
    ...cityLandmarks.map((story) => ({
      id: story.id,
      bodyId: "earth",
      story: withoutNames(getPlanetStory("earth", story.id)!),
    })),
    ...originalPlanetStories.map((story) => ({
      id: story.id,
      bodyId: story.bodyId,
      story: withoutNames(getPlanetStory(story.bodyId, story.id)!),
    })),
  ],
  destinations: explorationContent.destinations.map((entry) =>
    withoutNames(entry),
  ),
  stories: explorationContent.stories,
  assets: explorationContent.assets,
  sources: explorationContent.sources,
  contentPacks: explorationContent.contentPacks,
  immersiveSites: immersiveSites.map((entry) => withoutNames(entry)),
  pending: [
    { id: "cities", ids: firstBatchPendingCityIds },
    { id: "landmarks", ids: pendingCityLandmarks.map((entry) => entry.id) },
  ],
};

const namedDomains = {
  planets: originalPlanets.map((planet) => ({
    id: planet.id,
    name: { zh: planet.chineseName, en: planet.name },
  })),
  directoryCountries: earthDirectory.countries,
  directoryCities: earthDirectory.cities,
  continents: firstBatchContinents,
  countries: firstBatchCountries,
  cities: firstBatchCities,
  cityStories: firstBatchCityStories,
  legacyCityStories: cityStories,
  landmarks: cityLandmarks,
  planetStories: originalPlanetStories,
  legacyAtlasCities: atlasCities,
  annotations: originalPlanets.flatMap((planet) =>
    getPlanetAnnotations(planet.id),
  ),
  scopes: firstBatchCities.flatMap((city) =>
    getVisiblePlanetAnnotations("earth", city.id),
  ),
  resolvedStories: [
    ...firstBatchCityStories.map((story) => getPlanetStory("earth", story.id)!),
    ...cityLandmarks.map((story) => getPlanetStory("earth", story.id)!),
    ...originalPlanetStories.map(
      (story) => getPlanetStory(story.bodyId, story.id)!,
    ),
  ],
  destinations: explorationContent.destinations,
  immersiveSites,
};

test("the labels-only baseline protects every original domain", () => {
  assert.equal(baseline.schemaVersion, 1);
  assert.deepEqual(Object.keys(domains), Object.keys(baseline.domains));
});

test("existing nonempty translations survive every catalog and story resolver", () => {
  assert.deepEqual(
    Object.keys(namedDomains),
    Object.keys(baseline.preservedNames),
  );
  for (const [domain, expected] of Object.entries(baseline.preservedNames)) {
    const rows = namedDomains[domain as keyof typeof namedDomains];
    assert.equal(rows.length, expected.length, domain);
    rows.forEach((row, index) => {
      assert.equal(row.id, expected[index].id, `${domain}[${index}]`);
      for (const locale of ["zh", "en"] as const) {
        const original = expected[index].name[locale];
        if (original?.trim()) {
          assert.equal(
            row.name[locale],
            original,
            `${domain}/${row.id}/${locale}: an existing translation was overwritten`,
          );
        }
      }
    });
  }
});

for (const [domain, expected] of Object.entries(baseline.domains)) {
  test(`bilingual labels preserve ${domain} IDs, relationships and non-name content`, () => {
    const rows = domains[domain];
    assert.equal(rows.length, expected.rows.length, `${domain} entry count`);
    rows.forEach((row, index) => {
      const id = "id" in row ? row.id : `row-${index}`;
      assert.equal(id, expected.rows[index].id, `${domain}[${index}] identity`);
      assert.equal(
        fingerprint(row),
        expected.rows[index].sha256,
        `${domain}/${String(id)} changed outside name/aliases`,
      );
    });
    assert.equal(fingerprint(rows), expected.sha256, domain);
  });
}

test("the names-only exception cannot hide anchor, text or image-review mutations", () => {
  const story = planetStories[0];
  const original = fingerprint(withoutNames(story));
  assert.equal(
    fingerprint(
      withoutNames({
        ...story,
        name: { zh: "label", en: "label" },
        aliases: [],
      }),
    ),
    original,
  );
  for (const changed of [
    { ...story, id: `${story.id}-changed` },
    { ...story, latitude: story.latitude + 0.1 },
    { ...story, humanReview: "approved" },
    { ...story, gallery: story.gallery.slice().reverse() },
    { ...story, events: [] },
  ]) {
    assert.notEqual(fingerprint(withoutNames(changed)), original);
  }
});

test("fact sources, copyright metadata and audit gates keep their original JSON", () => {
  for (const [path, expected] of Object.entries(baseline.jsonFiles)) {
    const value = JSON.parse(
      readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    );
    assert.equal(fingerprint(value), expected, path);
  }
});

test("original file protection remains active outside authorized presentation and additive Moon integration", () => {
  // Keep the historical baseline intact. Only the shared presentation and the
  // requested language display files are exempt; data, images, gesture recognition
  // and camera/input controllers stay locked outside the prior glass-panel scope.
  const presentationScope = new Set([
    "src/globeLab/GlobeStoryPanel.tsx",
    "src/globeLab/storyPanel.css",
    "src/interaction/InteractionController.ts",
    "src/ui/HUD.tsx",
    "src/ui/GestureHint.tsx",
    "src/ui/TextCommandInput.tsx",
    "src/planets/PlanetBase.tsx",
    // Remove the duplicate decorative Moon and register the selectable satellite.
    "src/planets/Earth.tsx",
    "src/scene/SolarSystem.tsx",
  ]);
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    if (presentationScope.has(path)) continue;
    const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      expected,
      path,
    );
  }
});

function imagePaths(folder: URL): string[] {
  return readdirSync(folder, { withFileTypes: true })
    .flatMap((entry) => {
      const path = new URL(entry.name, folder);
      return entry.isDirectory()
        ? imagePaths(new URL(`${entry.name}/`, folder))
        : /\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(entry.name)
          ? [decodeURIComponent(path.pathname).split("/public/")[1]]
          : [];
    })
    .sort();
}

test("all 249 existing exploration image files keep their exact bytes and paths", () => {
  assert.equal(baseline.images.length, 249);
  assert.deepEqual(
    imagePaths(new URL("../public/exploration/", import.meta.url)).filter(
      (path) => !path.startsWith("exploration/planets/moon/"),
    ),
    baseline.images.map((image) => image.path.replace(/^public\//, "")),
  );
  for (const image of baseline.images) {
    const bytes = readFileSync(new URL(`../${image.path}`, import.meta.url));
    assert.equal(bytes.length, image.bytes, image.path);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      image.sha256,
      image.path,
    );
  }
});
