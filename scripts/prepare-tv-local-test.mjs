import { execFileSync } from "node:child_process";
import { X509Certificate, createHash, createPrivateKey } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { validateLocalTestEndpoints } from "./tv-local-test-config.mjs";

const args = process.argv.slice(2);
let lanAddress;
let allowLan = false;
let reuseCaConfig;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--allow-lan-test" && !allowLan) allowLan = true;
  else if (
    args[i] === "--lan-address" &&
    lanAddress === undefined &&
    args[i + 1]
  )
    lanAddress = args[++i];
  else if (
    args[i] === "--reuse-ca-config" &&
    reuseCaConfig === undefined &&
    args[i + 1]
  )
    reuseCaConfig = args[++i];
  else
    throw new Error(
      "Use --lan-address <private IPv4> --allow-lan-test [--reuse-ca-config <private config>], or no arguments for loopback only",
    );
}
if (allowLan && lanAddress === undefined)
  throw new Error("LAN authorization requires an explicit LAN address");
if (reuseCaConfig !== undefined && (!allowLan || lanAddress === undefined))
  throw new Error(
    "Reusing a CA requires an explicitly authorized new LAN address",
  );
const mode = lanAddress === undefined ? "loopback" : "lan";
const authority = lanAddress ?? "localhost";
const endpoints = {
  mode,
  host: lanAddress ?? "127.0.0.1",
  relayOrigin: `https://${authority}:5444`,
  controllerUrl: `https://${authority}:5443/controller/`,
};
validateLocalTestEndpoints(endpoints, { allowLan });

// Private one-day fixtures; installing the public CA is always a separate manual step.
const root = join(homedir(), ".cache", "solaris-tv-local-test");
await mkdir(root, { recursive: true, mode: 0o700 });
const reusableCa =
  reuseCaConfig === undefined ? undefined : await readReusableCa(reuseCaConfig);
const directory = await mkdtemp(join(root, "session-"));
await chmod(directory, 0o700);
const run = (args) => {
  try {
    execFileSync("openssl", args, { cwd: directory, stdio: "ignore" });
  } catch {
    throw new Error("OpenSSL local certificate operation failed");
  }
};
const caName =
  reusableCa?.caName ??
  (mode === "lan"
    ? `SOLARIS LAN Test ${directory.split("session-").at(-1)}`
    : "SOLARIS Local Test CA");
const caKeyFile = reusableCa?.caKeyFile ?? join(directory, "ca-key.pem");
if (reusableCa) {
  await writeFile(join(directory, "ca.pem"), reusableCa.pem, { mode: 0o600 });
} else
  run([
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-keyout",
    caKeyFile,
    "-out",
    "ca.pem",
    "-subj",
    `/CN=${caName}`,
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
  ]);
run([
  "req",
  "-new",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  "server-key.pem",
  "-out",
  "server.csr",
  "-subj",
  `/CN=${authority}`,
]);
const san = mode === "lan" ? `IP:${lanAddress}` : "DNS:localhost,IP:127.0.0.1";
await writeFile(
  join(directory, "server.ext"),
  `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\n`,
  { mode: 0o600 },
);
run([
  "x509",
  "-req",
  "-in",
  "server.csr",
  "-CA",
  "ca.pem",
  "-CAkey",
  caKeyFile,
  "-CAcreateserial",
  "-days",
  "1",
  "-out",
  "server.pem",
  "-extfile",
  "server.ext",
]);
for (const name of ["server-key.pem", ...(reusableCa ? [] : ["ca-key.pem"])])
  await chmod(join(directory, name), 0o600);
const ca = new X509Certificate(await readFile(join(directory, "ca.pem")));
const server = new X509Certificate(
  await readFile(join(directory, "server.pem")),
);
const matchesHost =
  mode === "lan" ? server.checkIP(lanAddress) : server.checkHost("localhost");
if (!ca.ca || server.ca || !server.verify(ca.publicKey) || !matchesHost)
  throw new Error("Invalid local test certificate chain");
run([
  "x509",
  "-in",
  "ca.pem",
  "-outform",
  "DER",
  "-out",
  "solaris-test-ca.cer",
]);
const config = {
  ...endpoints,
  scope:
    mode === "lan"
      ? "Authorized temporary private-LAN iPhone and Android TV emulator test only; manual phone CA trust, no public deployment or automatic camera access."
      : "Local Android TV emulator and isolated Chromium test only; no physical phone, LAN, public server or system CA installation.",
  directory,
  caFile: join(directory, "ca.pem"),
  certFile: join(directory, "server.pem"),
  keyFile: join(directory, "server-key.pem"),
  caDerFile: join(directory, "solaris-test-ca.cer"),
  caName,
  certificateExpires:
    Date.parse(ca.validTo) < Date.parse(server.validTo)
      ? ca.validTo
      : server.validTo,
  ...(reusableCa ? { reusedCa: true, caKeyFile } : {}),
  serverSpki: createHash("sha256")
    .update(server.publicKey.export({ type: "spki", format: "der" }))
    .digest("base64"),
};
await writeFile(
  join(directory, "config.json"),
  JSON.stringify(config, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    mode,
    configFile: join(directory, "config.json"),
    caFile: config.caFile,
    caDerFile: config.caDerFile,
    caName,
    relayOrigin: config.relayOrigin,
    controllerUrl: config.controllerUrl,
    certificateExpires: config.certificateExpires,
    ...(reusableCa ? { reusedCa: true } : {}),
  }),
);

