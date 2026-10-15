import assert from "node:assert/strict";
import test from "node:test";

type Endpoints = {
  host: string;
  relayOrigin: string;
  controllerOrigin: string;
  controllerUrl: string;
};
const { isPrivateLanIpv4, validateLocalTestEndpoints } = (await import(
  new URL("../scripts/tv-local-test-config.mjs", import.meta.url).href
)) as {
  isPrivateLanIpv4: (value: unknown) => boolean;
  validateLocalTestEndpoints: (
    config: unknown,
    options?: { allowLan?: unknown; interfaces?: unknown },
  ) => Endpoints;
};

const loopback = {
  relayOrigin: "https://localhost:5444",
  controllerUrl: "https://localhost:5443/controller/",
};
const lanHost = "192.168.1.42";
const lan = {
  mode: "lan",
  host: lanHost,
  relayOrigin: `https://${lanHost}:5444`,
  controllerUrl: `https://${lanHost}:5443/controller/`,
};
const interfaces = {
  lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
  en0: [{ address: lanHost, family: "IPv4", internal: false }],
};
const lanOptions = { allowLan: true, interfaces };

test("private LAN addresses include exactly the canonical RFC1918 ranges", () => {
  for (const value of [
    "10.0.0.0",
    "10.255.255.255",
    "172.16.0.0",
    "172.31.255.255",
    "192.168.0.0",
    "192.168.255.255",
    lanHost,
  ])
    assert.equal(isPrivateLanIpv4(value), true, value);
  for (const value of [
    "9.255.255.255",
    "11.0.0.0",
    "172.15.255.255",
    "172.32.0.0",
    "192.167.255.255",
    "192.169.0.0",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.1.2",
    "100.64.0.1",
    "8.8.8.8",
    "224.0.0.1",
    "255.255.255.255",
  ])
    assert.equal(isPrivateLanIpv4(value), false, value);
});

test("private LAN parser rejects aliases, leading zeros, malformed and non-string values", () => {
  for (const value of [
    "010.0.0.1",
    "192.168.01.42",
    "192.168.1.042",
    "192.168.1.256",
    "192.168.1.-1",
    "192.168.1.1.1",
    "10.1",
    "10.0.0",
    "0x0a.0.0.1",
    "167772161",
    "10.0.0.1:5444",
    "https://10.0.0.1",
    " 10.0.0.1",
    "10.0.0.1\n",
    "10.0.0.NaN",
    "10.0.0.1e0",
    "::1",
    "::ffff:192.168.1.42",
    "fd00::1",
    "localhost",
    "",
    null,
    undefined,
    NaN,
    167772161,
    {},
    ["10.0.0.1"],
  ])
    assert.equal(isPrivateLanIpv4(value), false, String(value));
});

test("legacy and explicit loopback configs preserve the fixed localhost endpoints", () => {
  const expected = {
    host: "127.0.0.1",
    relayOrigin: loopback.relayOrigin,
    controllerOrigin: "https://localhost:5443",
    controllerUrl: loopback.controllerUrl,
  };
  for (const config of [
    loopback,
    { ...loopback, mode: "loopback" },
    { ...loopback, mode: "loopback", host: "127.0.0.1" },
    { ...loopback, controllerOrigin: expected.controllerOrigin },
  ])
    assert.deepEqual(validateLocalTestEndpoints(config), expected);
});

test("loopback config cannot quietly change the listen address, origins, scheme or path", () => {
  for (const config of [
    { ...loopback, host: "localhost" },
    { ...loopback, host: "0.0.0.0" },
    { ...loopback, host: lanHost },
    { ...loopback, host: null },
    { ...loopback, relayOrigin: "https://127.0.0.1:5444" },
    { ...loopback, relayOrigin: "http://localhost:5444" },
    { ...loopback, relayOrigin: "https://localhost:5445" },
    { ...loopback, relayOrigin: "https://localhost:5444/" },
    { ...loopback, controllerUrl: "https://localhost:5443/controller" },
    { ...loopback, controllerOrigin: "https://localhost:5443/" },
  ])
    assert.throws(() => validateLocalTestEndpoints(config));
});

test("LAN config requires explicit boolean authorization even for an assigned private IP", () => {
  for (const allowLan of [undefined, false, "true", 1, null])
    assert.throws(
      () => validateLocalTestEndpoints(lan, { allowLan, interfaces }),
      /explicit authorization/,
    );
});

test("authorized LAN config uses only an actual noninternal IPv4 interface", () => {
  assert.deepEqual(validateLocalTestEndpoints(lan, lanOptions), {
    host: lanHost,
    relayOrigin: lan.relayOrigin,
    controllerOrigin: `https://${lanHost}:5443`,
    controllerUrl: lan.controllerUrl,
  });
  assert.equal(
    validateLocalTestEndpoints(lan, {
      allowLan: true,
      interfaces: {
        en1: [{ address: lanHost, family: 4, internal: false }],
      },
    }).host,
    lanHost,
  );
});

test("LAN config rejects unassigned, internal, stale and invalid interface inventories", () => {
  for (const current of [
    {},
    { en0: undefined },
    { en0: [{ address: "192.168.1.43", family: "IPv4", internal: false }] },
    { en0: [{ address: lanHost, family: "IPv4", internal: true }] },
    { en0: [{ address: lanHost, family: "IPv4" }] },
    { en0: [{ address: lanHost, family: "IPv6", internal: false }] },
    null,
    [],
    "en0",
  ])
    assert.throws(() =>
      validateLocalTestEndpoints(lan, { allowLan: true, interfaces: current }),
    );
});

test("LAN endpoint fields must exactly agree with the authorized address and fixed ports", () => {
  for (const config of [
    { ...lan, host: "192.168.001.42" },
    { ...lan, host: "8.8.8.8" },
    { ...lan, host: "127.0.0.1" },
    { ...lan, relayOrigin: loopback.relayOrigin },
    { ...lan, relayOrigin: `https://${lanHost}:5444/` },
    { ...lan, relayOrigin: `https://${lanHost}:5444/v1/sessions` },
    { ...lan, relayOrigin: `https://${lanHost}:5444?token=x` },
    { ...lan, relayOrigin: `https://user:pass@${lanHost}:5444` },
    { ...lan, controllerUrl: `https://${lanHost}:5444/controller/` },
    { ...lan, controllerUrl: `https://${lanHost}:5443/controller/?lang=en` },
    { ...lan, controllerUrl: `https://${lanHost}:5443/controller/#claim` },
    { ...lan, controllerOrigin: `https://${lanHost}:5443/` },
  ])
    assert.throws(() => validateLocalTestEndpoints(config, lanOptions));
});

test("unknown modes and malformed configuration records are refused", () => {
  for (const config of [
    null,
    undefined,
    [],
    "loopback",
    {},
    { ...loopback, mode: null },
    { ...loopback, mode: "LAN" },
    { ...loopback, mode: "public" },
    { ...lan, host: undefined },
  ])
    assert.throws(() => validateLocalTestEndpoints(config, lanOptions));
});

test("endpoint validation never mutates configuration, metadata or interface records", () => {
  const config = Object.freeze({ ...lan, scope: "authorized fixture" });
  const current = Object.freeze({
    en0: Object.freeze([
      Object.freeze({ address: lanHost, family: "IPv4", internal: false }),
    ]),
  });
  const before = JSON.stringify({ config, current });
  const first = validateLocalTestEndpoints(config, {
    allowLan: true,
    interfaces: current,
  });
  const second = validateLocalTestEndpoints(config, {
    allowLan: true,
    interfaces: current,
  });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify({ config, current }), before);
});
