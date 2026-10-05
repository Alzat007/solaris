import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Ellipsoid,
  Math as CesiumMath,
  Matrix3,
  Quaternion,
  type Viewer,
} from "cesium";
import { FlightSession, type FlightMode } from "./FlightSession";
import {
  applyWorldCameraPose,
  geographicCameraPose,
  type WorldCameraPose,
} from "./cameraPose";

export const MIN_HEIGHT = 250_000;
export const MAX_HEIGHT = 30_000_000;
const HOME_HEIGHT = 18_000_000;

export interface GeographicTarget {
  longitude: number;
  latitude: number;
  height: number;
  name: string;
}
export const BEIJING: GeographicTarget = {
  longitude: 116.4074,
  latitude: 39.9042,
  height: 500_000,
  name: "北京",
};
export interface CameraSnapshot {
  position: [number, number, number];
  direction: [number, number, number];
  up: [number, number, number];
  focus: string;
}
export interface GlobeCameraStatus {
  mode: FlightMode;
  height: number;
  longitude: number;
  latitude: number;
  focus: string;
  atBoundary: boolean;
}
export interface GlobeCameraOptions {
  minimumHeight?: number;
  terrain?: boolean;
  initialPose?: WorldCameraPose;
}
const tuple = (v: Cartesian3): [number, number, number] => [v.x, v.y, v.z];
const vector = (v: [number, number, number]) => new Cartesian3(...v);

/** All mouse, gesture, navigation and remote actions write through this owner. */
export class GlobeCameraActions {
  readonly flight: FlightSession<CameraSnapshot, GeographicTarget>;
  private grab: Cartesian3 | null = null;
  private fallbackTarget = Cartesian3.fromDegrees(
    BEIJING.longitude,
    BEIJING.latitude,
  );
  private focus = "地球";
  private boundary = false;
  enabled = true;

  readonly minimumHeight: number;
  readonly maximumHeight: number;
  private homePose: CameraSnapshot;

  constructor(
    private viewer: Viewer,
    private options: GlobeCameraOptions = {},
  ) {
    this.minimumHeight = options.minimumHeight ?? MIN_HEIGHT;
    this.maximumHeight = Math.max(
      MAX_HEIGHT,
      options.initialPose
        ? Cartographic.fromCartesian(vector(options.initialPose.position))
            .height * 1.05
        : 0,
    );
    viewer.scene.screenSpaceCameraController.enableInputs = false;
    this.flight = new FlightSession({
      capture: () => this.capture(),
      restore: (pose) => this.restore(pose),
      stop: () => viewer.camera.cancelFlight(),
      fly: (target, complete) => {
        this.focus = target.name;
        const pose = geographicCameraPose(target, 15);
        viewer.camera.flyTo({
          destination: vector(pose.position),
          orientation: {
            direction: vector(pose.direction),
            up: vector(pose.up),
          },
          duration: 8,
          complete,
        });
      },
      arrive: (target) => this.setTarget(target, 15),
    });
    if (options.initialPose) {
      this.restore({ ...options.initialPose, focus: "地球" });
      this.fallbackTarget =
        this.pick(0.5, 0.5) ??
        Ellipsoid.WGS84.scaleToGeodeticSurface(
          vector(options.initialPose.position),
        )!;
    } else {
      this.setTarget({ ...BEIJING, height: HOME_HEIGHT, name: "地球" });
    }
    this.homePose = this.capture();
  }

  capture(): CameraSnapshot {
    const camera = this.viewer.camera;
    return {
      position: tuple(camera.positionWC),
      direction: tuple(camera.directionWC),
      up: tuple(camera.upWC),
      focus: this.focus,
    };
  }

  restore(pose: CameraSnapshot) {
    applyWorldCameraPose(this.viewer.camera, pose);
    this.focus = pose.focus;
    this.grab = null;
    this.boundary = false;
    this.viewer.scene.requestRender();
  }

