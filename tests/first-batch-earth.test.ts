import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cityStories } from "../src/exploration/cityStories";
import { getCityLandmarks } from "../src/exploration/cityLandmarks";
import { getEarthCity } from "../src/exploration/earthDirectory";
import {
  firstBatchCities,
  firstBatchCityStories,
  firstBatchContinents,
  firstBatchCountries,
  firstBatchPendingCityIds,
  firstBatchReview,
} from "../src/exploration/firstBatchEarth";
import { isContentDate } from "../src/exploration/validateContent";

const expectedGroups = {
  asia: [
    "beijing",
    "shanghai",
    "shenzhen",
    "hangzhou",
    "hong-kong",
    "taipei",
    "tokyo",
    "kyoto",
    "sapporo",
    "seoul",
    "pyongyang",
    "singapore",
    "kuala-lumpur",
    "bangkok",
    "hanoi",
    "manila",
    "jakarta",
    "new-delhi",
  ],
  europe: [
    "london",
    "manchester",
    "paris",
    "berlin",
    "rome",
    "madrid",
    "barcelona",
    "moscow",
    "saint-petersburg",
  ],
  "north-america": [
    "washington-dc",
    "new-york",
    "los-angeles",
    "san-francisco",
    "chicago",
    "ottawa",
    "toronto",
    "vancouver",
    "mexico-city",
  ],
  "south-america": ["brasilia", "rio-de-janeiro", "sao-paulo", "buenos-aires"],
  oceania: ["canberra", "sydney", "melbourne", "wellington", "auckland"],
  africa: [
    "cairo",
    "abuja",
    "nairobi",
    "addis-ababa",
    "rabat",
    "algiers",
    "accra",
  ],
};
const records = JSON.parse(
  readFileSync(
    new URL(
      "../public/exploration/first-batch/cities/source-records.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const bytesFor = (path: string) =>
  readFileSync(new URL(`../public/${path}`, import.meta.url));
const digest = (path: string) =>
  createHash("sha256").update(bytesFor(path)).digest("hex");
const story = (slug: string) =>
  firstBatchCityStories.find((entry) => entry.id === `city-${slug}`)!;

test("the first batch has exactly the 52 selected cities in six navigation groups", () => {
  assert.equal(firstBatchCities.length, 52);
  assert.equal(new Set(firstBatchCities.map((city) => city.id)).size, 52);
  assert.equal(firstBatchContinents.length, 6);
  assert.equal(firstBatchCountries.length, 31);
  for (const [continentId, slugs] of Object.entries(expectedGroups)) {
    assert.deepEqual(
      firstBatchCities
        .filter((city) => city.continentId === continentId)
        .map((city) => city.id),
      slugs.map((slug) => `city-${slug}`),
    );
  }
  for (const city of firstBatchCities) {
    assert.equal(city.featured, true);
    assert.ok(city.name.zh && city.name.en && city.label.zh && city.label.en);
    assert.ok(city.countryName.zh && city.countryName.en);
    assert.match(city.countryId, /^[a-z]{2}$/);
    assert.ok(Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90);
    assert.ok(
      Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180,
    );
    assert.ok(
      city.sourceUrls.length > 0 &&
        city.sourceUrls.every((url) => url.startsWith("https://")),
    );
    const existing = getEarthCity(city.id);
    if (existing?.coordinates) {
      assert.equal(city.latitude, existing.coordinates.latitude, city.id);
      assert.equal(city.longitude, existing.coordinates.longitude, city.id);
    } else {
      assert.ok(
        city.sourceUrls.some((url) =>
          /^https:\/\/www.wikidata.org\/wiki\/Q\d+$/.test(url),
        ),
        city.id,
      );
    }
  }
});

test("country/territory navigation is explicit rather than an administrative-status decision", () => {
  for (const id of ["city-hong-kong", "city-taipei"]) {
    const city = firstBatchCities.find((entry) => entry.id === id)!;
    assert.equal(city.countryId, "cn");
    assert.equal(city.countryName.zh, "中国组");
    assert.equal(city.capital, false);
  }
  assert.match(
    firstBatchReview.groupingNote.zh,
    /编辑导航分组.*不是行政或政治地位判断/,
  );
  assert.match(
    firstBatchReview.groupingNote.en,
    /not a claim that all Russia is in Europe/,
  );
  assert.match(
    firstBatchReview.groupingNote.en,
    /not a current legal-status verification/,
  );
});

test("all selected cities have complete bilingual educational stories, without empty fallback entries", () => {
  assert.deepEqual(firstBatchPendingCityIds, []);
  assert.equal(firstBatchCityStories.length, 52);
  assert.deepEqual(
    firstBatchCityStories.map((entry) => entry.id),
    firstBatchCities.map((city) => city.id),
  );
  assert.equal(
    firstBatchCityStories.reduce(
      (count, entry) => count + entry.gallery.length,
      0,
    ),
    106,
  );
  for (const entry of firstBatchCityStories) {
    assert.equal(entry.humanReview, "pending");
    assert.equal(entry.coordinateAccuracy, "approximate");
    assert.ok(entry.introduction.zh.trim() && entry.introduction.en.trim());
    assert.ok(entry.relation.zh && entry.relation.en);
    assert.ok(entry.gallery.length >= 2, entry.id);
    assert.equal(
      new Set(entry.gallery.map((image) => image.path)).size,
      entry.gallery.length,
      entry.id,
    );
    assert.equal(
      new Set(entry.gallery.map((image) => digest(image.path))).size,
      entry.gallery.length,
      entry.id,
    );
    assert.equal(entry.image, entry.gallery[0]);
    assert.ok(entry.events.length > 0, entry.id);
    for (const event of entry.events) {
      assert.ok(
        event.title.zh &&
          event.title.en &&
          event.description.zh &&
          event.description.en,
      );
      assert.ok(isContentDate(event.date), `${entry.id}:${event.date}`);
      assert.ok(
        event.sourceUrls.length > 0 &&
          event.sourceUrls.every((url) => url.startsWith("https://")),
      );
      assert.ok(event.imageIndices.length > 0);
      assert.ok(
        event.imageIndices.every(
          (index) =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < entry.gallery.length,
        ),
      );
    }
  }
  for (const existing of cityStories) {
    assert.equal(
      firstBatchCityStories.find((entry) => entry.id === existing.id),
      existing,
    );
  }
  assert.equal(firstBatchReview.humanReview, "pending");
  assert.equal(firstBatchReview.sourceCheckedBy, "Codex source review");
});

test("72 newly acquired JPEGs have file-integrity, date and Commons-rights evidence", () => {
  assert.equal(records.retrievedAt, "2026-10-06");
  assert.equal(records.files.length, 72);
  assert.deepEqual(records.failures, []);
  const newPhotoPaths = firstBatchCityStories
    .flatMap((entry) => entry.gallery)
    .filter((image) => image.path.startsWith("exploration/first-batch/cities/"))
    .map((image) => image.path);
  assert.equal(newPhotoPaths.length, 72);
  assert.equal(
    new Set(records.files.map((record: { cityId: string }) => record.cityId))
      .size,
    36,
  );
  for (const record of records.files) {
    assert.ok(newPhotoPaths.includes(record.path), record.path);
    const bytes = bytesFor(record.path);
    assert.ok(bytes.length > 3000);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.equal(bytes[2], 0xff);
    assert.equal(bytes.length, record.bytes);
    assert.equal(digest(record.path), record.sha256);
    assert.equal(record.review, "source-checked");
    assert.equal(record.checkedBy, "Codex source review");
    assert.equal(record.humanReview, "pending");
    assert.ok(isContentDate(record.date));
    assert.ok(record.date.slice(0, 4) <= "2026");
    assert.ok(
      record.originalDimensions.every(
        (value: number) => Number.isInteger(value) && value > 0,
      ),
    );
    assert.ok(
      record.displayDimensions.every(
        (value: number) => Number.isInteger(value) && value > 0,
      ),
    );
    assert.match(
      record.sourceUrl,
      /^https:\/\/commons.wikimedia.org\/wiki\/File:/,
    );
    assert.match(
      record.downloadUrl,
      /^https:\/\/(?:upload|thumb).wikimedia.org\//,
    );
    assert.match(record.licenseUrl, /^https:\/\//);
    assert.ok(
      record.subject.zh && record.subject.en && record.author && record.license,
    );
    assert.ok(
      record.metadata.Artist.value && record.metadata.LicenseShortName.value,
    );
    assert.ok(
      record.metadata.ImageDescription?.value ||
        record.metadata.ObjectName?.value,
    );
  }
});

test("new stories reuse only source-reviewed landmarks and preserve their specific subjects", () => {
  for (const slug of [
    "shenzhen",
    "hangzhou",
    "hong-kong",
    "taipei",
    "kyoto",
    "saint-petersburg",
  ]) {
    const entry = story(slug);
    const admittedImages = getCityLandmarks(entry.id).flatMap(
      (landmark) => landmark.gallery,
    );
    assert.equal(entry.gallery.length, 2);
    for (const image of entry.gallery) {
      assert.ok(
        admittedImages.some((admitted) => admitted.path === image.path),
        `${entry.id}:${image.path}`,
      );
      assert.ok(image.credit && image.caption.zh && image.caption.en);
      assert.ok(isContentDate(image.date));
    }
  }
  assert.ok(
    story("saint-petersburg").gallery.every(
      (image) => !image.credit.includes("Godot13"),
    ),
  );
  assert.match(
    story("taipei").events[0].description.zh,
    /台北院区馆舍外观.*不冒充馆内文物/,
  );
  assert.ok(
    story("taipei").gallery.every((image) =>
      image.path.includes("taipei-palace-museum"),
    ),
  );
  assert.ok(
    story("hong-kong").gallery.every((image) =>
      image.path.includes("hong-kong-convention-centre"),
    ),
  );
  assert.equal(story("hong-kong").events[0].date, "1988");
  assert.match(
    story("hong-kong").events[0].description.zh,
    /2009 年完成第二次扩建/,
  );
  assert.deepEqual(story("hangzhou").events[0].imageIndices, [0]);
});

test("site context and historical milestones keep separate dates and geography", () => {
  const accra = records.files.find((record: { path: string }) =>
    record.path.endsWith("accra-2.jpg"),
  );
  assert.equal(accra.date, "1995");
  assert.match(accra.metadata.ImageDescription.value, /1995/);
  assert.ok(accra.dateNote.zh && accra.dateNote.en);
  assert.equal(story("sapporo").events[0].date, "1878");
  assert.match(
    story("sapporo").events[0].description.zh,
    /后续安装时钟不是同一事件/,
  );
  assert.match(
    story("bangkok").events[0].description.en,
    /Memory of the World registration is not World Heritage/,
  );
  assert.match(story("pyongyang").events[0].description.zh, /不意味着整座平壤/);
  assert.match(
    story("addis-ababa").events[0].description.zh,
    /发现地点不是亚的斯亚贝巴/,
  );
  assert.equal(story("chicago").events[0].date, "1897");
  assert.equal(
    story("melbourne").events[0].sourceUrls[0],
    "https://whc.unesco.org/en/list/1131/",
  );
  assert.equal(story("kuala-lumpur").events[0].date, "1999");
  for (const entry of firstBatchCityStories.filter(
    (entry) => !cityStories.some((existing) => existing.id === entry.id),
  )) {
    assert.match(entry.relation.en, /does not mean an event photograph/);
    for (const image of entry.gallery.filter((image) =>
      image.path.startsWith("exploration/first-batch/cities/"),
    )) {
      assert.match(
        image.caption.en,
        /not a photograph of the historical event/,
      );
    }
  }
});
