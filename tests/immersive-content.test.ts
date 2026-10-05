import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assets } from "../src/exploration/content";
import {
  getImmersiveSite,
  immersiveSites,
  validateImmersiveCatalog,
} from "../src/exploration/immersiveCatalog";

test("immersive samples have valid bilingual, independently attributed content", () => {
  assert.deepEqual(validateImmersiveCatalog(), []);
  assert.equal(immersiveSites.length, 3);
  assert.equal(getImmersiveSite("unknown"), undefined);
  assert.equal(immersiveSites.flatMap((site) => site.hotspots).length, 6);
  for (const hotspot of immersiveSites.flatMap((site) => site.hotspots)) {
    assert.equal(hotspot.humanReview, "pending");
    assert.ok(hotspot.sourceUrls.length > 0);
    assert.ok(hotspot.coordinateNote.zh.length > 0);
    assert.ok(hotspot.image);
  }
});

test("Beijing has the three requested landmarks and actual matching photos", () => {
  const beijing = getImmersiveSite("beijing")!;
  assert.equal(beijing.cityId, "city-beijing");
  assert.equal(beijing.kind, "city-atlas");
  assert.equal(beijing.bodyId, "earth");
  assert.deepEqual(
    beijing.hotspots.map((hotspot) => hotspot.id),
    ["beijing-tiananmen", "beijing-great-wall", "beijing-birds-nest"],
  );
  assert.ok(beijing.hotspots[1].latitude > beijing.hotspots[2].latitude);
  assert.ok(beijing.hotspots[1].longitude < beijing.hotspots[2].longitude);
  assert.equal(
    new Set(beijing.hotspots.map((hotspot) => hotspot.image?.path)).size,
    3,
  );
  for (const hotspot of beijing.hotspots) {
    assert.equal(hotspot.coordinateAccuracy, "approximate");
    assert.ok(
      hotspot.sourceUrls.some((url) =>
        url.startsWith("https://www.wikidata.org/wiki/Q"),
      ),
    );
    assert.notEqual(hotspot.date, hotspot.image?.date);
  }
});

test("Olympus uses educational approximate anchors and existing orbital imagery", () => {
  const olympus = getImmersiveSite("mars-olympus-mons")!;
  const asset = assets.find((entry) => entry.id === olympus.baseAssetId)!;
  assert.equal(asset.projection, "orbital-map");
  assert.equal(olympus.hotspots.length, 2);
  for (const hotspot of olympus.hotspots) {
    assert.equal(hotspot.coordinateAccuracy, "approximate");
    assert.equal(hotspot.image?.path, asset.path);
    assert.match(hotspot.coordinateNote.en, /not a|not survey/);
    assert.match(hotspot.relation.zh, /轨道/);
  }
});

test("Viking is a real uncrewed landing with the existing mission image", () => {
  const viking = getImmersiveSite("mars-viking-1")!;
  assert.equal(viking.hotspots.length, 1);
  const hotspot = viking.hotspots[0];
  assert.equal(hotspot.date, "1976-07-20");
  assert.match(hotspot.summary.en, /uncrewed/i);
  assert.equal(hotspot.image?.path, "exploration/viking-1-pia00381.jpg");
  assert.match(hotspot.paragraphs[0].zh, /不称人类首次登陆/);
});

test("catalog rejects missing evidence, changed review status and invalid geometry", () => {
  const copy = structuredClone(immersiveSites);
  copy[0].spanKm = 0;
  copy[0].hotspots[0].sourceUrls = [];
  copy[0].hotspots[1].latitude = 91;
  copy[0].hotspots[2].image!.credit = "";
  copy[1].hotspots[0].image!.licenseUrl = "https://user:password@example.com";
  copy[1].hotspots[1].coordinateNote.en = "";
  copy[2].hotspots[0].humanReview = "approved" as "pending";
  const errors = validateImmersiveCatalog(copy).join("\n");
  assert.match(errors, /invalid atlas span/);
  assert.match(errors, /missing fact sources/);
  assert.match(errors, /invalid coordinates/);
  assert.match(errors, /missing image rights or credit/);
  assert.match(errors, /unsafe source URL/);
  assert.match(errors, /both languages are required/);
  assert.match(errors, /review must remain pending/);
});

test("all hotspot pictures are small real JPEGs, not unresolved placeholders", () => {
  const paths = new Set(
    immersiveSites.flatMap((site) =>
      site.hotspots.flatMap((hotspot) =>
        hotspot.image ? [hotspot.image.path] : [],
      ),
    ),
  );
  for (const path of paths) {
    const bytes = readFileSync(new URL(`../public/${path}`, import.meta.url));
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.ok(bytes.length > 1000 && bytes.length < 500_000);
  }
});

test("new Beijing image bytes match the individually reviewed source downloads", () => {
  const files = [
    [
      "beijing-tiananmen-2008.jpg",
      170140,
      "9bd5d9eb07ce272447bf763c4257bfbac31c20dd635b36c9bbe7c28d604ea293",
    ],
    [
      "beijing-badaling-2006.jpg",
      116849,
      "feba659e1a245ac739291c16a9fb68177c3300c06ca43aa165b85189fba07341",
    ],
    [
      "beijing-birds-nest-2020.jpg",
      193446,
      "2a4409e4b3cc9ecf16fcbd473e8c321d73db3414e3a53a6276d2f9c90b5ce6f7",
    ],
  ] as const;
  for (const [file, size, hash] of files) {
    const bytes = readFileSync(
      new URL(`../public/exploration/${file}`, import.meta.url),
    );
    assert.equal(bytes.length, size);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
  }
});
