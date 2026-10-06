import type { LocalizedText } from "./contentTypes";
import type { ImmersiveHotspot } from "./immersiveCatalog";

export interface GalleryStory extends ImmersiveHotspot {
  introduction: LocalizedText;
  gallery: NonNullable<ImmersiveHotspot["image"]>[];
  sectionTitle?: LocalizedText;
  events: {
    id: string;
    title: LocalizedText;
    date: string;
    description: LocalizedText;
    sourceUrls: string[];
    imageIndices: number[];
  }[];
}

export function isGalleryStory(
  hotspot: ImmersiveHotspot,
): hotspot is GalleryStory {
  return (
    "introduction" in hotspot &&
    "gallery" in hotspot &&
    Array.isArray(hotspot.gallery) &&
    "events" in hotspot &&
    Array.isArray(hotspot.events)
  );
}
