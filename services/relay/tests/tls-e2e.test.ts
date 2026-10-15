import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WebSocket } from "ws";
import {
  createRelayServer,
  RELAY_DIAGNOSTIC_CODES,
  type RelayDiagnostic,
  type RelayServerOptions,
} from "../src/server.js";
type Event = Record<string, unknown>;
class Peer {
  readonly socket: WebSocket;
  events: Event[] = [];
  constructor(address: string, ca: Buffer, origin: string) {
    this.socket = new WebSocket(address, { ca, origin });
    this.socket.on("error", () => {});
    this.socket.on("message", (buffer) =>
      this.events.push(JSON.parse(buffer.toString())),
    );
  }
  async open() {
    await new Promise<void>((resolve, reject) => {
      this.socket.once("open", resolve);
      this.socket.once("error", reject);
    });
  }
  send(data: unknown) {
    this.socket.send(JSON.stringify(data));
  }
  async next(type: string, timeout = 2000): Promise<Event> {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const index = this.events.findIndex((event) => event.type === type);
      if (index >= 0) return this.events.splice(index, 1)[0];
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(
      `Timed out waiting for ${type}; events ${JSON.stringify(this.events)}`,
    );
  }
  close() {
    this.socket.terminate();
  }
}
async function fixture(
  options: Omit<RelayServerOptions, "tls" | "allowedOrigins"> = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "solaris-relay-tls-")),
    certPath = join(directory, "cert.pem"),
    keyPath = join(directory, "key.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  const ca = readFileSync(certPath),
    origin = "https://controller.example";
  const relay = createRelayServer({
    tls: { cert: ca, key: readFileSync(keyPath) },
    allowedOrigins: [origin, "https://appassets.androidplatform.net"],
    ...options,
  });
  await new Promise<void>((resolve) =>
    relay.server.listen(0, "127.0.0.1", resolve),
  );
  const address = relay.server.address();
  assert.ok(address && typeof address !== "string");
  const base = `https://127.0.0.1:${address.port}`;
  const peers: Peer[] = [];
  const post = async (
    path = "/v1/sessions",
    requestOrigin = "https://appassets.androidplatform.net",
    body = "{}",
  ) =>
    new Promise<{ status: number; body: Record<string, unknown> }>(
      (resolve, reject) => {
        const req = request(
          base + path,
          {
            method: "POST",
            ca,
            headers: {
              Origin: requestOrigin,
              "Content-Type": "application/json",
            },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () =>
              resolve({
                status: response.statusCode!,
                body: JSON.parse(Buffer.concat(chunks).toString()),
              }),
            );
          },
        );
        req.on("error", reject);
        req.end(body);
      },
    );
  const peer = async (path = "/v1/ws", peerOrigin = origin) => {
    const value = new Peer(
      base.replace("https:", "wss:") + path,
      ca,
      peerOrigin,
    );
    peers.push(value);
    await value.open();
    return value;
  };
  const newSession = async () => {
    const created = await post();
    assert.equal(created.status, 201);
    return created.body as {
      sessionId: string;
      tvToken: string;
      claimToken: string;
      expiresAt: number;
    };
  };
  const pair = async () => {
    const session = await newSession();
    const tv = await peer("/v1/ws", "https://appassets.androidplatform.net");
    tv.send({
      type: "auth",
      role: "tv",
      sessionId: session.sessionId,
      token: session.tvToken,
    });
    await tv.next("authenticated");
    const phone = await peer();
    phone.send({
      type: "auth",
      role: "controller",
      sessionId: session.sessionId,
      token: session.claimToken,
    });
    await phone.next("authenticated");
    await phone.next("waiting-approval");
    const request = await tv.next("pair-request");
    return { session, tv, phone, requestId: request.requestId };
  };
  const confirm = async (tv: Peer, phone: Peer, requestId: unknown) => {
    tv.send({ type: "confirm", requestId, approved: true });
    await tv.next("connected");
    await phone.next("connected");
  };
  const close = async () => {
    for (const value of peers) value.close();
    await relay.close();
    rmSync(directory, { recursive: true, force: true });
  };
  return { ca, base, relay, post, peer, newSession, pair, confirm, close };
}
test("real HTTPS/WSS: explicit approval, rotation/select/back, state and revocation", async () => {
  const f = await fixture();
  try {
    const { session, tv, phone, requestId } = await f.pair();
    const message = (sequence: number, action: string, payload?: unknown) => ({
      type: "control",
      message: {
        version: 1,
        sessionId: session.sessionId,
        sequence,
        timestamp: Date.now(),
        action,
        ...(payload ? { payload } : {}),
      },
    });
    phone.send(message(1, "ROTATE", { dx: 0.2, dy: 0.1 }));
    assert.equal((await phone.next("error")).code, "not-authorized");
    assert.equal(
      tv.events.some((event) => event.type === "action"),
      false,
    );
    await f.confirm(tv, phone, requestId);
    phone.send(message(1, "ROTATE", { dx: 0.2, dy: 0.1 }));
    const rotation = await tv.next("action");
    assert.equal((rotation.message as Event).action, "ROTATE");
    await phone.next("acknowledged");
    phone.send(message(2, "SELECT", { expectedTargetId: "city-beijing" }));
    assert.equal(((await tv.next("action")).message as Event).action, "SELECT");
    await phone.next("acknowledged");
    phone.send(message(3, "BACK"));
    assert.equal(((await tv.next("action")).message as Event).action, "BACK");
    await phone.next("acknowledged");
    tv.send({
      type: "state",
      state: {
        mode: "PLANET_OVERVIEW",
        selected: "earth",
        available: ["SELECT", "BACK"],
        focusTarget: { id: "city-beijing", label: "北京", kind: "ui" },
      },
    });
    assert.equal(
      ((await phone.next("state")).state as Event).selected,
      "earth",
    );
    tv.send({ type: "revoke" });
    assert.equal((await phone.next("closed")).reason, "revoked");
    assert.equal(f.relay.activeSessionCount(), 0);
    const attacker = await f.peer();
    attacker.send({
      type: "auth",
      role: "controller",
      sessionId: session.sessionId,
      token: session.claimToken,
    });
    assert.equal((await attacker.next("error")).code, "session-expired");
  } finally {
    await f.close();
  }
});
test("real WSS forwards target source only from the approved TV and rejects unknown source", async () => {
  const f = await fixture();
  try {
    const { tv, phone, requestId } = await f.pair();
    await f.confirm(tv, phone, requestId);
    for (const source of ["pointer", "focus"]) {
      const state = {
        mode: "PLANET_OVERVIEW",
        selected: "earth",
        available: ["SELECT", "BACK"],
        focusTarget: { id: "atlas-back", label: "Back", kind: "ui", source },
      };
      tv.send({ type: "state", state });
      assert.deepEqual((await phone.next("state")).state, state);
      phone.send({ type: "state", state });
      assert.equal((await phone.next("error")).code, "invalid-state");
    }
    tv.send({
      type: "state",
      state: {
        mode: "PLANET_OVERVIEW",
        available: [],
        focusTarget: { id: "atlas-back", kind: "ui", source: "arbitrary" },
      },
    });
    assert.equal((await tv.next("error")).code, "invalid-state");
    assert.equal(
      phone.events.some((event) => event.type === "state"),
      false,
    );
  } finally {
    await f.close();
  }
});