  private setTarget(target: GeographicTarget, tiltDegrees = 0) {
    applyWorldCameraPose(
      this.viewer.camera,
      geographicCameraPose(target, tiltDegrees),
    );
    this.fallbackTarget = Cartesian3.fromDegrees(
      target.longitude,
      target.latitude,
    );
    this.focus = target.name;
    this.boundary = false;
    this.viewer.scene.requestRender();
  }

  pick(x: number, y: number) {
    const canvas = this.viewer.canvas;
    const point = new Cartesian2(
      x * canvas.clientWidth,
      y * canvas.clientHeight,
    );
    if (this.options.terrain) {
      const ray = this.viewer.camera.getPickRay(point);
      const surface =
        ray && this.viewer.scene.globe.pick(ray, this.viewer.scene);
      if (surface) return surface;
    }
    // Local low-resolution preview is an ellipsoid, not measured terrain.
    return this.viewer.camera.pickEllipsoid(point, Ellipsoid.WGS84) ?? null;
  }

  beginDrag(x: number, y: number) {
    if (!this.enabled) return;
    const anchor = this.pick(x, y);
    if (!anchor) return;
    this.flight.takeover();
    this.grab = Cartesian3.clone(anchor);
    this.fallbackTarget = Cartesian3.clone(anchor);
  }

  dragTo(x: number, y: number) {
    if (!this.enabled || !this.grab) return;
    const underPointer = this.pick(x, y);
    if (!underPointer) return;
    const from = Cartesian3.normalize(underPointer, new Cartesian3());
    const to = Cartesian3.normalize(this.grab, new Cartesian3());
    const axis = Cartesian3.cross(from, to, new Cartesian3());
    if (Cartesian3.magnitudeSquared(axis) < 1e-14) return;
    Cartesian3.normalize(axis, axis);
    const angle = CesiumMath.acosClamped(Cartesian3.dot(from, to));
    const matrix = Matrix3.fromQuaternion(
      Quaternion.fromAxisAngle(axis, angle),
    );
    const camera = this.viewer.camera;
    const position = Matrix3.multiplyByVector(
      matrix,
      camera.positionWC,
      new Cartesian3(),
    );
    this.applyPose(
      position,
      Matrix3.multiplyByVector(matrix, camera.directionWC, new Cartesian3()),
      Matrix3.multiplyByVector(matrix, camera.upWC, new Cartesian3()),
    );
    this.focus = "自由浏览";
  }

  endDrag() {
    this.grab = null;
  }

  zoom(amount: number, x = 0.5, y = 0.5) {
    if (!this.enabled || !Number.isFinite(amount) || amount === 0) return;
    this.flight.takeover();
    const camera = this.viewer.camera;
    const anchor = this.pick(x, y) ?? this.fallbackTarget;
    this.fallbackTarget = Cartesian3.clone(anchor);
    const start = Cartesian3.clone(camera.positionWC);
    const distance = Cartesian3.distance(start, anchor);
    const delta =
      Math.min(distance * 0.3, camera.positionCartographic.height * 0.3) *
      Math.max(-1, Math.min(1, amount * 3));
    const direction = Cartesian3.normalize(
      Cartesian3.subtract(anchor, start, new Cartesian3()),
      new Cartesian3(),
    );
    const proposed = Cartesian3.add(
      start,
      Cartesian3.multiplyByScalar(direction, delta, new Cartesian3()),
      new Cartesian3(),
    );
    const height = (p: Cartesian3) => Cartographic.fromCartesian(p).height;
    const valid = (p: Cartesian3) =>
      height(p) >= this.floorAt(p) && height(p) <= this.maximumHeight;
    let destination = proposed;
    this.boundary = !valid(proposed);
    if (this.boundary) {
      let low = 0,
        high = 1;
      for (let i = 0; i < 36; i++) {
        const mid = (low + high) / 2;
        if (valid(Cartesian3.lerp(start, proposed, mid, new Cartesian3())))
          low = mid;
        else high = mid;
      }
      destination = Cartesian3.lerp(start, proposed, low, new Cartesian3());
    }
    this.applyPose(
      destination,
      Cartesian3.clone(camera.directionWC),
      Cartesian3.clone(camera.upWC),
    );
  }

