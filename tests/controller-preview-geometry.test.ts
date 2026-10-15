import test from "node:test";
import assert from "node:assert/strict";
import { controllerPreviewPoint } from "../src/controller/controllerPreviewGeometry";

test("a 4:3 image uses the full preview without mirroring the pointer twice", () => {
  assert.deepEqual(controllerPreviewPoint({ x: 0.2, y: 0.7 }, 640, 480), {
    x: 0.2,
    y: 0.7,
  });
});

test("wide and portrait video pointers stay within the contained image rectangle", () => {
  assert.deepEqual(controllerPreviewPoint({ x: 0, y: 0 }, 1280, 720), {
    x: 0,
    y: 0.125,
  });
  assert.deepEqual(controllerPreviewPoint({ x: 1, y: 1 }, 1280, 720), {
    x: 1,
    y: 0.875,
  });
  assert.deepEqual(controllerPreviewPoint({ x: 0, y: 0 }, 480, 640), {
    x: 0.21875,
    y: 0,
  });
  assert.deepEqual(controllerPreviewPoint({ x: 1, y: 1 }, 480, 640), {
    x: 0.78125,
    y: 1,
  });
});

test("unknown video size falls back safely and resizing preserves the image centre", () => {
  for (const [width, height] of [
    [0, 0],
    [NaN, 480],
    [640, -1],
  ])
    assert.deepEqual(
      controllerPreviewPoint({ x: 0.2, y: 0.7 }, width, height),
      {
        x: 0.2,
        y: 0.7,
      },
    );
  for (const [width, height] of [
    [640, 480],
    [1280, 720],
    [480, 640],
  ])
    assert.deepEqual(
      controllerPreviewPoint({ x: 0.5, y: 0.5 }, width, height),
      {
        x: 0.5,
        y: 0.5,
      },
    );
});
