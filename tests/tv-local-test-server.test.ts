import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";

type StaticAsset = { path: string; bytes: number; mime: string };
type InterfaceSnapshot = Record<
  string,
  { address: string; family: "IPv4" | "IPv6"; internal: boolean }[]
>;
type ServerSettings = {
  host: string;
  relayOrigin: string;
  controllerOrigin: string;
  controllerUrl: string;
  staticHost: string;
  allowedOrigins: string[];
  scope: string;
};
const {
  resolveStaticAsset,
  localTestServerSettings,
  localTestLauncherArguments,
  formatLocalRelayDiagnostic,
} = (await import(
  new URL("../scripts/start-tv-local-test.mjs", import.meta.url).href
)) as {
  resolveStaticAsset: (root: string, target: string) => Promise<StaticAsset>;
  localTestServerSettings: (
    config: Record<string, string>,
    options?: { allowLan?: boolean; interfaces?: InterfaceSnapshot },
  ) => ServerSettings;
  localTestLauncherArguments: (values: string[]) => {
    configFile: string;
    distRoot: string;
    check: boolean;
    allowLanTest: boolean;
    diagnostics: boolean;
  };
  formatLocalRelayDiagnostic: (value: unknown) => string | undefined;
};

test("relay diagnostics remain disabled unless the launcher explicitly receives --diagnostics", () => {
  const defaults = localTestLauncherArguments([
    "--config",
    "/private/fixture/config.json",
  ]);
  assert.equal(defaults.diagnostics, false);
  assert.equal(defaults.check, false);
  assert.equal(defaults.allowLanTest, false);
  const enabled = localTestLauncherArguments([
    "--config",
    "/private/fixture/config.json",
    "--diagnostics",
    "--allow-lan-test",
    "--check",
  ]);
  assert.equal(enabled.diagnostics, true);
  assert.equal(enabled.check, true);
  assert.equal(enabled.allowLanTest, true);
  assert.equal(enabled.configFile, defaults.configFile);
  assert.equal(enabled.distRoot, defaults.distRoot);
  assert.throws(() => localTestLauncherArguments(["--diagnostics"]));
  assert.throws(() =>
    localTestLauncherArguments([
      "--config",
      "/private/fixture/config.json",
      "--diagnostics=1",
    ]),
  );
});

