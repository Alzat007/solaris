import assert from "node:assert/strict";
import test from "node:test";
import {
  controllerActionStarted,
  handleControllerRelayError,
} from "../src/remote/controllerRelayErrors";

const rejectedActions = ["rate-limited", "expired-message", "stale-sequence"];

function fixture(connected: boolean) {
  const state = {
    connected,
    phase: connected ? "connected" : "approval",
    cameraTracks: connected ? 1 : 0,
    touchHeld: connected,
    continuousMotion: connected,
    stopMessages: 0,
    revocations: 0,
  };
  const effects = {
    stopContinuousInput: () => {
      state.touchHeld = false;
      state.continuousMotion = false;
    },
    sendStop: () => {
      state.stopMessages++;
    },
    disconnect: () => {
      state.revocations++;
      state.connected = false;
      state.phase = "error";
      state.cameraTracks = 0;
      state.touchHeld = false;
      state.continuousMotion = false;
    },
  };
  return { state, effects, recovery: { stopPending: false } };
}

for (const code of rejectedActions) {
  test(`connected ${code} stops continuous input without revoking the session or camera`, () => {
    const f = fixture(true);
    assert.equal(
      handleControllerRelayError(code, true, f.effects, f.recovery),
      "recovered",
    );
    assert.deepEqual(f.state, {
      connected: true,
      phase: "connected",
      cameraTracks: 1,
      touchHeld: false,
      continuousMotion: false,
      stopMessages: 1,
      revocations: 0,
    });
  });

  test(`unapproved ${code} fails closed instead of treating a control rejection as authorization`, () => {
    const f = fixture(false);
    assert.equal(
      handleControllerRelayError(code, false, f.effects, f.recovery),
      "disconnected",
    );
    assert.equal(f.state.connected, false);
    assert.equal(f.state.revocations, 1);
    assert.equal(f.state.stopMessages, 0);
  });
}

for (const code of [
  "authorization-failed",
  "session-expired",
  "not-authorized",
  "invalid-action",
  "invalid-session",
  "invalid-message",
  "message-too-large",
  "invalid-json",
  "invalid-state",
  "network-error",
  "future-unknown-error",
]) {
  test(`connected ${code} still fails closed and releases input and camera`, () => {
    const f = fixture(true);
    assert.equal(
      handleControllerRelayError(code, true, f.effects, f.recovery),
      "disconnected",
    );
    assert.equal(f.state.connected, false);
    assert.equal(f.state.phase, "error");
    assert.equal(f.state.cameraTracks, 0);
    assert.equal(f.state.touchHeld, false);
    assert.equal(f.state.continuousMotion, false);
    assert.equal(f.state.revocations, 1);
  });
}

test("a rejected recovery STOP cannot cause an unbounded STOP/error loop", () => {
  const f = fixture(true);
  handleControllerRelayError("expired-message", true, f.effects, f.recovery);
  handleControllerRelayError("expired-message", true, f.effects, f.recovery);
  handleControllerRelayError("stale-sequence", true, f.effects, f.recovery);
  assert.equal(f.state.stopMessages, 1);
  assert.equal(f.state.revocations, 0);
  assert.equal(f.state.continuousMotion, false);
});

test("a new user action permits one fresh recovery STOP, but cleanup actions do not", () => {
  const f = fixture(true);
  handleControllerRelayError("rate-limited", true, f.effects, f.recovery);
  controllerActionStarted(f.recovery, "STOP");
  controllerActionStarted(f.recovery, "ROTATE_END");
  handleControllerRelayError("expired-message", true, f.effects, f.recovery);
  assert.equal(f.state.stopMessages, 1);
  controllerActionStarted(f.recovery, "FOCUS");
  handleControllerRelayError("rate-limited", true, f.effects, f.recovery);
  assert.equal(f.state.stopMessages, 2);
  assert.equal(f.state.revocations, 0);
});
