import { cities, type EarthCity } from "../exploration/earthDirectory";
import {
  immersiveSites,
  type ImmersiveSite,
} from "../exploration/immersiveCatalog";
import type { GeographicTarget } from "./GlobeCameraActions";

export const earthSites = immersiveSites.filter(
  (site) => site.bodyId === "earth",
);
export const earthStoryHotspots = earthSites.flatMap((site) => site.hotspots);

export interface EarthCityMarker {
  id: string;
  name: EarthCity["name"];
  latitude: number;
  longitude: number;
  tags: EarthCity["tags"];
  priority: number;
}

export function cityMarkers(
  directory: readonly EarthCity[] = cities,
): EarthCityMarker[] {
  return directory
    .flatMap((city) => {
      const position = city.coordinates;
      if (
        !position ||
        !Number.isFinite(position.latitude) ||
        Math.abs(position.latitude) > 90 ||
        !Number.isFinite(position.longitude) ||
        Math.abs(position.longitude) > 180
      )
        return [];
      return [
        {
          id: city.id,
          name: city.name,
          ...position,
          tags: city.tags,
          priority: city.tags.includes("featured") ? 2 : 1,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.tags.includes("featured")) -
          Number(a.tags.includes("featured")) || a.id.localeCompare(b.id),
    );
}

export const earthCityMarkers = cityMarkers();

export function cityTarget(
  cityId: string,
  minimumHeight: number,
  directory: readonly EarthCityMarker[] = earthCityMarkers,
  sites: readonly ImmersiveSite[] = earthSites,
): GeographicTarget | null {
  const city = directory.find((entry) => entry.id === cityId);
  if (!city || !Number.isFinite(minimumHeight) || minimumHeight <= 0)
    return null;
  const center = sites.find((site) => site.cityId === city.id)?.center ?? city;
  return {
    longitude: center.longitude,
    latitude: center.latitude,
    height: Math.max(
      minimumHeight,
      minimumHeight >= 250_000 ? 500_000 : 30_000,
    ),
    name: city.name.zh,
  };
}
