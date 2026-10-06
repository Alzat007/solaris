import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { rockPlanetStories } from "../src/exploration/planetStoriesRock";
import { getImmersiveSite } from "../src/exploration/immersiveCatalog";
import { isContentDate } from "../src/exploration/validateContent";

const expectedIds = [
  "region-mercury-caloris",
  "region-mercury-raditladi",
  "region-venus-maxwell-montes",
  "region-venus-maat-mons",
  "region-mars-olympus-mons",
  "region-mars-jezero",
  "region-mars-viking-1",
  "region-venus-ishtar-terra",
  "region-venus-aphrodite-terra",
  "region-venus-alpha-regio",
  "region-mars-valles-marineris",
];

const records = JSON.parse(
  readFileSync(
    new URL(
      "../public/exploration/planets/rock/source-records.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("eleven rocky-planet regions provide actual galleries and educational exploration events", () => {
  assert.deepEqual(
    rockPlanetStories.map((story) => story.id).sort(),
    [...expectedIds].sort(),
  );
  assert.deepEqual(
    Object.fromEntries(
      ["mercury", "venus", "mars"].map((id) => [
        id,
        rockPlanetStories.filter((story) => story.bodyId === id).length,
      ]),
    ),
    { mercury: 2, venus: 5, mars: 4 },
  );
  const eventIds = new Set<string>();
  for (const story of rockPlanetStories) {
    assert.equal(story.anchorKind, "surface");
    assert.equal(story.coordinateAccuracy, "approximate");
    assert.equal(story.humanReview, "pending");
    assert.ok(story.introduction.zh && story.introduction.en);
    assert.ok(story.gallery.length >= 2);
    assert.equal(story.image, story.gallery[0]);
    assert.equal(
      new Set(story.gallery.map((image) => image.path)).size,
      story.gallery.length,
    );
    assert.ok(story.latitude >= -90 && story.latitude <= 90);
    assert.ok(story.longitude >= -180 && story.longitude <= 180);
    assert.ok(story.events.length >= 1);
    assert.match(story.coordinateNote.zh, /未验证/);
    assert.deepEqual(
      story.paragraphs,
      story.events.map((event) => event.description),
    );
    for (const event of story.events) {
      assert.ok(!eventIds.has(event.id), event.id);
      eventIds.add(event.id);
      assert.ok(isContentDate(event.date), event.id);
      assert.ok(
        event.title.zh &&
          event.title.en &&
          event.description.zh &&
          event.description.en,
      );
      assert.ok(event.sourceUrls.length >= 1);
      assert.ok(
        event.sourceUrls.every((url) =>
          /^https:\/\/(?:[a-z0-9.-]+\.)?nasa\.gov\//.test(url),
        ),
      );
      assert.ok(event.imageIndices.length >= 1);
      assert.ok(
        event.imageIndices.every(
          (index) =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < story.gallery.length,
        ),
      );
    }
  }
});

test("all twenty-two real local JPEGs match exact source checksums and rights evidence", () => {
  assert.equal(records.retrievedAt, "2026-10-06");
  assert.equal(records.files.length, 22);
  assert.equal(
    records.files.filter(
      (file: { reusedExistingAsset: boolean }) => file.reusedExistingAsset,
    ).length,
    2,
  );
  const hashes = new Set<string>();
  for (const image of rockPlanetStories.flatMap((story) => story.gallery)) {
    const record = records.files.find(
      (file: { path: string }) => file.path === image.path,
    );
    assert.ok(record, image.path);
    const bytes = readFileSync(
      new URL(`../public/${image.path}`, import.meta.url),
    );
    assert.ok(bytes.length > 3000, image.path);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], image.path);
    const hash = createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash, record.sha256, image.path);
    assert.equal(bytes.length, record.bytes, image.path);
    assert.ok(!hashes.has(hash), `Duplicate image: ${image.path}`);
    hashes.add(hash);
    assert.equal(record.sourceUrl, image.sourceUrl);
    assert.equal(record.credit, image.credit);
    assert.equal(record.date, image.date);
    assert.ok(record.dateKind && isContentDate(record.publicationDate));
    assert.equal(record.licenseUrl, image.licenseUrl);
    assert.equal(record.license, image.license);
    assert.ok(record.downloadUrl.startsWith("https://"));
    assert.ok(record.width > 300 && record.height > 300);
    assert.ok(Math.max(record.width, record.height) <= 1600);
    assert.ok(
      image.caption.zh &&
        image.caption.en &&
        image.processing.zh &&
        image.processing.en,
    );
    assert.ok(
      image.credit && image.license && image.licenseUrl.startsWith("https://"),
    );
    assert.ok(isContentDate(image.date));
    assert.doesNotMatch(image.credit, /AAAS|Science magazine/);
    assert.doesNotMatch(image.license, /public domain/i);
    assert.equal(record.humanReview, "pending");
  }
  assert.equal(hashes.size, 22);
});