test("origin, token query, arbitrary path and HTTPS request body are rejected", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.post("/v1/sessions", "https://evil.example")).status,
      403,
    );
    assert.equal((await f.post("/v1/sessions?token=secret")).status, 404);
    assert.equal(
      (await f.post("/v1/sessions", undefined, '{"video":true}')).status,
      400,
    );
    await assert.rejects(f.peer("/v1/ws?token=secret"));
    await assert.rejects(f.peer("/v1/ws", "https://evil.example"));
    const session = await f.newSession();
    const peer = await f.peer();
    peer.send({
      type: "auth",
      role: "tv",
      sessionId: session.sessionId,
      token: "x".repeat(43),
    });
    assert.equal((await peer.next("error")).code, "authorization-failed");
    await assert.rejects(
      new Promise<void>((resolve, reject) => {
        const req = request(f.base + "/health", (res) => {
          res.resume();
          resolve();
        });
        req.on("error", reject);
        req.end();
      }),
      "Self-signed test TLS must not be implicitly trusted",
    );
  } finally {
    await f.close();
  }
});
test("single-use credential cannot claim twice; controller cannot approve itself", async () => {
  const f = await fixture();
  try {
    const { session, tv, phone, requestId } = await f.pair();
    const duplicate = await f.peer();
    duplicate.send({
      type: "auth",
      role: "controller",
      sessionId: session.sessionId,
      token: session.claimToken,
    });
    assert.equal((await duplicate.next("error")).code, "authorization-failed");
    phone.send({ type: "confirm", requestId, approved: true });
    assert.equal((await phone.next("error")).code, "invalid-confirmation");
    tv.send({ type: "confirm", requestId, approved: false });
    assert.equal((await phone.next("closed")).reason, "pairing-rejected");
  } finally {
    await f.close();
  }
});
test("reject replay, stale/future messages, raw data, spoofed state and rate floods", async () => {
  const f = await fixture();
  try {
    const { session, tv, phone, requestId } = await f.pair();
    await f.confirm(tv, phone, requestId);
    const base = {
      version: 1,
      sessionId: session.sessionId,
      sequence: 1,
      timestamp: Date.now(),
      action: "SELECT",
    };
    phone.send({ type: "control", message: base });
    await tv.next("action");
    await phone.next("acknowledged");
    phone.send({ type: "control", message: base });
    assert.equal((await phone.next("error")).code, "stale-sequence");
    phone.send({
      type: "control",
      message: { ...base, sequence: 2, timestamp: Date.now() - 3000 },
    });
    assert.equal((await phone.next("error")).code, "expired-message");
    phone.send({
      type: "control",
      message: { ...base, sequence: 2, timestamp: Date.now() + 3000 },
    });
    assert.equal((await phone.next("error")).code, "expired-message");
    phone.send({
      type: "control",
      message: { ...base, sequence: 2, landmarks: [] },
    });
    assert.equal((await phone.next("error")).code, "invalid-message");
    phone.send({
      type: "state",
      state: { mode: "PLANET_OVERVIEW", available: ["SELECT"] },
    });
    assert.equal((await phone.next("error")).code, "invalid-state");
    phone.send({ type: "control", message: { ...base, sequence: 2 } });
    assert.equal((await phone.next("error")).code, "rate-limited");
    phone.send({
      type: "control",
      message: { ...base, sequence: 3, action: "STOP" },
    });
    assert.equal(((await tv.next("action")).message as Event).action, "STOP");
    await phone.next("acknowledged");
    phone.send({
      type: "control",
      message: {
        ...base,
        sequence: 4,
        action: "ROTATE",
        payload: { dx: 0.2, dy: 0 },
      },
    });
    await tv.next("action");
    await phone.next("acknowledged");
    phone.send({
      type: "control",
      message: {
        ...base,
        sequence: 5,
        action: "ROTATE",
        payload: { dx: 0.2, dy: 0 },
      },
    });
    assert.equal((await phone.next("error")).code, "rate-limited");
  } finally {
    await f.close();
  }
});
test("peer disconnection invalidates the session and no stale claim resumes control", async () => {
  const f = await fixture();
  try {
    const { session, tv, phone, requestId } = await f.pair();
    await f.confirm(tv, phone, requestId);
    phone.close();
    assert.equal((await tv.next("closed")).reason, "peer-disconnected");
    assert.equal(f.relay.activeSessionCount(), 0);
    const reconnect = await f.peer();
    reconnect.send({
      type: "auth",
      role: "controller",
      sessionId: session.sessionId,
      token: session.claimToken,
    });
    assert.equal((await reconnect.next("error")).code, "session-expired");
  } finally {
    await f.close();
  }
});
test("pairing expiration, approval expiration and heartbeat timeout close safely", async () => {
  const f = await fixture({
    pairingTtlMs: 1000,
    approvalTtlMs: 100,
    heartbeatTimeoutMs: 300,
  });
  try {
    const { tv, phone } = await f.pair();
    assert.equal((await phone.next("closed")).reason, "session-expired");
    await tv.next("closed");
    const expired = await f.newSession();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const peer = await f.peer();
    peer.send({
      type: "auth",
      role: "tv",
      sessionId: expired.sessionId,
      token: expired.tvToken,
    });
    assert.equal((await peer.next("error")).code, "session-expired");
  } finally {
    await f.close();
  }
  const heartbeat = await fixture({ heartbeatTimeoutMs: 200 });
  try {
    const { tv, phone, requestId } = await heartbeat.pair();
    await heartbeat.confirm(tv, phone, requestId);
    assert.equal((await tv.next("closed")).reason, "heartbeat-timeout");
    await phone.next("closed");
  } finally {
    await heartbeat.close();
  }
});
for (const deadline of ["claim", "session"] as const) {
  test(`authentication at the ${deadline} deadline revokes the existing TV before cleanup`, async (t) => {
    const start = 1000000;
    t.mock.timers.enable({ apis: ["Date", "setInterval"], now: start });
    const f = await fixture({
      pairingTtlMs: deadline === "claim" ? 100 : 1000,
      sessionTtlMs: deadline === "session" ? 100 : 1000,
    });
    try {
      const session = await f.newSession();
      const tv = await f.peer(
        "/v1/ws",
        "https://appassets.androidplatform.net",
      );
      tv.send({
        type: "auth",
        role: "tv",
        sessionId: session.sessionId,
        token: session.tvToken,
      });
      await tv.next("authenticated");
      t.mock.timers.setTime(start + 100);
      assert.equal(f.relay.activeSessionCount(), 1);
      const phone = await f.peer();
      phone.send({
        type: "auth",
        role: "controller",
        sessionId: session.sessionId,
        token: session.claimToken,
      });
      assert.equal((await phone.next("error")).code, "session-expired");
      assert.equal((await tv.next("closed")).reason, "session-expired");
      assert.equal(f.relay.activeSessionCount(), 0);
      assert.equal(
        phone.events.some((event) => event.type === "authenticated"),
        false,
      );
    } finally {
      await f.close();
      t.mock.timers.reset();
    }
  });
}
test("authenticated TV heartbeat at the unconfirmed claim deadline revokes before cleanup", async (t) => {
  const start = 1000000;
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: start });
  const f = await fixture({ pairingTtlMs: 100 });
  try {
    const session = await f.newSession();
    const tv = await f.peer("/v1/ws", "https://appassets.androidplatform.net");
    tv.send({
      type: "auth",
      role: "tv",
      sessionId: session.sessionId,
      token: session.tvToken,
    });
    await tv.next("authenticated");
    t.mock.timers.setTime(start + 100);
    assert.equal(f.relay.activeSessionCount(), 1);
    tv.send({ type: "heartbeat" });
    assert.equal((await tv.next("closed")).reason, "session-expired");
    assert.equal(
      tv.events.some((event) => event.type === "heartbeat"),
      false,
    );
    assert.equal(f.relay.activeSessionCount(), 0);
  } finally {
    await f.close();
    t.mock.timers.reset();
  }
});
test("TV confirmation at the approval deadline cannot connect peers before cleanup", async (t) => {
  const start = 1000000;
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: start });
  const f = await fixture({ pairingTtlMs: 1000, approvalTtlMs: 100 });
  try {
    const { tv, phone, requestId } = await f.pair();
    t.mock.timers.setTime(start + 100);
    assert.equal(f.relay.activeSessionCount(), 1);
    tv.send({ type: "confirm", requestId, approved: true });
    assert.equal((await tv.next("closed")).reason, "session-expired");
    assert.equal((await phone.next("closed")).reason, "session-expired");
    assert.equal(
      tv.events.some((event) => event.type === "connected"),
      false,
    );
    assert.equal(
      phone.events.some((event) => event.type === "connected"),
      false,
    );
    assert.equal(f.relay.activeSessionCount(), 0);
  } finally {
    await f.close();
    t.mock.timers.reset();
  }
});
for (const messageType of ["control", "state"] as const) {
  test(`${messageType} at the confirmed session deadline cannot forward before cleanup`, async (t) => {
    const start = 1000000;
    t.mock.timers.enable({ apis: ["Date", "setInterval"], now: start });
    const f = await fixture({ pairingTtlMs: 1000, sessionTtlMs: 100 });
    try {
      const { session, tv, phone, requestId } = await f.pair();
      await f.confirm(tv, phone, requestId);
      t.mock.timers.setTime(start + 100);
      assert.equal(f.relay.activeSessionCount(), 1);
      if (messageType === "control") {
        phone.send({
          type: "control",
          message: {
            version: 1,
            sessionId: session.sessionId,
            sequence: 1,
            timestamp: Date.now(),
            action: "SELECT",
          },
        });
      } else {
        tv.send({
          type: "state",
          state: { mode: "PLANET_OVERVIEW", available: ["SELECT"] },
        });
      }
      assert.equal((await tv.next("closed")).reason, "session-expired");
      assert.equal((await phone.next("closed")).reason, "session-expired");
      assert.equal(
        tv.events.some((event) => event.type === "action"),
        false,
      );
      assert.equal(
        phone.events.some((event) =>
          ["state", "acknowledged"].includes(String(event.type)),
        ),
        false,
      );
      assert.equal(f.relay.activeSessionCount(), 0);
    } finally {
      await f.close();
      t.mock.timers.reset();
    }
  });
}
test("a confirmed session remains usable when its consumed claim expires", async (t) => {
  const start = 1000000;
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: start });
  const f = await fixture({ pairingTtlMs: 100, sessionTtlMs: 1000 });
  try {
    const { session, tv, phone, requestId } = await f.pair();
    await f.confirm(tv, phone, requestId);
    t.mock.timers.setTime(start + 100);
    phone.send({
      type: "control",
      message: {
        version: 1,
        sessionId: session.sessionId,
        sequence: 1,
        timestamp: Date.now(),
        action: "SELECT",
      },
    });
    assert.equal(((await tv.next("action")).message as Event).action, "SELECT");
    await phone.next("acknowledged");
    assert.equal(f.relay.activeSessionCount(), 1);
  } finally {
    await f.close();
    t.mock.timers.reset();
  }
});
test("binary and oversized websocket messages terminate without forwarding", async () => {
  const f = await fixture();
  try {
    const { phone, tv, requestId } = await f.pair();
    await f.confirm(tv, phone, requestId);
    phone.socket.send(Buffer.from([1, 2, 3]));
    await phone.next("error");
    await tv.next("closed");
    const second = await f.pair();
    await f.confirm(second.tv, second.phone, second.requestId);
    second.phone.socket.send("x".repeat(2049));
    await second.tv.next("closed");
    assert.equal(
      second.tv.events.some((event) => event.type === "action"),
      false,
    );
  } finally {
    await f.close();
  }
});

