import test from "node:test";
import assert from "node:assert/strict";
import {
  exceedsHotspotDragThreshold,
  isFrontFacing,
  isProjectedPointVisible,
  isTerrainOccluded,
  nextHotspotVisibility,
  placeGlobeHotspotLabels,
} from "../src/globeLab/hotspotVisibility";

test("pointer travel above 6px is a drag but keyboard activation is separate", () => {
  assert.equal(
    exceedsHotspotDragThreshold({ x: 10, y: 10 }, { x: 13, y: 14 }),
    false,
  );
  assert.equal(
    exceedsHotspotDragThreshold({ x: 10, y: 10 }, { x: 16, y: 10 }),
    false,
  );
  assert.equal(
    exceedsHotspotDragThreshold({ x: 10, y: 10 }, { x: 16.1, y: 10 }),
    true,
  );
});

test("hotspot visibility uses meter-per-pixel hysteresis, not camera height", () => {
  assert.equal(nextHotspotVisibility(false, 141), false);
  assert.equal(nextHotspotVisibility(false, 140), true);
  assert.equal(nextHotspotVisibility(true, 170), true);
  assert.equal(nextHotspotVisibility(true, 200), false);
  assert.equal(nextHotspotVisibility(true, Number.NaN), false);
  assert.equal(nextHotspotVisibility(true, 0), false);
});

test("invalid visibility bands fail closed", () => {
  assert.equal(
    nextHotspotVisibility(false, 10, { showBelow: 40, hideAbove: 30 }),
    false,
  );
  assert.equal(
    nextHotspotVisibility(true, 10, { showBelow: -1, hideAbove: 30 }),
    false,
  );
});

test("outward normal excludes far-side and tangent locations", () => {
  const point = { x: 1, y: 0, z: 0 };
  const normal = { x: 1, y: 0, z: 0 };
  assert.equal(isFrontFacing(point, normal, { x: 3, y: 0, z: 0 }), true);
  assert.equal(isFrontFacing(point, normal, { x: -3, y: 0, z: 0 }), false);
  assert.equal(isFrontFacing(point, normal, { x: 1, y: 3, z: 0 }), false);
});

test("terrain intersections ahead of a hotspot hide it, with surface tolerance", () => {
  assert.equal(isTerrainOccluded(1000, 900), true);
  assert.equal(isTerrainOccluded(1000, 999), false);
  assert.equal(isTerrainOccluded(1000, 1010), false);
  assert.equal(isTerrainOccluded(1000, undefined), false);
  assert.equal(isTerrainOccluded(1000, Number.NaN), false);
});

test("projected points need finite coordinates and a complete 44px hit target", () => {
  assert.equal(isProjectedPointVisible(100, 100, 800, 600), true);
  assert.equal(isProjectedPointVisible(10, 100, 800, 600), false);
  assert.equal(isProjectedPointVisible(100, 590, 800, 600), false);
  assert.equal(isProjectedPointVisible(Number.NaN, 100, 800, 600), false);
});

test("nearby label collisions use distinct in-bounds positions", () => {
  const labels = placeGlobeHotspotLabels(
    [
      { id: "a", x: 400, y: 300, width: 160, height: 44 },
      { id: "b", x: 410, y: 305, width: 160, height: 44 },
      { id: "c", x: 405, y: 310, width: 160, height: 44 },
    ],
    { width: 800, height: 600 },
  );
  assert.equal(labels.length, 3);
  for (const label of labels) {
    assert.ok(label.left >= 12 && label.left + label.width <= 788);
    assert.ok(label.top >= 78 && label.top + label.height <= 536);
    assert.equal(label.height, 44);
    assert.equal(label.elbow.y, label.y);
    assert.equal(label.elbow.x, label.endpoint.x);
  }
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i],
        b = labels[j];
      assert.ok(
        a.left + a.width + 8 <= b.left ||
          b.left + b.width + 8 <= a.left ||
          a.top + a.height + 8 <= b.top ||
          b.top + b.height + 8 <= a.top,
      );
    }
});

test("stable relative offsets track the map without resetting labels", () => {
  const anchor = { id: "a", x: 300, y: 300, width: 120, height: 44 };
  const first = placeGlobeHotspotLabels([anchor], {
    width: 800,
    height: 600,
  })[0];
  const previous = new Map([[first.id, { dx: first.dx, dy: first.dy }]]);
  const next = placeGlobeHotspotLabels(
    [{ ...anchor, x: 310, y: 305 }],
    { width: 800, height: 600 },
    previous,
  )[0];
  assert.equal(next.left - first.left, 10);
  assert.equal(next.top - first.top, 5);
});

test("focused hotspots win limited label space without oversized hit regions", () => {
  const labels = placeGlobeHotspotLabels(
    [
      { id: "a", x: 100, y: 100, width: 300, height: 44 },
      { id: "z", x: 100, y: 100, width: 300, height: 44, priority: 2 },
    ],
    { width: 200, height: 160, insetTop: 60, insetBottom: 48 },
  );
  assert.equal(labels.length, 1);
  assert.equal(labels[0].id, "z");
  assert.equal(labels[0].width, 176);
});
