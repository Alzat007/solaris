import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gasPlanetStories } from "../src/exploration/planetStoriesGas";
import { isContentDate } from "../src/exploration/validateContent";

test("all four giant planets have reviewed-source science entries with switchable images", () => {
  assert.equal(gasPlanetStories.length, 13);
  assert.equal(new Set(gasPlanetStories.map((story) => story.id)).size, 13);
  for (const [body, count] of Object.entries({
    jupiter: 4,
    saturn: 4,
    uranus: 2,
    neptune: 3,
  })) {
    assert.equal(
      gasPlanetStories.filter((story) => story.bodyId === body).length,
      count,
    );
  }
  for (const story of gasPlanetStories) {
    assert.match(story.id, /^region-/);
    assert.equal(story.humanReview, "pending");
    assert.equal(story.coordinateAccuracy, "approximate");
    assert.ok(story.name.zh && story.name.en);
    assert.ok(story.introduction.zh && story.introduction.en);
    assert.equal(story.sectionTitle?.zh, "科学与探测");
    assert.equal(story.gallery.length, 2);
    assert.equal(new Set(story.gallery.map((image) => image.path)).size, 2);
    assert.equal(story.image, story.gallery[0]);
    assert.ok(story.events.length > 0);
    assert.deepEqual(
      story.paragraphs,
      story.events.map((event) => event.description),
    );
    assert.ok(
      Number.isFinite(story.latitude) && Math.abs(story.latitude) <= 90,
    );
    assert.ok(
      Number.isFinite(story.longitude) && Math.abs(story.longitude) <= 180,
    );
    for (const event of story.events) {
      assert.ok(isContentDate(event.date));
      assert.ok(event.title.zh && event.title.en);
      assert.ok(event.description.zh && event.description.en);
      assert.ok(event.sourceUrls.length > 0);
      assert.ok(
        event.sourceUrls.every((url) =>
          /^https:\/\/(?:[^/]+\.)?nasa\.gov\//.test(url),
        ),
      );
      assert.ok(
        event.imageIndices.every(
          (index) => index >= 0 && index < story.gallery.length,
        ),
      );
    }
  }
});

test("cloud and ring entries do not pretend to be static solid-surface coordinates", () => {
  for (const story of gasPlanetStories) {
    assert.notEqual(story.anchorKind, "surface");
    assert.match(story.coordinateNote.zh, /代表入口锚点|代表入口绑定/);
    if (story.anchorKind === "ring") {
      assert.equal(story.bodyId, "saturn");
      assert.ok(story.ringRadius! >= 1.35 && story.ringRadius! <= 2.43);
      assert.ok(Number.isFinite(story.ringAngleDegrees));
      assert.match(story.coordinateNote.zh, /示意半径/);
    } else {
      assert.equal(story.ringRadius, undefined);
    }
  }
  const redSpot = gasPlanetStories.find(
    (story) => story.id === "region-jupiter-great-red-spot",
  )!;
  assert.match(redSpot.coordinateNote.en, /planetographic and planetocentric/);
  const uranusRings = gasPlanetStories.find(
    (story) => story.id === "region-uranus-rings",
  )!;
  assert.equal(uranusRings.anchorKind, "phenomenon");
  assert.match(uranusRings.coordinateNote.zh, /尚未重建.*实体环几何/);
  const darkSpot = gasPlanetStories.find(
    (story) => story.id === "region-neptune-great-dark-spot",
  )!;
  assert.match(darkSpot.name.zh, /1989/);
  assert.match(darkSpot.introduction.zh, /后来已消失/);
  assert.match(darkSpot.coordinateNote.zh, /不能声称仍位于此处/);
});

