import {
  Cartesian3,
  Ellipsoid,
  Math as CesiumMath,
  Matrix4,
  type Camera,
} from "cesium";

export interface WorldCameraPose {
  position: [number, number, number];
  direction: [number, number, number];
  up: [number, number, number];
}
const tuple = (v: Cartesian3): [number, number, number] => [v.x, v.y, v.z];

export function geographicCameraPose(
  target: { longitude: number; latitude: number; height: number },
  tiltDegrees = 0,
): WorldCameraPose {
  const surface = Cartesian3.fromDegrees(target.longitude, target.latitude);
  const offset = CesiumMath.toDegrees(
    Math.atan(
      (target.height * Math.tan(CesiumMath.toRadians(tiltDegrees))) /
        Ellipsoid.WGS84.maximumRadius,
    ),
  );
  const position = Cartesian3.fromDegrees(
    target.longitude,
    CesiumMath.clamp(target.latitude - offset, -90, 90),
    target.height,
  );
  const direction = Cartesian3.normalize(
    Cartesian3.subtract(surface, position, new Cartesian3()),
    new Cartesian3(),
  );
  const longitude = CesiumMath.toRadians(target.longitude);
  const east = new Cartesian3(-Math.sin(longitude), Math.cos(longitude), 0);
  const up = Cartesian3.normalize(
    Cartesian3.cross(east, direction, new Cartesian3()),
    new Cartesian3(),
  );
  return {
    position: tuple(position),
    direction: tuple(direction),
    up: tuple(up),
  };
}

/** Near nadir, setView's HPR round trip can alter a world-space direction. */
export function applyWorldCameraPose(
  camera: Pick<
    Camera,
    "lookAtTransform" | "position" | "direction" | "up" | "right"
  >,
  pose: WorldCameraPose,
) {
  camera.lookAtTransform(Matrix4.IDENTITY);
  Cartesian3.clone(new Cartesian3(...pose.position), camera.position);
  Cartesian3.normalize(new Cartesian3(...pose.direction), camera.direction);
  Cartesian3.normalize(
    Cartesian3.cross(
      camera.direction,
      new Cartesian3(...pose.up),
      camera.right,
    ),
    camera.right,
  );
  Cartesian3.normalize(
    Cartesian3.cross(camera.right, camera.direction, camera.up),
    camera.up,
  );
}
