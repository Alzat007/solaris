import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { moonPlanetStories } from "../src/exploration/planetStoriesMoon";
import { isContentDate } from "../src/exploration/validateContent";

const expectedIds = [
  "region-moon-apollo-11",
  "region-moon-mare-tranquillitatis",
  "region-moon-tycho",
  "region-moon-copernicus",
  "region-moon-south-pole",
  "region-moon-change-4",
];
const audit = JSON.parse(
  readFileSync(
    new URL(
      "../public/exploration/planets/moon/source-records.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function dimensions(bytes: Buffer): { width: number; height: number } {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return {
        width: bytes.readUInt16BE(offset + 7),
        height: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += bytes.readUInt16BE(offset + 2) + 2;
  }
  throw new Error("Missing supported image dimensions");
}

test("six distinct lunar anchors reuse the shared bilingual gallery-story shape", () => {
  assert.deepEqual(
    moonPlanetStories.map((story) => story.id),
    expectedIds,
  );
  for (const story of moonPlanetStories) {
    assert.equal(story.bodyId, "moon");
    assert.equal(story.anchorKind, "surface");
    assert.equal(story.humanReview, "pending");
    assert.equal(story.coordinateAccuracy, "approximate");
    assert.ok(story.name.zh && story.name.en);
    assert.ok(story.introduction.zh && story.introduction.en);
    assert.ok(story.coordinateNote.zh && story.coordinateNote.en);
    assert.ok(story.relation?.zh && story.relation.en);
    assert.ok(
      Number.isFinite(story.latitude) && Math.abs(story.latitude) <= 90,
    );
    assert.ok(
      Number.isFinite(story.longitude) && Math.abs(story.longitude) <= 180,
    );
    assert.equal(story.gallery.length, 2);
    assert.equal(new Set(story.gallery.map((image) => image.path)).size, 2);
    assert.equal(story.image, story.gallery[0]);
    assert.deepEqual(
      story.paragraphs,
      story.events.map((event) => event.description),
    );
    assert.equal(story.date, story.events[0].date);
    assert.ok(isContentDate(story.date));
  }
});

test("every photograph has an explicit valid event association without unused or duplicate assets", () => {
  const allPaths = new Set<string>();
  const allEvents = new Set<string>();
  for (const story of moonPlanetStories) {
    const covered = new Set<number>();
    for (const event of story.events) {
      assert.ok(!allEvents.has(event.id), event.id);
      allEvents.add(event.id);
      assert.ok(event.title.zh && event.title.en);
      assert.ok(event.description.zh && event.description.en);
      assert.ok(isContentDate(event.date));
      assert.ok(event.imageIndices.length > 0);
      for (const index of event.imageIndices) {
        assert.ok(
          Number.isInteger(index) && index >= 0 && index < story.gallery.length,
        );
        covered.add(index);
      }
      assert.ok(event.sourceUrls.length > 0);
      assert.ok(
        event.sourceUrls.every((url) =>
          /^https:\/\/(?:[^/]+\.)?(?:nasa\.gov|im-ldi\.com)\//.test(url),
        ),
      );
    }
    assert.deepEqual([...covered].sort(), [0, 1], story.id);
    for (const image of story.gallery) {
      assert.ok(!allPaths.has(image.path), image.path);
      allPaths.add(image.path);
    }
  }
  assert.equal(allPaths.size, 12);
});

test("twelve official lunar image files match audit hashes, dimensions, metadata and rights", () => {
  assert.equal(audit.retrievedAt, "2026-10-08");
  assert.equal(audit.review.status, "source-checked");
  assert.equal(audit.review.humanReview, "pending");
  assert.equal(audit.files.length, 12);
  assert.equal(
    new Set(audit.files.map((record: { sha256: string }) => record.sha256))
      .size,
    12,
  );
  const used = new Map(
    moonPlanetStories
      .flatMap((story) => story.gallery)
      .map((image) => [image.path, image]),
  );
  for (const record of audit.files) {
    const image = used.get(record.path);
    assert.ok(image, record.path);
    const bytes = readFileSync(
      new URL(`../public/${record.path}`, import.meta.url),
    );
    assert.ok(bytes.length > 10000, record.path);
    assert.equal(bytes.length, record.bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      record.sha256,
    );
    assert.deepEqual(dimensions(bytes), {
      width: record.width,
      height: record.height,
    });
    assert.equal(image.sourceUrl, record.sourceUrl);
    assert.equal(image.credit, record.credit);
    assert.equal(image.date, record.date);
    assert.ok(isContentDate(image.date));
    assert.deepEqual(image.caption, record.caption);
    assert.deepEqual(image.processing, record.processing);
    assert.equal(image.license, record.license);
    assert.equal(image.licenseUrl, record.licenseUrl);
    assert.equal(record.humanReview, "pending");
    assert.ok(
      record.rightsChecked && record.dateKind && record.officialSizeVariant,
    );
    assert.equal(record.rightsSourceUrl, record.licenseUrl);
    assert.match(
      record.downloadUrl,
      /^https:\/\/(?:assets\.science\.nasa\.gov|lroc\.im-ldi\.com)\//,
    );
    assert.ok(record.imageRelation.length > 0);
    const story = moonPlanetStories.find(
      (candidate) => candidate.id === record.storyId,
    )!;
    const index = story.gallery.indexOf(image);
    assert.deepEqual(
      record.imageRelation,
      story.events
        .filter((event) => event.imageIndices.includes(index))
        .map((event) => event.id),
    );
  }
});

test("coordinates distinguish landing points, the mare, crater centers and the geographic pole", () => {
  assert.equal(audit.coordinates.length, 6);
  const get = (id: string) =>
    moonPlanetStories.find((story) => story.id === id)!;
  assert.deepEqual(
    [get(expectedIds[0]).latitude, get(expectedIds[0]).longitude],
    [0.67409, 23.47298],
  );
  assert.deepEqual(
    [get(expectedIds[1]).latitude, get(expectedIds[1]).longitude],
    [8.35, 30.83],
  );
  assert.deepEqual(
    [get(expectedIds[2]).latitude, get(expectedIds[2]).longitude],
    [-43.3, -11.22],
  );
  assert.deepEqual(
    [get(expectedIds[3]).latitude, get(expectedIds[3]).longitude],
    [9.62, -20.08],
  );
  assert.deepEqual(
    [get(expectedIds[4]).latitude, get(expectedIds[4]).longitude],
    [-90, 0],
  );
  assert.match(get(expectedIds[4]).coordinateNote.en, /all meridians meet/);
  assert.deepEqual(
    [get(expectedIds[5]).latitude, get(expectedIds[5]).longitude],
    [-45.45, 177.6],
  );
  for (const coordinate of audit.coordinates) {
    const story = get(coordinate.id);
    assert.equal(coordinate.latitude, story.latitude);
    assert.equal(coordinate.longitude, story.longitude);
    assert.deepEqual(coordinate.coordinateNote, story.coordinateNote);
    assert.deepEqual(coordinate.sourceUrls, story.sourceUrls);
    assert.equal(coordinate.humanReview, "pending");
  }
});

test("mission firsts, later observations and scientific imagery are not mislabeled as human landings", () => {
  const apollo = moonPlanetStories[0];
  assert.match(apollo.events[0].title.en, /First Crewed Lunar Landing/);
  assert.equal(apollo.events[0].date, "1969-07-20");
  assert.deepEqual(
    apollo.events.map((event) => event.imageIndices),
    [[0], [1]],
  );
  assert.match(apollo.gallery[0].caption.en, /not asserted as an exact UTC/);
  assert.match(apollo.gallery[1].caption.en, /Not the 1969 landing moment/);
  const pole = moonPlanetStories[4];
  assert.match(pole.events[0].description.en, /not.*human landing/);
  assert.match(pole.events[0].description.en, /not the impact instant/);
  assert.match(pole.gallery[1].caption.en, /1994 mission/);
  const change = moonPlanetStories[5];
  assert.match(change.name.en, /Chang'e 4.*Statio Tianhe/);
  assert.match(
    change.events[0].title.en,
    /First Robotic Soft Landing on the Lunar Farside/,
  );
  assert.equal(change.events[0].date, "2019-01-03");
  assert.match(change.gallery[0].caption.en, /Yutu-2 is not resolved/);
  assert.match(change.gallery[1].caption.en, /not a January 3 touchdown/);
  assert.match(change.gallery[1].processing.en, /fourfold enlargement/);
  assert.ok(
    change.gallery.every((image) =>
      image.credit.startsWith("NASA/GSFC/Arizona State University"),
    ),
  );
});

test("LROC educational permission is not mislabeled as blanket public-domain or commercial clearance", () => {
  const lrocImages = moonPlanetStories
    .flatMap((story) => story.gallery)
    .filter(
      (image) => image.licenseUrl === "https://lroc.im-ldi.com/about/terms",
    );
  assert.equal(lrocImages.length, 8);
  for (const image of lrocImages) {
    assert.match(image.license, /Copyrighted LROC/);
    assert.match(image.license, /educational use permitted/);
    assert.match(image.license, /commercial reuse requires prior permission/);
    assert.match(image.license, /not a public-domain claim/);
  }
  assert.match(audit.rightsNotes.lroc, /Only PDS-delivered/);
  assert.match(
    audit.rightsNotes.nasa,
    /promotional\/likeness rights are not cleared/,
  );
});
