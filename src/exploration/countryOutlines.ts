import { Vector3 } from "three";
import { geographicPoint } from "./sceneState";

export const COUNTRY_OUTLINES_PATH =
  "geography/ne_110m_admin_0_countries.geojson";
export const COUNTRY_OUTLINE_RADIUS = 1.003;
export const COUNTRY_OUTLINE_MAX_ARC_DEGREES = 2;

export type GeographicPosition = readonly [longitude: number, latitude: number];

export interface ParsedCountryOutlines {
  featureCount: number;
  rings: readonly (readonly GeographicPosition[])[];
}

export interface CountryOutlineSegments {
  positions: Float32Array;
  featureCount: number;
  lineCount: number;
  segmentCount: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonemptyArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path}: 必须是非空数组`);
  }
  return value;
}

function parsePosition(value: unknown, path: string): GeographicPosition {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    value[0] < -180 ||
    value[0] > 180 ||
    value[1] < -90 ||
    value[1] > 90
  ) {
    throw new Error(`${path}: 必须是有效的 [经度, 纬度]`);
  }
  return [value[0], value[1]];
}

function parseRing(value: unknown, path: string): GeographicPosition[] {
  const ring = nonemptyArray(value, path).map((position, index) =>
    parsePosition(position, `${path}[${index}]`),
  );
  if (ring.length < 4) {
    throw new Error(`${path}: 边界环至少需要四个坐标（含闭合点）`);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new Error(`${path}: 边界环必须闭合`);
  }
  if (new Set(ring.map(([lon, lat]) => `${lon},${lat}`)).size < 3) {
    throw new Error(`${path}: 边界环至少需要三个不同坐标`);
  }
  return ring;
}

export function parseCountryOutlines(value: unknown): ParsedCountryOutlines {
  if (!record(value) || value.type !== "FeatureCollection") {
    throw new Error("国家轮廓必须是 GeoJSON FeatureCollection");
  }
  // 本地数据采用 CRS84：坐标顺序始终为经度、纬度，不接收投影坐标。
  if (value.crs !== undefined) {
    const crs = value.crs;
    if (
      !record(crs) ||
      crs.type !== "name" ||
      !record(crs.properties) ||
      crs.properties.name !== "urn:ogc:def:crs:OGC:1.3:CRS84"
    ) {
      throw new Error("国家轮廓仅支持 CRS84 地理坐标");
    }
  }
  const features = nonemptyArray(value.features, "features");
  const rings: GeographicPosition[][] = [];
  features.forEach((feature, featureIndex) => {
    const path = `features[${featureIndex}]`;
    if (!record(feature) || feature.type !== "Feature") {
      throw new Error(`${path}: 必须是 GeoJSON Feature`);
    }
    const geometry = feature.geometry;
    if (
      !record(geometry) ||
      (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
    ) {
      throw new Error(`${path}: 仅支持 Polygon 或 MultiPolygon`);
    }
    const coordinates = nonemptyArray(
      geometry.coordinates,
      `${path}.coordinates`,
    );
    const polygons = geometry.type === "Polygon" ? [coordinates] : coordinates;
    polygons.forEach((polygon, polygonIndex) => {
      const polygonPath = `${path}.polygons[${polygonIndex}]`;
      for (const [ringIndex, ring] of nonemptyArray(
        polygon,
        polygonPath,
      ).entries()) {
        rings.push(parseRing(ring, `${polygonPath}.rings[${ringIndex}]`));
      }
    });
  });
  return { featureCount: features.length, rings };
}

export function buildCountryOutlineSegments(
  data: ParsedCountryOutlines,
): CountryOutlineSegments {
  const positions: number[] = [];
  const maxArc = (COUNTRY_OUTLINE_MAX_ARC_DEGREES * Math.PI) / 180;
  const point = new Vector3();
  for (const ring of data.rings) {
    for (let edge = 1; edge < ring.length; edge += 1) {
      const [startLon, startLat] = ring[edge - 1];
      const [endLon, endLat] = ring[edge];
      const start = geographicPoint(startLat, startLon);
      const end = geographicPoint(endLat, endLon);
      const dot = Math.max(-1, Math.min(1, start.dot(end)));
      if (dot > 1 - 1e-14) continue;
      if (dot < -1 + 1e-12) {
        throw new Error("国家轮廓包含对跖点边，无法确定唯一短球面路径");
      }
      const angle = Math.acos(dot);
      const steps = Math.max(1, Math.ceil(angle / maxArc));
      const inverseSin = 1 / Math.sin(angle);
      let previous = start.clone().multiplyScalar(COUNTRY_OUTLINE_RADIUS);
      // 最短球面插值自然跨过反子午线；分成小弦后仍全部位于地表外侧。
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        point
          .copy(start)
          .multiplyScalar(Math.sin((1 - t) * angle) * inverseSin)
          .addScaledVector(end, Math.sin(t * angle) * inverseSin)
          .normalize()
          .multiplyScalar(COUNTRY_OUTLINE_RADIUS);
        positions.push(
          previous.x,
          previous.y,
          previous.z,
          point.x,
          point.y,
          point.z,
        );
        previous.copy(point);
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    featureCount: data.featureCount,
    lineCount: data.rings.length,
    segmentCount: positions.length / 6,
  };
}
