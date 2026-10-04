import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import {
  assets,
  contentPack,
  destinations,
  explorationContent,
  getDestination,
  getDestinations,
  stories,
} from "../src/exploration/content";
import {
  isContentDate,
  validateContent,
} from "../src/exploration/validateContent";

const copy = () => structuredClone(explorationContent);

test("the V3 batch is structurally valid without pretending human review", () => {
  assert.deepEqual(validateContent(explorationContent), []);
  assert.equal(
    destinations.filter((entry) => entry.status === "ready").length,
    3,
  );
  assert.equal(stories.length, 3);
  assert.equal(assets.length, 3);
  for (const entry of [...destinations, ...stories, ...assets]) {
    assert.equal(entry.review.humanReview, "pending");
    if (entry.review.status === "source-checked")
      assert.equal(entry.review.by, "Codex source review");
  }
});

test("all eight planets have actual source-backed catalog candidates", () => {
  const bodies = [
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ] as const;
  assert.deepEqual(
    [...new Set(destinations.map((entry) => entry.bodyId))].sort(),
    [...bodies].sort(),
  );
  for (const body of bodies) {
    assert.ok(getDestinations(body).length > 0);
    assert.ok(
      getDestinations(body).every((entry) => entry.sourceIds.length > 0),
    );
  }
  assert.equal(getDestination("not-a-destination"), undefined);
});

test("catalog entries without reviewed stories or imagery stay draft", () => {
  for (const destination of destinations.filter(
    (entry) => entry.status === "draft",
  )) {
    assert.equal(destination.review.status, "pending");
    assert.deepEqual(destination.assetIds, []);
    assert.deepEqual(destination.storyIds, []);
  }
});

test("every batch asset is a small real local JPEG", () => {
  for (const asset of assets) {
    const path = new URL(`../public/${asset.path}`, import.meta.url);
    const bytes = readFileSync(path);
    assert.ok(statSync(path).size > 1000);
    assert.ok(statSync(path).size < 500_000);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.equal(asset.aiGenerated, false);
  }
});

test("date validation supports declared precision and rejects impossible days", () => {
  for (const date of ["2024", "1976-07", "1976-07-20", "2000-02-29"])
    assert.equal(isContentDate(date), true);
  for (const date of [
    "",
    "2024-13",
    "2024-02-30",
    "1900-02-29",
    "2024-00",
    "2024-01-00",
    "0000",
    "July 1976",
  ])
    assert.equal(isContentDate(date), false);
});

test("invalid stable IDs and duplicates fail", () => {
  const content = copy();
  content.assets[0].id = "Bad Asset ID";
  content.destinations.push(structuredClone(content.destinations[0]));
  const errors = validateContent(content).join("\n");
  assert.match(errors, /invalid stable ID/);
  assert.match(errors, /duplicate ID/);
});

test("unknown source and asset references fail", () => {
  const content = copy();
  content.destinations[2].sourceIds = ["missing-source"];
  content.stories[0].assetIds = ["missing-asset"];
  const errors = validateContent(content).join("\n");
  assert.match(errors, /unknown ID missing-source/);
  assert.match(errors, /unknown ID missing-asset/);
});

test("a ready destination needs real source, story, and image references", () => {
  const content = copy();
  content.destinations[0].status = "ready";
  content.destinations[0].sourceIds = [];
  const errors = validateContent(content).join("\n");
  assert.match(errors, /at least one reference is required/);
  assert.match(errors, /requires source-checked/);
});

test("ready destinations cannot include unchecked source, story, or image", () => {
  const content = copy();
  content.sources[2].review.status = "pending";
  content.stories[0].review.status = "pending";
  content.assets[0].review.status = "pending";
  const errors = validateContent(content).join("\n");
  assert.match(
    errors,
    /story.story-olympus-orbital-view.review: ready content requires source-checked/,
  );
  assert.match(
    errors,
    /asset.asset-olympus-mons.review: ready content requires source-checked/,
  );
  assert.match(
    errors,
    /jpl-olympus-mons: ready content requires source-checked/,
  );
});

test("a reviewed record must retain its reviewer and exact check date", () => {
  const content = copy();
  content.assets[0].review.by = null;
  content.stories[0].review.checkedAt = "2026-10";
  assert.match(
    validateContent(content).join("\n"),
    /reviewer and exact check date/,
  );
});

test("missing image rights and credit fail independently of fact review", () => {
  const content = copy();
  content.assets[0].rightsUrl = "";
  content.assets[1].credit = "";
  content.assets[2].license = "";
  const errors = validateContent(content).join("\n");
  assert.match(errors, /rightsUrl/);
  assert.match(errors, /credit/);
  assert.match(errors, /license/);
});

test("unsafe paths and source credentials fail", () => {
  const content = copy();
  content.assets[0].path = "../private/image.jpg";
  content.assets[1].originalUrl =
    "https://username:password@example.com/image.jpg";
  const errors = validateContent(content).join("\n");
  assert.match(errors, /safe local exploration image path/);
  assert.match(errors, /HTTPS URL/);
});

test("Chinese and English content are independently required", () => {
  const content = copy();
  content.stories[0].body.en = " ";
  content.assets[0].caption.zh = "";
  const errors = validateContent(content).join("\n");
  assert.match(errors, /body.en: text is required/);
  assert.match(errors, /caption.zh: text is required/);
});

test("coordinates reject out-of-range values and false precision", () => {
  const content = copy();
  const beijing = content.destinations.find(
    (entry) => entry.cityId === "city-beijing",
  )!;
  beijing.position!.latitude = 91;
  beijing.position!.longitude = 181;
  const viking = content.destinations.find(
    (entry) => entry.id === "mars-viking-1",
  )!;
  viking.position!.exact = true;
  const errors = validateContent(content).join("\n");
  assert.match(errors, /latitude out of range/);
  assert.match(errors, /longitude out of range/);
  assert.match(errors, /unspecified datum cannot assert an exact location/);
});