async function readReusableCa(configPath) {
  const cache = await realpath(root);
  if (
    (await lstat(root)).isSymbolicLink() ||
    (await lstat(dirname(root))).isSymbolicLink()
  )
    throw new Error("CA reuse cache must not be a symlink");
  const sourcePath = await realpath(configPath);
  const sourceDirectory = dirname(sourcePath);
  if (
    basename(sourcePath) !== "config.json" ||
    dirname(sourceDirectory) !== cache ||
    !/^session-[A-Za-z0-9]+$/.test(basename(sourceDirectory))
  )
    throw new Error(
      "CA reuse configuration must be inside a private cache session",
    );
  await privateDirectory(sourceDirectory);
  const sourceBytes = await privateFile(sourcePath, 32768);
  let source;
  try {
    source = JSON.parse(sourceBytes.toString("utf8"));
  } catch {
    throw new Error("Invalid private CA reuse configuration");
  }
  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    typeof source.directory !== "string" ||
    (await realpath(source.directory)) !== sourceDirectory ||
    source.caFile !== join(source.directory, "ca.pem") ||
    typeof source.caName !== "string" ||
    !source.caName ||
    source.caName.length > 128
  )
    throw new Error("CA reuse configuration has invalid fixture paths or name");
  const pem = await confinedFile(source.caFile, sourceDirectory, 65536);
  const publicPem =
    /^-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----\s*$/.exec(
      pem.toString("ascii"),
    );
  if (!publicPem)
    throw new Error("CA reuse requires one public PEM certificate");
  let ca;
  try {
    ca = new X509Certificate(pem);
    if (!Buffer.from(publicPem[1], "base64").equals(ca.raw))
      throw new Error("extra certificate data");
  } catch {
    throw new Error("CA reuse certificate is invalid");
  }
  const now = Date.now();
  if (
    !ca.ca ||
    ca.subject !== ca.issuer ||
    !ca.verify(ca.publicKey) ||
    !Number.isFinite(Date.parse(ca.validFrom)) ||
    !Number.isFinite(Date.parse(ca.validTo)) ||
    Date.parse(ca.validFrom) > now ||
    Date.parse(ca.validTo) <= now
  )
    throw new Error(
      "CA reuse requires a currently valid self-signed certificate authority",
    );
  const sourceKeyPath =
    source.caKeyFile ?? join(source.directory, "ca-key.pem");
  if (
    typeof sourceKeyPath !== "string" ||
    (await lstat(sourceKeyPath)).isSymbolicLink()
  )
    throw new Error("CA signing key must remain in a private cache session");
  const caKeyFile = await realpath(sourceKeyPath);
  if (
    basename(caKeyFile) !== "ca-key.pem" ||
    dirname(dirname(caKeyFile)) !== cache ||
    !/^session-[A-Za-z0-9]+$/.test(basename(dirname(caKeyFile)))
  )
    throw new Error("CA signing key must remain in a private cache session");
  await privateDirectory(dirname(caKeyFile));
  const keyBytes = await privateFile(caKeyFile, 65536);
  try {
    if (!ca.checkPrivateKey(createPrivateKey(keyBytes)))
      throw new Error("mismatch");
  } catch {
    throw new Error("CA signing key does not match the public certificate");
  } finally {
    keyBytes.fill(0);
  }
  return { pem: ca.toString(), caName: source.caName, caKeyFile };
}

async function privateDirectory(path) {
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (info.mode & 0o777) !== 0o700 ||
    (typeof process.getuid === "function" && info.uid !== process.getuid())
  )
    throw new Error("CA reuse session must be an owner-only private directory");
}

async function confinedFile(path, directory, maximumSize) {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    dirname(await realpath(path)) !== directory ||
    info.size === 0 ||
    info.size > maximumSize ||
    (typeof process.getuid === "function" && info.uid !== process.getuid())
  )
    throw new Error(
      "CA reuse file must stay inside its original cache fixture",
    );
  return readFile(path);
}

async function privateFile(path, maximumSize) {
  const info = await lstat(path);
  if ((info.mode & 0o777) !== 0o600)
    throw new Error(
      "CA reuse configuration and signing key require private 0600 permissions",
    );
  return confinedFile(path, await realpath(dirname(path)), maximumSize);
}
