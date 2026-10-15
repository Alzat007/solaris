import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import {
  configureTvAssets,
  createTvIndex,
  tvContentSecurityPolicy,
  tvPhoneUrl,
  tvRelayOrigin,
  verifyTvAssets,
} from "../scripts/verify-tv-assets.mjs";

const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const critical = [
  "models/hand_landmarker.task",
  "textures/earth-day.jpg",
  "textures/earth-night.png",
  "textures/moon-day.jpg",
  "mediapipe/vision_wasm_internal.js",
  "mediapipe/vision_wasm_internal.wasm",
  "mediapipe/vision_wasm_nosimd_internal.js",
  "mediapipe/vision_wasm_nosimd_internal.wasm",
];

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "solaris-tv-assets-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const distRoot = join(root, "dist"),
    publicRoot = join(root, "public");
  const write = async (
    base: string,
    path: string,
    value: string | Uint8Array,
  ) => {
    await mkdir(dirname(join(base, path)), { recursive: true });
    await writeFile(join(base, path), value);
  };
  const html =
    '<!doctype html><html><head><title>SOLARIS</title></head><body><script type="module" src="/assets/main.js"></script></body></html>';
  const generated = [
    { path: "index.html", value: html },
    { path: "assets/main.js", value: "export const solaris = true;" },
    { path: "assets/main.css", value: "body{color:white}" },
  ];
  for (const { path, value } of generated) await write(distRoot, path, value);
  for (const path of critical) {
    const value = Buffer.alloc(1001, 6);
    await write(publicRoot, path, value);
    await write(distRoot, path, value);
  }
  const imagePath = "exploration/planets/moon/test-image.jpg",
    image = Buffer.from("unit-test image fixture, not real released imagery");
  for (const base of [publicRoot, distRoot])
    await write(base, imagePath, image);
  const moon = {
    path: "textures/moon-day.jpg",
    bytes: 1001,
    sha256: hash(Buffer.alloc(1001, 6)),
  };
  for (const [path, record] of [
    ["textures/moon-source.json", moon],
    [
      "exploration/planets/moon/source-records.json",
      {
        files: [{ path: imagePath, bytes: image.length, sha256: hash(image) }],
      },
    ],
  ] as const)
    for (const base of [publicRoot, distRoot])
      await write(base, path, JSON.stringify(record));
  const info = {
    schemaVersion: 1,
    gitCommit: null,
    vite: { base: "/", mode: "production" },
    ion: { tokenConfigured: false },
    files: generated.map(({ path, value }) => ({
      path,
      bytes: Buffer.byteLength(value),
      sha256: hash(value),
    })),
  };
  await write(distRoot, "build-info.json", JSON.stringify(info));
  return { root, distRoot, publicRoot, html, info, write };
}

test("TV relay accepts one canonical TLS authority, never arbitrary origins or credential URLs", () => {
  assert.equal(tvRelayOrigin(), "");
  assert.equal(
    tvRelayOrigin("https://relay.example:443/"),
    "https://relay.example",
  );
  assert.equal(
    tvRelayOrigin("https://relay.example:9443"),
    "https://relay.example:9443",
  );
  for (const value of [
    "http://relay.example",
    "wss://relay.example",
    "https://name:secret@relay.example",
    "https://relay.example/v1/ws",
    "https://relay.example/path/..",
    "https://relay.example?token=x",
    "https://relay.example#",
    "https://relay.example:0",
    "https://relay.example\\evil",
    "https://rel\nay.example",
  ])
    assert.throws(() => tvRelayOrigin(value));
  assert.equal(
    tvPhoneUrl("https://phone.example/solaris/remote.html"),
    "https://phone.example/solaris/remote.html",
  );
  for (const value of [
    "http://phone.example",
    "https://name:secret@phone.example/",
    "https://phone.example/?token=x",
    "https://phone.example/#",
    "https://phone.example:0/",
    "https://pho\nne.example/",
  ])
    assert.throws(() => tvPhoneUrl(value));
});

