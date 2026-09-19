import { Camera, Group, Vector2, Vector3 } from "three";
import type { PlanetId } from "../data/planets";

// Shared independently of React component refreshes; entries follow mount/unmount.
export const planetObjects = new Map<PlanetId, Group>();
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
  objects: ReadonlyMap<PlanetId, Group> = planetObjects,
): PlanetId | null {
  let best: PlanetId | null = null;
  let score = Infinity;
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  for (const [id, object] of objects) {
    if (!object.visible) continue;
    object.getWorldPosition(center);
    object.getWorldScale(scale);
    const radius = Math.max(scale.x, scale.y, scale.z);
    if (radius < 0.01) continue;
    edge.copy(center).addScaledVector(right, radius).project(camera);
    center.project(camera);
    if (center.z < -1 || center.z > 1) continue;
    const pixelRadius = Math.abs(edge.x - center.x) * width * 0.5;
    const hitRadius = Math.max(22, pixelRadius + 12);
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
