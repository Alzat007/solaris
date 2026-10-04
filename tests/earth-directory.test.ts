import test from "node:test";
import assert from "node:assert/strict";
import {
  earthDirectory,
  earthDirectoryStats,
  getCountryEntry,
  getEarthCity,
  searchEarthCities,
  validateEarthDirectory,
  type EarthDirectory,
} from "../src/exploration/earthDirectory";

const copy = () => structuredClone(earthDirectory);

test("public directory retains its independent database license and full versioned download", () => {
  const license = earthDirectory.databaseLicense;
  assert.equal(license.id, "ODbL-1.0");
  assert.equal(license.url, "https://opendatacommons.org/licenses/odbl/1-0/");
  assert.match(license.attribution, /REST Countries and mledoze\/countries/);
  assert.match(license.attribution, /application code.*not covered/);
  assert.match(
    license.downloadUrl,
    /v3-public-preview-2026-10-04\/data\/earth-directory-source\.json$/,
  );
  const bad = copy();
  bad.databaseLicense.downloadUrl = "";
  assert.ok(
    validateEarthDirectory(bad).some((error) => /database license/.test(error)),
  );
});

test("the pinned whole-source baseline declares entries separately from capital relationships and content", () => {
  assert.deepEqual(validateEarthDirectory(earthDirectory), []);
  const stats = earthDirectoryStats();
  assert.equal(stats.countryEntries, 250);
  assert.equal(stats.entriesWithCapitals, 246);
  assert.equal(stats.capitalRelations, 249);
  assert.equal(stats.multiCapitalEntries, 2);
  assert.equal(stats.capitalCities, 247);
  assert.equal(stats.cities, 248);
  assert.equal(stats.featuredCities, 6);
  assert.equal(stats.pendingContentCities, 248);
  assert.match(earthDirectory.baseline.scope, /国家与地区/);
});

test("all source relationships keep unknown roles and dates explicit, including multiple capitals", () => {
  assert.equal(getCountryEntry("ZA")?.capitalRelations.length, 3);
  assert.equal(getCountryEntry("ps")?.capitalRelations.length, 2);
  assert.equal(getCountryEntry("aq")?.capitalRelations.length, 0);
  for (const country of earthDirectory.countries)
    for (const relation of country.capitalRelations) {
      assert.deepEqual(relation.roles, ["source-listed"]);
      assert.equal(relation.effectiveFrom, null);
      assert.equal(relation.effectiveTo, null);
      assert.ok(relation.notes);
      assert.ok(relation.sourceRefs.length);
    }
});

test("featured capitals are one city each, while New York is not tagged a current capital", () => {
  for (const id of ["city-beijing", "city-paris", "city-tokyo"])
    assert.deepEqual(getEarthCity(id)?.tags, ["capital", "featured"]);
  assert.deepEqual(getEarthCity("city-new-york")?.tags, ["featured"]);
  assert.equal(
    earthDirectory.cities.filter((city) => city.id === "city-beijing").length,
    1,
  );
  assert.deepEqual(getEarthCity("city-jerusalem")?.countryIds.sort(), [
    "il",
    "ps",
  ]);
  assert.deepEqual(getEarthCity("city-washington-dc")?.countryIds.sort(), [
    "um",
    "us",
  ]);
  assert.equal(
    getEarthCity("city-washington-dc")?.coordinates?.latitude,
    38.89,
  );
  assert.notDeepEqual(
    getEarthCity("city-kingston-jm")?.coordinates,
    getEarthCity("city-kingston-nf")?.coordinates,
  );
});

test("Chinese aliases, country names and normalized English aliases work with country and tag filters", () => {
  assert.deepEqual(
    searchEarthCities("北京市").map((city) => city.id),
    ["city-beijing"],
  );
  assert.deepEqual(
    searchEarthCities("  peking ").map((city) => city.id),
    ["city-beijing"],
  );
  assert.deepEqual(
    searchEarthCities("NYC").map((city) => city.id),
    ["city-new-york"],
  );
  assert.equal(
    searchEarthCities("中国", { countryId: "CN" })[0].id,
    "city-beijing",
  );
  assert.equal(searchEarthCities("纽约", { tag: "capital" }).length, 0);
  assert.equal(searchEarthCities("Paris", { countryId: "us" }).length, 0);
  assert.equal(
    searchEarthCities("", { countryId: "za", tag: "capital" }).length,
    3,
  );
  assert.equal(searchEarthCities("", { countryId: "xx" }).length, 0);
  assert.equal(searchEarthCities("", { tag: "featured" }).length, 6);
});

