import { Vector3, type Group } from "three";
import type { PlanetId } from "../data/planets";
import type { InteractionState } from "../interaction/InteractionStateMachine";
import { assets } from "./content";
import type { ImmersiveSite } from "./immersiveCatalog";

export const bodyTransforms = new Map<PlanetId, Group>();
export const pickerModes: InteractionState[] = [
  "EARTH_CONTINENT_PICKER",
  "EARTH_COUNTRY_PICKER",
  "EARTH_CITY_PICKER",
  "PLANET_REGION_PICKER",
];
export const explorationModes: InteractionState[] = [
  ...pickerModes,
  "DESCENT_TRANSITION",
  "LOCATION_OVERVIEW",
  "INFO_PANEL_OPEN",
];

export function getSiteResourcePaths(site: ImmersiveSite) {
  const base = assets.find((asset) => asset.id === site.baseAssetId);
  return [
    ...new Set([
      ...(base ? [base.path] : []),
      ...site.hotspots.flatMap((hotspot) =>
        hotspot.image ? [hotspot.image.path] : [],
      ),
    ]),
  ];
}

// A labelled local geographic diagram, not a reconstructed city or terrain mesh.
export function localAtlasPoint(
  site: ImmersiveSite,
  latitude: number,
  longitude: number,
) {
  const kmPerDegree =
    site.bodyId === "mars" ? (Math.PI * 3389.5) / 180 : 111.32;
  const scale = 22 / site.spanKm;
  return new Vector3(
    (longitude - site.center.longitude) *
      kmPerDegree *
      Math.cos((site.center.latitude * Math.PI) / 180) *
      scale,
    0.35,
    -(latitude - site.center.latitude) * kmPerDegree * scale,
  );
}

export function descentPhase(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const veil = (p - 0.33) / 0.46;
  return {
    orbit: Math.min(1, p / 0.56),
    local: p === 1 ? 1 : Math.max(0, (p - 0.56) / 0.44),
    localVisible: p >= 0.56,
    cloudOpacity:
      veil <= 0 || veil >= 1 ? 0 : Math.pow(Math.sin(Math.PI * veil), 0.4),
  };
}

// Matches SphereGeometry UVs and the existing equirectangular Earth texture.
export function geographicPoint(
  latitude: number,
  longitude: number,
  radius = 1,
) {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return new Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}

export function facingRotation(latitude: number, longitude: number) {
  return {
    x: ((latitude - 13.3) * Math.PI) / 180,
    y: -Math.PI / 2 - (longitude * Math.PI) / 180,
  };
}
