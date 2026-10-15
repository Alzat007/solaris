import assert from "node:assert/strict";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";

export function isPrivateLanIpv4(value) {
  if (typeof value !== "string" || isIP(value) !== 4) return false;
  const octets = value.split(".").map(Number);
  if (octets.join(".") !== value) return false;
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function validateLocalTestEndpoints(
  config,
  { allowLan = false, interfaces = networkInterfaces() } = {},
) {
  assert.ok(
    config && typeof config === "object" && !Array.isArray(config),
    "Local test configuration must be an object",
  );
  const mode = config.mode === undefined ? "loopback" : config.mode;
  assert.ok(
    mode === "loopback" || mode === "lan",
    "Local test mode must be loopback or lan",
  );
  let host = "127.0.0.1";
  let authority = "localhost";
  if (mode === "lan") {
    assert.equal(allowLan, true, "LAN testing requires explicit authorization");
    assert.ok(
      isPrivateLanIpv4(config.host),
      "LAN host must be a canonical RFC1918 IPv4 address",
    );
    host = config.host;
    assert.ok(
      interfaces &&
        typeof interfaces === "object" &&
        !Array.isArray(interfaces),
      "Current network interfaces are required for LAN testing",
    );
    const assigned = Object.values(interfaces).some(
      (entries) =>
        Array.isArray(entries) &&
        entries.some(
          (entry) =>
            entry &&
            entry.address === host &&
            entry.internal === false &&
            (entry.family === "IPv4" || entry.family === 4),
        ),
    );
    assert.ok(
      assigned,
      "LAN host is not assigned to a current external interface",
    );
    authority = host;
  } else if (config.host !== undefined) {
    assert.equal(config.host, host, "Unexpected loopback listen host");
  }
  const relayOrigin = `https://${authority}:5444`;
  const controllerOrigin = `https://${authority}:5443`;
  const controllerUrl = `${controllerOrigin}/controller/`;
  assert.equal(
    config.relayOrigin,
    relayOrigin,
    "Unexpected local relay origin",
  );
  assert.equal(
    config.controllerUrl,
    controllerUrl,
    "Unexpected controller URL",
  );
  if (config.controllerOrigin !== undefined)
    assert.equal(
      config.controllerOrigin,
      controllerOrigin,
      "Unexpected controller origin",
    );
  return { host, relayOrigin, controllerOrigin, controllerUrl };
}