async function diagnosticSeen(
  diagnostics: RelayDiagnostic[],
  event: RelayDiagnostic["event"],
  code: string,
) {
  const start = performance.now();
  while (performance.now() - start < 2000) {
    const found = diagnostics.find(
      (diagnostic) => diagnostic.event === event && diagnostic.code === code,
    );
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`Missing fixed diagnostic ${event}/${code}`);
}

function assertDiagnosticsAreRedacted(
  diagnostics: RelayDiagnostic[],
  sensitive: string[],
) {
  for (const diagnostic of diagnostics) {
    assert.deepEqual(
      Object.keys(diagnostic).sort(),
      diagnostic.role ? ["code", "event", "role"] : ["code", "event"],
    );
    const allowed: readonly string[] = RELAY_DIAGNOSTIC_CODES[diagnostic.event];
    assert.ok(allowed.includes(diagnostic.code));
    if (diagnostic.role)
      assert.ok(["tv", "controller"].includes(diagnostic.role));
  }
  const serialized = JSON.stringify(diagnostics);
  for (const value of sensitive)
    assert.equal(serialized.includes(value), false);
}

test("opt-in diagnostics identify approval and revocation without IDs, secrets or actions", async () => {
  const diagnostics: RelayDiagnostic[] = [];
  const f = await fixture({
    onDiagnostic: (value) => {
      diagnostics.push(value);
    },
  });
  try {
    const { session, tv, phone, requestId } = await f.pair();
    assert.deepEqual(diagnostics, [
      { event: "authentication", code: "authenticated", role: "tv" },
      { event: "authentication", code: "authenticated", role: "controller" },
      {
        event: "waiting-approval",
        code: "waiting-approval",
        role: "controller",
      },
    ]);
    await f.confirm(tv, phone, requestId);
    phone.send({
      type: "control",
      message: {
        version: 1,
        sessionId: session.sessionId,
        sequence: 1,
        timestamp: Date.now(),
        action: "ROTATE",
        payload: { dx: 0.2, dy: -0.1 },
      },
    });
    await tv.next("action");
    await phone.next("acknowledged");
    assert.equal(diagnostics.length, 4);
    phone.send({
      type: "control",
      message: {
        camera: "sensitive-camera-fixture",
        payload: "private-payload",
      },
    });
    assert.equal((await phone.next("error")).code, "invalid-message");
    tv.send({ type: "revoke" });
    assert.equal((await phone.next("closed")).reason, "revoked");
    assert.equal(
      (await diagnosticSeen(diagnostics, "session-closed", "revoked")).role,
      undefined,
    );
    await diagnosticSeen(diagnostics, "connection-closed", "normal-close");
    assertDiagnosticsAreRedacted(diagnostics, [
      session.sessionId,
      session.tvToken,
      session.claimToken,
      String(requestId),
      f.base,
      "127.0.0.1",
      "https://appassets.androidplatform.net",
      "sensitive-camera-fixture",
      "private-payload",
      "ROTATE",
    ]);
  } finally {
    await f.close();
  }
});

