import mapping from "../../data/bilingual-label-mapping.json" with { type: "json" };
import uiCandidates from "../../data/bilingual-ui-candidates.json" with { type: "json" };
import type { LocalizedText } from "./contentTypes";

export type LabelLanguage = keyof LocalizedText;
export type UiLabelKey = keyof typeof uiCandidates.ui;
export interface NamedLabel {
  id: string;
  name: LocalizedText;
  aliases?: readonly string[];
}
interface LabelMapping {
  externalId: string;
  currentId: string | null;
  status: "confirmed" | "new" | "ambiguous" | "not_adopted";
  candidateName: LocalizedText;
  candidateAliases: readonly string[];
}

const identityCollections = [
  "cities",
  "landmarks",
  "planetaryFeatures",
  "bodies",
] as const;
export const bilingualLabelMappings = identityCollections.flatMap(
  (key) => mapping.mappings[key] as LabelMapping[],
);
const confirmed = new Map(
  bilingualLabelMappings
    .filter((entry) => entry.status === "confirmed" && entry.currentId)
    .map((entry) => [entry.currentId!, entry]),
);

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function usable(value: unknown): value is string {
  return hasText(value) && !/<[^>]+>/.test(value);
}

function aliasKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}

export function getBilingualAliases(id: string): readonly string[] {
  return confirmed.get(id)?.candidateAliases.filter(usable) ?? [];
}

// Only names and aliases cross this boundary; external content fields never do.
export function mergeBilingualLabel<T extends NamedLabel>(
  current: T,
): T & { aliases?: readonly string[] } {
  const candidate = confirmed.get(current.id);
  if (!candidate) return current;
  const name = { ...current.name };
  let changedName = false;
  for (const language of ["zh", "en"] as const) {
    if (!hasText(name[language]) && usable(candidate.candidateName[language])) {
      name[language] = candidate.candidateName[language];
      changedName = true;
    }
  }
  const aliases = [...(current.aliases ?? [])];
  const known = new Set(
    [...aliases, name.zh, name.en].filter(usable).map(aliasKey),
  );
  for (const alias of candidate.candidateAliases) {
    if (!usable(alias) || known.has(aliasKey(alias))) continue;
    aliases.push(alias.trim());
    known.add(aliasKey(alias));
  }
  const addedAliases = aliases.length > (current.aliases?.length ?? 0);
  if (!changedName && !addedAliases) return current;
  return {
    ...current,
    ...(changedName ? { name } : {}),
    ...(addedAliases ? { aliases } : {}),
  };
}

export function bilingualName(id: string, current: LocalizedText) {
  return mergeBilingualLabel({ id, name: current }).name;
}

export function uiText(
  key: UiLabelKey,
  language: LabelLanguage,
  current: LocalizedText,
) {
  return hasText(current[language])
    ? current[language]
    : uiCandidates.ui[key][language];
}

export function getPendingBilingualCandidates() {
  return bilingualLabelMappings.filter(
    (entry) => entry.status === "new" || entry.status === "ambiguous",
  );
}
