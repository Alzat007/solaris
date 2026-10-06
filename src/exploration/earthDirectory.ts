import snapshot from "../../data/earth-directory-source.json" with { type: "json" };
import { mergeBilingualLabel } from "./bilingualLabels";

export type CityTag = "capital" | "featured";
export interface DirectorySource {
  id: string;
  title: string;
  url: string;
  revision: string;
  retrievedAt: string;
  license: string;
  licenseUrl: string;
}
export interface CapitalRelation {
  cityId: string;
  roles: string[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
  notes: string;
  sourceRefs: string[];
}
export interface CountryEntry {
  id: string;
  name: { zh: string; en: string };
  aliases: string[];
  sourceStatus: string;
  independent: boolean | null;
  unMember: boolean | null;
  capitalRelations: CapitalRelation[];
  notes: string;
  sourceRefs: string[];
}
export interface EarthCity {
  id: string;
  name: { zh: string; en: string };
  aliases: string[];
  countryIds: string[];
  tags: CityTag[];
  coordinates: { latitude: number; longitude: number } | null;
  translationStatus: "editorial-alias" | "pending";
  contentStatus: "pending";
  notes: string;
  sourceRefs: string[];
}
export interface EarthDirectory {
  version: string;
  databaseLicense: {
    id: string;
    url: string;
    attribution: string;
    sourceUrl: string;
    downloadUrl: string;
  };
  baseline: {
    scope: string;
    scopeEn: string;
    sourceId: string;
    expectedCountryEntries: number;
    expectedCapitalRelations: number;
    sourceSha256: string;
    featuredSelection: string;
  };
  sources: DirectorySource[];
  countries: CountryEntry[];
  cities: EarthCity[];
}

export const earthDirectory: EarthDirectory = {
  ...(snapshot as EarthDirectory),
  cities: (snapshot as EarthDirectory).cities.map((city) =>
    mergeBilingualLabel(city),
  ),
};
export const countries = earthDirectory.countries;
export const cities = earthDirectory.cities;

export function normalizeDirectoryName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}

export function getEarthCity(id: string) {
  return cities.find((city) => city.id === id);
}

export function getCountryEntry(id: string) {
  return countries.find((country) => country.id === id.toLowerCase());
}

export function searchEarthCities(
  query: string,
  filters: { countryId?: string; tag?: CityTag } = {},
  directory: EarthDirectory = earthDirectory,
) {
  const needle = normalizeDirectoryName(query);
  const countryId = filters.countryId?.toLowerCase();
  const countryNames = new Map(
    directory.countries.map((country) => [
      country.id,
      [country.name.zh, country.name.en, ...country.aliases],
    ]),
  );
  return directory.cities.filter((city) => {
    if (countryId && !city.countryIds.includes(countryId)) return false;
    if (filters.tag && !city.tags.includes(filters.tag)) return false;
    if (!needle) return true;
    const names = [
      city.name.zh,
      city.name.en,
      ...city.aliases,
      ...city.countryIds.flatMap((id) => countryNames.get(id) || []),
    ];
    return names.some((name) => normalizeDirectoryName(name).includes(needle));
  });
}

export function earthDirectoryStats(
  directory: EarthDirectory = earthDirectory,
) {
  return {
    countryEntries: directory.countries.length,
    entriesWithCapitals: directory.countries.filter(
      (country) => country.capitalRelations.length,
    ).length,
    capitalRelations: directory.countries.reduce(
      (count, country) => count + country.capitalRelations.length,
      0,
    ),
    multiCapitalEntries: directory.countries.filter(
      (country) => country.capitalRelations.length > 1,
    ).length,
    cities: directory.cities.length,
    capitalCities: directory.cities.filter((city) =>
      city.tags.includes("capital"),
    ).length,
    featuredCities: directory.cities.filter((city) =>
      city.tags.includes("featured"),
    ).length,
    citiesWithCoordinates: directory.cities.filter((city) => city.coordinates)
      .length,
    citiesWithChineseAliases: directory.cities.filter(
      (city) => city.translationStatus === "editorial-alias",
    ).length,
    pendingContentCities: directory.cities.filter(
      (city) => city.contentStatus === "pending",
    ).length,
  };
}

