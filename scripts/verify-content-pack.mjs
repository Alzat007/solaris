import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const idPattern = /^[a-z][a-z0-9-]*$/;

try {
  const pack = JSON.parse(
    await readFile(join(root, "public/exploration/content-pack.json"), "utf8"),
  );
  const errors = [];
  if (
    !idPattern.test(pack.id) ||
    typeof pack.version !== "string" ||
    !pack.version.trim()
  )
    errors.push("Pack ID/version is invalid");
  for (const key of ["destinationIds", "assetIds"]) {
    if (
      !Array.isArray(pack[key]) ||
      !pack[key].length ||
      pack[key].some((id) => typeof id !== "string" || !idPattern.test(id)) ||
      new Set(pack[key]).size !== pack[key].length
    )
      errors.push(`${key} must contain unique stable IDs`);
  }
  if (!Array.isArray(pack.files)) throw new Error("files must be an array");
  if (
    pack.offlineStatus !== "bundled-assets-only" ||
    pack.browserColdStartVerified !== false
  )
    errors.push(
      "This verifier checks bundled files, not browser offline cold start",
    );
  const seen = new Set();
  let totalBytes = 0;
  for (const file of pack.files) {
    if (
      !file ||
      !/^exploration\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/.test(file.path ?? "")
    ) {
      errors.push("Invalid local asset path");
      continue;
    }
    if (
      typeof file.assetId !== "string" ||
      seen.has(file.assetId) ||
      !pack.assetIds?.includes(file.assetId)
    )
      errors.push(`Invalid/duplicate asset ID: ${file.assetId}`);
    seen.add(file.assetId);
    if (
      !Number.isSafeInteger(file.bytes) ||
      file.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256 ?? "")
    )
      errors.push(`Invalid byte count or SHA-256: ${file.assetId}`);
    const path = join(root, "public", file.path);
    try {
      if (!(await stat(path)).isFile()) throw new Error("not a regular file");
      const bytes = await readFile(path);
      totalBytes += bytes.byteLength;
      if (bytes.byteLength !== file.bytes)
        errors.push(`Byte count mismatch: ${file.assetId}`);
      if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
        errors.push(`Checksum mismatch: ${file.assetId}`);
    } catch (error) {
      errors.push(`Cannot read ${file.assetId}: ${error.message}`);
    }
  }
  for (const id of pack.assetIds ?? [])
    if (!seen.has(id)) errors.push(`Missing asset file: ${id}`);
  if (!Number.isSafeInteger(pack.totalBytes) || totalBytes !== pack.totalBytes)
    errors.push("Pack total byte count mismatch");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    `Verified ${pack.id}: ${pack.files.length} local files, ${totalBytes} bytes, SHA-256 matches. Browser offline cold start is not implemented or verified.`,
  );
} catch (error) {
  console.error(`Content pack verification failed: ${error.message}`);
  process.exitCode = 1;
}
