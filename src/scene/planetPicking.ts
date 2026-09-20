import { Camera, Group, Vector2, Vector3, type Object3D } from "three";
import type { CelestialId } from "../gesture/gestureFeedback";
import { gestureConfig as config } from "../gesture/gestureConfig";

// Shared independently of React component refreshes; entries follow mount/unmount.
export const planetObjects = new Map<CelestialId, Group>();
const center = new Vector3();
const edge = new Vector3();
const scale = new Vector3();
const right = new Vector3();

/** Pick the visible disc, with a small pixel margin for natural fingertip jitter. */
export function pickPlanet(
  pointer: Vector2,
  camera: Camera,
  width: number,
  height: number,
  objects: ReadonlyMap<CelestialId, Group> = planetObjects,
  radiusMultiplier = 1,
): CelestialId | null {
  let best: CelestialId | null = null;
  let score = Infinity;
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  for (const [id, object] of objects) {
    let ancestor: Object3D | null = object;
    while (ancestor?.visible) ancestor = ancestor.parent;
    if (ancestor) continue;
    object.getWorldPosition(center);
    object.getWorldScale(scale);
    const radius =
      Math.max(scale.x, scale.y, scale.z) * (object.userData.pickRadius ?? 1);
    if (radius < 0.01) continue;
    edge.copy(center).addScaledVector(right, radius).project(camera);
    center.project(camera);
    if (center.z < -1 || center.z > 1) continue;
    const pixelRadius = Math.abs(edge.x - center.x) * width * 0.5;
    const hitRadius = Math.max(
      config.TARGET_MIN_RADIUS_PX,
      Math.max(
        pixelRadius * radiusMultiplier,
        pixelRadius + config.TARGET_MARGIN_PX,
      ),
    );
    const distance = Math.hypot(
      (center.x - pointer.x) * width * 0.5,
      (center.y - pointer.y) * height * 0.5,
    );
    const candidate = distance / hitRadius;
    if (candidate <= 1 && candidate < score) {
      best = id;
      score = candidate;
    }
  }
  return best;
}

/** Project the actual visible disc for an unobtrusive HUD selection ring. */
export function projectPlanetTarget(
  id: CelestialId,
  camera: Camera,
  width: number,
  height: number,
  objects: ReadonlyMap<CelestialId, Group> = planetObjects,
) {
  const object = objects.get(id);
  if (!object) return null;
  let ancestor: Object3D | null = object;
  while (ancestor?.visible) ancestor = ancestor.parent;
  if (ancestor) return null;
  object.getWorldPosition(center);
  object.getWorldScale(scale);
  const radius =
    Math.max(scale.x, scale.y, scale.z) * (object.userData.pickRadius ?? 1);
  if (radius < 0.01) return null;
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  edge.copy(center).addScaledVector(right, radius).project(camera);
  center.project(camera);
  if (center.z < -1 || center.z > 1) return null;
  return {
    x: ((center.x + 1) * width) / 2,
    y: ((1 - center.y) * height) / 2,
    radius: (Math.abs(edge.x - center.x) * width) / 2,
  };
}
