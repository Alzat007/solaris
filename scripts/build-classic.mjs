import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceCommit = "2353680b32060c4aa6a0a814d18e10290d644b07";
const parentBase = process.env.VITE_BASE_PATH || "/";
assert.match(
  parentBase,
  /^\/(?:[A-Za-z0-9_-]+\/)*$/,
  "Expected an absolute Pages base path ending with slash",
);
const base = `${parentBase}classic/`;
const temporary = await mkdtemp(join(tmpdir(), "solaris-classic-"));
const output = join(root, "dist/classic");
const env = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "CI", "SYSTEMROOT"].flatMap(
    (key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]]),
  ),
);
env.VITE_BASE_PATH = base;
const run = (file, args, cwd = temporary) =>
  execFileSync(file, args, { cwd, env, stdio: "inherit" });
const node = (...args) => run(process.execPath, args);

try {
  const archive = join(temporary, "source.tar");
  run(
    "git",
    ["archive", "--format=tar", `--output=${archive}`, sourceCommit],
    root,
  );
  run("tar", ["-xf", archive, "-C", temporary]);
  const originalPackage = JSON.parse(
    await readFile(join(temporary, "package.json"), "utf8"),
  );
  assert.ok(
    !originalPackage.dependencies.cesium,
    "Classic must remain the original non-geographic application",
  );
  if (process.argv.includes("--reuse-node-modules")) {
    // Local verification only; CI always installs the original frozen lockfile.
    const lock = JSON.parse(
      await readFile(join(temporary, "package-lock.json"), "utf8"),
    );
    for (const name of Object.keys({
      ...originalPackage.dependencies,
      ...originalPackage.devDependencies,
    })) {
      const installed = JSON.parse(
        await readFile(
          join(root, "node_modules", name, "package.json"),
          "utf8",
        ),
      );
      assert.equal(
        installed.version,
        lock.packages[`node_modules/${name}`].version,
        `Original lockfile mismatch: ${name}`,
      );
    }
    await symlink(
      join(root, "node_modules"),
      join(temporary, "node_modules"),
      "dir",
    );
    node("scripts/copy-mediapipe.mjs");
  } else {
    run("npm", ["ci"]);
  }
  const tests = (await readdir(join(temporary, "tests")))
    .filter((name) => name.endsWith(".test.ts"))
    .sort();
  node(
    "node_modules/tsx/dist/cli.mjs",
    "--test",
    ...tests.map((name) => `tests/${name}`),
  );
  node("node_modules/typescript/bin/tsc", "-b");
  node("node_modules/vite/bin/vite.js", "build");
  node("scripts/verify-static-export.mjs");
  const built = join(temporary, "dist");
  const html = await readFile(join(built, "index.html"), "utf8");
  const entryAssets = [...html.matchAll(/(?:src|href)="(\/[^\"]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(entryAssets.length >= 3);
  for (const url of entryAssets) {
    assert.ok(
      url.startsWith(base),
      `Classic asset must use its own base path: ${url}`,
    );
    assert.ok((await stat(join(built, url.slice(base.length)))).isFile());
  }
  for (const path of [
    "mediapipe/vision_wasm_internal.js",
    "mediapipe/vision_wasm_internal.wasm",
    "mediapipe/vision_wasm_nosimd_internal.js",
    "mediapipe/vision_wasm_nosimd_internal.wasm",
    "models/hand_landmarker.task",
    "textures/earth-day.jpg",
    "textures/earth-night.png",
  ])
    assert.ok((await stat(join(built, path))).size > 1000, path);
  await cp(
    join(temporary, "THIRD_PARTY_NOTICES.md"),
    join(built, "THIRD_PARTY_NOTICES.md"),
  );
  // Pages omits dotfiles; the main artifact already owns the Jekyll marker.
  await rm(join(built, ".nojekyll"), { force: true });
  const files = [];
  async function hashFiles(folder, prefix = "") {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = `${prefix}${entry.name}`;
      if (entry.isDirectory())
        await hashFiles(join(folder, entry.name), `${path}/`);
      else {
        assert.ok(
          entry.isFile(),
          "Only regular files belong in the public artifact",
        );
        const bytes = await readFile(join(folder, entry.name));
        files.push({
          path,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  }
  await hashFiles(built);
  await writeFile(
    join(built, "release-info.json"),
    `${JSON.stringify(
      {
        edition: "original-gesture",
        sourceCommit,
        sourceTree: execFileSync(
          "git",
          ["rev-parse", `${sourceCommit}^{tree}`],
          {
            cwd: root,
            env,
            encoding: "utf8",
          },
        ).trim(),
        base,
        sourceUrl: `https://github.com/Alzat007/solaris/tree/${sourceCommit}`,
        usesGeographicServices: false,
        files,
      },
      null,
      2,
    )}\n`,
  );
  await mkdir(join(root, "dist"), { recursive: true });
  await rm(output, { recursive: true, force: true });
  await cp(built, output, { recursive: true });
  console.log(
    `Classic verified: ${sourceCommit}, base ${base}, ${files.length} checksummed files. Current source and main dist remain untouched.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
