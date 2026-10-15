import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:https";
import {
  createPrivateKey,
  createPublicKey,
  X509Certificate,
} from "node:crypto";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { homedir } from "node:os";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import {
  createRelayServer,
  RELAY_DIAGNOSTIC_CODES,
} from "../services/relay/src/server.ts";
import { validateLocalTestEndpoints } from "./tv-local-test-config.mjs";
import {
  tvContentSecurityPolicy,
  verifyTvAssets,
} from "./verify-tv-assets.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".gltf": "model/gltf+json",
  ".glb": "model/gltf-binary",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function contained(root, path) {
  const suffix = relative(root, path);
  return (
    suffix === "" ||
    (!isAbsolute(suffix) && suffix !== ".." && !suffix.startsWith("../"))
  );
}

function requestError(status) {
  return Object.assign(new Error("Static resource unavailable."), { status });
}

export function localTestServerSettings(config, options) {
  const endpoints = validateLocalTestEndpoints(config, options);
  return {
    ...endpoints,
    staticHost: new URL(endpoints.controllerOrigin).host,
    allowedOrigins: [
      "https://appassets.androidplatform.net",
      endpoints.controllerOrigin,
    ],
    scope:
      config.mode === "lan"
        ? "Explicitly authorized temporary private-network TV/controller test; this launcher does not activate a camera, expose public hosting or install system trust."
        : "Loopback Android TV emulator and isolated controller test only; this launcher does not activate a camera, expose LAN/public hosting or install system trust.",
  };
}

export async function resolveStaticAsset(distRoot, requestTarget) {
  if (
    typeof requestTarget !== "string" ||
    !requestTarget.startsWith("/") ||
    requestTarget.startsWith("//") ||
    requestTarget.includes("#") ||
    /[\u0000-\u0020\u007f]/.test(requestTarget)
  )
    throw requestError(400);
  let pathname;
  try {
    pathname = decodeURIComponent(requestTarget.split("?", 1)[0]);
  } catch {
    throw requestError(400);
  }
  if (
    pathname.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(pathname) ||
    pathname.split("/").some((part) => part.startsWith(".")) ||
    /\.(?:pem|key|p12|pfx)$/i.test(pathname)
  )
    throw requestError(400);
  const root = await realpath(distRoot);
  let candidate = resolve(root, `.${pathname}`);
  if (!contained(root, candidate)) throw requestError(400);
  try {
    if ((await stat(candidate)).isDirectory())
      candidate = join(candidate, "index.html");
    const actual = await realpath(candidate);
    if (!contained(root, actual)) throw requestError(400);
    const info = await stat(actual);
    if (!info.isFile()) throw requestError(404);
    return {
      path: actual,
      bytes: info.size,
      mime:
        mimeTypes[extname(actual).toLowerCase()] ?? "application/octet-stream",
    };
  } catch (error) {
    if (error.status) throw error;
    if (["ENOENT", "ENOTDIR"].includes(error.code)) throw requestError(404);
    throw requestError(500);
  }
}

async function readConfiguration(configFile, allowLan) {
  const file = await realpath(configFile);
  const config = JSON.parse(await readFile(file, "utf8"));
  assert.ok(config && typeof config === "object" && !Array.isArray(config));
  const settings = localTestServerSettings(config, { allowLan });
  const directory = await realpath(config.directory);
  const cacheRoot = await realpath(
    join(homedir(), ".cache", "solaris-tv-local-test"),
  );
  assert.ok(
    contained(cacheRoot, directory),
    "Configuration is not a local fixture",
  );
  assert.equal(dirname(file), directory, "Configuration directory differs");
  const files = {};
  for (const [field, filename] of [
    ["caFile", "ca.pem"],
    ["certFile", "server.pem"],
    ["keyFile", "server-key.pem"],
  ]) {
    assert.equal(
      config[field],
      join(directory, filename),
      "Unexpected TLS path",
    );
    const actual = await realpath(config[field]);
    assert.ok(contained(directory, actual), "TLS file escapes the fixture");
    files[field] = await readFile(actual);
  }
  const ca = new X509Certificate(files.caFile);
  const cert = new X509Certificate(files.certFile);
  const now = Date.now();
  assert.ok(
    ca.ca && !cert.ca && cert.verify(ca.publicKey),
    "Invalid TLS chain",
  );
  for (const certificate of [ca, cert])
    assert.ok(
      now >= Date.parse(certificate.validFrom) &&
        now < Date.parse(certificate.validTo),
      "Expired or not-yet-valid local certificate",
    );
  assert.ok(
    config.mode === "lan"
      ? cert.checkIP(settings.host)
      : cert.checkHost("localhost") && cert.checkIP(settings.host),
    "Local certificate name differs",
  );
  const key = createPrivateKey(files.keyFile);
  assert.deepEqual(
    createPublicKey(key).export({ type: "spki", format: "der" }),
    cert.publicKey.export({ type: "spki", format: "der" }),
    "TLS key and certificate differ",
  );
  return { tls: { cert: files.certFile, key: files.keyFile }, settings };
}