test("missing multi-capital coordinates remain unknown rather than becoming country-centre markers", () => {
  for (const id of [
    "city-pretoria",
    "city-bloemfontein",
    "city-cape-town",
    "city-ramallah",
  ])
    assert.equal(getEarthCity(id)?.coordinates, null);
  assert.equal(getEarthCity("city-beijing")?.coordinates?.latitude, 39.92);
  assert.equal(
    getEarthCity("city-new-york")?.coordinates?.longitude,
    -74.006111111111,
  );
});

test("directory validation rejects invalid IDs, duplicate cities and normalized duplicate aliases", () => {
  const badId = copy();
  badId.cities[0].id = "city BAD";
  assert.ok(
    validateEarthDirectory(badId).some((error) => /invalid ID/.test(error)),
  );
  const duplicate = copy();
  duplicate.cities.push(structuredClone(duplicate.cities[0]));
  assert.ok(
    validateEarthDirectory(duplicate).some((error) =>
      /duplicate (ID|city record)/.test(error),
    ),
  );
  const duplicateAlias = copy();
  duplicateAlias.cities[0].aliases = ["Sample", " SAMPLE "];
  assert.ok(
    validateEarthDirectory(duplicateAlias).some((error) =>
      /duplicate alias/.test(error),
    ),
  );
});

test("directory validation rejects bad coordinates, country associations, sources and false ready content", () => {
  const bad = copy();
  bad.cities[0].coordinates = { latitude: 95, longitude: Number.NaN };
  bad.cities[0].countryIds = ["xx"];
  bad.cities[0].sourceRefs = ["invented"];
  (bad.cities[0] as unknown as { contentStatus: string }).contentStatus =
    "ready";
  const errors = validateEarthDirectory(bad);
  assert.ok(errors.some((error) => /invalid coordinates/.test(error)));
  assert.ok(errors.some((error) => /unknown country/.test(error)));
  assert.ok(errors.some((error) => /unknown source/.test(error)));
  assert.ok(errors.some((error) => /cannot approve story/.test(error)));
});

test("directory validation rejects malformed dates, duplicate relationships and mismatched baseline counts", () => {
  const bad = copy();
  const country = bad.countries.find((item) => item.capitalRelations.length)!;
  const relation = country.capitalRelations[0];
  relation.effectiveFrom = "2026-02-30";
  country.capitalRelations.push(structuredClone(relation));
  bad.baseline.expectedCountryEntries++;
  const errors = validateEarthDirectory(bad);
  assert.ok(errors.some((error) => /invalid effective date/.test(error)));
  assert.ok(errors.some((error) => /duplicate relation/.test(error)));
  assert.ok(errors.some((error) => /entry count/.test(error)));
  assert.ok(errors.some((error) => /relationship count/.test(error)));
});

test("the raw importer rejects bad codes, duplicate capitals and invalid city coordinates", async () => {
  const url = new URL("../scripts/import-earth-directory.mjs", import.meta.url)
    .href;
  const { importEarthDirectory } = (await import(url)) as {
    importEarthDirectory: (source: unknown, sha256: string) => EarthDirectory;
  };
  const country = {
    cca2: "CN",
    name: { common: "China", official: "China" },
    translations: { zho: { common: "中国" } },
    capital: ["Beijing"],
    capitalInfo: { latlng: [39.92, 116.38] },
  };
  assert.throws(() =>
    importEarthDirectory([{ ...country, cca2: "bad" }], "test"),
  );
  assert.throws(() => importEarthDirectory([country, country], "test"));
  assert.throws(() =>
    importEarthDirectory(
      [{ ...country, capital: ["Beijing", " Beijing "] }],
      "test",
    ),
  );
  assert.throws(() =>
    importEarthDirectory(
      [{ ...country, capitalInfo: { latlng: [999, 0] } }],
      "test",
    ),
  );
  const result = importEarthDirectory([country], "test");
  assert.deepEqual(validateEarthDirectory(result), []);
  assert.equal(result.cities.length, 1);
});
