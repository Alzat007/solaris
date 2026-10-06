import records from "../../data/first-batch-landmarks.json" with { type: "json" };
import specs from "../../data/first-batch-landmark-spec.json" with { type: "json" };
import audit from "../../data/first-batch-landmark-review.json" with { type: "json" };
import facts from "../../data/first-batch-landmark-facts.json" with { type: "json" };
import type { LocalizedText } from "./contentTypes";
import type { GalleryStory } from "./galleryStory";
import type { ImmersiveHotspotImage } from "./immersiveCatalog";
import { cityLandmarkImageNotes } from "./cityLandmarkImageNotes";

interface SourceImage {
  path: string;
  filename: string;
  sourceUrl: string;
  author: string;
  date: string;
  license: string;
  licenseUrl: string;
  sha256: string;
  sourceSha1: string;
}
interface LandmarkRecord {
  id: string;
  cityId: string;
  entityId: string;
  name: LocalizedText;
  topic: LocalizedText;
  latitude: number;
  longitude: number;
  sourceUrls: string[];
  images: SourceImage[];
}
const text = (zh: string, en: string): LocalizedText => ({ zh, en });

export interface CityLandmark extends GalleryStory {
  cityId: string;
}

function photo(
  record: LandmarkRecord,
  image: SourceImage,
): ImmersiveHotspotImage {
  const note = cityLandmarkImageNotes[image.filename];
  return {
    path: image.path,
    sourceUrl: image.sourceUrl,
    date: note?.date ?? image.date,
    license: image.license,
    licenseUrl: image.licenseUrl,
    credit: `${note?.credit ?? image.author} / Wikimedia Commons / ${image.license}`,
    caption:
      note?.caption ??
      text(
        `${record.name.zh}地点配图：${image.filename}。照片不是实时影像，也不冒充历史事件发生时的现场。拍摄日期及作者处理记录以来源文件为准。`,
        `${record.name.en} site illustration: ${image.filename}. Not a live view or a photograph of a historical event. See the source file for the shooting date and author's processing history.`,
      ),
    processing:
      note?.processing ??
      text(
        "使用 Wikimedia 官方等比例尺寸版本，未本地裁剪、调色或合成；作者可能已做 HDR 等处理，原记录与许可见图片来源。",
        "Official Wikimedia proportional size variant, with no local crop, recoloring or compositing. The author may have applied HDR or other processing; see the original record and license.",
      ),
  };
}

export const cityLandmarks: CityLandmark[] = (records as LandmarkRecord[])
  .filter(
    (record) =>
      ((facts as Record<string, string[]>)[record.id]?.length ?? 0) > 0 &&
      record.images.every((image) =>
        (audit as Record<string, string[]>)[record.id]?.includes(
          image.sourceSha1,
        ),
      ) &&
      record.images.length >= 2 &&
      new Set(record.images.map((image) => image.sourceSha1)).size >= 2 &&
      new Set(record.images.map((image) => image.sha256)).size >= 2,
  )
  .map((record) => {
    const gallery = record.images.map((image) => photo(record, image));
    const sourceUrls = [
      ...new Set([
        ...((facts as Record<string, string[]>)[record.id] ?? []),
        ...record.sourceUrls,
      ]),
    ];
    const topic = {
      id: `${record.id}-learning`,
      title: text(
        "建筑、文化与科学观察",
        "Architecture, culture and observation",
      ),
      date: "",
      description: record.topic,
      sourceUrls,
      imageIndices: gallery.map((_, index) => index),
    };
    return {
      id: `city-landmark-${record.id}`,
      cityId: record.cityId,
      name: record.name,
      latitude: record.latitude,
      longitude: record.longitude,
      coordinateAccuracy: "approximate" as const,
      coordinateNote: text(
        `地点位置采用 Wikidata ${record.entityId}；为球面示意锚点，区域入口不代表整个区域边界，也不是道路导航或照片机位。`,
        `Position from Wikidata ${record.entityId}; an orientation anchor on the globe, not the boundary of an entire area, a routing location or camera position.`,
      ),
      introduction: record.topic,
      summary: record.topic,
      paragraphs: [record.topic],
      date: "",
      relation: text(
        "地点照片用于认识建筑、文化或自然环境。未指定历史事件的条目只讲可核对的地点知识，不自动生成历史故事。",
        "Site photographs introduce architecture, culture or natural environments. Entries without a specified historical event present checkable site knowledge, not automatically invented stories.",
      ),
      sourceUrls,
      sectionTitle: text("文化与科学", "Culture and science"),
      events: [topic],
      gallery,
      image: gallery[0],
      humanReview: "pending" as const,
    };
  });

export const getCityLandmarks = (cityId: string) =>
  cityLandmarks.filter((landmark) => landmark.cityId === cityId);

export const pendingCityLandmarks = specs.filter(
  (spec) =>
    !cityLandmarks.some(
      (landmark) => landmark.id === `city-landmark-${spec.id}`,
    ),
);

export const getCityLandmark = (id: string) =>
  cityLandmarks.find((landmark) => landmark.id === id);
