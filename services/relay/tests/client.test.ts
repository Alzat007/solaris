import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WebSocket } from "ws";
import {
  RelayClient,
  type RelayEvent,
} from "../../../src/remote/RelayClient.js";
import {
  controllerActionStarted,
  handleControllerRelayError,
} from "../../../src/remote/controllerRelayErrors.js";
import { createRelayServer } from "../src/server.js";
async function waitEvent(
  events: RelayEvent[],
  type: RelayEvent["type"],
  timeout = 2500,
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = events.find((event) => event.type === type);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`No ${type} event`);
}
test("browser transport API through real CA-trusted TLS: complete client lifecycle and no implicit reconnect", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solaris-client-tls-")),
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
    allowedOrigins: [origin],
  });
  await new Promise<void>((resolve) =>
    relay.server.listen(0, "127.0.0.1", resolve),
  );
  const address = relay.server.address();
  assert.ok(address && typeof address !== "string");
  const base = `https://127.0.0.1:${address.port}`;
  const originalSocket = globalThis.WebSocket,
    originalFetch = globalThis.fetch;
  const browserSockets: WebSocket[] = [];
  class BrowserSocket extends WebSocket {
    constructor(url: string | URL) {
      super(url, { ca, origin });
      browserSockets.push(this);
    }
  }
  globalThis.WebSocket =
    BrowserSocket as unknown as typeof globalThis.WebSocket;
  globalThis.fetch = async (url, init) =>
    new Promise<Response>((resolve, reject) => {
      const req = request(
        String(url),
        {
          ca,
          method: init?.method,
          headers: { Origin: origin, "Content-Type": "application/json" },
          signal: init?.signal ?? undefined,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () =>
            resolve(
              new Response(Buffer.concat(chunks).toString(), {
                status: res.statusCode,
              }),
            ),
          );
        },
      );
      req.on("error", reject);
      req.end(init?.body as string);
    });
  const tvEvents: RelayEvent[] = [],
    phoneEvents: RelayEvent[] = [];
  let phoneConnected = false;
  let stoppedContinuousInput = 0;
  const errorRecovery = { stopPending: false };
  const tv = new RelayClient({
    role: "tv",
    serviceUrl: base,
    onEvent: (event) => tvEvents.push(event),
  });
  const phone = new RelayClient({
    role: "controller",
    serviceUrl: base,
    onEvent: (event) => {
      phoneEvents.push(event);
      if (event.type === "connected") phoneConnected = true;
      if (event.type === "closed") phoneConnected = false;
      if (event.type === "error")
        handleControllerRelayError(
          event.code,
          phoneConnected,
          {
            stopContinuousInput: () => {
              stoppedContinuousInput++;
            },
            sendStop: () => {
              phone.sendAction("STOP");
            },
            disconnect: () => phone.disconnect(),
          },
          errorRecovery,
        );
    },
  });
  try {
    await tv.createSession();
    const qr = await waitEvent(tvEvents, "pair-code");
    assert.equal(qr.type, "pair-code");
    if (qr.type !== "pair-code") throw new Error("Missing pair credentials");
    await phone.pair(qr.sessionId, qr.claimToken);
    await waitEvent(phoneEvents, "waiting-approval");
    const approval = await waitEvent(tvEvents, "pair-request");
    assert.equal(phone.sendAction("ROTATE", { dx: 0.1, dy: 0 }), false);
    assert.equal(approval.type, "pair-request");
    if (approval.type !== "pair-request")
      throw new Error("Missing authorization request");
    assert.equal(tv.confirm(approval.requestId, true), true);
    await waitEvent(phoneEvents, "connected");
    await waitEvent(tvEvents, "connected");
    assert.equal(phone.sendAction("ROTATE", { dx: 0.2, dy: 0.1 }), true);
    assert.equal(phone.sendAction("ROTATE", { dx: 0.2, dy: 0.1 }), false);
    await waitEvent(tvEvents, "action");
    await waitEvent(phoneEvents, "acknowledged");
    assert.equal(
      tv.publishState({
        mode: "PLANET_OVERVIEW",
        selected: "moon",
        available: ["BACK", "SELECT"],
      }),
      true,
    );
    await waitEvent(phoneEvents, "state");
    const phoneSocket = browserSockets.at(-1);
    assert.ok(phoneSocket);
    const originalSend = phoneSocket.send.bind(phoneSocket);
    const delayedPackets: Parameters<WebSocket["send"]>[0][] = [];
    // A held packet must prevent a second continuous packet entering the socket.
    phoneSocket.send = ((data: Parameters<WebSocket["send"]>[0]) => {
      delayedPackets.push(data);
    }) as WebSocket["send"];
    await new Promise((resolve) => setTimeout(resolve, 110));
    assert.equal(phone.sendAction("POINTER", { x: 0.4, y: 0.5 }), true);
    await new Promise((resolve) => setTimeout(resolve, 75));
    assert.equal(phone.sendAction("POINTER", { x: 0.6, y: 0.5 }), false);
    assert.equal(delayedPackets.length, 1);
    phoneSocket.send = originalSend;
    const ackCount = phoneEvents.filter(
      (event) => event.type === "acknowledged",
    ).length;
    for (const packet of delayedPackets) originalSend(packet);
    const ackDeadline = Date.now() + 2500;
    while (
      phoneEvents.filter((event) => event.type === "acknowledged").length ===
        ackCount &&
      Date.now() < ackDeadline
    )
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(
      phoneEvents.filter((event) => event.type === "acknowledged").length,
      ackCount + 1,
    );
    // Fault injection bypasses only client pacing, not the relay's validation.
    // Preserve the client's sequence so the rejected packet cannot desync BACK.
    phoneSocket.send = ((data: Parameters<WebSocket["send"]>[0]) => {
      const packet = JSON.parse(String(data));
      if (packet.type === "control" && packet.message.action === "FOCUS") {
        packet.message.action = "POINTER";
        packet.message.payload = { x: 0.6, y: 0.5 };
        originalSend(JSON.stringify(packet));
      } else originalSend(data);
    }) as WebSocket["send"];
    assert.equal(phone.sendAction("FOCUS", { direction: "left" }), true);
    phoneSocket.send = originalSend;
    const rejection = await waitEvent(phoneEvents, "error");
    assert.equal(rejection.type, "error");
    if (rejection.type === "error")
      assert.equal(rejection.code, "rate-limited");
    assert.equal(phoneConnected, true);
    assert.equal(stoppedContinuousInput, 1);
    assert.equal(relay.activeSessionCount(), 1);
    assert.equal(
      phoneEvents.some((event) => event.type === "closed"),
      false,
    );
    assert.equal(phone.sendAction("BACK"), true);
    const deadline = Date.now() + 2500;
    while (
      !tvEvents.some(
        (event) => event.type === "action" && event.message.action === "BACK",
      ) &&
      Date.now() < deadline
    )
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(
      tvEvents.some(
        (event) => event.type === "action" && event.message.action === "BACK",
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 185));
    let expiredPackets = 0;
    phoneSocket.send = ((data: Parameters<WebSocket["send"]>[0]) => {
      const packet = JSON.parse(String(data));
      if (packet.type === "control") {
        packet.message.timestamp = Date.now() - 3000;
        expiredPackets++;
        originalSend(JSON.stringify(packet));
      } else originalSend(data);
    }) as WebSocket["send"];
    controllerActionStarted(errorRecovery, "FOCUS");
    assert.equal(phone.sendAction("FOCUS", { direction: "right" }), true);
    const expiredDeadline = Date.now() + 2500;
    while (
      phoneEvents.filter(
        (event) => event.type === "error" && event.code === "expired-message",
      ).length < 2 &&
      Date.now() < expiredDeadline
    )
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(
      phoneEvents.filter(
        (event) => event.type === "error" && event.code === "expired-message",
      ).length,
      2,
    );
    await new Promise((resolve) => setTimeout(resolve, 75));
    assert.equal(
      expiredPackets,
      2,
      "The rejected STOP must not produce another STOP",
    );
    assert.equal(phoneConnected, true);
    assert.equal(relay.activeSessionCount(), 1);
    phoneSocket.send = originalSend;
    controllerActionStarted(errorRecovery, "BACK");
    assert.equal(phone.sendAction("BACK"), true);
    const recoveredDeadline = Date.now() + 2500;
    while (
      tvEvents.filter(
        (event) => event.type === "action" && event.message.action === "BACK",
      ).length < 2 &&
      Date.now() < recoveredDeadline
    )
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(
      tvEvents.filter(
        (event) => event.type === "action" && event.message.action === "BACK",
      ).length,
      2,
    );
    assert.equal(
      phone.sendAction("SELECT", { expectedTargetId: "region-moon-tycho" }),
      true,
    );
    assert.equal(
      phone.sendAction("SELECT", { expectedTargetId: "region-moon-tycho" }),
      false,
    );
    assert.equal(phone.sendAction("VIDEO" as never), false);
    assert.equal(phone.publishState({ mode: "ok", available: [] }), false);
    tv.revoke();
    await waitEvent(phoneEvents, "closed");
    assert.equal(phone.sendAction("BACK"), false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(relay.activeSessionCount(), 0);
    assert.equal(
      phoneEvents.filter((event) => event.type === "connected").length,
      1,
    );
    phoneEvents.length = 0;
    await phone.pair(qr.sessionId, qr.claimToken);
    await waitEvent(phoneEvents, "closed");
    assert.equal(
      phoneEvents.some((event) => event.type === "connected"),
      false,
    );
    tvEvents.length = 0;
    await tv.createSession();
    const newQr = await waitEvent(tvEvents, "pair-code");
    assert.equal(newQr.type, "pair-code");
    if (newQr.type === "pair-code")
      assert.notEqual(newQr.sessionId, qr.sessionId);
  } finally {
    tv.disconnect();
    phone.disconnect();
    globalThis.WebSocket = originalSocket;
    globalThis.fetch = originalFetch;
    await relay.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