test("seventeen distinct real JPEG assets match recorded dimensions, byte counts and hashes", () => {
  const records = JSON.parse(
    readFileSync(
      new URL(
        "../public/exploration/planets/gas/source-records.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(records.retrievedAt, "2026-10-06");
  assert.equal(records.files.length, 17);
  assert.equal(
    new Set(records.files.map((record: { sha256: string }) => record.sha256))
      .size,
    17,
  );
  const used = new Map(
    gasPlanetStories
      .flatMap((story) => story.gallery)
      .map((image) => [image.path, image]),
  );
  assert.equal(used.size, records.files.length);
  for (const record of records.files) {
    const path = `exploration/planets/gas/${record.filename}`;
    const image = used.get(path);
    assert.ok(image, path);
    const bytes = readFileSync(new URL(`../public/${path}`, import.meta.url));
    assert.equal(bytes.length, record.bytes, path);
    assert.ok(bytes.length > 10000, path);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], path);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      record.sha256,
      path,
    );
    let offset = 2;
    let size: { width: number; height: number } | undefined;
    while (offset + 8 < bytes.length) {
      assert.equal(bytes[offset], 0xff, `${path}: JPEG marker`);
      const marker = bytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = bytes.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        size = {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
        break;
      }
      offset += length + 2;
    }
    assert.deepEqual(
      size,
      { width: record.width, height: record.height },
      path,
    );
    assert.equal(image.sourceUrl, record.sourceUrl);
    assert.equal(image.date, record.date);
    assert.ok(isContentDate(image.date));
    assert.equal(image.credit, `${record.credit} · ${record.id}`);
    assert.equal(image.licenseUrl, records.rightsPolicy);
    assert.ok(image.caption.zh && image.caption.en);
    assert.ok(image.processing.zh && image.processing.en);
    assert.match(record.downloadUrl, /^https:\/\/assets\.science\.nasa\.gov\//);
    assert.match(record.credit, /^NASA\/JPL/);
    assert.ok(record.rightsChecked && record.dateBasis && record.relationship);
    if (record.credit !== "NASA/JPL") {
      assert.match(
        record.rightsSourceUrl,
        /^https:\/\/www\.jpl\.nasa\.gov\/images\//,
      );
      assert.match(record.rightsChecked, /individual|Individual/);
    }
  }
});

test("image captions distinguish false color, historical clouds, artifacts and context images", () => {
  const photos = gasPlanetStories.flatMap((story) => story.gallery);
  const get = (id: string) =>
    photos.find((image) => image.path.endsWith(`${id}.jpg`))!;
  assert.match(get("pia01486").caption.zh, /不是肉眼自然色/);
  assert.match(get("pia00370").caption.zh, /镜头尘埃伪影/);
  assert.match(get("pia00142").caption.zh, /约 33 千米/);
  assert.match(get("pia00143").caption.zh, /不是环系近景/);
  assert.match(get("pia00052").caption.zh, /后来消失/);
  assert.match(get("pia02222").caption.en, /400×400/);
  assert.match(get("pia01509").caption.en, /400×400/);
  assert.match(get("pia00458").caption.en, /607×496/);
  assert.match(
    get("pia01524").caption.en,
    /neither natural color nor a current/,
  );
  assert.match(get("pia22336").caption.zh, /不是现场照片或实测云顶地形/);
  assert.match(get("pia24967").caption.zh, /2017.*2016.*不一致/);
  assert.match(get("pia09188").caption.zh, /反转.*不等于肉眼/);
  assert.match(
    get("pia17654").processing.en,
    /without claiming movie playback/,
  );
  assert.match(get("pia00064").caption.en, /different weather systems/);
  assert.ok(
    photos.every((image) => !image.credit.includes("Space Science Institute")),
  );
});

test("new equatorial, polar, hexagon, ring and storm entries preserve prior coverage", () => {
  const get = (id: string) =>
    gasPlanetStories.find((story) => story.id === id)!;
  const equatorial = get("region-jupiter-equatorial-belts");
  assert.ok(get("region-jupiter-cloud-belts"));
  assert.match(
    equatorial.introduction.en,
    /Equatorial Zone.*North Equatorial Belt.*distinct/,
  );
  assert.deepEqual(
    equatorial.gallery.map((image) => image.path.split("/").at(-1)),
    ["pia01524.jpg", "pia00458.jpg"],
  );
  const polar = get("region-jupiter-polar-cyclones");
  assert.equal(polar.anchorKind, "phenomenon");
  assert.match(
    polar.coordinateNote.en,
    /not a fixed or live cyclone coordinate/,
  );
  assert.match(polar.introduction.en, /both|North-polar/);
  assert.match(polar.events[0].description.en, /not measured relief/);
  const hexagon = get("region-saturn-north-hexagon");
  assert.equal(hexagon.anchorKind, "cloud");
  assert.match(hexagon.introduction.en, /not a building or a solid edge/);
  assert.deepEqual(
    hexagon.gallery.map((image) => image.date),
    ["2006-10-29", "2013-06-14"],
  );
  const ring = get("region-saturn-ring-observation");
  assert.equal(ring.anchorKind, "ring");
  assert.equal(ring.ringRadius, 1.5);
  assert.equal(ring.ringAngleDegrees, 225);
  assert.match(
    ring.events[0].description.en,
    /not an isolated C-ring close-up/,
  );
  const storm = get("region-neptune-storm-activity");
  assert.equal(storm.anchorKind, "phenomenon");
  assert.match(
    storm.coordinateNote.en,
    /not D2 or the Great Dark Spot at fixed coordinates/,
  );
  assert.match(
    storm.events[0].description.en,
    /unmeasured rotation rate is not reported as a fact/,
  );
});