test("TLS, upgrade and auth rejection diagnostics never expose attacker-controlled fields", async () => {
  const diagnostics: RelayDiagnostic[] = [];
  const f = await fixture({
    onDiagnostic: (value) => {
      diagnostics.push(value);
    },
  });
  try {
    await assert.rejects(
      new Promise((resolve, reject) => {
        const req = request(f.base + "/health", (response) => {
          response.resume();
          resolve(response.statusCode);
        });
        req.on("error", reject);
        req.end();
      }),
    );
    await diagnosticSeen(diagnostics, "tls-error", "tls-handshake-failed");
    await assert.rejects(f.peer("/v1/ws?token=private-upgrade-fixture"));
    await assert.rejects(
      f.peer("/v1/ws", "https://private-origin-fixture.example"),
    );
    await diagnosticSeen(diagnostics, "upgrade-rejected", "path-rejected");
    await diagnosticSeen(diagnostics, "upgrade-rejected", "origin-rejected");
    const session = await f.newSession();
    const invalid = await f.peer();
    invalid.send({
      type: "auth",
      role: "sensitive-role-fixture",
      sessionId: session.sessionId,
      token: session.claimToken,
    });
    assert.equal((await invalid.next("error")).code, "authorization-failed");
    await diagnosticSeen(diagnostics, "authentication", "authorization-failed");
    const missing = await f.peer();
    missing.send({
      type: "auth",
      role: "tv",
      sessionId: "missing-session-fixture-00000000",
      token: "private-token-fixture-0000000000000000000000",
    });
    assert.equal((await missing.next("error")).code, "session-expired");
    await diagnosticSeen(diagnostics, "authentication", "session-expired");
    assertDiagnosticsAreRedacted(diagnostics, [
      session.sessionId,
      session.tvToken,
      session.claimToken,
      "private-upgrade-fixture",
      "private-origin-fixture",
      "sensitive-role-fixture",
      "missing-session-fixture",
      "private-token-fixture",
      "127.0.0.1",
      f.base,
    ]);
  } finally {
    await f.close();
  }
});

