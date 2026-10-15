import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isPrivateLanIpv4 } from "../scripts/tv-local-test-config.mjs";

test("local TV TLS fixtures stay private, short-lived and outside the repository", () => {
  const home = mkdtempSync(join(tmpdir(), "solaris-test-home-"));
  try {
    const output = execFileSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../scripts/prepare-tv-local-test.mjs", import.meta.url),
        ),
      ],
      {
        encoding: "utf8",
        env: { ...process.env, HOME: home },
        timeout: 30000,
      },
    );
    assert.doesNotMatch(output, /BEGIN .*KEY/);
    const info = JSON.parse(output);
    assert.ok(info.configFile.startsWith(home + "/"));
    const config = JSON.parse(readFileSync(info.configFile, "utf8"));
    const ca = new X509Certificate(readFileSync(config.caFile));
    const cert = new X509Certificate(readFileSync(config.certFile));
    assert.equal(ca.ca, true);
    assert.equal(cert.ca, false);
    assert.equal(cert.verify(ca.publicKey), true);
    assert.equal(cert.checkHost("localhost"), "localhost");
    assert.ok(Date.parse(cert.validTo) - Date.now() < 25 * 60 * 60 * 1000);
    assert.equal(statSync(config.keyFile).mode & 0o777, 0o600);
    assert.equal(statSync(config.directory).mode & 0o777, 0o700);
    assert.equal(config.relayOrigin, "https://localhost:5444");
    assert.equal(config.controllerUrl, "https://localhost:5443/controller/");
    assert.equal(
      new X509Certificate(readFileSync(config.caDerFile)).fingerprint256,
      ca.fingerprint256,
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("LAN fixture generation requires authorization and rejects public or wildcard hosts", () => {
  const script = fileURLToPath(
    new URL("../scripts/prepare-tv-local-test.mjs", import.meta.url),
  );
  for (const args of [
    ["--lan-address", "10.1.2.3"],
    ["--allow-lan-test"],
    ["--lan-address", "0.0.0.0", "--allow-lan-test"],
    ["--lan-address", "8.8.8.8", "--allow-lan-test"],
  ]) {
    assert.throws(() =>
      execFileSync(process.execPath, [script, ...args], {
        stdio: "ignore",
        timeout: 10000,
      }),
    );
  }
});

test("authorized LAN fixtures bind their leaf certificate to the assigned private IP only", (t) => {
  const host = Object.values(networkInterfaces())
    .flat()
    .find(
      (entry) =>
        entry &&
        !entry.internal &&
        entry.family === "IPv4" &&
        isPrivateLanIpv4(entry.address),
    )?.address;
  if (!host)
    return t.skip("No private external IPv4 available on this test machine");
  const home = mkdtempSync(join(tmpdir(), "solaris-lan-test-home-"));
  try {
    const output = execFileSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../scripts/prepare-tv-local-test.mjs", import.meta.url),
        ),
        "--lan-address",
        host,
        "--allow-lan-test",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, HOME: home },
        timeout: 30000,
      },
    );
    assert.doesNotMatch(output, /BEGIN .*KEY/);
    const info = JSON.parse(output);
    const config = JSON.parse(readFileSync(info.configFile, "utf8"));
    const ca = new X509Certificate(readFileSync(config.caFile));
    const cert = new X509Certificate(readFileSync(config.certFile));
    assert.equal(config.mode, "lan");
    assert.equal(config.host, host);
    assert.equal(cert.checkIP(host), host);
    assert.equal(cert.checkHost("localhost"), undefined);
    assert.equal(cert.verify(ca.publicKey), true);
    assert.equal(
      new X509Certificate(readFileSync(config.caDerFile)).fingerprint256,
      ca.fingerprint256,
    );
    assert.equal(config.controllerUrl, `https://${host}:5443/controller/`);
    assert.equal(statSync(config.keyFile).mode & 0o777, 0o600);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

const fixtureScript = fileURLToPath(
  new URL("../scripts/prepare-tv-local-test.mjs", import.meta.url),
);
const currentPrivateHost = () =>
  Object.values(networkInterfaces())
    .flat()
    .find(
      (entry) =>
        entry &&
        !entry.internal &&
        entry.family === "IPv4" &&
        isPrivateLanIpv4(entry.address),
    )?.address;
const prepare = (home: string, args: string[] = []) => {
  const output = execFileSync(process.execPath, [fixtureScript, ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
    timeout: 30000,
  });
  assert.doesNotMatch(output, /BEGIN .*KEY|ca-key\.pem|caKeyFile/);
  return JSON.parse(output);
};
const reuseArgs = (host: string, config: string) => [
  "--lan-address",
  host,
  "--allow-lan-test",
  "--reuse-ca-config",
  config,
];
const rejectReuse = (home: string, host: string, config: string) =>
  assert.throws(() =>
    execFileSync(
      process.execPath,
      [fixtureScript, ...reuseArgs(host, config)],
      {
        env: { ...process.env, HOME: home },
        stdio: "ignore",
        timeout: 30000,
      },
    ),
  );

