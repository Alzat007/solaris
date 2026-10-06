import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve("dist");
const buildInfo = JSON.parse(
  await readFile(path.join(root, "build-info.json"), "utf8"),
);
assert.equal(buildInfo.schemaVersion, 1);
assert.ok(
  buildInfo.gitCommit === null ||
    /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(buildInfo.gitCommit),
);
assert.ok(buildInfo.dirty === null || typeof buildInfo.dirty === "boolean");
assert.equal(typeof buildInfo.vite?.mode, "string");
assert.equal(typeof buildInfo.vite?.base, "string");
const base = process.env.VITE_BASE_PATH || buildInfo.vite.base;
assert.equal(
  buildInfo.vite.base,
  base,
  "Build base differs from the verification base",
);
assert.equal(buildInfo.ion?.defaultDataMode, "local");
assert.equal(buildInfo.ion?.requiredQuery, "data=ion");
assert.equal(typeof buildInfo.ion?.tokenConfigured, "boolean");
for (const id of [buildInfo.ion.terrainAssetId, buildInfo.ion.imageryAssetId])
  assert.ok(Number.isSafeInteger(id) && id > 0, "Invalid manifest asset ID");
assert.ok(
  Array.isArray(buildInfo.files) && buildInfo.files.length > 0,
  "Build file evidence is missing",
);
const buildPaths = new Set();
for (const item of buildInfo.files) {
  assert.match(item.path, /^[a-zA-Z0-9_./-]+\.(js|css|html)$/);
  assert.ok(
    !path.posix.isAbsolute(item.path) &&
      item.path === path.posix.normalize(item.path),
  );
  assert.ok(
    !item.path.split("/").includes("..") && !buildPaths.has(item.path),
    "Unsafe or duplicate build path",
  );
  buildPaths.add(item.path);
  assert.ok(
    Number.isSafeInteger(item.bytes) && item.bytes > 0,
    "Invalid build file length",
  );
  assert.match(item.sha256, /^[a-f0-9]{64}$/);
  const file = await readFile(path.join(root, item.path));
  assert.equal(
    file.length,
    item.bytes,
    `Build file length changed: ${item.path}`,
  );
  assert.equal(
    createHash("sha256").update(file).digest("hex"),
    item.sha256,
    `Build file bytes changed: ${item.path}`,
  );
}
for (const entry of ["index.html", "globe-lab.html"])
  assert.ok(buildPaths.has(entry), `Build evidence is missing ${entry}`);
for (const file of await readdir(path.join(root, "assets")))
  if (/\.(js|css)$/.test(file))
    assert.ok(
      buildPaths.has(`assets/${file}`),
      `Build evidence is missing assets/${file}`,
    );
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
assert.deepEqual(
  await readFile(path.join(root, "cesium/LICENSE.md")),
  await readFile(path.resolve("node_modules/cesium/LICENSE.md")),
  "The full pinned Cesium license must accompany the static distribution",
);
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
    base === "/" || !bundles.includes(`"${rootPath}"`),
    `Runtime asset still uses a root-only URL: ${rootPath}`,
  );
}
assert.ok(
  bundles.includes(base),
  "The runtime asset base is missing from the bundle",
);
const imagePaths = new Set();
const packResults = [];
for (const manifest of ["content-pack.json", "immersive-pack.json"]) {
  const pack = JSON.parse(
    await readFile(path.join(root, "exploration", manifest), "utf8"),
  );
  assert.ok(
    Array.isArray(pack.files) && pack.files.length > 0,
    `${manifest}: files missing`,
  );
  assert.equal(pack.offlineStatus, "bundled-assets-only", manifest);
  assert.equal(pack.browserColdStartVerified, false, manifest);
  const paths = new Set();
  let packBytes = 0;
  for (const item of pack.files) {
    assert.match(item.path, /^exploration\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/);
    assert.ok(
      !paths.has(item.path),
      `${manifest}: duplicate path ${item.path}`,
    );
    paths.add(item.path);
    imagePaths.add(item.path);
    assert.ok(Number.isSafeInteger(item.bytes) && item.bytes > 0, item.path);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    const file = await readFile(path.join(root, item.path));
    assert.equal(file.length, item.bytes, item.path);
    assert.equal(
      createHash("sha256").update(file).digest("hex"),
      item.sha256,
      item.path,
    );
    packBytes += file.length;
  }
  assert.equal(packBytes, pack.totalBytes, manifest);
  packResults.push(
    `${manifest}: ${pack.files.length} images, ${packBytes} bytes`,
  );
}
console.log(
  `Static export verified: ${buildPaths.size} generated files with build SHA-256, ${assets.length} entry assets, 7 runtime assets, full Cesium license, ${imagePaths.size} unique exploration images with SHA-256, base ${base}; ${packResults.join("; ")}. Browser offline cold start is not verified.`,
);
