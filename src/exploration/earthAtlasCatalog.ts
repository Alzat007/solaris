import {
  cities,
  countries,
  earthDirectory,
  type EarthCity,
} from "./earthDirectory";
import { cityStories, type CityStory } from "./cityStories";

export interface AtlasCity {
  id: string;
  name: EarthCity["name"];
  label: EarthCity["name"];
  latitude: number;
  longitude: number;
  capital: boolean;
  featured: boolean;
  countryName: EarthCity["name"];
}

export const featuredAtlasIds = [
  "city-beijing",
  "city-shanghai",
  "city-new-york",
  "city-washington-dc",
  "city-paris",
  "city-london",
  "city-tokyo",
  "city-seoul",
  "city-moscow",
  "city-singapore",
];
const countryById = new Map(countries.map((country) => [country.id, country]));
const storiesById = new Map(cityStories.map((story) => [story.id, story]));

export function buildAtlasCities(
  directory: readonly EarthCity[] = cities,
): AtlasCity[] {
  const records: AtlasCity[] = directory.flatMap((city) => {
    const position = city.coordinates;
    if (
      !position ||
      !Number.isFinite(position.latitude) ||
      Math.abs(position.latitude) > 90 ||
      !Number.isFinite(position.longitude) ||
      Math.abs(position.longitude) > 180
    )
      return [];
    const countryId = city.countryIds.includes("us")
      ? "us"
      : city.countryIds[0];
    const countryName = countryById.get(countryId)?.name ?? {
      zh: "国家／地区待核验",
      en: "Country/territory pending review",
    };
    const featured = featuredAtlasIds.includes(city.id);
    return [
      {
        id: city.id,
        name: city.name,
        label: {
          zh:
            ["city-beijing", "city-new-york"].includes(city.id) ||
            city.name.zh === countryName.zh
              ? city.name.zh
              : `${countryName.zh}·${city.name.zh}`,
          en: `${countryName.en} · ${city.name.en}`,
        },
        ...position,
        countryName,
        capital: city.tags.includes("capital"),
        featured,
      },
    ];
  });
  for (const story of cityStories) {
    if (records.some((city) => city.id === story.id)) continue;
    // Shanghai is a source-checked addition; it is not silently inserted into the capital database.
    if (story.id === "city-shanghai")
      records.push({
        id: story.id,
        name: story.name,
        label: story.name,
        latitude: story.latitude,
        longitude: story.longitude,
        countryName: countryById.get("cn")!.name,
        capital: false,
        featured: true,
      });
  }
  return records.sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      a.name.zh.localeCompare(b.name.zh, "zh-CN"),
  );
}

export const atlasCities = buildAtlasCities();
export const getAtlasCity = (id: string) =>
  atlasCities.find((city) => city.id === id);

export function getAtlasStory(id: string): CityStory | undefined {
  const reviewed = storiesById.get(id);
  if (reviewed) return reviewed;
  const city = getAtlasCity(id);
  if (!city) return;
  const introduction = {
    zh: `${city.name.zh}是地球目录中的${city.capital ? "首都" : "城市"}条目，关联国家／地区为${city.countryName.zh}。此目录记录的首都角色及生效日期仍待逐条审核。`,
    en: `${city.name.en} is a ${city.capital ? "capital" : "city"} entry associated with ${city.countryName.en} in the Earth Directory. Capital roles and effective dates remain pending individual review.`,
  };
  return {
    id: city.id,
    name: city.label,
    latitude: city.latitude,
    longitude: city.longitude,
    introduction,
    summary: introduction,
    paragraphs: [],
    date: "",
    events: [],
    gallery: [],
    coordinateAccuracy: "approximate",
    coordinateNote: {
      zh: "城市目录示意锚点，不是街道导航或照片机位。",
      en: "A city-directory orientation anchor, not a street-navigation or camera position.",
    },
    relation: {
      zh: "此条目目前只有目录信息。历史故事与授权照片尚未录入，不代表图文已完成。",
      en: "Directory information only. Historical stories and licensed photographs are not yet available; this is not a completed story entry.",
    },
    sourceUrls: [earthDirectory.databaseLicense.sourceUrl],
    humanReview: "pending",
  };
}
