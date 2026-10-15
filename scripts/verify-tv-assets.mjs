import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function tvRelayOrigin(value = "") {
  if (!value.trim()) return "";
  const raw = value.trim();
  assert.ok(
    /^https:\/\/[^/?#\\\s]+\/?$/.test(raw),
    "TV_RELAY_ORIGIN must contain only an explicit HTTPS origin",
  );
  const url = new URL(raw);
  assert.ok(
    url.protocol === "https:" &&
      url.hostname &&
      !url.username &&
      !url.password &&
      url.port !== "0" &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "TV_RELAY_ORIGIN must be an HTTPS origin without credentials, path, query or fragment",
  );
  return url.origin;
}

export function tvPhoneUrl(value = "") {
  if (!value.trim()) return "";
  const raw = value.trim();
  assert.ok(
    !/[?#\\\u0000-\u0020]/.test(raw),
    "TV_CONTROLLER_URL must not contain query, fragment or control characters",
  );
  const url = new URL(raw);
  assert.ok(
    url.protocol === "https:" &&
      url.hostname &&
      !url.username &&
      !url.password &&
      url.port !== "0" &&
      !url.search &&
      !url.hash,
    "TV_CONTROLLER_URL must be a credential-free HTTPS page without query or fragment",
  );
  return url.href;
}

export function tvContentSecurityPolicy(relayOrigin = "") {
  const origin = tvRelayOrigin(relayOrigin);
  const connections = origin
    ? ` ${origin}/v1/sessions ${origin.replace(/^https:/, "wss:")}/v1/ws`
    : "";
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `connect-src 'self'${connections}`,
  ].join("; ");
}

export function createTvIndex(html, relayOrigin = "") {
  assert.match(
    html,
    /<head(?:\s[^>]*)?>/i,
    "Local app is missing its HTML head",
  );
  assert.ok(
    !/http-equiv=["']Content-Security-Policy["']/i.test(html),
    "Unexpected existing CSP; do not weaken it silently",
  );
  const policy = tvContentSecurityPolicy(relayOrigin);
  return html.replace(
    /(<head(?:\s[^>]*)?>)/i,
    `$1\n<meta http-equiv="Content-Security-Policy" content="${policy}" />\n<script src="/solaris-tv-config.js"></script>`,
  );
}

async function filesIn(root, prefix = "") {
  const result = [];
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) result.push(...(await filesIn(root, `${path}/`)));
    else {
      assert.ok(entry.isFile(), `TV assets must be regular files: ${path}`);
      result.push(path);
    }
  }
  return result.sort();
}

function safePath(path) {
  assert.ok(
    typeof path === "string" &&
      path &&
      !posix.isAbsolute(path) &&
      path === posix.normalize(path) &&
      !path.split("/").includes("..") &&
      !path.includes("\\"),
    "Unsafe TV asset path",
  );
  return path;
}

async function verifyFile(distRoot, record) {
  const path = safePath(record.path);
  assert.ok(
    Number.isSafeInteger(record.bytes) && record.bytes > 0,
    `Invalid asset byte count: ${path}`,
  );
  assert.match(record.sha256, /^[a-f0-9]{64}$/, `Missing asset hash: ${path}`);
  assert.ok(
    (await lstat(join(distRoot, path))).isFile(),
    `TV asset is not a regular file: ${path}`,
  );
  const bytes = await readFile(join(distRoot, path));
  assert.equal(bytes.length, record.bytes, `TV asset length differs: ${path}`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    record.sha256,
    `TV asset bytes differ: ${path}`,
  );
}

