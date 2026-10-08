import type { GalleryStory } from "./galleryStory";
import { immersiveSites, type ImmersiveHotspotImage } from "./immersiveCatalog";
import { rockPlanetStories } from "./planetStoriesRock";
import { gasPlanetStories } from "./planetStoriesGas";
import { moonPlanetStories } from "./planetStoriesMoon";

export interface StoryImagePresentation {
  fit: "cover" | "contain";
  position?: string;
}

// Preserve scientific annotations and framing without changing audited images.
const scientificImages = new Set([
  ...[...rockPlanetStories, ...gasPlanetStories, ...moonPlanetStories].flatMap(
    (story) => story.gallery.map((image) => image.path),
  ),
  ...immersiveSites
    .filter((site) => site.bodyId !== "earth")
    .flatMap((site) => site.hotspots.flatMap((spot) => spot.image?.path ?? [])),
]);

export function getStoryImagePresentation(
  image: ImmersiveHotspotImage,
  override?: StoryImagePresentation,
): StoryImagePresentation {
  return {
    fit: scientificImages.has(image.path) ? "contain" : "cover",
    position: "50% 50%",
    ...override,
  };
}

export function getGalleryEvent(
  story: GalleryStory,
  imageIndex: number,
  preferredId?: string | null,
) {
  return (
    story.events.find(
      (event) =>
        event.id === preferredId && event.imageIndices.includes(imageIndex),
    ) ?? story.events.find((event) => event.imageIndices.includes(imageIndex))
  );
}

export function visibleGalleryIndices(length: number, selected: number) {
  const size = Math.min(4, Math.max(0, length));
  const start = Math.max(0, Math.min(selected - 1, length - size));
  return Array.from({ length: size }, (_, offset) => start + offset);
}
