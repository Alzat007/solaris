import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createBuildInfo, readGitBuildState } from "../scripts/build-info";

const settings = {
  gitCommit: "a".repeat(40),
  dirty: false,
  mode: "production",
  base: "/solaris/",
  env: {},
};

test("build evidence hashes actual UTF-8 chunks and binary assets in stable path order", () => {
  const code = "console.log('地球')";
  const css = new Uint8Array([97, 123, 125]);
  const info = createBuildInfo(settings, {
    "index.html": { type: "asset", source: "<html></html>" },
    "assets/main.js": { type: "chunk", code },
    "assets/main.css": { type: "asset", source: css },
    "assets/image.jpg": { type: "asset", source: new Uint8Array([1, 2]) },
    "other.json": { type: "asset", source: "{}" },
  });
  assert.deepEqual(
    info.files.map((file) => file.path),
    ["assets/main.css", "assets/main.js", "index.html"],
  );
  assert.equal(info.files[1].bytes, Buffer.byteLength(code));
  assert.equal(
    info.files[1].sha256,
    createHash("sha256").update(code).digest("hex"),
  );
  assert.equal(info.files[0].bytes, css.byteLength);
  assert.equal(
    info.files[0].sha256,
    createHash("sha256").update(css).digest("hex"),
  );
});

test("default evidence preserves local mode and the explicit ion activation gate", () => {
  const info = createBuildInfo(settings, {});
  assert.deepEqual(info.vite, { mode: "production", base: "/solaris/" });
  assert.deepEqual(info.ion, {
    defaultDataMode: "local",
    requiredQuery: "data=ion",
    tokenConfigured: false,
    terrainAssetId: 1,
    imageryAssetId: 3830183,
  });
});

test("token evidence exposes only a configured flag, never token values, hashes or other environment fields", () => {
  const token = "fake-read-token-for-unit-test";
  const info = createBuildInfo(
    {
      ...settings,
      env: {
        VITE_CESIUM_ION_READ_TOKEN: token,
        TEST_PASSWORD: "fake-password-for-unit-test",
        PRIVATE_PATH: "not-a-public-field",
      },
    },
    {},
  );
  const serialized = JSON.stringify(info);
  assert.equal(info.ion.tokenConfigured, true);
  assert.equal(serialized.includes(token), false);
  assert.equal(
    serialized.includes(createHash("sha256").update(token).digest("hex")),
    false,
  );
  assert.equal(serialized.includes("TEST_PASSWORD"), false);
  assert.equal(serialized.includes("fake-password-for-unit-test"), false);
  assert.equal(serialized.includes("PRIVATE_PATH"), false);
  assert.equal(serialized.includes("not-a-public-field"), false);
  assert.equal(
    createBuildInfo(
      { ...settings, env: { VITE_CESIUM_ION_READ_TOKEN: "  " } },
      {},
    ).ion.tokenConfigured,
    false,
  );
});

test("selected asset IDs are numeric and invalid overrides fail without echoing their input", () => {
  const info = createBuildInfo(
    {
      ...settings,
      env: {
        VITE_CESIUM_TERRAIN_ASSET_ID: " 42 ",
        VITE_CESIUM_IMAGERY_ASSET_ID: "12345",
      },
    },
    {},
  );
  assert.equal(info.ion.terrainAssetId, 42);
  assert.equal(info.ion.imageryAssetId, 12345);
  for (const value of [
    "0",
    "-1",
    "1.5",
    "1e3",
    "9007199254740992",
    "private-input",
  ]) {
    assert.throws(
      () =>
        createBuildInfo(
          {
            ...settings,
            env: { VITE_CESIUM_TERRAIN_ASSET_ID: value },
          },
          {},
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message.includes(value), false);
        return true;
      },
    );
  }
});

test("Git evidence includes only commit and dirty status, including untracked source changes", () => {
  const commands: string[][] = [];
  const info = readGitBuildState("unused", (args) => {
    commands.push(args);
    return args[0] === "rev-parse"
      ? `${"b".repeat(40)}\n`
      : "?? undisclosed-file-name\n";
  });
  assert.deepEqual(info, { gitCommit: "b".repeat(40), dirty: true });
  assert.equal(JSON.stringify(info).includes("undisclosed-file-name"), false);
  assert.deepEqual(commands[1], [
    "status",
    "--porcelain",
    "--untracked-files=normal",
  ]);
  assert.equal(
    readGitBuildState("unused", (args) =>
      args[0] === "rev-parse" ? "c".repeat(40) : "",
    ).dirty,
    false,
  );
});

test("unavailable Git metadata remains explicitly unknown and does not publish command errors", () => {
  const info = readGitBuildState("unused", () => {
    throw new Error("private command failure");
  });
  assert.deepEqual(info, { gitCommit: null, dirty: null });
  assert.equal(JSON.stringify(info).includes("private command failure"), false);
  assert.deepEqual(
    readGitBuildState("unused", (args) => {
      if (args[0] === "rev-parse") return "d".repeat(40);
      throw new Error("status not available");
    }),
    { gitCommit: "d".repeat(40), dirty: null },
  );
});