test("non-Earth markers cannot borrow WGS84", () => {
  const content = copy();
  content.destinations.find(
    (entry) => entry.id === "mars-viking-1",
  )!.position!.coordinateSystem = "WGS84";
  assert.match(
    validateContent(content).join("\n"),
    /WGS84 cannot be assigned to another planet/,
  );
});

test("gas and ice giant themes never imply surface landings", () => {
  for (const body of ["jupiter", "saturn", "uranus", "neptune"]) {
    assert.ok(
      destinations
        .filter((entry) => entry.bodyId === body)
        .every((entry) => entry.approach === "observation"),
    );
  }
  const content = copy();
  content.destinations.find((entry) => entry.bodyId === "jupiter")!.approach =
    "surface";
  assert.match(
    validateContent(content).join("\n"),
    /cannot imply surface landing/,
  );
});

test("story relationships must be reciprocated, not guessed from city membership", () => {
  const content = copy();
  content.stories[0].links[0].destinationId = "earth-beijing-central-axis";
  const errors = validateContent(content).join("\n");
  assert.match(errors, /reciprocate the story relationship/);
  assert.match(errors, /story must link back/);
});

test("many-to-many stories can use different explicit relations", () => {
  const content = copy();
  const olympusStory = content.stories[0];
  olympusStory.links.push({
    destinationId: "mars-viking-1",
    relation: "topic-related",
    description: {
      zh: "测试中的主题关联，不声明同一现场。",
      en: "A thematic test association, not a shared event site.",
    },
  });
  const viking = content.destinations.find(
    (entry) => entry.id === "mars-viking-1",
  )!;
  viking.storyIds.push(olympusStory.id);
  viking.assetIds.push("asset-olympus-mons");
  assert.deepEqual(validateContent(content), []);
});

test("story images must be included in the destination's preload list", () => {
  const content = copy();
  content.destinations.find(
    (entry) => entry.id === "mars-olympus-mons",
  )!.assetIds = ["asset-viking-1"];
  assert.match(
    validateContent(content).join("\n"),
    /not in the destination preload list/,
  );
});

test("AI images cannot masquerade as camera or mission records", () => {
  const content = copy();
  content.assets[0].aiGenerated = true;
  assert.match(
    validateContent(content).join("\n"),
    /AI images cannot be labeled/,
  );
});

test("automated source checking cannot claim human approval", () => {
  const content = copy();
  content.assets[0].review.humanReview = "approved";
  assert.match(
    validateContent(content).join("\n"),
    /cannot assert human approval/,
  );
  assert.match(
    validateContent(explorationContent, { requireHumanReview: true }).join(
      "\n",
    ),
    /human review is pending/,
  );
});

test("city photographs and planetary records retain their separate roles and dates", () => {
  assert.equal(
    assets.find((entry) => entry.id === "asset-beijing-axis")!.role,
    "landmark-photo",
  );
  assert.equal(
    assets.find((entry) => entry.id === "asset-beijing-axis")!.date,
    "2012-05-08",
  );
  assert.equal(
    stories.find((entry) => entry.id === "story-beijing-axis-heritage")!.date,
    "2024",
  );
  assert.equal(
    stories.find((entry) => entry.id === "story-olympus-orbital-view")!.links[0]
      .relation,
    "remote-observation",
  );
  assert.equal(
    stories.find((entry) => entry.id === "story-viking-1-landing")!.links[0]
      .relation,
    "event-at-site",
  );
  assert.equal(
    stories.find((entry) => entry.id === "story-beijing-axis-heritage")!
      .links[0].relation,
    "topic-related",
  );
  assert.equal(
    assets.find((entry) => entry.id === "asset-viking-1")!.projection,
    "ordinary-photo",
  );
});

test("the content pack manifest matches real bytes and SHA-256 without claiming offline caching", () => {
  assert.equal(contentPack.version, explorationContent.version);
  assert.equal(contentPack.offlineStatus, "bundled-assets-only");
  assert.equal(contentPack.browserColdStartVerified, false);
  let total = 0;
  for (const file of contentPack.files) {
    const bytes = readFileSync(
      new URL(`../public/${file.path}`, import.meta.url),
    );
    assert.equal(bytes.byteLength, file.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
    total += bytes.byteLength;
  }
  assert.equal(total, contentPack.totalBytes);
  assert.equal(total, 329763);
});

test("pack validation rejects version, checksum format, path, and size metadata errors", () => {
  const content = copy();
  const pack = content.contentPacks[0];
  pack.version = "wrong-version";
  pack.files[0].sha256 = "not-a-checksum";
  pack.files[0].bytes += 1;
  pack.files[1].path = "exploration/wrong-image.jpg";
  const errors = validateContent(content).join("\n");
  assert.match(errors, /content version mismatch/);
  assert.match(errors, /SHA-256 checksum is required/);
  assert.match(errors, /asset path mismatch/);
  assert.match(errors, /byte total mismatch/);
});

test("pack validation rejects missing files and draft destinations", () => {
  const content = copy();
  content.contentPacks[0].files.pop();
  content.contentPacks[0].destinationIds.push("mercury-caloris");
  const errors = validateContent(content).join("\n");
  assert.match(errors, /missing file for asset-beijing-axis/);
  assert.match(errors, /cannot advertise a draft destination/);
});

test("bundled images cannot automatically become verified offline cold-start support", () => {
  const content = copy();
  content.contentPacks[0].browserColdStartVerified = true;
  assert.match(
    validateContent(content).join("\n"),
    /bundled assets do not verify browser offline cold start/,
  );
});
