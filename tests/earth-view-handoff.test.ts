import test from "node:test";
import assert from "node:assert/strict";
import { Group, Object3D, PerspectiveCamera, Vector3 } from "three";
import {
  captureEarthView,
  earthLocalToEcef,
  earthViewHandoff,
} from "../src/scene/earthViewHandoff";

const EARTH_RADIUS = 6_378_137;
const close = (actual: number, expected: number, epsilon = 1e-8) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} differs from ${expected}`,
  );
};
function closeVector(actual: number[], expected: number[], epsilon = 1e-8) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index], epsilon));
}

test("Earth local axes map north and east to ECEF without changing direction lengths", () => {
  closeVector(earthLocalToEcef(new Vector3(1, 0, 0)), [1, 0, 0]);
  closeVector(earthLocalToEcef(new Vector3(0, 1, 0)), [0, 0, 1]);
  closeVector(earthLocalToEcef(new Vector3(0, 0, -1)), [0, 1, 0]);
  closeVector(
    earthLocalToEcef(new Vector3(2, 3, -4), true),
    [2 * EARTH_RADIUS, 4 * EARTH_RADIUS, 3 * EARTH_RADIUS],
  );
});

test("a centered scaled Earth transfers camera distance, direction and screen radius", () => {
  const body = new Object3D();
  body.scale.setScalar(3);
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 100);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  const result = captureEarthView(camera, body, 960, 600);
  closeVector(result.pose.position, [0, -4 * EARTH_RADIUS, 0], 1e-6);
  closeVector(result.pose.direction, [0, 1, 0]);
  closeVector(result.pose.up, [0, 0, 1]);
  close(result.verticalFov, Math.PI / 3);
  close(result.aspect, 1.6);
  close(result.center.x, 480);
  close(result.center.y, 300);
  close(result.radius, (3 / 12) * 300 / Math.tan(Math.PI / 6));
});

test("off-center Earth screen coordinates and effective zoom are retained", () => {
  const body = new Object3D();
  body.position.set(2, 1, 0);
  body.scale.setScalar(1.5);
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.zoom = 1.5;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
  const result = captureEarthView(camera, body, 960, 600);
  const focalPixels = 300 * camera.zoom / Math.tan(Math.PI / 6);
  close(result.center.x, 480 + (2 / 10) * focalPixels);
  close(result.center.y, 300 - (1 / 10) * focalPixels);
  close(result.radius, (1.5 / 10) * focalPixels);
  close(result.verticalFov, 2 * Math.atan(Math.tan(Math.PI / 6) / 1.5));
});

test("world parent transforms preserve full Earth projection after ECEF handoff", () => {
  const parent = new Group();
  parent.position.set(5, -2, 9);
  parent.rotation.set(0.2, 0.4, -0.15);
  parent.scale.setScalar(1.3);
  const body = new Object3D();
  body.position.set(-2, 1, 0.5);
  body.rotation.set(0.25, -0.8, 0.1);
  body.scale.setScalar(3);
  parent.add(body);
  parent.updateWorldMatrix(true, true);

  const cameraRig = new Group();
  cameraRig.position.set(-3, 5, 1);
  cameraRig.rotation.set(-0.1, 0.3, 0.2);
  const camera = new PerspectiveCamera(48, 1.5, 0.1, 1000);
  cameraRig.add(camera);
  cameraRig.updateWorldMatrix(true, true);
  const localCameraPosition = new Vector3(1, 2, 6);
  const worldCameraPosition = body.localToWorld(localCameraPosition.clone());
  camera.position.copy(cameraRig.worldToLocal(worldCameraPosition.clone()));
  camera.up.copy(new Vector3(0, 1, 0).transformDirection(body.matrixWorld));
  camera.lookAt(body.getWorldPosition(new Vector3()));
  const result = captureEarthView(camera, body, 900, 600);
  closeVector(
    result.pose.position,
    earthLocalToEcef(localCameraPosition, true),
    1e-6,
  );
  closeVector(
    result.pose.direction,
    earthLocalToEcef(localCameraPosition.clone().negate().normalize()),
  );
  const direction = new Vector3(...result.pose.direction);
  const up = new Vector3(...result.pose.up);
  close(direction.length(), 1);
  close(up.length(), 1);
  close(direction.dot(up), 0);

  const converted = new PerspectiveCamera(
    result.verticalFov * 180 / Math.PI,
    result.aspect,
    1,
    100 * EARTH_RADIUS,
  );
  converted.position.set(...result.pose.position);
  converted.up.set(...result.pose.up);
  converted.lookAt(converted.position.clone().add(direction));
  converted.updateWorldMatrix(true, false);
  for (const point of [
    new Vector3(),
    new Vector3(1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, 0, -1),
    new Vector3(0.2, 0.4, 0.6),
  ]) {
    const original = body.localToWorld(point.clone()).project(camera);
    const transferred = new Vector3(...earthLocalToEcef(point, true)).project(converted);
    close(transferred.x, original.x);
    close(transferred.y, original.y);
  }
});

test("updating the handed-off camera pose leaves the original framing metadata intact", () => {
  const body = new Object3D();
  const camera = new PerspectiveCamera(60, 1.6, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  const initial = captureEarthView(camera, body, 960, 600);
  earthViewHandoff.set(initial);
  const pose = {
    position: [1, 2, 3] as [number, number, number],
    direction: [0, 1, 0] as [number, number, number],
    up: [0, 0, 1] as [number, number, number],
  };
  earthViewHandoff.updatePose(pose);
  assert.deepEqual(earthViewHandoff.get(), { ...initial, pose });
  assert.notEqual(earthViewHandoff.get(), initial);
  assert.notEqual(initial.pose, pose);
});
