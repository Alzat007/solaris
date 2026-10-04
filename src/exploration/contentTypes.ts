import type { PlanetId } from "../data/planets";

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface ContentReview {
  status: "source-checked" | "pending";
  by: string | null;
  checkedAt: string | null;
  humanReview: "pending" | "approved";
}

export interface ContentSource {
  id: string;
  title: string;
  url: string;
  institution: string;
  review: ContentReview;
}

export type DestinationKind =
  | "natural-region"
  | "landing-site"
  | "city"
  | "observation";

export interface DestinationPosition {
  latitude: number;
  longitude: number;
  coordinateSystem: "WGS84" | "planetocentric-east" | "source-unspecified-east";
  exact: boolean;
  description: LocalizedText;
  sourceIds: string[];
}

export interface Destination {
  id: string;
  bodyId: PlanetId;
  cityId?: string;
  kind: DestinationKind;
  name: LocalizedText;
  summary: LocalizedText;
  position?: DestinationPosition;
  locationDescription: LocalizedText;
  approach: "surface" | "atmosphere" | "observation";
  storyIds: string[];
  assetIds: string[];
  sourceIds: string[];
  status: "ready" | "draft";
  review: ContentReview;
}

export type StoryRelation =
  | "event-at-site"
  | "remote-observation"
  | "topic-related";

export interface StoryLink {
  destinationId: string;
  relation: StoryRelation;
  description: LocalizedText;
}

export interface Story {
  id: string;
  title: LocalizedText;
  date: string;
  summary: LocalizedText;
  body: LocalizedText;
  topics: string[];
  links: StoryLink[];
  sourceIds: string[];
  assetIds: string[];
  review: ContentReview;
}

export type AssetRole =
  | "event-record"
  | "landmark-photo"
  | "orbital-image"
  | "scientific-visualization"
  | "artistic-illustration";

export interface Asset {
  id: string;
  path: string;
  sourceUrl: string;
  originalUrl: string;
  rightsUrl: string;
  license: string;
  credit: string;
  date: string;
  location: LocalizedText;
  role: AssetRole;
  caption: LocalizedText;
  processing: LocalizedText;
  aiGenerated: boolean;
  projection: "ordinary-photo" | "orbital-map" | "panorama";
  review: ContentReview;
}

export interface ContentPackFile {
  assetId: string;
  path: string;
  bytes: number;
  sha256: string;
}

export interface ContentPack {
  id: string;
  version: string;
  destinationIds: string[];
  assetIds: string[];
  files: ContentPackFile[];
  totalBytes: number;
  offlineStatus: "bundled-assets-only" | "not-cached" | "verified-offline";
  browserColdStartVerified: boolean;
}

export interface ExplorationContent {
  version: string;
  destinations: Destination[];
  stories: Story[];
  assets: Asset[];
  sources: ContentSource[];
  contentPacks: ContentPack[];
}
