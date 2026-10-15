import { readFileSync } from "node:fs";
import { createRelayServer } from "./server.js";
const certPath = process.env.RELAY_TLS_CERT,
  keyPath = process.env.RELAY_TLS_KEY;
if (!certPath || !keyPath)
  throw new Error(
    "Set RELAY_TLS_CERT and RELAY_TLS_KEY to a trusted HTTPS certificate and private key outside this repository.",
  );
const host = process.env.RELAY_HOST ?? "127.0.0.1";
if (
  !["127.0.0.1", "::1", "localhost"].includes(host) &&
  process.env.RELAY_ALLOW_NON_LOOPBACK !== "1"
)
  throw new Error(
    "Non-loopback listen requires explicit RELAY_ALLOW_NON_LOOPBACK=1; configure TLS, firewall and origins first.",
  );
const port = Number(process.env.RELAY_PORT ?? 8443);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid RELAY_PORT.");
const allowedOrigins = (process.env.RELAY_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const relay = createRelayServer({
  tls: { cert: readFileSync(certPath), key: readFileSync(keyPath) },
  allowedOrigins,
});
relay.server.listen(port, host, () =>
  process.stdout.write(
    `SOLARIS HTTPS/WSS relay listening on ${host}:${port}; ${allowedOrigins.length} allowed origins.\n`,
  ),
);
const stop = async () => {
  await relay.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
