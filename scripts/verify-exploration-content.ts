import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { explorationContent } from "../src/exploration/content";
import { earthDirectory } from "../src/exploration/earthDirectory";
import {
  immersiveSites,
  validateImmersiveCatalog,
} from "../src/exploration/immersiveCatalog";
import { validateExploration } from "../src/exploration/validateExploration";

const release = process.argv.includes("--release");
const publicPreview = process.argv.includes("--public-preview");
if (release && publicPreview) {
  console.error("Choose --release or --public-preview, not both.");
  process.exit(1);
}
const mode = release ? "Release" : publicPreview ? "Public preview" : "Preview";
const errors = [
  ...validateExploration(explorationContent, earthDirectory, {
    requireHumanReview: release,
  }),
  ...validateImmersiveCatalog(),
];
const hotspots = immersiveSites.flatMap((site) => site.hotspots);
const imagePaths = [
  ...new Set(
    hotspots.flatMap((hotspot) => (hotspot.image ? [hotspot.image.path] : [])),
  ),
];
if (release) {
  for (const hotspot of hotspots) {
    if (hotspot.humanReview !== ("approved" as string))
      errors.push(
        `hotspot.${hotspot.id}: formal release requires human review approval`,
      );
  }
}

try {
  const pack = JSON.parse(
    await readFile(
      new URL("../public/exploration/immersive-pack.json", import.meta.url),
      "utf8",
    ),
  ) as {
    id: string;
    version: string;
    siteIds: string[];
    hotspotIds: string[];
    files: { path: string; bytes: number; sha256: string }[];
    totalBytes: number;
    humanReview: string;
    offlineStatus: string;
    browserColdStartVerified: boolean;
  };
  const sameIds = (actual: string[], expected: string[]) =>
    Array.isArray(actual) &&
    actual.every((id) => typeof id === "string") &&
    new Set(actual).size === actual.length &&
    actual.length === expected.length &&
    [...actual].sort().join("\n") === [...expected].sort().join("\n");
  if (!/^[a-z][a-z0-9-]*$/.test(pack.id) || !pack.version?.trim())
    errors.push("Immersive pack: invalid ID/version");
  if (
    !sameIds(
      pack.siteIds,
      immersiveSites.map((site) => site.id),
    )
  )
    errors.push("Immersive pack: site IDs do not match the catalog");
  if (
    !sameIds(
      pack.hotspotIds,
      hotspots.map((hotspot) => hotspot.id),
    )
  )
    errors.push("Immersive pack: hotspot IDs do not match the catalog");
  if (!Array.isArray(pack.files)) throw new Error("files must be an array");
  if (
    !sameIds(
      pack.files.map((file) => file.path),
      imagePaths,
    )
  )
    errors.push(
      "Immersive pack: files must match all catalog images exactly once",
    );
  let totalBytes = 0;
  for (const file of pack.files) {
    if (!/^exploration\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(file.path)) {
      errors.push("Immersive pack: unsafe asset path");
      continue;
    }
    const bytes = await readFile(
      new URL(`../public/${file.path}`, import.meta.url),
    );
    totalBytes += bytes.byteLength;
    if (!Number.isSafeInteger(file.bytes) || file.bytes !== bytes.byteLength)
      errors.push(`Immersive pack: byte count mismatch for ${file.path}`);
    if (
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      createHash("sha256").update(bytes).digest("hex") !== file.sha256
    )
      errors.push(`Immersive pack: SHA-256 mismatch for ${file.path}`);
  }
  if (!Number.isSafeInteger(pack.totalBytes) || totalBytes !== pack.totalBytes)
    errors.push("Immersive pack: total byte count mismatch");
  if (
    pack.offlineStatus !== "bundled-assets-only" ||
    pack.browserColdStartVerified !== false
  )
    errors.push(
      "Immersive pack: bundled files do not establish browser offline cold start",
    );
  if (pack.humanReview !== "pending")
    errors.push("Immersive pack: this sample batch still awaits human review");
} catch (error) {
  errors.push(
    `Immersive pack: ${error instanceof Error ? error.message : String(error)}`,
  );
}
if (errors.length) {
  console.error(`${mode} validation failed:\n${errors.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(
    `${mode} validation passed: ${immersiveSites.length} immersive sites, ${hotspots.length} hotspots and ${imagePaths.length} deduplicated images.${release ? "" : " Human review remains pending; this is not formal-release approval. Browser offline cold start is not verified."}`,
  );
}