  tilt(amount: number) {
    if (!this.enabled) return;
    this.flight.takeover();
    const camera = this.viewer.camera;
    const pitch = CesiumMath.clamp(
      camera.pitch + amount,
      -CesiumMath.PI_OVER_TWO,
      -CesiumMath.PI_OVER_FOUR,
    );
    camera.setView({
      orientation: { heading: camera.heading, pitch, roll: 0 },
    });
    this.viewer.scene.requestRender();
  }

  pan(dx: number, dy: number) {
    this.beginDrag(0.5, 0.5);
    this.dragTo(0.5 + dx, 0.5 + dy);
    this.endDrag();
  }

  flyToBeijing() {
    return this.flyTo(BEIJING);
  }

  flyTo(target: GeographicTarget) {
    if (!this.enabled) return false;
    if (
      !Number.isFinite(target.latitude) ||
      Math.abs(target.latitude) > 90 ||
      !Number.isFinite(target.longitude) ||
      Math.abs(target.longitude) > 180 ||
      !Number.isFinite(target.height) ||
      !target.name.trim()
    )
      return false;
    let height = CesiumMath.clamp(
      target.height,
      this.minimumHeight,
      this.maximumHeight,
    );
    for (let i = 0; i < 3; i++) {
      const eye = vector(
        geographicCameraPose({ ...target, height }, 15).position,
      );
      height = CesiumMath.clamp(
        Math.max(height, this.floorAt(eye)),
        this.minimumHeight,
        this.maximumHeight,
      );
    }
    this.endDrag();
    return this.flight.start({ ...target, height });
  }

  cancelFlight() {
    this.endDrag();
    return this.flight.cancel();
  }

  skipFlight() {
    this.endDrag();
    return this.flight.skip();
  }

  home() {
    if (!this.enabled) return;
    this.flight.takeover();
    this.endDrag();
    this.restore(this.homePose);
    this.fallbackTarget = this.pick(0.5, 0.5) ?? this.fallbackTarget;
  }

  status(): GlobeCameraStatus {
    const camera = this.viewer.camera;
    const center = this.pick(0.5, 0.5);
    const geo = center
      ? Cartographic.fromCartesian(center)
      : camera.positionCartographic;
    return {
      mode: this.flight.mode,
      height: camera.positionCartographic.height,
      longitude: CesiumMath.toDegrees(geo.longitude),
      latitude: CesiumMath.toDegrees(geo.latitude),
      focus: this.focus,
      atBoundary: this.boundary,
    };
  }

  private floorAt(position: Cartesian3) {
    if (!this.options.terrain) return this.minimumHeight;
    const geo = Cartographic.fromCartesian(position, Ellipsoid.WGS84);
    const ground = this.viewer.scene.globe.getHeight(geo) ?? 0;
    return Math.max(0, ground) + this.minimumHeight;
  }

  enforceTerrainClearance() {
    if (!this.options.terrain || !this.enabled || this.flight.mode !== "MANUAL")
      return;
    const camera = this.viewer.camera;
    if (camera.positionCartographic.height < this.floorAt(camera.positionWC))
      this.applyPose(camera.positionWC, camera.directionWC, camera.upWC);
  }

  private applyPose(
    position: Cartesian3,
    direction: Cartesian3,
    up: Cartesian3,
  ) {
    const geo = Cartographic.fromCartesian(position);
    // Rotation around an ellipsoid can slightly alter geodetic height near poles.
    geo.height = CesiumMath.clamp(
      geo.height,
      this.floorAt(position),
      this.maximumHeight,
    );
    applyWorldCameraPose(this.viewer.camera, {
      position: tuple(Ellipsoid.WGS84.cartographicToCartesian(geo)),
      direction: tuple(direction),
      up: tuple(up),
    });
    this.viewer.scene.requestRender();
  }
}