test("throwing diagnostic callbacks cannot interrupt authentication, control or closing", async () => {
  let callbacks = 0;
  const f = await fixture({
    onDiagnostic: () => {
      callbacks++;
      throw new Error("Diagnostic sink unavailable");
    },
  });
  try {
    const { session, tv, phone, requestId } = await f.pair();
    await f.confirm(tv, phone, requestId);
    phone.send({
      type: "control",
      message: {
        version: 1,
        sessionId: session.sessionId,
        sequence: 1,
        timestamp: Date.now(),
        action: "STOP",
      },
    });
    assert.equal(((await tv.next("action")).message as Event).action, "STOP");
    await phone.next("acknowledged");
    tv.send({ type: "revoke" });
    assert.equal((await phone.next("closed")).reason, "revoked");
    assert.equal(f.relay.activeSessionCount(), 0);
    assert.ok(callbacks >= 5);
  } finally {
    await f.close();
  }
});

test("asynchronously rejected diagnostic callbacks do not create unhandled errors", async () => {
  const f = await fixture({
    onDiagnostic: async () => {
      throw new Error("Asynchronous diagnostic sink unavailable");
    },
  });
  try {
    const { tv, phone, requestId } = await f.pair();
    await f.confirm(tv, phone, requestId);
    tv.send({ type: "revoke" });
    assert.equal((await phone.next("closed")).reason, "revoked");
    assert.equal(f.relay.activeSessionCount(), 0);
  } finally {
    await f.close();
  }
});

