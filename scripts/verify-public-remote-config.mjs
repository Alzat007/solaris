import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function localIpv4(host) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const [a, b] = host.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function localHostname(value) {
  const host = value
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    localIpv4(host) ||
    host === "::" ||
    host === "::1" ||
    /^(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):/.test(host)
  )
    return true;
  const mapped = host.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
  if (!mapped) return false;
  const high = parseInt(mapped[1], 16);
  const low = parseInt(mapped[2], 16);
  return localIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
}

export function verifyPublicText(source, file) {
  assert.ok(
    !/-----BEGIN (?:[A-Z ]*PRIVATE KEY|CERTIFICATE)-----/.test(source),
    `Public output contains a private key or certificate: ${file}`,
  );
  for (const match of source.matchAll(
    /\b(?:https?|wss?):\/\/[^\s"'<>`\\]+/gi,
  )) {
    let url;
    try {
      url = new URL(match[0]);
    } catch {
      continue;
    }
    assert.ok(
      !localHostname(url.hostname),
      `Public output contains a local network URL: ${file}`,
    );
    assert.ok(
      !url.username && !url.password,
      `Public output contains URL credentials: ${file}`,
    );
  }
}

async function verifyPublicFileNames(root, prefix = "") {
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const file = `${prefix}${entry.name}`;
    assert.ok(
      !/\.(?:pem|key|crt|cer|der|p12|pfx|jks|keystore)$/i.test(file) &&
        !/^\.env(?:\.|$)/.test(entry.name),
      `Private configuration or certificate file in public output: ${file}`,
    );
    if (entry.isDirectory()) await verifyPublicFileNames(root, `${file}/`);
    else assert.ok(entry.isFile(), "Public output must contain regular files");
  }
}

export async function verifyPublicRemoteConfig({
  distRoot = resolve("dist"),
  expectedBase = process.env.VITE_BASE_PATH,
} = {}) {
  await verifyPublicFileNames(distRoot);
  const info = JSON.parse(
    await readFile(join(distRoot, "build-info.json"), "utf8"),
  );
  assert.equal(
    info.vite?.mode,
    "production",
    "Public output must be a production build",
  );
  const base = expectedBase ?? info.vite.base;
  assert.match(base, /^\/(?:[A-Za-z0-9_-]+\/)*$/, "Invalid public base path");
  assert.equal(
    info.vite.base,
    base,
    "Public build base differs from the release base",
  );
  assert.ok(Array.isArray(info.files), "Public build evidence is missing");
  const paths = new Set();
  for (const item of info.files) {
    assert.ok(
      typeof item.path === "string" &&
        /^[A-Za-z0-9_./-]+\.(?:js|css|html)$/.test(item.path) &&
        !posix.isAbsolute(item.path) &&
        posix.normalize(item.path) === item.path &&
        !item.path.split("/").includes("..") &&
        !paths.has(item.path),
      "Unsafe or duplicate public build path",
    );
    paths.add(item.path);
  }
  assert.ok(
    paths.has("controller/index.html"),
    "Public controller entry is missing",
  );

  // The preceding static-export verifier checks these files' bytes and SHA-256.
  // Copied Cesium/MediaPipe trees are excluded so vendor examples are not config.
  for (const file of paths) {
    if (!/\.(?:js|html)$/.test(file)) continue;
    const source = await readFile(join(distRoot, file), "utf8");
    verifyPublicText(source, file);
    if (file !== "controller/index.html") continue;
    const assets = [
      ...source.matchAll(
        /<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi,
      ),
    ].map((match) => match[1]);
    assert.ok(
      assets.some((url) => url.endsWith(".js")),
      "Controller script is missing",
    );
    for (const url of assets) {
      assert.ok(
        url.startsWith(base) && !url.startsWith("//"),
        "Controller asset escaped the public base path",
      );
      assert.ok(
        paths.has(url.slice(base.length)),
        "Controller asset is missing from verified build evidence",
      );
    }
  }
  return { base, generatedFiles: paths.size };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await verifyPublicRemoteConfig();
  console.log(
    `Public remote configuration verified: ${result.generatedFiles} generated files, controller base ${result.base}.`,
  );
}
