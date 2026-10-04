import type { ExplorationContent } from "./contentTypes";
import type { EarthDirectory } from "./earthDirectory";
import { validateEarthDirectory } from "./earthDirectory";
import {
  validateContent,
  type ContentValidationOptions,
} from "./validateContent";

export function validateExploration(
  content: ExplorationContent,
  directory: EarthDirectory,
  options: ContentValidationOptions = {},
): string[] {
  const errors = [
    ...validateContent(content, options),
    ...validateEarthDirectory(directory),
  ];
  const cities = new Set(directory.cities.map((city) => city.id));
  for (const destination of content.destinations) {
    if (
      destination.cityId &&
      (destination.bodyId !== "earth" || !cities.has(destination.cityId))
    ) {
      errors.push(
        `destination.${destination.id}: city must reference a real Earth directory entry`,
      );
    }
    if (destination.kind === "city" && !destination.cityId) {
      errors.push(
        `destination.${destination.id}: city destination requires a directory city`,
      );
    }
  }
  return errors;
}
