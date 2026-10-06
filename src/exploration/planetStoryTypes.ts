import type { PlanetId } from "../data/planets";
import type { GalleryStory } from "./galleryStory";

export type AtlasPlanetId = Exclude<PlanetId, "earth" | "sun">;

export interface PlanetStory extends GalleryStory {
  bodyId: AtlasPlanetId;
  anchorKind: "surface" | "cloud" | "ring" | "phenomenon";
  // Ring anchors use the existing tilted Saturn ring plane, not a surface coordinate.
  ringRadius?: number;
  ringAngleDegrees?: number;
}
