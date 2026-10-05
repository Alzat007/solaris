import test from "node:test";
import assert from "node:assert/strict";
import {
  Cartesian3,
  Cartographic,
  Ellipsoid,
  IntersectionTests,
  Matrix4,
  Ray,
} from "cesium";
import {
  applyWorldCameraPose,
  geographicCameraPose,
} from "../src/globeLab/cameraPose";

for (const height of [500_000, 18_000_000]) {
  for (const tilt of [0, 15]) {
    test(`camera at ${height}m and ${tilt} degrees targets Beijing on the actual ellipsoid`, () => {
      const pose = geographicCameraPose(
        { longitude: 116.4074, latitude: 39.9042, height },
        tilt,
      );
      const ray = new Ray(
        new Cartesian3(...pose.position),
        new Cartesian3(...pose.direction),
      );
      const intersection = IntersectionTests.rayEllipsoid(
        ray,
        Ellipsoid.WGS84,
      )!;
      assert.ok(intersection);
      const position = Ray.getPoint(ray, intersection.start);
      assert.ok(
        Cartesian3.distance(
          position,
          Cartesian3.fromDegrees(116.4074, 39.9042),
        ) < 1e-5,
      );
      assert.ok(
        Math.abs(Cartographic.fromCartesian(ray.origin).height - height) < 1e-5,
      );
      const up = new Cartesian3(...pose.up);
      assert.ok(Math.abs(Cartesian3.dot(ray.direction, up)) < 1e-12);
      assert.ok(Math.abs(Cartesian3.magnitude(up) - 1) < 1e-12);
    });
  }
}

test("exact world pose does not change near-nadir direction through an HPR conversion", () => {
  let transformed = 0;
  const camera = {
    position: new Cartesian3(),
    direction: new Cartesian3(),
    up: new Cartesian3(),
    right: new Cartesian3(),
    lookAtTransform: (matrix: Matrix4) => {
      assert.equal(matrix, Matrix4.IDENTITY);
      transformed++;
    },
  };
  const pose = geographicCameraPose({
    longitude: 116.4074,
    latitude: 39.9042,
    height: 18_000_000,
  });
  applyWorldCameraPose(camera, pose);
  assert.equal(transformed, 1);
  assert.ok(
    Cartesian3.distance(camera.position, new Cartesian3(...pose.position)) <
      1e-12,
  );
  assert.ok(
    Cartesian3.distance(camera.direction, new Cartesian3(...pose.direction)) <
      1e-12,
  );
  assert.ok(Cartesian3.distance(camera.up, new Cartesian3(...pose.up)) < 1e-12);
  assert.ok(Math.abs(Cartesian3.dot(camera.right, camera.up)) < 1e-12);
});

test("whole globe pose remains finite at both poles and the antimeridian", () => {
  for (const latitude of [-90, 0, 90])
    for (const longitude of [-180, 180]) {
      const pose = geographicCameraPose({
        longitude,
        latitude,
        height: 18_000_000,
      });
      assert.ok(
        [...pose.position, ...pose.direction, ...pose.up].every(
          Number.isFinite,
        ),
      );
    }
});
