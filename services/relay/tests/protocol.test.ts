import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_MESSAGE_BYTES,
  REMOTE_ACTIONS,
  parseControlMessage,
  parsePairingFragment,
  validateControlMessage,
  validateRelayServiceUrl,
  validateRemoteViewState,
} from "../../../src/remote/controlProtocol.js";
const sessionId = "s".repeat(32),
  claimToken = "c".repeat(43),
  now = 100000;
const context = { sessionId, lastSequence: 0, now };
const message = {
  version: 1,
  sessionId,
  sequence: 1,
  timestamp: now,
  action: "SELECT",
};
test("all known control actions have valid, bounded payloads", () => {
  for (const action of REMOTE_ACTIONS) {
    const payload =
      action === "POINTER"
        ? { x: 0.5, y: 0.6 }
        : action === "ROTATE"
          ? { dx: -1, dy: 1 }
          : action === "ZOOM"
            ? { delta: -0.2 }
            : action === "FOCUS"
              ? { direction: "left" }
              : undefined;
    assert.equal(
      validateControlMessage(
        { ...message, action, ...(payload ? { payload } : {}) },
        context,
      ).ok,
      true,
      action,
    );
  }
});
for (const [name, change] of Object.entries({
  "unknown action": { action: "VIDEO" },
  "camera frame": { video: "binary-data" },
  "raw landmarks": { landmarks: [] },
  "wrong version": { version: 2 },
  "wrong session": { sessionId: "x".repeat(32) },
  "expired timestamp": { timestamp: now - 2001 },
  "future timestamp": { timestamp: now + 1001 },
  "fractional sequence": { sequence: 1.5 },
  "replayed sequence": { sequence: 0 },
  "invalid token-sized ID": { sessionId: "a" },
  "unnecessary payload": { payload: {} },
  "missing rotate payload": { action: "ROTATE" },
  "over-range rotate": { action: "ROTATE", payload: { dx: 2, dy: 0 } },
  "NaN rotate": { action: "ROTATE", payload: { dx: NaN, dy: 0 } },
  "coordinate extra": {
    action: "POINTER",
    payload: { x: 0, y: 1, landmarks: [] },
  },
  "negative pointer": { action: "POINTER", payload: { x: -0.1, y: 1 } },
  "invalid focus": { action: "FOCUS", payload: { direction: "north" } },
  "coerced array focus": { action: "FOCUS", payload: { direction: ["left"] } },
  "selector injection": { payload: { expectedTargetId: "#danger > button" } },
}))
  test(`reject ${name}`, () =>
    assert.equal(
      validateControlMessage({ ...message, ...change }, context).ok,
      false,
    ));
test("monotonic sequence guard rejects previously accepted sequence", () =>
  assert.equal(
    validateControlMessage(message, { ...context, lastSequence: 1 }).ok,
    false,
  ));
test("SELECT may bind to an expected safe target ID", () =>
  assert.equal(
    validateControlMessage(
      { ...message, payload: { expectedTargetId: "region-moon-tycho" } },
      context,
    ).ok,
    true,
  ));
test("size check is UTF-8 bytes, not JavaScript character count", () => {
  assert.equal(parseControlMessage(JSON.stringify(message), context).ok, true);
  assert.equal(
    parseControlMessage('"' + "月".repeat(MAX_MESSAGE_BYTES / 2) + '"', context)
      .ok,
    false,
  );
  assert.equal(parseControlMessage("{", context).ok, false);
});
test("safe state is small and only TV-published scene metadata", () => {
  assert.equal(
    validateRemoteViewState({
      mode: "LOCATION_OVERVIEW",
      selected: "earth",
      available: ["SELECT", "BACK"],
      focusTarget: { id: "city-beijing", label: "北京", kind: "ui" },
    }).ok,
    true,
  );
  for (const value of [
    { mode: "ok", available: ["VIDEO"] },
    { mode: "ok", available: ["SELECT", "SELECT"] },
    { mode: "ok", available: [], secret: "token" },
    { mode: "ok", available: [], focusTarget: { id: "#button" } },
    { mode: "ok", available: [], focusTarget: { id: "x", kind: "random" } },
    { mode: "ok", available: [], focusTarget: { id: "x", kind: ["ui"] } },
    { mode: "ok", available: [], focusTarget: { id: "x", label: "\nnew" } },
  ])
    assert.equal(validateRemoteViewState(value).ok, false);
});

test("target source accepts only explicit pointer/focus or omitted legacy metadata", () => {
  for (const source of [undefined, "pointer", "focus"]) {
    const state = {
      mode: "PLANET_OVERVIEW",
      selected: "earth",
      available: ["SELECT", "BACK"],
      focusTarget: {
        id: "atlas-back",
        kind: "ui",
        ...(source === undefined ? {} : { source }),
      },
    };
    assert.deepEqual(validateRemoteViewState(state), {
      ok: true,
      value: state,
    });
  }
  for (const source of ["", "gesture", "window", null, true, [], {}])
    assert.equal(
      validateRemoteViewState({
        mode: "PLANET_OVERVIEW",
        available: [],
        focusTarget: { id: "atlas-back", kind: "ui", source },
      }).ok,
      false,
    );
});

test("target source does not allow coordinates, tracking data or other extra target fields", () => {
  for (const extra of [
    { x: 0.5, y: 0.5 },
    { timestamp: Date.now() },
    { landmarks: [] },
    { token: "not-allowed" },
  ])
    assert.equal(
      validateRemoteViewState({
        mode: "PLANET_OVERVIEW",
        available: [],
        focusTarget: {
          id: "atlas-back",
          kind: "ui",
          source: "focus",
          ...extra,
        },
      }).ok,
      false,
    );
});
test("relay endpoint is configured HTTPS origin, never arbitrary query address", () => {
  assert.equal(
    validateRelayServiceUrl("https://relay.example:8443").origin,
    "https://relay.example:8443",
  );
  for (const value of [
    "http://localhost:8443",
    "wss://relay.example",
    "https://user:pass@relay.example",
    "https://relay.example/ws",
    "https://relay.example?token=private",
    "https://relay.example#secret",
  ])
    assert.throws(() => validateRelayServiceUrl(value));
});
test("pairing fragment requires unique named keys and never accepts query URLs", () => {
  assert.deepEqual(
    parsePairingFragment(`#session=${sessionId}&claim=${claimToken}`),
    { sessionId, claimToken },
  );
  for (const hash of [
    "",
    `#session=${sessionId}&claim=${claimToken}&claim=${claimToken}`,
    `#session=${sessionId}&claim=${claimToken}&relay=https://evil.example`,
    `#session=${sessionId}&claim=short`,
  ])
    assert.equal(parsePairingFragment(hash), null);
});
