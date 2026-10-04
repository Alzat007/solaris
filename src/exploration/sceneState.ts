import { Vector3, type Group } from "three";
import type { PlanetId } from "../data/planets";

export const bodyTransforms = new Map<PlanetId, Group>();
export const explorationModes = ["EXPLORATION_DIRECTORY", "LOCATION_TRANSITION", "LOCATION_VIEW"];

// Matches SphereGeometry UVs and the existing equirectangular Earth texture.
export function geographicPoint(latitude: number, longitude: number, radius = 1) {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  return new Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), -radius * Math.cos(lat) * Math.sin(lon));
}

export function facingRotation(latitude: number, longitude: number) {
  return { x: (latitude - 13.3) * Math.PI / 180, y: -Math.PI / 2 - longitude * Math.PI / 180 };
}
