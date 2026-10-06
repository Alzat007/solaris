import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Vector3 } from "three";
import {
  COUNTRY_OUTLINE_MAX_ARC_DEGREES,
  COUNTRY_OUTLINE_RADIUS,
  buildCountryOutlineSegments,
  parseCountryOutlines,
} from "../src/exploration/countryOutlines";
import { geographicPoint } from "../src/exploration/sceneState";

function collection(type: string, coordinates: unknown) {
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type, coordinates } },
    ],
  };
}

const triangle = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 0],
];

test("Polygon and MultiPolygon retain exterior rings, holes and independent islands", () => {
  const hole = [
    [1, 1],
    [2, 1],
    [2, 2],
    [1, 1],
  ];
  const island = [
    [30, 0],
    [31, 0],
    [31, 1],
    [30, 0],
  ];
  const data = parseCountryOutlines(
    collection("MultiPolygon", [[triangle, hole], [island]]),
  );
  assert.equal(data.featureCount, 1);
  assert.deepEqual(data.rings, [triangle, hole, island]);
  const built = buildCountryOutlineSegments(data);
  assert.equal(built.lineCount, 3);
  assert.equal(built.positions.length, built.segmentCount * 6);
});

test("GeoJSON rejects malformed collections, unsupported geometry and projected coordinates", () => {
  for (const input of [
    null,
    [],
    {},
    { type: "FeatureCollection", features: [] },
  ]) {
    assert.throws(() => parseCountryOutlines(input));
  }
  assert.throws(
    () => parseCountryOutlines(collection("LineString", triangle)),
    /Polygon/,
  );
  assert.throws(
    () => parseCountryOutlines(collection("Polygon", [])),
    /非空数组/,
  );
  assert.throws(
    () => parseCountryOutlines(collection("MultiPolygon", [[]])),
    /非空数组/,
  );
  const projected = {
    ...collection("Polygon", [triangle]),
    crs: { type: "name", properties: { name: "EPSG:3857" } },
  };
  assert.throws(() => parseCountryOutlines(projected), /CRS84/);
});

test("rings reject missing closure, too few unique points and invalid longitude/latitude values", () => {
  const invalid = [
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [181, 0],
      [1, 1],
      [0, 0],
    ],
    [
      [0, 0],
      [1, 91],
      [1, 1],
      [0, 0],
    ],
    [
      [0, 0],
      [1, Number.NaN],
      [1, 1],
      [0, 0],
    ],
    [
      [0, 0],
      [1, Number.POSITIVE_INFINITY],
      [1, 1],
      [0, 0],
    ],
    [
      [0, 0],
      ["1", 1],
      [1, 1],
      [0, 0],
    ],
    [
      [0, 0],
      [1, 1, 0],
      [1, 1],
      [0, 0],
    ],
  ];
  for (const ring of invalid) {
    assert.throws(() => parseCountryOutlines(collection("Polygon", [ring])));
  }
});

test("outline endpoints use exactly the existing geographicPoint and SphereGeometry UV convention", () => {
  const ring = [
    [0, 0],
    [90, 0],
    [90, 90],
    [0, 0],
  ];
  const { positions } = buildCountryOutlineSegments(
    parseCountryOutlines(collection("Polygon", [ring])),
  );
  const vertices: Vector3[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    vertices.push(new Vector3().fromArray(positions, i));
  }
  for (const [lon, lat] of ring) {
    const expected = geographicPoint(lat, lon, COUNTRY_OUTLINE_RADIUS);
    assert.ok(vertices.some((vertex) => vertex.distanceTo(expected) < 1e-6));
  }
  assert.ok(geographicPoint(0, 90).distanceTo(new Vector3(0, 0, -1)) < 1e-12);
  assert.ok(geographicPoint(90, 0).distanceTo(new Vector3(0, 1, 0)) < 1e-12);
});

test("antimeridian edges take the short spherical route, not a line through the globe", () => {
  const ring = [
    [179, 0],
    [-179, 0],
    [-179, 1],
    [179, 0],
  ];
  const { positions } = buildCountryOutlineSegments(
    parseCountryOutlines(collection("Polygon", [ring])),
  );
  for (let i = 0; i < positions.length; i += 3) {
    const vertex = new Vector3().fromArray(positions, i);
    assert.ok(vertex.x < -0.999);
    assert.ok(Math.abs(vertex.length() - COUNTRY_OUTLINE_RADIUS) < 1e-6);
  }
});

test("long arcs are subdivided so every chord stays outside the unit sphere", () => {
  const ring = [
    [0, 0],
    [80, 0],
    [80, 30],
    [0, 0],
  ];
  const { positions, segmentCount } = buildCountryOutlineSegments(
    parseCountryOutlines(collection("Polygon", [ring])),
  );
  assert.ok(segmentCount > 50);
  const limit = (COUNTRY_OUTLINE_MAX_ARC_DEGREES * Math.PI) / 180 + 1e-6;
  for (let i = 0; i < positions.length; i += 6) {
    const a = new Vector3().fromArray(positions, i);
    const b = new Vector3().fromArray(positions, i + 3);
    assert.ok(a.angleTo(b) <= limit);
    assert.ok(a.clone().add(b).multiplyScalar(0.5).length() > 1);
  }
});

test("repeated points are skipped and ambiguous antipodal edges are rejected explicitly", () => {
  const repeated = [
    [0, 0],
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 0],
  ];
  const ordinary = buildCountryOutlineSegments(
    parseCountryOutlines(collection("Polygon", [triangle])),
  );
  const built = buildCountryOutlineSegments(
    parseCountryOutlines(collection("Polygon", [repeated])),
  );
  assert.deepEqual(built.positions, ordinary.positions);
  const antipodal = [
    [0, 0],
    [180, 0],
    [10, 10],
    [0, 0],
  ];
  assert.throws(
    () =>
      buildCountryOutlineSegments(
        parseCountryOutlines(collection("Polygon", [antipodal])),
      ),
    /对跖点/,
  );
});

test("pinned local Natural Earth data has verified bytes, coverage and finite surface geometry", () => {
  const bytes = readFileSync(
    new URL(
      "../public/geography/ne_110m_admin_0_countries.geojson",
      import.meta.url,
    ),
  );
  assert.equal(bytes.length, 838726);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f",
  );
  const source = JSON.parse(bytes.toString());
  assert.deepEqual(source.bbox, [-180, -90, 180, 83.64513]);
  const data = parseCountryOutlines(source);
  const built = buildCountryOutlineSegments(data);
  assert.equal(built.featureCount, 177);
  assert.equal(built.lineCount, 289);
  assert.ok(built.segmentCount > 10_000 && built.segmentCount < 20_000);
  for (let i = 0; i < built.positions.length; i += 6) {
    const a = new Vector3().fromArray(built.positions, i);
    const b = new Vector3().fromArray(built.positions, i + 3);
    assert.ok([...a.toArray(), ...b.toArray()].every(Number.isFinite));
    assert.ok(Math.abs(a.length() - COUNTRY_OUTLINE_RADIUS) < 1e-6);
    assert.ok(Math.abs(b.length() - COUNTRY_OUTLINE_RADIUS) < 1e-6);
    assert.ok(a.clone().add(b).multiplyScalar(0.5).length() > 1);
  }
});