test("diagnostic log lines contain only fixed event/code and recognized roles", () => {
  const output = formatLocalRelayDiagnostic({
    event: "session-closed",
    code: "heartbeat-timeout",
    role: "controller",
    token: "private-token-fixture",
    sessionId: "private-session-fixture",
    requestId: "private-request-fixture",
    ip: "192.168.0.100",
    url: "https://private-url-fixture.example",
    payload: { video: "private-camera-fixture" },
  });
  assert.ok(output);
  assert.deepEqual(JSON.parse(output), {
    type: "relay-diagnostic",
    event: "session-closed",
    code: "heartbeat-timeout",
    role: "controller",
  });
  assert.deepEqual(
    JSON.parse(
      formatLocalRelayDiagnostic({
        event: "tls-error",
        code: "tls-handshake-failed",
        role: "private-role-fixture",
      })!,
    ),
    {
      type: "relay-diagnostic",
      event: "tls-error",
      code: "tls-handshake-failed",
    },
  );
  for (const value of [
    null,
    "private-text-fixture",
    { event: "private-event-fixture", code: "private-code-fixture" },
    { event: "tls-error", code: "private-error-text-fixture" },
    { event: "confirmation", code: "heartbeat-timeout" },
    { event: "__proto__", code: "private-code-fixture" },
  ])
    assert.equal(formatLocalRelayDiagnostic(value), undefined);
});

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "solaris-static-paths-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, "dist");
  const outside = join(directory, "private");
  const files: Record<string, string | Uint8Array> = {
    "dist/index.html": "<!doctype html><title>Main</title>",
    "dist/controller/index.html": "<!doctype html><title>Controller</title>",
    "dist/assets/app.js": "export const ready = true;",
    "dist/assets/app.css": "body { color: white; }",
    "dist/assets/photo.png": new Uint8Array([137, 80, 78, 71]),
    "dist/assets/photo.jpg": new Uint8Array([255, 216, 255]),
    "dist/assets/data.json": '{"fixture":true}',
    "dist/assets/font.woff2": new Uint8Array([119, 79, 70, 50]),
    "dist/assets/vision.wasm": new Uint8Array([0, 97, 115, 109]),
    "dist/assets/model.task": new Uint8Array([1, 2, 3]),
    "dist/.env": "FIXTURE_ONLY=not-a-secret",
    "dist/assets/.hidden": "hidden fixture",
    "dist/server-key.pem": "not a real private key",
    "dist/server.key": "not a real private key",
    "dist/archive.p12": "not a real private key",
    "dist/archive.pfx": "not a real private key",
    "private/index.html": "outside the static root",
  };
  for (const [path, content] of Object.entries(files)) {
    const destination = join(directory, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  await mkdir(join(root, "empty"));
  return { root, outside };
}

const statusIs = (status: number) => (error: unknown) =>
  error instanceof Error && "status" in error && error.status === status;

test("static directory indexes and query strings resolve within the real root", async (t) => {
  const { root } = await fixture(t);
  for (const target of [
    "/",
    "/controller",
    "/controller/",
    "/controller/?lang=en",
  ]) {
    const asset = await resolveStaticAsset(root, target);
    const file = target === "/" ? "index.html" : "controller/index.html";
    assert.equal(asset.path, await realpath(join(root, file)));
    assert.equal(asset.mime, "text/html; charset=utf-8");
    assert.ok(asset.bytes > 0);
  }
});

test("static scripts, images, fonts, WASM and data have their actual MIME and byte length", async (t) => {
  const { root } = await fixture(t);
  for (const [filename, mime, bytes] of [
    ["app.js", "text/javascript; charset=utf-8", 26],
    ["app.css", "text/css; charset=utf-8", 22],
    ["photo.png", "image/png", 4],
    ["photo.jpg", "image/jpeg", 3],
    ["data.json", "application/json; charset=utf-8", 16],
    ["font.woff2", "font/woff2", 4],
    ["vision.wasm", "application/wasm", 4],
    ["model.task", "application/octet-stream", 3],
  ] as const) {
    const asset = await resolveStaticAsset(root, `/assets/${filename}`);
    assert.equal(asset.mime, mime);
    assert.equal(asset.bytes, bytes);
    assert.equal(asset.path, await realpath(join(root, "assets", filename)));
  }
});

test("literal traversal cannot read a real sibling directory", async (t) => {
  const { root } = await fixture(t);
  for (const target of [
    "/../private/index.html",
    "/assets/../../private/index.html",
    "/assets/./app.js",
  ])
    await assert.rejects(resolveStaticAsset(root, target), statusIs(400));
});

test("percent-encoded traversal and separators cannot read a sibling directory", async (t) => {
  const { root } = await fixture(t);
  for (const target of [
    "/%2e%2e/private/index.html",
    "/%2E%2E%2fprivate/index.html",
    "/assets/%2e%2e/%2e%2e/private/index.html",
  ])
    await assert.rejects(resolveStaticAsset(root, target), statusIs(400));
});

test("hidden files are rejected even when present or percent encoded", async (t) => {
  const { root } = await fixture(t);
  for (const target of [
    "/.env",
    "/assets/.hidden",
    "/%2eenv",
    "/assets/%2ehidden",
  ])
    await assert.rejects(resolveStaticAsset(root, target), statusIs(400));
});

test("private-key and certificate-container extensions are never served", async (t) => {
  const { root } = await fixture(t);
  for (const target of [
    "/server-key.pem",
    "/server.key",
    "/archive.p12",
    "/archive.pfx",
    "/server-key.PEM",
  ])
    await assert.rejects(resolveStaticAsset(root, target), statusIs(400));
});

test("a file symlink escaping the static root is rejected", async (t) => {
  const { root, outside } = await fixture(t);
  await symlink(join(outside, "index.html"), join(root, "escaped.html"));
  await assert.rejects(
    resolveStaticAsset(root, "/escaped.html"),
    statusIs(400),
  );
});

test("a directory symlink escaping the static root cannot expose its index", async (t) => {
  const { root, outside } = await fixture(t);
  await symlink(outside, join(root, "escaped"), "dir");
  await assert.rejects(resolveStaticAsset(root, "/escaped/"), statusIs(400));
});

test("missing assets return not-found instead of falling back to the application page", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(resolveStaticAsset(root, "/missing.js"), statusIs(404));
  await assert.rejects(
    resolveStaticAsset(root, "/missing/index.html"),
    statusIs(404),
  );
});

