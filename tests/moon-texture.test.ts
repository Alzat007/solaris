import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SphereGeometry, Vector3 } from "three";
import { geographicPoint } from "../src/exploration/sceneState";

const audit = JSON.parse(
  readFileSync(
    new URL("../public/textures/moon-source.json", import.meta.url),
    "utf8",
  ),
);
const bytes = readFileSync(new URL(`../public/${audit.path}`, import.meta.url));

// Read JPEG segment headers, rather than trusting provenance dimensions alone.
function jpegFrame(buffer: Buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, "JPEG SOI");
  assert.equal(buffer.readUInt16BE(buffer.length - 2), 0xffd9, "JPEG EOI");
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    assert.equal(buffer[offset++], 0xff, "JPEG segment prefix");
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = buffer.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= buffer.length);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      assert.ok(length >= 8);
      return {
        precision: buffer[offset + 2],
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
        channels: buffer[offset + 7],
      };
    }
    offset += length;
  }
  assert.fail("JPEG does not have a supported start-of-frame segment");
}

test("Moon texture is the real 2K JPEG with provenance-matching dimensions, bytes and SHA-256", () => {
  assert.deepEqual(jpegFrame(bytes), {
    precision: 8,
    width: 2048,
    height: 1024,
    channels: 3,
  });
  assert.equal(audit.width, 2048);
  assert.equal(audit.height, 1024);
  assert.equal(audit.bytes, bytes.length);
  assert.equal(audit.bytes, 457942);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash, audit.sha256);
  assert.equal(
    hash,
    "f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170",
  );
  assert.equal(audit.mediaType, "image/jpeg");
  assert.equal(audit.colorSpace, "sRGB");
  assert.equal(audit.exifOrientation, 1);
});