export function localTestLauncherArguments(values) {
  let configFile;
  let distRoot = join(repository, "dist");
  let check = false;
  let allowLanTest = false;
  let diagnostics = false;
  for (let index = 0; index < values.length; index++) {
    const name = values[index];
    if (name === "--check") check = true;
    else if (name === "--allow-lan-test") allowLanTest = true;
    else if (name === "--diagnostics") diagnostics = true;
    else if (["--config", "--dist"].includes(name)) {
      const value = values[++index];
      assert.ok(value && !value.startsWith("--"), "Missing argument value");
      if (name === "--config") {
        assert.ok(!configFile, "Duplicate configuration argument");
        configFile = resolve(value);
      } else distRoot = resolve(value);
    } else
      throw new Error(
        "Use --config CONFIG_FILE [--dist DIST] [--check] [--allow-lan-test] [--diagnostics]",
      );
  }
  assert.ok(
    configFile,
    "Use --config CONFIG_FILE [--dist DIST] [--check] [--allow-lan-test] [--diagnostics]",
  );
  return { configFile, distRoot, check, allowLanTest, diagnostics };
}

export function formatLocalRelayDiagnostic(diagnostic) {
  if (!diagnostic || typeof diagnostic !== "object") return;
  const { event, code, role } = diagnostic;
  if (
    typeof event !== "string" ||
    typeof code !== "string" ||
    !Object.hasOwn(RELAY_DIAGNOSTIC_CODES, event) ||
    !RELAY_DIAGNOSTIC_CODES[event].includes(code)
  )
    return;
  return JSON.stringify({
    type: "relay-diagnostic",
    event,
    code,
    ...(role === "tv" || role === "controller" ? { role } : {}),
  });
}

function trackSockets(server) {
  const sockets = new Set();
  const add = (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  };
  server.on("connection", add);
  server.on("secureConnection", add);
  return sockets;
}

async function listen(server, port, host) {
  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolveListening();
    });
  });
}

async function main() {
  const options = localTestLauncherArguments(process.argv.slice(2));
  const { tls, settings } = await readConfiguration(
    options.configFile,
    options.allowLanTest,
  );
  const {
    host,
    relayOrigin,
    controllerUrl,
    allowedOrigins,
    staticHost,
    scope,
  } = settings;
  const distRoot = await realpath(options.distRoot);
  await verifyTvAssets({ distRoot });
  await resolveStaticAsset(distRoot, "/controller/");
  const publicUrls = { relay: relayOrigin, controller: controllerUrl };
  if (options.check) {
    console.log(
      JSON.stringify({
        status: "checked-without-listening",
        publicUrls,
        scope,
      }),
    );
    return;
  }
  const relay = createRelayServer({
    tls,
    allowedOrigins,
    ...(options.diagnostics
      ? {
          onDiagnostic: (diagnostic) => {
            const line = formatLocalRelayDiagnostic(diagnostic);
            if (line) console.log(line);
          },
        }
      : {}),
  });
  const staticServer = createServer(
    { ...tls, minVersion: "TLSv1.2" },
    (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader(
        "Content-Security-Policy",
        tvContentSecurityPolicy(relayOrigin),
      );
      if (request.headers.host !== staticHost) {
        response.writeHead(403);
        response.end("Local host required.");
        return;
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        response.writeHead(405);
        response.end("Method not allowed.");
        return;
      }
      void resolveStaticAsset(distRoot, request.url)
        .then(async (asset) => {
          if (response.destroyed) return;
          response.setHeader("Content-Type", asset.mime);
          response.setHeader("Content-Length", asset.bytes);
          response.writeHead(200);
          if (request.method === "HEAD") response.end();
          else await pipeline(createReadStream(asset.path), response);
        })
        .catch((error) => {
          if (response.destroyed) return;
          if (response.headersSent) response.destroy();
          else {
            response.writeHead(error.status ?? 500);
            response.end("Static resource unavailable.");
          }
        });
    },
  );
  staticServer.requestTimeout = 10000;
  staticServer.headersTimeout = 10000;
  staticServer.setTimeout(10000, (socket) => socket.destroy());
  staticServer.on("upgrade", (_request, socket) => socket.destroy());
  const relaySockets = trackSockets(relay.server);
  const staticSockets = trackSockets(staticServer);
  let stopping;
  const stop = (exitCode) => {
    if (stopping) return stopping;
    stopping = (async () => {
      const relayClosed = relay.close();
      for (const socket of relaySockets) socket.destroy();
      staticServer.closeAllConnections();
      for (const socket of staticSockets) socket.destroy();
      const staticClosed = staticServer.listening
        ? new Promise((done, reject) =>
            staticServer.close((error) => (error ? reject(error) : done())),
          )
        : Promise.resolve();
      const results = await Promise.allSettled([relayClosed, staticClosed]);
      process.exitCode = results.some((result) => result.status === "rejected")
        ? 1
        : exitCode;
      console.log(JSON.stringify({ status: "stopped", publicUrls, scope }));
    })();
    return stopping;
  };
  const signal = () => {
    void stop(0);
  };
  process.once("SIGINT", signal);
  process.once("SIGTERM", signal);
  for (const server of [relay.server, staticServer])
    server.on("error", () => {
      void stop(1);
    });
  try {
    await listen(relay.server, 5444, host);
    if (stopping) return;
    await listen(staticServer, 5443, host);
    if (!stopping)
      console.log(JSON.stringify({ status: "ready", publicUrls, scope }));
  } catch {
    await stop(1);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch {
    console.error(
      "Local TV test startup refused: check private configuration, TLS fixtures and the verified root-path production build.",
    );
    process.exitCode = 1;
  }
}