export async function verifyTvAssets({
  distRoot = join(repository, "dist"),
  publicRoot = join(repository, "public"),
} = {}) {
  const info = JSON.parse(
    await readFile(join(distRoot, "build-info.json"), "utf8"),
  );
  assert.equal(info.schemaVersion, 1, "Unsupported TV build evidence");
  assert.equal(
    info.vite?.base,
    "/",
    "TV requires a fresh VITE_BASE_PATH=/ build, not the Pages /solaris/ build",
  );
  assert.equal(info.vite?.mode, "production", "TV requires a production build");
  assert.equal(
    info.ion?.tokenConfigured,
    false,
    "Do not package client map credentials into the TV APK",
  );
  assert.ok(
    Array.isArray(info.files) && info.files.length > 0,
    "Build file hashes are missing",
  );
  const recorded = new Set();
  for (const file of info.files) {
    assert.ok(!recorded.has(file.path), "Duplicate build evidence path");
    recorded.add(file.path);
    await verifyFile(distRoot, file);
  }
  assert.ok(
    recorded.has("index.html"),
    "Main TV entry is missing from build evidence",
  );
  for (const path of await filesIn(distRoot)) {
    if (
      !path.startsWith("classic/") &&
      /\.(js|css|html)$/.test(path) &&
      !path.startsWith("cesium/") &&
      !path.startsWith("mediapipe/")
    )
      assert.ok(
        recorded.has(path),
        `Generated TV code is absent from build evidence: ${path}`,
      );
  }
  const publicPaths = await filesIn(publicRoot);
  for (const path of publicPaths) {
    const expected = await readFile(join(publicRoot, path));
    assert.ok(
      (await lstat(join(distRoot, path))).isFile(),
      `Bundled source asset is missing: ${path}`,
    );
    assert.deepEqual(
      await readFile(join(distRoot, path)),
      expected,
      `Bundled source asset changed: ${path}`,
    );
  }
  for (const path of [
    "models/hand_landmarker.task",
    "textures/earth-day.jpg",
    "textures/earth-night.png",
    "textures/moon-day.jpg",
    "mediapipe/vision_wasm_internal.js",
    "mediapipe/vision_wasm_internal.wasm",
    "mediapipe/vision_wasm_nosimd_internal.js",
    "mediapipe/vision_wasm_nosimd_internal.wasm",
  ])
    assert.ok(
      (await readFile(join(distRoot, path))).length > 1000,
      `Critical TV runtime asset missing: ${path}`,
    );
  for (const auditPath of [
    "textures/moon-source.json",
    "exploration/planets/moon/source-records.json",
  ]) {
    const audit = JSON.parse(await readFile(join(distRoot, auditPath), "utf8"));
    for (const record of audit.files ?? [audit])
      await verifyFile(distRoot, record);
  }
  for (const auditPath of publicPaths.filter((path) =>
    path.endsWith("source-records.json"),
  )) {
    const audit = JSON.parse(await readFile(join(distRoot, auditPath), "utf8"));
    for (const record of audit.files ?? []) {
      // Older audit packs use a filename relative to their containing folder.
      if (!record.sha256 || !record.bytes) continue;
      await verifyFile(distRoot, {
        ...record,
        path: record.path ?? `${posix.dirname(auditPath)}/${record.filename}`,
      });
    }
  }
  return {
    gitCommit: info.gitCommit,
    generatedFiles: recorded.size,
    publicFiles: publicPaths.length,
  };
}

export async function configureTvAssets({
  stageRoot,
  relayOrigin = "",
  phoneUrl = "",
}) {
  const relayUrl = tvRelayOrigin(relayOrigin);
  const controllerUrl = tvPhoneUrl(phoneUrl);
  const html = await readFile(join(stageRoot, "index.html"), "utf8");
  const index = createTvIndex(html, relayUrl);
  await writeFile(join(stageRoot, "index.html"), index);
  const config = JSON.stringify({ relayUrl, phoneUrl: controllerUrl });
  const bootstrap = `Object.defineProperty(window, "__SOLARIS_REMOTE_CONFIG", {value: Object.freeze(${config}), writable: false, configurable: false});\n`;
  await writeFile(join(stageRoot, "solaris-tv-config.js"), bootstrap);
  const sha256 = (value) => createHash("sha256").update(value).digest("hex");
  await writeFile(
    join(stageRoot, "tv-build-info.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sourceBuildInfoSha256: sha256(
          await readFile(join(stageRoot, "build-info.json")),
        ),
        sourceIndexSha256: sha256(html),
        packagedIndexSha256: sha256(index),
        packagedBootstrapSha256: sha256(bootstrap),
        relayOrigin: relayUrl,
        phoneUrl: controllerUrl,
        usesLocalAssets: true,
        nativeInstallationVerified: false,
      },
      null,
      2,
    )}\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    if (at < 0) return fallback;
    assert.ok(args[at + 1] !== undefined, `Missing ${name} argument`);
    return args[at + 1];
  };
  if (args.includes("--configure-index")) {
    await configureTvAssets({
      stageRoot: resolve(option("--configure-index")),
      relayOrigin: option("--relay-origin", ""),
      phoneUrl: option("--phone-url", ""),
    });
    console.log(
      "TV asset copy configured with local CSP and explicit remote configuration; no credentials embedded.",
    );
  } else {
    const evidence = await verifyTvAssets({
      distRoot: resolve(option("--dist", join(repository, "dist"))),
    });
    console.log(
      `TV assets verified: ${evidence.generatedFiles} generated hashes, ${evidence.publicFiles} byte-identical bundled files; source ${evidence.gitCommit ?? "unknown"}. Native installation is not verified.`,
    );
  }
}