test("oversized mission images use official proportional variants with retained source dimensions", () => {
  const variants = records.files.filter(
    (file: { officialSizeVariant?: string }) => file.officialSizeVariant,
  );
  assert.equal(variants.length, 11);
  for (const file of variants) {
    assert.equal(Math.max(file.width, file.height), 1280);
    assert.ok(Math.max(file.originalWidth, file.originalHeight) > 1280);
    assert.ok(
      Math.abs(
        file.width / file.height - file.originalWidth / file.originalHeight,
      ) < 0.005,
    );
    assert.match(
      file.downloadUrl,
      /^https:\/\/assets\.science\.nasa\.gov\/dynamicimage\//,
    );
    assert.match(file.originalDownloadUrl, /\/content\/dam\/science\//);
    assert.match(file.originalSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(file.sha256, file.originalSha256);
    assert.ok(file.bytes < file.originalBytes);
    assert.match(file.processing.zh, /NASA 官方等比例长边 1280/);
  }
  assert.equal(
    records.decodedRgbaEstimate.originalBytes,
    records.files.reduce(
      (
        sum: number,
        file: {
          originalWidth?: number;
          originalHeight?: number;
          width: number;
          height: number;
        },
      ) =>
        sum +
        (file.originalWidth ?? file.width) *
          (file.originalHeight ?? file.height) *
          4,
      0,
    ),
  );
  assert.equal(
    records.decodedRgbaEstimate.currentBytes,
    records.files.reduce(
      (sum: number, file: { width: number; height: number }) =>
        sum + file.width * file.height * 4,
      0,
    ),
  );
  assert.ok(records.decodedRgbaEstimate.originalBytes > 700_000_000);
  assert.ok(records.decodedRgbaEstimate.currentBytes < 90_000_000);
  assert.equal(
    records.decodedRgbaEstimate.excludesBrowserCopiesAndGpuTextures,
    true,
  );
});

test("coordinates retain source direction, control-network pairings and regional scope", () => {
  const find = (id: string) =>
    rockPlanetStories.find((story) => story.id === id)!;
  const caloris = find("region-mercury-caloris");
  assert.equal(caloris.latitude, 31.65);
  assert.equal(caloris.longitude, 360 - 198.02);
  assert.match(caloris.coordinateNote.zh, /西经正向/);
  const maat = find("region-venus-maat-mons");
  assert.equal(maat.longitude, 194.5 - 360);
  assert.match(maat.coordinateNote.zh, /194.5°E/);
  const olympus = find("region-mars-olympus-mons");
  assert.ok(Math.abs(olympus.longitude - (226.2 - 360)) < 1e-10);
  assert.match(olympus.coordinateNote.zh, /18.40°N/);
  const jezero = find("region-mars-jezero");
  assert.equal(jezero.latitude, 18.41);
  assert.equal(jezero.longitude, 77.69);
  assert.match(jezero.coordinateNote.zh, /不是 Perseverance 着陆点/);
  assert.equal(find("region-mars-viking-1").longitude, -47.94);
  assert.equal(find("region-venus-ishtar-terra").latitude, 70.4);
  assert.equal(find("region-venus-ishtar-terra").longitude, 27.5);
  assert.equal(find("region-venus-aphrodite-terra").latitude, -5.8);
  assert.equal(find("region-venus-aphrodite-terra").longitude, 104.8);
  assert.equal(find("region-venus-alpha-regio").latitude, -25);
  assert.equal(find("region-venus-alpha-regio").longitude, 4);
  assert.ok(
    Math.abs(find("region-mars-valles-marineris").longitude - (301.41 - 360)) <
      1e-10,
  );
  assert.match(
    find("region-mars-valles-marineris").coordinateNote.zh,
    /MDIM 2\.1/,
  );
  assert.equal(find("region-mars-valles-marineris").latitude, -14.01);
});

test("Venus radar and measured visualizations never claim camera photos or true vertical scale", () => {
  const venus = rockPlanetStories.filter((story) => story.bodyId === "venus");
  assert.ok(
    venus.every((story) =>
      story.gallery.every((image) =>
        /不是|not/.test(image.caption.zh + image.caption.en),
      ),
    ),
  );
  const captions = venus
    .flatMap((story) => story.gallery)
    .map((image) => image.caption.zh)
    .join(" ");
  assert.match(captions, /10 倍垂直夸张/);
  assert.match(captions, /20 倍垂直夸张/);
  assert.match(captions, /22.5 倍/);
  assert.match(captions, /23 倍垂直夸张/);
  assert.match(captions, /日期|发布日期/);
});

test("new highlands, named Magellan region and canyon disclose footprint and observation limits", () => {
  const find = (id: string) =>
    rockPlanetStories.find((story) => story.id === id)!;
  const ishtar = find("region-venus-ishtar-terra");
  assert.match(ishtar.gallery[0].caption.zh, /Pioneer Venus.*颜色代表高度/);
  assert.match(ishtar.gallery[1].caption.zh, /不是整个伊什塔尔/);
  assert.equal(ishtar.events[0].date, "1990-09-15");
  const aphrodite = find("region-venus-aphrodite-terra");
  assert.match(aphrodite.gallery[0].caption.zh, /阿佛洛狄忒西部/);
  assert.match(aphrodite.gallery[1].processing.zh, /不将该解释写成已证实/);
  assert.match(
    aphrodite.events[0].description.zh,
    /资料发布.*不是地质事件发生日/,
  );
  const alpha = find("region-venus-alpha-regio");
  assert.match(alpha.name.en, /Alpha Regio.*Magellan/);
  assert.equal(alpha.gallery[1].date, "1991-03-05");
  assert.match(alpha.gallery[1].caption.zh, /1996-12-02 入库/);
  assert.match(alpha.gallery[1].processing.zh, /不能据图量真实坡度/);
  const valles = find("region-mars-valles-marineris");
  assert.match(valles.gallery[0].processing.zh, /墨卡托/);
  assert.equal(valles.gallery[1].date, "1997-10-03");
  assert.match(valles.gallery[1].processing.zh, /几何变形/);
  assert.match(valles.events[0].description.zh, /任务均为无人探测/);
});

test("Mars reuses existing assets without changing legacy IDs and qualifies landing history", () => {
  const olympus = rockPlanetStories.find(
    (story) => story.id === "region-mars-olympus-mons",
  )!;
  const viking = rockPlanetStories.find(
    (story) => story.id === "region-mars-viking-1",
  )!;
  assert.equal(
    olympus.gallery[0],
    getImmersiveSite("mars-olympus-mons")?.hotspots[0].image,
  );
  assert.equal(
    viking.gallery[0],
    getImmersiveSite("mars-viking-1")?.hotspots[0].image,
  );
  assert.match(viking.events[0].description.zh, /美国首次/);
  assert.match(viking.events[0].description.zh, /Mars 3.*1971/);
  assert.match(viking.events[0].description.zh, /没有证实火星生命/);
  assert.equal(viking.gallery[1].date, "1976-07-21");
  assert.match(viking.gallery[1].caption.zh, /误写 1997/);
  const jezero = rockPlanetStories.find(
    (story) => story.id === "region-mars-jezero",
  )!;
  assert.match(jezero.events[0].description.zh, /绝不是人类登陆火星/);
  const raditladi = rockPlanetStories.find(
    (story) => story.id === "region-mercury-raditladi",
  )!;
  assert.match(raditladi.gallery[1].caption.zh, /不含这些箭头/);
});
