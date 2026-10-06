export interface HotspotScaleLimits {
  showBelow: number;
  hideAbove: number;
  showAbove?: number;
  hideBelow?: number;
}

export const DEFAULT_HOTSPOT_SCALE: HotspotScaleLimits = {
  showBelow: 140,
  hideAbove: 200,
};

export const EARTH_LABEL_SCALES = {
  ion: {
    story: DEFAULT_HOTSPOT_SCALE,
    city: { showBelow: 6000, hideAbove: 8000, showAbove: 230, hideBelow: 200 },
  },
  local: {
    story: { showBelow: 1000, hideAbove: 1300 },
    city: {
      showBelow: 6000,
      hideAbove: 8000,
      showAbove: 1500,
      hideBelow: 1300,
    },
  },
} satisfies Record<
  "ion" | "local",
  Record<"story" | "city", HotspotScaleLimits>
>;

export function exceedsHotspotDragThreshold(
  start: { x: number; y: number },
  end: { x: number; y: number },
  threshold = 6,
): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) > threshold;
}

export function nextHotspotVisibility(
  visible: boolean,
  metersPerPixel: number,
  limits: HotspotScaleLimits = DEFAULT_HOTSPOT_SCALE,
): boolean {
  if (
    !Number.isFinite(metersPerPixel) ||
    metersPerPixel <= 0 ||
    !Number.isFinite(limits.showBelow) ||
    !Number.isFinite(limits.hideAbove) ||
    limits.showBelow <= 0 ||
    limits.hideAbove <= limits.showBelow
  )
    return false;
  if (limits.showAbove !== undefined || limits.hideBelow !== undefined) {
    if (
      !Number.isFinite(limits.showAbove) ||
      !Number.isFinite(limits.hideBelow) ||
      limits.hideBelow! < 0 ||
      limits.showAbove! <= limits.hideBelow! ||
      limits.showAbove! >= limits.showBelow
    )
      return false;
    if (
      visible
        ? metersPerPixel <= limits.hideBelow!
        : metersPerPixel < limits.showAbove!
    )
      return false;
  }
  return visible
    ? metersPerPixel < limits.hideAbove
    : metersPerPixel <= limits.showBelow;
}

export interface VectorPoint {
  x: number;
  y: number;
  z: number;
}

export function isFrontFacing(
  point: VectorPoint,
  outwardNormal: VectorPoint,
  camera: VectorPoint,
): boolean {
  const facing =
    (camera.x - point.x) * outwardNormal.x +
    (camera.y - point.y) * outwardNormal.y +
    (camera.z - point.z) * outwardNormal.z;
  return Number.isFinite(facing) && facing > 0;
}

export function isTerrainOccluded(
  pointDistance: number,
  terrainHitDistance: number | undefined,
  toleranceMeters = 2,
): boolean {
  return (
    Number.isFinite(pointDistance) &&
    terrainHitDistance !== undefined &&
    Number.isFinite(terrainHitDistance) &&
    terrainHitDistance + Math.max(0, toleranceMeters) < pointDistance
  );
}

export function isProjectedPointVisible(
  x: number,
  y: number,
  width: number,
  height: number,
  inset = 22,
): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= inset &&
    y >= inset &&
    x <= width - inset &&
    y <= height - inset
  );
}

export interface HotspotAnchor {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority?: number;
}

export interface HotspotLabel extends HotspotAnchor {
  left: number;
  top: number;
  dx: number;
  dy: number;
  elbow: { x: number; y: number };
  endpoint: { x: number; y: number };
}

export interface HotspotViewport {
  width: number;
  height: number;
  insetTop?: number;
  insetBottom?: number;
}

function overlaps(a: HotspotLabel, b: HotspotLabel): boolean {
  const gap = 8;
  return (
    a.left < b.left + b.width + gap &&
    a.left + a.width + gap > b.left &&
    a.top < b.top + b.height + gap &&
    a.top + a.height + gap > b.top
  );
}

/** Reuse the last relative label offset before trying new collision slots. */
export function placeGlobeHotspotLabels(
  anchors: HotspotAnchor[],
  viewport: HotspotViewport,
  previous = new Map<string, { dx: number; dy: number }>(),
): HotspotLabel[] {
  const placed: HotspotLabel[] = [];
  const sorted = [...anchors].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id),
  );
  for (const anchor of sorted) {
    const width = Math.min(anchor.width, viewport.width - 24);
    const height = Math.max(44, anchor.height);
    if (width <= 0 || height > viewport.height - 24) continue;
    const offsets = [
      previous.get(anchor.id),
      { dx: 30, dy: -height - 20 },
      { dx: -width - 30, dy: -height - 20 },
      { dx: 30, dy: 20 },
      { dx: -width - 30, dy: 20 },
      { dx: -width / 2, dy: -height - 78 },
      { dx: -width / 2, dy: 78 },
    ];
    for (const offset of offsets) {
      if (!offset) continue;
      const minTop = viewport.insetTop ?? 78;
      const maxTop = viewport.height - (viewport.insetBottom ?? 64) - height;
      if (maxTop < minTop) continue;
      const left = Math.max(
        12,
        Math.min(viewport.width - width - 12, anchor.x + offset.dx),
      );
      const top = Math.max(minTop, Math.min(maxTop, anchor.y + offset.dy));
      const endpoint = {
        x: anchor.x < left + width / 2 ? left : left + width,
        y: top + height / 2,
      };
      const label: HotspotLabel = {
        ...anchor,
        width,
        height,
        left,
        top,
        dx: left - anchor.x,
        dy: top - anchor.y,
        elbow: { x: endpoint.x, y: anchor.y },
        endpoint,
      };
      if (placed.some((other) => overlaps(label, other))) continue;
      placed.push(label);
      break;
    }
  }
  return placed;
}