export function validateEarthDirectory(directory: EarthDirectory): string[] {
  const errors: string[] = [];
  const license = directory.databaseLicense;
  if (
    !license ||
    license.id !== "ODbL-1.0" ||
    !license.attribution?.trim() ||
    ![license.url, license.sourceUrl, license.downloadUrl].every((url) =>
      url?.startsWith("https://"),
    )
  )
    errors.push(
      "missing database license, attribution or public data download",
    );
  const sourceIds = new Set(directory.sources.map((source) => source.id));
  const countryIds = new Set<string>();
  const cityIds = new Set<string>();
  const cityById = new Map(directory.cities.map((city) => [city.id, city]));
  const capitalCityIds = new Set<string>();
  const checkSources = (refs: string[], path: string) => {
    if (!refs.length || refs.some((id) => !sourceIds.has(id)))
      errors.push(`${path}: missing or unknown source`);
  };
  const checkNames = (
    name: { zh: string; en: string },
    aliases: string[],
    path: string,
  ) => {
    if (!name.zh.trim() || !name.en.trim()) errors.push(`${path}: empty name`);
    const normalized = aliases.map(normalizeDirectoryName);
    if (normalized.some((alias) => !alias)) errors.push(`${path}: empty alias`);
    if (new Set(normalized).size !== normalized.length)
      errors.push(`${path}: duplicate alias`);
  };
  const dateValid = (value: string | null) =>
    value === null ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value);

  for (const source of directory.sources) {
    if (!source.id || !source.url.startsWith("https://") || !source.license)
      errors.push(`source ${source.id}: missing provenance or license`);
  }
  if (sourceIds.size !== directory.sources.length)
    errors.push("duplicate source ID");
  if (!sourceIds.has(directory.baseline.sourceId))
    errors.push("unknown baseline source");
  if (directory.countries.length !== directory.baseline.expectedCountryEntries)
    errors.push("country entry count differs from declared snapshot baseline");

  for (const country of directory.countries) {
    if (!/^[a-z]{2}$/.test(country.id))
      errors.push(`country ${country.id}: invalid ID`);
    if (countryIds.has(country.id))
      errors.push(`country ${country.id}: duplicate ID`);
    countryIds.add(country.id);
    checkNames(country.name, country.aliases, `country ${country.id}`);
    checkSources(country.sourceRefs, `country ${country.id}`);
    const relationKeys = new Set<string>();
    for (const relation of country.capitalRelations) {
      const city = cityById.get(relation.cityId);
      const path = `country ${country.id} capital ${relation.cityId}`;
      if (!city || !city.countryIds.includes(country.id))
        errors.push(`${path}: missing city or country association`);
      if (!relation.roles.length || relation.roles.some((role) => !role.trim()))
        errors.push(`${path}: missing role`);
      if (
        !dateValid(relation.effectiveFrom) ||
        !dateValid(relation.effectiveTo)
      )
        errors.push(`${path}: invalid effective date`);
      if (
        relation.effectiveFrom &&
        relation.effectiveTo &&
        relation.effectiveFrom > relation.effectiveTo
      )
        errors.push(`${path}: reversed effective dates`);
      const key = `${relation.cityId}:${[...relation.roles].sort().join(",")}:${relation.effectiveFrom}:${relation.effectiveTo}`;
      if (relationKeys.has(key)) errors.push(`${path}: duplicate relation`);
      relationKeys.add(key);
      capitalCityIds.add(relation.cityId);
      checkSources(relation.sourceRefs, path);
    }
  }

  const cityKeys = new Set<string>();
  for (const city of directory.cities) {
    const path = `city ${city.id}`;
    if (!/^city-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(city.id))
      errors.push(`${path}: invalid ID`);
    if (cityIds.has(city.id)) errors.push(`${path}: duplicate ID`);
    cityIds.add(city.id);
    checkNames(city.name, city.aliases, path);
    checkSources(city.sourceRefs, path);
    if (
      !city.countryIds.length ||
      city.countryIds.some((id) => !countryIds.has(id))
    )
      errors.push(`${path}: unknown country`);
    if (new Set(city.countryIds).size !== city.countryIds.length)
      errors.push(`${path}: duplicate country association`);
    const key = `${normalizeDirectoryName(city.name.en)}:${[...city.countryIds].sort().join(",")}`;
    if (cityKeys.has(key)) errors.push(`${path}: duplicate city record`);
    cityKeys.add(key);
    if (
      !city.tags.length ||
      city.tags.some((tag) => !["capital", "featured"].includes(tag)) ||
      new Set(city.tags).size !== city.tags.length
    )
      errors.push(`${path}: invalid or duplicate tag`);
    if (city.tags.includes("capital") !== capitalCityIds.has(city.id))
      errors.push(`${path}: capital tag differs from capital relationships`);
    const p = city.coordinates;
    if (
      p &&
      (!Number.isFinite(p.latitude) ||
        !Number.isFinite(p.longitude) ||
        Math.abs(p.latitude) > 90 ||
        Math.abs(p.longitude) > 180)
    )
      errors.push(`${path}: invalid coordinates`);
    if (city.contentStatus !== "pending")
      errors.push(`${path}: directory cannot approve story content`);
  }
  if (
    earthDirectoryStats(directory).capitalRelations !==
    directory.baseline.expectedCapitalRelations
  )
    errors.push(
      "capital relationship count differs from declared snapshot baseline",
    );
  return errors;
}
