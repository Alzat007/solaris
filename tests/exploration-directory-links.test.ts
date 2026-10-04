import assert from "node:assert/strict";
import test from "node:test";
import { explorationContent } from "../src/exploration/content";
import { earthDirectory } from "../src/exploration/earthDirectory";
import { validateExploration } from "../src/exploration/validateExploration";

test("shared content references actual directory cities without claiming release readiness", () => {
  assert.deepEqual(validateExploration(explorationContent, earthDirectory), []);
  assert.match(
    validateExploration(explorationContent, earthDirectory, {
      requireHumanReview: true,
    }).join("\n"),
    /human review is pending/,
  );
});

test("unknown cities and non-Earth city associations fail cross-table validation", () => {
  const content = structuredClone(explorationContent);
  content.destinations.find((entry) => entry.bodyId === "earth")!.cityId =
    "city-not-in-directory";
  content.destinations.find((entry) => entry.bodyId === "mars")!.cityId =
    "city-beijing";
  assert.equal(
    validateExploration(content, earthDirectory).filter((error) =>
      error.includes("real Earth directory"),
    ).length,
    2,
  );
});

test("a city story destination cannot silently drop its parent directory city", () => {
  const content = structuredClone(explorationContent);
  delete content.destinations.find((entry) => entry.bodyId === "earth")!.cityId;
  assert.match(
    validateExploration(content, earthDirectory).join("\n"),
    /requires a directory city/,
  );
});
