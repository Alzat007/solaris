import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const base = process.env.VITE_BASE_PATH || "/";
const root = path.resolve("dist");
const html = await readFile(path.join(root, "index.html"), "utf8");
assert.ok(html.includes("SOLARIS"));
const assets = [...html.matchAll(/(?:src|href)="(\/[^\"]+)"/g)].map(
  (m) => m[1],
);
assert.ok(assets.length >= 3, "Entry assets are missing");
for (const url of assets) {
  assert.ok(url.startsWith(base), `Asset escaped the Pages base path: ${url}`);
  assert.ok(
    (await stat(path.join(root, url.slice(base.length)))).isFile(),
    url,
  );
}
for (const asset of [
  "mediapipe/vision_wasm_internal.js",
  "mediapipe/vision_wasm_internal.wasm",
  "mediapipe/vision_wasm_nosimd_internal.js",
  "mediapipe/vision_wasm_nosimd_internal.wasm",
  "models/hand_landmarker.task",
  "textures/earth-day.jpg",
  "textures/earth-night.png",
]) {
  const file = await readFile(path.join(root, asset));
  assert.ok(file.length > 1000, `Missing or empty runtime asset: ${asset}`);
  if (asset.endsWith(".wasm"))
    assert.deepEqual([...file.subarray(0, 4)], [0, 97, 115, 109]);
}
const jsFiles = (await readdir(path.join(root, "assets"))).filter((f) =>
  f.endsWith(".js"),
);
const bundles = (
  await Promise.all(
    jsFiles.map((f) => readFile(path.join(root, "assets", f), "utf8")),
  )
).join("\n");
for (const rootPath of [
  "/mediapipe",
  "/models/hand_landmarker.task",
  "/textures/earth-day.jpg",
  "/textures/earth-night.png",
]) {
  assert.ok(
    !bundles.includes(`"${rootPath}"`),
    `Runtime asset still uses a root-only URL: ${rootPath}`,
  );
}
assert.ok(
  bundles.includes(base),
  "The runtime asset base is missing from the bundle",
);
console.log(
  `Static export verified: ${assets.length} entry assets, 7 runtime assets, base ${base}`,
);
