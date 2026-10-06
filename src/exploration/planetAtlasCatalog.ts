import { Euler, Vector3 } from "three";
import type { PlanetId } from "../data/planets";
import type { LocalizedText } from "./contentTypes";
import { getAtlasCity, getAtlasStory } from "./earthAtlasCatalog";
import type { GalleryStory } from "./galleryStory";
import { rockPlanetStories } from "./planetStoriesRock";
import { gasPlanetStories } from "./planetStoriesGas";
import type { PlanetStory } from "./planetStoryTypes";
import { firstBatchCities, firstBatchCityStories } from "./firstBatchEarth";
import { cityLandmarks, getCityLandmark } from "./cityLandmarks";
import { mergeBilingualLabel } from "./bilingualLabels";
import { normalizeDirectoryName } from "./earthDirectory";

export interface AtlasAnnotation {
  id: string;
  name: LocalizedText;
  label: LocalizedText;
  latitude: number;
  longitude: number;
  featured: boolean;
  capital: boolean;
  localPosition?: readonly [number, number, number];
  cityId?: string;
  aliases?: readonly string[];
}

export const planetStories: PlanetStory[] = [
  ...rockPlanetStories,
  ...gasPlanetStories,
];
const storyById = new Map(planetStories.map((story) => [story.id, story]));
const earthStories = new Map(
  firstBatchCityStories.map((story) => [story.id, story]),
);
const earthAnnotations: AtlasAnnotation[] = firstBatchCities.map((city) =>
  mergeBilingualLabel({ ...city, featured: earthStories.has(city.id) }),
);
const landmarkAnnotations: AtlasAnnotation[] = cityLandmarks.map((landmark) =>
  mergeBilingualLabel({
    id: landmark.id,
    cityId: landmark.cityId,
    name: landmark.name,
    label: landmark.name,
    latitude: landmark.latitude,
    longitude: landmark.longitude,
    featured: true,
    capital: false,
  }),
);

export function ringAnchor(radius: number, angleDegrees: number) {
  const angle = (angleDegrees * Math.PI) / 180;
  return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    .applyEuler(new Euler(0.5, 0, -0.3))
    .toArray() as [number, number, number];
}

const annotations = new Map<PlanetId, AtlasAnnotation[]>();
for (const story of planetStories) {
  const list = annotations.get(story.bodyId) ?? [];
  list.push(
    mergeBilingualLabel({
      id: story.id,
      name: story.name,
      label: story.name,
      latitude: story.latitude,
      longitude: story.longitude,
      featured: true,
      capital: false,
      ...(story.anchorKind === "ring"
        ? {
            localPosition: ringAnchor(
              story.ringRadius ?? 1.7,
              story.ringAngleDegrees ?? 45,
            ),
          }
        : {}),
    }),
  );
  annotations.set(story.bodyId, list);
}

export function getPlanetAnnotations(
  bodyId: PlanetId,
): readonly AtlasAnnotation[] {
  return bodyId === "earth"
    ? earthAnnotations
    : (annotations.get(bodyId) ?? []);
}

export function getVisiblePlanetAnnotations(
  bodyId: PlanetId,
  cityId: string | null,
) {
  if (bodyId !== "earth" || !cityId) return getPlanetAnnotations(bodyId);
  const city = earthAnnotations.find((entry) => entry.id === cityId);
  return city
    ? [city, ...landmarkAnnotations.filter((entry) => entry.cityId === cityId)]
    : earthAnnotations;
}

export function searchPlanetAnnotations(
  bodyId: PlanetId,
  query: string,
  cityId: string | null = null,
) {
  const needle = normalizeDirectoryName(query);
  return getVisiblePlanetAnnotations(bodyId, cityId).filter((entry) =>
    [entry.name.zh, entry.name.en, ...(entry.aliases ?? [])].some((value) =>
      normalizeDirectoryName(value).includes(needle),
    ),
  );
}

export function getPlanetAnnotation(
  bodyId: PlanetId,
  id: string,
): AtlasAnnotation | undefined {
  return bodyId === "earth"
    ? (earthAnnotations.find((entry) => entry.id === id) ??
        landmarkAnnotations.find((entry) => entry.id === id) ??
        getAtlasCity(id))
    : getPlanetAnnotations(bodyId).find((entry) => entry.id === id);
}

export function getPlanetStory(
  bodyId: PlanetId,
  id: string,
): GalleryStory | undefined {
  if (bodyId === "earth") {
    const story = getCityLandmark(id) ?? earthStories.get(id);
    if (story) return story;
    // Older directory records remain available, but new batch entries never masquerade as finished stories.
    if (!firstBatchCities.some((city) => city.id === id))
      return getAtlasStory(id);
    return;
  }
  const story = storyById.get(id);
  return story?.bodyId === bodyId ? story : undefined;
}
