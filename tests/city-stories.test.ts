import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { cityStories } from "../src/exploration/cityStories";
import { getEarthCity } from "../src/exploration/earthDirectory";
import { isContentDate } from "../src/exploration/validateContent";

const expectedIds = [
  "city-beijing",
  "city-shanghai",
  "city-new-york",
  "city-washington-dc",
  "city-paris",
  "city-london",
  "city-tokyo",
  "city-seoul",
  "city-moscow",
  "city-singapore",
];

test("ten featured cities each have introductions, positive educational events and real galleries", () => {
  assert.deepEqual(
    cityStories.map((city) => city.id).sort(),
    [...expectedIds].sort(),
  );
  for (const city of cityStories) {
    assert.equal(city.humanReview, "pending");
    assert.equal(city.coordinateAccuracy, "approximate");
    assert.ok(city.introduction.zh.trim() && city.introduction.en.trim());
    assert.ok(city.events.length >= 1);
    assert.ok(city.gallery.length >= 2);
    assert.equal(
      new Set(city.gallery.map((image) => image.path)).size,
      city.gallery.length,
    );
    assert.equal(city.image, city.gallery[0]);
    assert.deepEqual(
      city.paragraphs,
      city.events.map((event) => event.description),
    );
    for (const event of city.events) {
      assert.ok(event.title.zh && event.title.en);
      assert.ok(event.description.zh && event.description.en);
      assert.ok(isContentDate(event.date));
      assert.ok(event.sourceUrls.length > 0);
      assert.ok(event.sourceUrls.every((url) => url.startsWith("https://")));
      assert.ok(event.imageIndices.length > 0);
      assert.ok(
        event.imageIndices.every(
          (index) =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < city.gallery.length,
        ),
      );
    }
  }
});

test("city story anchors preserve existing directory coordinates and distinguish city from event venue", () => {
  for (const city of cityStories.filter(
    (city) => city.id !== "city-shanghai",
  )) {
    assert.equal(city.latitude, getEarthCity(city.id)?.coordinates?.latitude);
    assert.equal(city.longitude, getEarthCity(city.id)?.coordinates?.longitude);
    assert.match(city.coordinateNote.zh, /不是.*精确坐标/);
  }
  const shanghai = cityStories.find((city) => city.id === "city-shanghai")!;
  assert.equal(shanghai.latitude, 31.2325);
  assert.equal(shanghai.longitude, 121.469167);
  assert.ok(
    shanghai.sourceUrls.includes("https://www.wikidata.org/wiki/Q8686"),
  );
  assert.match(shanghai.coordinateNote.zh, /不是世博中国馆/);
});

test("gallery photos are bundled real JPEGs with separately credited rights and capture dates", () => {
  for (const image of cityStories.flatMap((city) => city.gallery)) {
    assert.match(image.path, /^exploration\/(?:cities\/)?[a-z0-9-]+\.jpg$/);
    const bytes = readFileSync(
      new URL(`../public/${image.path}`, import.meta.url),
    );
    assert.ok(bytes.length > 3000, image.path);
    assert.equal(bytes[0], 0xff, image.path);
    assert.equal(bytes[1], 0xd8, image.path);
    assert.equal(bytes[2], 0xff, image.path);
    assert.ok(image.credit.trim());
    assert.ok(isContentDate(image.date), image.path);
    assert.ok(
      image.sourceUrl.startsWith("https://commons.wikimedia.org/wiki/File:"),
    );
    assert.ok(image.licenseUrl.startsWith("https://"));
    assert.ok(image.license.trim());
    assert.ok(image.caption.zh && image.caption.en);
    assert.ok(image.processing.zh && image.processing.en);
  }
});

test("downloaded photos match saved primary file records and checksum evidence", () => {
  const records = JSON.parse(
    readFileSync(
      new URL(
        "../public/exploration/cities/source-records.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(records.retrievedAt, "2026-10-06");
  assert.equal(records.files.length, 18);
  const newPhotos = cityStories
    .flatMap((city) => city.gallery)
    .filter((image) => image.path.startsWith("exploration/cities/"));
  assert.equal(newPhotos.length, records.files.length);
  for (const record of records.files) {
    const photo = newPhotos.find(
      (image) => image.path === `exploration/cities/${record.filename}`,
    );
    assert.ok(photo, record.filename);
    const bytes = readFileSync(
      new URL(
        `../public/exploration/cities/${record.filename}`,
        import.meta.url,
      ),
    );
    assert.equal(bytes.length, record.bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      record.sha256,
    );
    assert.ok(record.metadata.DateTimeOriginal.value);
    assert.ok(record.metadata.Artist.value);
    assert.ok(record.metadata.LicenseShortName.value);
    assert.ok(
      record.sourceUrl.startsWith("https://commons.wikimedia.org/wiki/File:"),
    );
  }
});

test("later photos never silently become historical event records or fabricated exact dates", () => {
  const tokyo = cityStories.find((city) => city.id === "city-tokyo")!;
  assert.equal(tokyo.events[0].date, "1964");
  assert.equal(tokyo.gallery[1].date, "2012-11");
  assert.match(tokyo.gallery[1].caption.zh, /不虚构拍摄日/);
  const washington = cityStories.find(
    (city) => city.id === "city-washington-dc",
  )!;
  assert.equal(washington.events[0].date, "1846-08-10");
  assert.match(
    washington.events[0].description.zh,
    /不把机构成立日期写成建筑竣工日期/,
  );
  const paris = cityStories.find((city) => city.id === "city-paris")!;
  assert.ok(paris.gallery.every((image) => image.date.startsWith("2018")));
  assert.equal(paris.events[0].date, "1991");
  assert.ok(
    paris.gallery.every((image) =>
      /不是|not/.test(image.caption.zh + image.caption.en),
    ),
  );
  assert.ok(
    cityStories.every((city) => city.relation.zh.includes("不冒充历史现场")),
  );
});
