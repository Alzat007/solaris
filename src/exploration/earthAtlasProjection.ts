import { Ray, Sphere, Vector3, type Camera, type Group } from "three";
import { useSyncExternalStore } from "react";
import { geographicPoint } from "./sceneState";
import {
  isFrontFacing,
  isProjectedPointVisible,
  placeGlobeHotspotLabels,
  type HotspotLabel,
} from "../globeLab/hotspotVisibility";
import type { AtlasAnnotation } from "./planetAtlasCatalog";
import type { CountryOutlineStatus } from "./CountryOutlineLayer";

export interface AtlasPoint {
  id: string;
  x: number;
  y: number;
  featured: boolean;
}
export interface AtlasView {
  points: AtlasPoint[];
  labels: HotspotLabel[];
  focusId: string | null;
  scopeCityId: string | null;
  width: number;
  height: number;
  insetBottom?: number;
  showBoundaries: boolean;
  countries: CountryOutlineStatus;
}

const empty: AtlasView = {
  points: [],
  labels: [],
  focusId: null,
  scopeCityId: null,
  width: 0,
  height: 0,
  showBoundaries: true,
  countries: { state: "loading", featureCount: 0, lineCount: 0 },
};
let snapshot = empty;
const listeners = new Set<() => void>();
export const earthAtlasView = {
  get: () => snapshot,
  set(patch: Partial<AtlasView>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
export const useEarthAtlasView = () =>
  useSyncExternalStore(earthAtlasView.subscribe, earthAtlasView.get);

export function atlasProjectionSignature(
  bodyId: string,
  viewport: {
    width: number;
    height: number;
    language?: "zh" | "en";
    tv?: boolean;
    insetTop?: number;
    insetBottom?: number;
  },
  view: Pick<AtlasView, "points" | "labels">,
) {
  return JSON.stringify([
    bodyId,
    viewport.width,
    viewport.height,
    viewport.language,
    viewport.tv,
    viewport.insetTop,
    viewport.insetBottom,
    view.points.map((point) => [
      point.id,
      Math.round(point.x),
      Math.round(point.y),
    ]),
    view.labels.map((label) => [
      label.id,
      Math.round(label.left),
      Math.round(label.top),
      label.width,
      label.height,
    ]),
  ]);
}

export function projectAtlasCities(
  camera: Camera,
  body: Group,
  cities: readonly AtlasAnnotation[],
  viewport: {
    width: number;
    height: number;
    insetTop?: number;
    insetBottom?: number;
    tv?: boolean;
    language?: "zh" | "en";
  },
  focusedId: string | null = null,
  previous = new Map<string, { dx: number; dy: number }>(),
) {
  camera.updateMatrixWorld();
  body.updateWorldMatrix(true, false);
  const eye = camera.getWorldPosition(new Vector3());
  const localEye = body.worldToLocal(eye.clone());
  const anchors = cities.flatMap((city) => {
    const local = city.localPosition
      ? new Vector3(...city.localPosition)
      : geographicPoint(city.latitude, city.longitude, 1.007);
    const point = local.clone().applyMatrix4(body.matrixWorld);
    if (city.localPosition) {
      const distance = localEye.distanceTo(local);
      const ray = new Ray(localEye, local.clone().sub(localEye).normalize());
      const hit = ray.intersectSphere(
        new Sphere(new Vector3(), 1),
        new Vector3(),
      );
      if (hit && localEye.distanceTo(hit) < distance - 1e-5) return [];
    } else {
      const normal = local
        .clone()
        .normalize()
        .transformDirection(body.matrixWorld);
      if (!isFrontFacing(point, normal, eye)) return [];
    }
    const ndc = point.clone().project(camera);
    if (ndc.z < -1 || ndc.z > 1) return [];
    const x = ((ndc.x + 1) * viewport.width) / 2;
    const y = ((1 - ndc.y) * viewport.height) / 2;
    if (!isProjectedPointVisible(x, y, viewport.width, viewport.height))
      return [];
    const label = city.label[viewport.language ?? "zh"];
    const labelUnits = label.length * (viewport.language === "en" ? 0.58 : 1);
    return [
      {
        id: city.id,
        x,
        y,
        width: viewport.tv
          ? Math.min(310, Math.max(128, labelUnits * 18 + 28))
          : Math.min(242, Math.max(104, labelUnits * 14 + 24)),
        height: viewport.tv ? 52 : 44,
        priority:
          city.id === focusedId
            ? 10000
            : city.featured
              ? 1000
              : city.capital
                ? 100
                : 0,
      },
    ];
  });
  const labels = placeGlobeHotspotLabels(anchors, viewport, previous).slice(
    0,
    viewport.width < 700 ? 5 : 12,
  );
  return {
    points: anchors.map((anchor) => ({
      id: anchor.id,
      x: anchor.x,
      y: anchor.y,
      featured: cities.find((city) => city.id === anchor.id)!.featured,
    })),
    labels,
  };
}