test("Moon texture retains its official map, acknowledgment and qualified usage evidence", () => {
  assert.equal(audit.sourceUrl, "https://svs.gsfc.nasa.gov/4720/");
  assert.equal(
    audit.imageUrl,
    "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg",
  );
  assert.match(audit.credit, /NASA's Scientific Visualization Studio/);
  assert.match(audit.credit, /LROC.*Arizona State University/);
  assert.equal(new URL(audit.licenseUrl).hostname, "www.nasa.gov");
  assert.match(audit.license, /educational and informational/);
  assert.match(audit.licenseNotes, /Third-party.*no-endorsement/);
  assert.equal(audit.audit.notNasaEndorsed, true);
  assert.match(audit.processing, /without cropping, resizing, re-encoding/);
});

test("Moon's served resolution is 2K sampling, not the upstream 400 m/pixel mosaic", () => {
  const resolution = audit.resolution;
  assert.equal(resolution.referenceRadiusKm, 1737.4);
  assert.equal(resolution.servedPixelsPerDegree, audit.width / 360);
  const equatorialKmPerPixel =
    (2 * Math.PI * resolution.referenceRadiusKm) / audit.width;
  assert.ok(
    Math.abs(
      equatorialKmPerPixel - resolution.approximateEquatorialKmPerServedPixel,
    ) < 0.005,
  );
  assert.ok(equatorialKmPerPixel > 5 && equatorialKmPerPixel < 6);
  assert.equal(resolution.upstreamMosaicEquatorialMetersPerPixel, 400);
  assert.equal(resolution.upstreamValueAppliesToServedJpeg, false);
  assert.ok(
    equatorialKmPerPixel * 1000 >
      resolution.upstreamMosaicEquatorialMetersPerPixel * 10,
  );
  assert.match(resolution.notes, /not a guaranteed optical resolution/);
  assert.equal(audit.width * audit.height * 4, 8 * 1024 * 1024);
});

test("global Moon texture discloses polar supplementation without claiming DEM, live imagery or scientific navigation", () => {
  assert.deepEqual(audit.coverage.renderedLatitude, [-90, 90]);
  assert.deepEqual(audit.coverage.renderedLongitude, [-180, 180]);
  assert.deepEqual(audit.coverage.lrocColorLatitude, [-70, 70]);
  assert.match(
    audit.coverage.polarSupplement,
    /lower-resolution monochromatic/,
  );
  assert.match(audit.coverage.polarSupplement, /LOLA LDAM/);
  assert.match(audit.coverage.polarSupplement, /do not establish/);
  assert.equal(audit.coverage.isGlobalTexture, true);
  assert.equal(audit.coverage.terrainAttached, false);
  assert.equal(audit.coverage.liveView, false);
  assert.equal(audit.audit.notForScientificMeasurementOrNavigation, true);
  assert.equal(audit.audit.humanReview, "pending");
});

test("Moon map centered on zero east longitude matches geographicPoint and existing SphereGeometry UV", () => {
  assert.equal(audit.pixelOrientation.leftLongitude, -180);
  assert.equal(audit.pixelOrientation.centerLongitude, 0);
  assert.equal(audit.pixelOrientation.rightLongitude, 180);
  assert.equal(audit.pixelOrientation.topLatitude, 90);
  assert.equal(audit.pixelOrientation.bottomLatitude, -90);
  assert.equal(audit.pixelOrientation.longitudeIncreases, "left-to-right");
  assert.equal(audit.pixelOrientation.northIsUp, true);
  assert.equal(audit.pixelOrientation.shaderUOffset, 0);
  assert.equal(audit.pixelOrientation.threeTextureFlipY, true);

  const geometry = new SphereGeometry(1, 56, 40);
  try {
    const positions = geometry.getAttribute("position");
    const coordinates = geometry.getAttribute("uv");
    let checked = 0;
    for (let index = 0; index < positions.count; index++) {
      const u = coordinates.getX(index);
      const v = coordinates.getY(index);
      // SphereGeometry offsets pole U coordinates; longitude is undefined there.
      if (v === 0 || v === 1) continue;
      const expected = geographicPoint((v - 0.5) * 180, (u - 0.5) * 360);
      const actual = new Vector3().fromBufferAttribute(positions, index);
      assert.ok(expected.distanceTo(actual) < 1e-6, `Moon UV vertex ${index}`);
      checked++;
    }
    assert.equal(checked, 57 * 39);
  } finally {
    geometry.dispose();
  }
  assert.ok(geographicPoint(0, 90).z < 0);
  assert.ok(geographicPoint(0, -90).z > 0);
  assert.ok(geographicPoint(45, 0).y > 0);
});

test("Moon landmark orientation evidence preserves coordinate pairs and served-map pixel locations", () => {
  assert.deepEqual(
    audit.pixelOrientation.orientationChecks.map(
      (check: { name: string }) => check.name,
    ),
    ["Tycho", "Copernicus"],
  );
  for (const check of audit.pixelOrientation.orientationChecks) {
    assert.equal(
      new URL(check.sourceUrl).hostname,
      "planetarynames.wr.usgs.gov",
    );
    const x = audit.width * (0.5 + check.longitude / 360);
    const y = audit.height * (0.5 - check.latitude / 180);
    assert.ok(Math.abs(x - check.expectedPixel[0]) < 0.02);
    assert.ok(Math.abs(y - check.expectedPixel[1]) < 0.02);
    assert.ok(x < audit.width / 2, "Both verified craters are west of zero");
    assert.ok(check.controlNetworkNote.trim());
  }
  assert.match(
    audit.pixelOrientation.verification,
    /not a surveyed pixel-level/,
  );
});

test("Moon asset URLs work under /solaris/ as well as root without an origin-root shortcut", () => {
  assert.equal(audit.path, "textures/moon-day.jpg");
  assert.ok(!audit.path.startsWith("/"));
  assert.ok(!audit.path.includes(".."));
  for (const base of ["/", "/solaris/"]) {
    const resolved = new URL(
      `${base}${audit.path}`,
      "https://alzat007.github.io",
    );
    assert.equal(resolved.pathname, `${base}textures/moon-day.jpg`);
    const resource = resolved.pathname.slice(base.length);
    assert.deepEqual(
      readFileSync(new URL(`../public/${resource}`, import.meta.url)),
      bytes,
    );
  }
  const source = readFileSync(
    new URL("../src/planets/Moon.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    source.includes("${import.meta.env.BASE_URL}textures/moon-day.jpg"),
  );
  assert.doesNotMatch(source, /["'`]\/textures\/moon-day\.jpg/);
});
