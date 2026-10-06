import test from "node:test";
import assert from "node:assert/strict";
import {
  cityMarkers,
  cityTarget,
  earthCityMarkers,
  earthSites,
  earthStoryHotspots,
} from "../src/globeLab/earthLocations";
import { cities, type EarthCity } from "../src/exploration/earthDirectory";
import {
  EARTH_LABEL_SCALES,
  nextHotspotVisibility,
} from "../src/globeLab/hotspotVisibility";

test("Earth markers reuse coordinate-bearing cities, not invented landmarks or Mars records", () => {
  assert.equal(
    earthCityMarkers.length,
    cities.filter((city) => city.coordinates).length,
  );
  assert.ok(earthCityMarkers.some((city) => city.id === "city-paris"));
  assert.ok(earthSites.every((site) => site.bodyId === "earth"));
  assert.equal(earthStoryHotspots.length, 3);
  assert.ok(
    earthStoryHotspots.every((hotspot) => hotspot.humanReview === "pending"),
  );
});

test("a second catalog city has an independent camera target without inheriting Beijing stories", () => {
  const beijing = cityTarget("city-beijing", 100)!;
  const paris = cityTarget("city-paris", 100)!;
  assert.equal(beijing.longitude, earthSites[0].center.longitude);
  assert.equal(paris.longitude, 2.33);
  assert.equal(paris.latitude, 48.87);
  assert.equal(paris.name, "巴黎");
  assert.equal(paris.height, 30_000);
  assert.equal(
    earthSites.filter((site) => site.cityId === "city-paris").length,
    0,
  );
  assert.equal(cityTarget("city-paris", 250_000)!.height, 500_000);
  assert.equal(cityTarget("missing", 100), null);
  assert.equal(cityTarget("city-paris", NaN), null);
});

test("invalid or absent coordinates cannot create a city marker", () => {
  const original = cities[0];
  const bad = [
    null,
    { latitude: NaN, longitude: 2 },
    { latitude: 0, longitude: 181 },
  ].map((coordinates) => ({ ...original, coordinates }) as EarthCity);
  assert.deepEqual(cityMarkers(bad), []);
});

test("city and story layers use pixel scale with a stable nonoverlapping close range", () => {
  for (const mode of ["ion", "local"] as const) {
    const scales = EARTH_LABEL_SCALES[mode];
    assert.equal(nextHotspotVisibility(false, 20_000, scales.city), false);
    assert.equal(nextHotspotVisibility(false, 3000, scales.city), true);
    assert.equal(
      nextHotspotVisibility(false, scales.story.showBelow, scales.city),
      false,
    );
    assert.equal(
      nextHotspotVisibility(false, scales.story.showBelow, scales.story),
      true,
    );
    assert.equal(
      nextHotspotVisibility(true, scales.city.hideBelow, scales.city),
      false,
    );
    assert.equal(
      nextHotspotVisibility(false, scales.city.showAbove - 1, scales.city),
      false,
    );
    assert.equal(
      nextHotspotVisibility(true, scales.city.showAbove - 1, scales.city),
      true,
    );
  }
});

test("the same camera/marker template accepts another content site's own coordinates", () => {
  const paris = earthCityMarkers.find((city) => city.id === "city-paris")!;
  const fixture = {
    ...earthSites[0],
    id: "synthetic-test-only",
    cityId: paris.id,
    center: { latitude: 48.8, longitude: 2.3 },
    hotspots: [],
  };
  assert.equal(cityTarget(paris.id, 100, [paris], [fixture])!.latitude, 48.8);
  assert.equal(cityTarget(paris.id, 100, [paris], [fixture])!.longitude, 2.3);
});
