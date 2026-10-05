import { Matrix4, PerspectiveCamera, Vector3, type Object3D } from "three";
import type { WorldCameraPose } from "../globeLab/cameraPose";

const EARTH_RADIUS = 6_378_137;
export interface EarthViewHandoff {
  pose: WorldCameraPose;
  verticalFov: number;
  aspect: number;
  center: { x: number; y: number };
  radius: number;
}
let current: EarthViewHandoff | null = null;

// SphereGeometry UVs use north=+Y and east=-Z; ECEF uses north=+Z/east=+Y.
export function earthLocalToEcef(
  point: Vector3,
  distance = false,
): [number, number, number] {
  const factor = distance ? EARTH_RADIUS : 1;
  return [point.x * factor, -point.z * factor, point.y * factor];
}

export function captureEarthView(
  camera: PerspectiveCamera,
  body: Object3D,
  width: number,
  height: number,
): EarthViewHandoff {
  body.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  const inverse = new Matrix4().copy(body.matrixWorld).invert();
  const position = camera.getWorldPosition(new Vector3()).applyMatrix4(inverse);
  const direction = camera
    .getWorldDirection(new Vector3())
    .transformDirection(inverse);
  const up = new Vector3()
    .setFromMatrixColumn(camera.matrixWorld, 1)
    .transformDirection(inverse);
  const center = body.getWorldPosition(new Vector3());
  const scale = body.getWorldScale(new Vector3()).x;
  const edge = center
    .clone()
    .addScaledVector(
      new Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
      scale,
    )
    .project(camera);
  center.project(camera);
  return {
    pose: {
      position: earthLocalToEcef(position, true),
      direction: earthLocalToEcef(direction),
      up: earthLocalToEcef(up),
    },
    verticalFov: (camera.getEffectiveFOV() * Math.PI) / 180,
    aspect: width / height,
    center: {
      x: ((center.x + 1) * width) / 2,
      y: ((1 - center.y) * height) / 2,
    },
    radius: (Math.abs(edge.x - center.x) * width) / 2,
  };
}

export const earthViewHandoff = {
  get: () => current,
  set: (value: EarthViewHandoff) => {
    current = value;
  },
  updatePose: (pose: WorldCameraPose) => {
    if (current) current = { ...current, pose };
  },
};