for (const reason of [
  "pairing-rejected",
  "peer-disconnected",
  "heartbeat-timeout",
  "service-stopped",
] as const) {
  test(`diagnostics identify ${reason} without free-form close text`, async () => {
    const diagnostics: RelayDiagnostic[] = [];
    const f = await fixture({
      onDiagnostic: (value) => {
        diagnostics.push(value);
      },
      ...(reason === "heartbeat-timeout" ? { heartbeatTimeoutMs: 20 } : {}),
    });
    let stopped = false;
    try {
      const { tv, phone, requestId } = await f.pair();
      if (reason === "pairing-rejected") {
        tv.send({ type: "confirm", requestId, approved: false });
        await phone.next("closed");
        await diagnosticSeen(diagnostics, "confirmation", "pairing-rejected");
      } else {
        await f.confirm(tv, phone, requestId);
        if (reason === "peer-disconnected") {
          phone.socket.close(1001, "private-disconnect-text-fixture");
          assert.equal((await tv.next("closed")).reason, reason);
          assert.equal(
            (
              await diagnosticSeen(
                diagnostics,
                "connection-closed",
                "going-away",
              )
            ).role,
            "controller",
          );
        } else if (reason === "heartbeat-timeout") {
          assert.equal((await phone.next("closed")).reason, reason);
        } else {
          await f.close();
          stopped = true;
        }
      }
      await diagnosticSeen(diagnostics, "session-closed", reason);
      assertDiagnosticsAreRedacted(diagnostics, [
        "private-disconnect-text-fixture",
      ]);
    } finally {
      if (!stopped) await f.close();
    }
  });
}

test("diagnostics record expiry once while retaining the existing approval deadline", async (t) => {
  const diagnostics: RelayDiagnostic[] = [];
  const start = 1000000;
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: start });
  const f = await fixture({
    onDiagnostic: (value) => {
      diagnostics.push(value);
    },
    pairingTtlMs: 1000,
    approvalTtlMs: 100,
  });
  try {
    const { tv, phone, requestId } = await f.pair();
    t.mock.timers.setTime(start + 100);
    tv.send({ type: "confirm", requestId, approved: true });
    assert.equal((await tv.next("closed")).reason, "session-expired");
    assert.equal((await phone.next("closed")).reason, "session-expired");
    await diagnosticSeen(diagnostics, "session-expired", "session-expired");
    assert.equal(
      diagnostics.filter((value) => value.event === "session-expired").length,
      1,
    );
    assert.equal(
      diagnostics.some((value) => value.code === "confirmed"),
      false,
    );
    assert.equal(f.relay.activeSessionCount(), 0);
  } finally {
    await f.close();
    t.mock.timers.reset();
  }
});
