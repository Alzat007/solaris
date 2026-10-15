import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";

const { verifyPublicText, verifyPublicRemoteConfig } = (await import(
  new URL("../scripts/verify-public-remote-config.mjs", import.meta.url).href
)) as {
  verifyPublicText: (source: string, file: string) => void;
  verifyPublicRemoteConfig: (options: {
    distRoot: string;
    expectedBase?: string;
  }) => Promise<{ base: string; generatedFiles: number }>;
};

test("public bundles reject local endpoints, normalized aliases and URL credentials without disclosing them", () => {
  for (const url of [
    "https://localhost:5444",
    "wss://relay.localhost/v1/ws",
    "https://computer.local:5443/controller/",
    "http://127.0.0.1",
    "https://127.1",
    "https://0x7f000001",
    "https://0.0.0.0",
    "https://10.1.2.3:5444",
    "https://172.16.0.1",
    "https://172.31.255.255",
    "https://192.168.1.42/controller/",
    "https://169.254.1.2",
    "https://[::1]:5444",
    "https://[fd00::1]",
    "https://[fe80::1]",
    "https://[::ffff:192.168.1.42]",
    "https://user:private-fixture@relay.example",
  ]) {
    assert.throws(
      () =>
        verifyPublicText(
          `const endpoint = ${JSON.stringify(url)};`,
          "assets/main.js",
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("assets/main.js"));
        assert.ok(!error.message.includes(url));
        assert.ok(!error.message.includes("private-fixture"));
        return true;
      },
    );
  }
});

test("public bundles allow public HTTPS relay configuration and adjacent public IPv4 ranges", () => {
  for (const url of [
    "https://relay.example",
    "wss://relay.example/v1/ws",
    "https://alzat007.github.io/solaris/controller/",
    "https://172.15.255.255",
    "https://172.32.0.1",
    "https://192.169.0.1",
    "https://[2606:4700:4700::1111]",
  ])
    assert.doesNotThrow(() =>
      verifyPublicText(JSON.stringify(url), "assets/main.js"),
    );
});

test("public bundles reject embedded test certificates and private key headers", () => {
  for (const label of [
    "CERTIFICATE",
    "PRIVATE KEY",
    "RSA PRIVATE KEY",
    "EC PRIVATE KEY",
    "OPENSSH PRIVATE KEY",
  ])
    assert.throws(
      () =>
        verifyPublicText(
          JSON.stringify(`-----BEGIN ${label}-----\nfixture`),
          "index.html",
        ),
      /private key or certificate/,
    );
});

async function fixture(t: TestContext, html?: string) {
  const distRoot = await mkdtemp(join(tmpdir(), "solaris-public-output-"));
  t.after(() => rm(distRoot, { recursive: true, force: true }));
  const files: Record<string, string> = {
    "controller/index.html":
      html ??
      '<script type="module" src="/solaris/assets/controller.js"></script><link rel="stylesheet" href="/solaris/assets/controller.css">',
    "assets/controller.js": "export const relay = '';",
    "assets/controller.css": "body { color: white; }",
  };
  for (const [file, source] of Object.entries(files)) {
    await mkdir(dirname(join(distRoot, file)), { recursive: true });
    await writeFile(join(distRoot, file), source);
  }
  const info = {
    vite: { mode: "production", base: "/solaris/" },
    files: Object.keys(files).map((path) => ({ path })),
  };
  await writeFile(join(distRoot, "build-info.json"), JSON.stringify(info));
  return { distRoot, info };
}

test("controller entry uses verified assets at the Pages base; copied vendor examples are excluded", async (t) => {
  const { distRoot } = await fixture(t);
  await mkdir(join(distRoot, "cesium"));
  await writeFile(
    join(distRoot, "cesium", "example.js"),
    'const documentation = "http://localhost:8080";',
  );
  assert.deepEqual(
    await verifyPublicRemoteConfig({ distRoot, expectedBase: "/solaris/" }),
    {
      base: "/solaris/",
      generatedFiles: 3,
    },
  );
});

test("controller entry rejects root-only, remote and unverified asset URLs", async (t) => {
  for (const url of [
    "/assets/controller.js",
    "https://cdn.example/controller.js",
    "//cdn.example/controller.js",
    "/solaris/assets/missing.js",
  ])
    await t.test(url, async (t) => {
      const { distRoot } = await fixture(t, `<script src="${url}"></script>`);
      await assert.rejects(
        verifyPublicRemoteConfig({ distRoot }),
        /Controller asset/,
      );
    });
});

test("public verification rejects a missing controller, wrong base and unsafe manifest paths", async (t) => {
  const { distRoot, info } = await fixture(t);
  await assert.rejects(
    verifyPublicRemoteConfig({ distRoot, expectedBase: "/" }),
    /release base/,
  );
  info.files = info.files.filter(
    (file) => file.path !== "controller/index.html",
  );
  await writeFile(join(distRoot, "build-info.json"), JSON.stringify(info));
  await assert.rejects(
    verifyPublicRemoteConfig({ distRoot }),
    /controller entry is missing/,
  );
  info.files.push({ path: "../private.js" });
  await writeFile(join(distRoot, "build-info.json"), JSON.stringify(info));
  await assert.rejects(
    verifyPublicRemoteConfig({ distRoot }),
    /Unsafe or duplicate/,
  );
});

test("public verification catches local configuration in generated chunks", async (t) => {
  const { distRoot } = await fixture(t);
  await writeFile(
    join(distRoot, "assets/controller.js"),
    'const relay = "https://192.168.1.42:5444";',
  );
  await assert.rejects(
    verifyPublicRemoteConfig({ distRoot }),
    /local network URL/,
  );
});

test("public verification rejects copied TLS and environment files outside the generated manifest", async (t) => {
  for (const filename of ["test-ca.pem", "server.key", ".env.production"])
    await t.test(filename, async (t) => {
      const { distRoot } = await fixture(t);
      await writeFile(join(distRoot, filename), "private fixture");
      await assert.rejects(
        verifyPublicRemoteConfig({ distRoot }),
        /Private configuration or certificate file/,
      );
    });
});