test("malformed targets, encoded controls and backslashes are rejected", async (t) => {
  const { root } = await fixture(t);
  for (const target of [
    "/%zz",
    "/%00file",
    "/%0afile",
    "/assets\\app.js",
    "/assets%5capp.js",
    "//outside/x",
    "https://outside/x",
    "/assets/app.js#fragment",
    "/assets/app.js\u0000",
  ])
    await assert.rejects(resolveStaticAsset(root, target), statusIs(400));
});

test("directories without an index and file-as-directory targets return not-found", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(resolveStaticAsset(root, "/empty/"), statusIs(404));
  await assert.rejects(
    resolveStaticAsset(root, "/assets/app.js/child.js"),
    statusIs(404),
  );
});

test("a contained symlink resolves to the original file and preserves its MIME", async (t) => {
  const { root } = await fixture(t);
  await symlink(join(root, "assets", "app.js"), join(root, "linked.js"));
  const asset = await resolveStaticAsset(root, "/linked.js");
  assert.equal(asset.path, await realpath(join(root, "assets", "app.js")));
  assert.equal(asset.mime, "text/javascript; charset=utf-8");
  assert.equal(asset.bytes, 26);
});

const lanHost = "192.168.23.5";
const lanConfig = {
  mode: "lan",
  host: lanHost,
  relayOrigin: `https://${lanHost}:5444`,
  controllerUrl: `https://${lanHost}:5443/controller/`,
};
const interfaces: InterfaceSnapshot = {
  en0: [{ address: lanHost, family: "IPv4", internal: false }],
  lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
};

test("legacy loopback server settings retain exact origin, Host and scope", () => {
  const settings = localTestServerSettings({
    relayOrigin: "https://localhost:5444",
    controllerUrl: "https://localhost:5443/controller/",
  });
  assert.equal(settings.host, "127.0.0.1");
  assert.equal(settings.staticHost, "localhost:5443");
  assert.equal(settings.relayOrigin, "https://localhost:5444");
  assert.equal(settings.controllerUrl, "https://localhost:5443/controller/");
  assert.deepEqual(settings.allowedOrigins, [
    "https://appassets.androidplatform.net",
    "https://localhost:5443",
  ]);
  assert.match(settings.scope, /^Loopback/);
});

test("approved LAN server settings bind one private address and only its exact controller origin", () => {
  const settings = localTestServerSettings(lanConfig, {
    allowLan: true,
    interfaces,
  });
  assert.equal(settings.host, lanHost);
  assert.equal(settings.staticHost, `${lanHost}:5443`);
  assert.equal(settings.relayOrigin, lanConfig.relayOrigin);
  assert.equal(settings.controllerUrl, lanConfig.controllerUrl);
  assert.deepEqual(settings.allowedOrigins, [
    "https://appassets.androidplatform.net",
    `https://${lanHost}:5443`,
  ]);
  assert.match(
    settings.scope,
    /^Explicitly authorized temporary private-network/,
  );
  assert.doesNotMatch(settings.scope, /Loopback/);
});

test("LAN server settings cannot be selected without explicit permission", () => {
  assert.throws(() => localTestServerSettings(lanConfig, { interfaces }));
  assert.throws(() =>
    localTestServerSettings(lanConfig, { allowLan: false, interfaces }),
  );
});

test("LAN server settings cannot broaden the controller origin or use an unassigned address", () => {
  assert.throws(() =>
    localTestServerSettings(
      { ...lanConfig, controllerUrl: "https://localhost:5443/controller/" },
      { allowLan: true, interfaces },
    ),
  );
  assert.throws(() =>
    localTestServerSettings(lanConfig, { allowLan: true, interfaces: {} }),
  );
});