test("APK CSP preserves local rendering/WASM/blob workers while allowing only the configured relay paths", () => {
  const offline = tvContentSecurityPolicy();
  assert.ok(offline.endsWith("connect-src 'self'"));
  assert.ok(!offline.includes("https:") && !offline.includes("wss:"));
  const online = tvContentSecurityPolicy("https://relay.example:9443");
  assert.ok(
    online.includes(
      "connect-src 'self' https://relay.example:9443/v1/sessions wss://relay.example:9443/v1/ws",
    ),
  );
  assert.ok(online.includes("worker-src 'self' blob:"));
  assert.ok(online.includes("'wasm-unsafe-eval'"));
  assert.ok(!online.includes("'unsafe-eval'") && !online.includes("*"));
  const html = createTvIndex(
    "<html><head><title>SOLARIS</title></head></html>",
    "https://relay.example",
  );
  assert.ok(
    html.indexOf("Content-Security-Policy") <
      html.indexOf("solaris-tv-config.js"),
  );
  assert.throws(() =>
    createTvIndex(
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src none"></head></html>',
    ),
  );
});

test("TV build guard verifies actual generated hashes and byte-identical public assets without Git metadata", async (t) => {
  const files = await fixture(t);
  const result = await verifyTvAssets(files);
  assert.equal(result.gitCommit, null);
  assert.equal(result.generatedFiles, 3);
  assert.equal(result.publicFiles, 11);
});

test("TV build guard rejects Pages base, leaked map configuration, mutated code and incomplete resources", async (t) => {
  const files = await fixture(t);
  for (const patch of [
    { vite: { base: "/solaris/", mode: "production" } },
    { ion: { tokenConfigured: true } },
  ]) {
    await files.write(
      files.distRoot,
      "build-info.json",
      JSON.stringify({ ...files.info, ...patch }),
    );
    await assert.rejects(verifyTvAssets(files));
  }
  await files.write(
    files.distRoot,
    "build-info.json",
    JSON.stringify(files.info),
  );
  await files.write(files.distRoot, "assets/main.js", "modified code");
  await assert.rejects(verifyTvAssets(files), /length differs|bytes differ/);
  await files.write(
    files.distRoot,
    "assets/main.js",
    "export const solaris = true;",
  );
  await files.write(
    files.distRoot,
    "textures/moon-day.jpg",
    Buffer.alloc(1001, 9),
  );
  await assert.rejects(verifyTvAssets(files), /Bundled source asset changed/);
  await files.write(
    files.distRoot,
    "textures/moon-day.jpg",
    Buffer.alloc(1001, 6),
  );
  await rm(join(files.distRoot, "mediapipe/vision_wasm_internal.wasm"));
  await assert.rejects(verifyTvAssets(files), /ENOENT/);
});

test("TV build guard rejects unrecorded generated code and unsafe evidence paths", async (t) => {
  const files = await fixture(t);
  await files.write(files.distRoot, "assets/extra.js", "extra code");
  await assert.rejects(verifyTvAssets(files), /absent from build evidence/);
  await rm(join(files.distRoot, "assets/extra.js"));
  await files.write(
    files.distRoot,
    "build-info.json",
    JSON.stringify({
      ...files.info,
      files: [{ ...files.info.files[0], path: "../private.html" }],
    }),
  );
  await assert.rejects(verifyTvAssets(files), /Unsafe TV asset path/);
});

test("APK-only configuration creates a separate packaging fingerprint without changing source assets", async (t) => {
  const files = await fixture(t);
  const originalInfo = await readFile(join(files.distRoot, "build-info.json"));
  await configureTvAssets({
    stageRoot: files.distRoot,
    relayOrigin: "https://relay.example",
    phoneUrl: "https://phone.example/remote.html",
  });
  assert.deepEqual(
    await readFile(join(files.distRoot, "build-info.json")),
    originalInfo,
  );
  const index = await readFile(join(files.distRoot, "index.html"), "utf8"),
    bootstrap = await readFile(
      join(files.distRoot, "solaris-tv-config.js"),
      "utf8",
    );
  assert.ok(
    bootstrap.includes('"relayUrl":"https://relay.example"') &&
      bootstrap.includes('"phoneUrl":"https://phone.example/remote.html"'),
  );
  assert.ok(
    bootstrap.includes("Object.freeze") && !bootstrap.includes("token"),
  );
  const evidence = JSON.parse(
    await readFile(join(files.distRoot, "tv-build-info.json"), "utf8"),
  );
  assert.equal(evidence.sourceIndexSha256, hash(files.html));
  assert.equal(evidence.packagedIndexSha256, hash(index));
  assert.equal(evidence.packagedBootstrapSha256, hash(bootstrap));
  assert.equal(evidence.nativeInstallationVerified, false);
});