test("CA reuse is unavailable without an explicitly authorized new LAN address", () => {
  for (const args of [
    ["--reuse-ca-config", "/not-a-private-fixture/config.json"],
    [
      "--reuse-ca-config",
      "/not-a-private-fixture/config.json",
      "--allow-lan-test",
    ],
    [
      "--lan-address",
      "10.1.2.3",
      "--reuse-ca-config",
      "/not-a-private-fixture/config.json",
    ],
  ]) {
    assert.throws(() =>
      execFileSync(process.execPath, [fixtureScript, ...args], {
        stdio: "ignore",
        timeout: 10000,
      }),
    );
  }
});

test("CA reuse preserves the trusted root, signs only the new IP, and never copies its private key", (t) => {
  const host = currentPrivateHost();
  if (!host)
    return t.skip("No private external IPv4 available on this test machine");
  const home = mkdtempSync(join(tmpdir(), "solaris-reuse-ca-home-"));
  try {
    const first = prepare(home);
    const source = JSON.parse(readFileSync(first.configFile, "utf8"));
    const ca = new X509Certificate(readFileSync(source.caFile));
    const keyFile = join(source.directory, "ca-key.pem");
    const keyBytes = readFileSync(keyFile);
    const oldHost =
      host === "10.254.254.254" ? "192.168.222.222" : "10.254.254.254";
    source.mode = "lan";
    source.host = oldHost;
    source.relayOrigin = `https://${oldHost}:5444`;
    source.controllerUrl = `https://${oldHost}:5443/controller/`;
    writeFileSync(first.configFile, JSON.stringify(source), { mode: 0o600 });
    const next = prepare(home, reuseArgs(host, first.configFile));
    const config = JSON.parse(readFileSync(next.configFile, "utf8"));
    const nextCa = new X509Certificate(readFileSync(config.caFile));
    const leaf = new X509Certificate(readFileSync(config.certFile));
    assert.equal(next.reusedCa, true);
    assert.equal(config.reusedCa, true);
    assert.equal(config.caName, source.caName);
    assert.equal(nextCa.fingerprint256, ca.fingerprint256);
    assert.equal(
      new X509Certificate(readFileSync(config.caDerFile)).fingerprint256,
      ca.fingerprint256,
    );
    assert.equal(config.caKeyFile, realpathSync(keyFile));
    assert.equal(existsSync(join(config.directory, "ca-key.pem")), false);
    assert.deepEqual(readFileSync(keyFile), keyBytes);
    assert.equal(leaf.checkIP(host), host);
    assert.equal(leaf.checkIP(oldHost), undefined);
    assert.equal(leaf.checkHost("localhost"), undefined);
    assert.equal(leaf.verify(ca.publicKey), true);
    assert.equal(
      Date.parse(config.certificateExpires),
      Math.min(Date.parse(ca.validTo), Date.parse(leaf.validTo)),
    );
    assert.equal(statSync(config.keyFile).mode & 0o777, 0o600);
    assert.equal(statSync(next.configFile).mode & 0o777, 0o600);
    const again = prepare(home, reuseArgs(host, next.configFile));
    const againConfig = JSON.parse(readFileSync(again.configFile, "utf8"));
    assert.equal(againConfig.caKeyFile, realpathSync(keyFile));
    assert.equal(existsSync(join(againConfig.directory, "ca-key.pem")), false);
    assert.equal(
      new X509Certificate(readFileSync(againConfig.caFile)).fingerprint256,
      ca.fingerprint256,
    );
    assert.equal(
      new X509Certificate(readFileSync(againConfig.certFile)).verify(
        ca.publicKey,
      ),
      true,
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("CA reuse rejects escaped fixture paths, symlinked CA files, and non-private signing keys", (t) => {
  const host = currentPrivateHost();
  if (!host)
    return t.skip("No private external IPv4 available on this test machine");
  const home = mkdtempSync(join(tmpdir(), "solaris-reuse-boundary-home-"));
  try {
    const info = prepare(home);
    const source = JSON.parse(readFileSync(info.configFile, "utf8"));
    const original = readFileSync(info.configFile);
    const caBytes = readFileSync(source.caFile);
    const externalConfig = join(home, "config.json");
    writeFileSync(externalConfig, original, { mode: 0o600 });
    rejectReuse(home, host, externalConfig);
    const externalCa = join(home, "ca.pem");
    writeFileSync(externalCa, caBytes, { mode: 0o600 });
    writeFileSync(
      info.configFile,
      JSON.stringify({ ...source, caFile: externalCa }),
      { mode: 0o600 },
    );
    rejectReuse(home, host, info.configFile);
    writeFileSync(info.configFile, original, { mode: 0o600 });
    rmSync(source.caFile);
    symlinkSync(externalCa, source.caFile);
    rejectReuse(home, host, info.configFile);
    rmSync(source.caFile);
    writeFileSync(source.caFile, caBytes, { mode: 0o600 });
    const keyFile = join(source.directory, "ca-key.pem");
    writeFileSync(
      info.configFile,
      JSON.stringify({ ...source, caKeyFile: join(home, "ca-key.pem") }),
      { mode: 0o600 },
    );
    rejectReuse(home, host, info.configFile);
    writeFileSync(info.configFile, original, { mode: 0o600 });
    chmodSync(keyFile, 0o644);
    rejectReuse(home, host, info.configFile);
    chmodSync(keyFile, 0o600);
    chmodSync(source.directory, 0o755);
    rejectReuse(home, host, info.configFile);
    chmodSync(source.directory, 0o700);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("CA reuse rejects expired, non-CA, non-self-signed, and mismatched key certificates", (t) => {
  const host = currentPrivateHost();
  if (!host)
    return t.skip("No private external IPv4 available on this test machine");
  const home = mkdtempSync(join(tmpdir(), "solaris-reuse-validity-home-"));
  try {
    const info = prepare(home);
    const source = JSON.parse(readFileSync(info.configFile, "utf8"));
    const caBytes = readFileSync(source.caFile);
    const keyFile = join(source.directory, "ca-key.pem");
    const keyBytes = readFileSync(keyFile);
    const expired = join(source.directory, "expired-ca.pem");
    const expiredCsr = join(source.directory, "expired-ca.csr");
    const expiryConfig = join(source.directory, "expiry.cnf");
    const expiryIndex = join(source.directory, "expiry-index.txt");
    const expirySerial = join(source.directory, "expiry-serial.txt");
    writeFileSync(expiryIndex, "", { mode: 0o600 });
    writeFileSync(expirySerial, "01\n", { mode: 0o600 });
    writeFileSync(
      expiryConfig,
      `[ca]\ndefault_ca=test_ca\n[test_ca]\ndatabase=${expiryIndex}\nnew_certs_dir=${source.directory}\nserial=${expirySerial}\nprivate_key=${keyFile}\ncertificate=${source.caFile}\ndefault_md=sha256\npolicy=test_policy\nx509_extensions=ca_extensions\n[test_policy]\ncommonName=supplied\n[ca_extensions]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n`,
      { mode: 0o600 },
    );
    execFileSync(
      "openssl",
      [
        "req",
        "-new",
        "-key",
        keyFile,
        "-out",
        expiredCsr,
        "-subj",
        "/CN=Expired Test CA",
      ],
      { stdio: "ignore" },
    );
    execFileSync(
      "openssl",
      [
        "ca",
        "-selfsign",
        "-batch",
        "-notext",
        "-config",
        expiryConfig,
        "-in",
        expiredCsr,
        "-out",
        expired,
        "-startdate",
        "20200101000000Z",
        "-enddate",
        "20200102000000Z",
      ],
      { stdio: "ignore" },
    );
    assert.ok(
      Date.parse(new X509Certificate(readFileSync(expired)).validTo) <
        Date.now(),
    );
    writeFileSync(source.caFile, readFileSync(expired));
    rejectReuse(home, host, info.configFile);
    writeFileSync(source.caFile, readFileSync(source.certFile));
    rejectReuse(home, host, info.configFile);
    writeFileSync(source.caFile, caBytes);
    const childExtensions = join(source.directory, "child-ca.ext");
    const childCa = join(source.directory, "child-ca.pem");
    writeFileSync(
      childExtensions,
      "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n",
      { mode: 0o600 },
    );
    execFileSync(
      "openssl",
      [
        "x509",
        "-req",
        "-in",
        join(source.directory, "server.csr"),
        "-CA",
        source.caFile,
        "-CAkey",
        keyFile,
        "-set_serial",
        "2",
        "-days",
        "1",
        "-out",
        childCa,
        "-extfile",
        childExtensions,
      ],
      { stdio: "ignore" },
    );
    assert.equal(new X509Certificate(readFileSync(childCa)).ca, true);
    writeFileSync(source.caFile, readFileSync(childCa));
    rejectReuse(home, host, info.configFile);
    writeFileSync(source.caFile, caBytes);
    writeFileSync(keyFile, readFileSync(source.keyFile), { mode: 0o600 });
    rejectReuse(home, host, info.configFile);
    writeFileSync(keyFile, keyBytes, { mode: 0o600 });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
