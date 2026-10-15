import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RelayClient, type RelayEvent } from "../src/remote/RelayClient";
import type { ControlMessage } from "../src/remote/controlProtocol";

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.OPEN;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_address: URL) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }
  send(text: string) {
    const data = JSON.parse(text) as Record<string, unknown>;
    this.sent.push(data);
    if (data.type === "auth")
      queueMicrotask(() => this.receive({ type: "authenticated" }));
  }
  receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
  controls(): ControlMessage[] {
    return this.sent
      .filter((data) => data.type === "control")
      .map((data) => data.message as ControlMessage);
  }
}

async function fixture(t: TestContext) {
  let now = 10000;
  t.mock.method(Date, "now", () => now);
  const originalSocket = globalThis.WebSocket;
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  FakeWebSocket.instances = [];
  const events: RelayEvent[] = [];
  const client = new RelayClient({
    role: "controller",
    serviceUrl: "https://relay.example",
    onEvent: (event) => events.push(event),
  });
  t.after(() => {
    client.disconnect();
    globalThis.WebSocket = originalSocket;
  });
  const pair = async (sessionId = "session-fixture-0000000000000000") => {
    await client.pair(
      sessionId,
      "claim-token-fixture-0000000000000000000000000",
    );
    const socket = FakeWebSocket.instances.at(-1)!;
    socket.receive({ type: "connected", sessionId });
    return socket;
  };
  const socket = await pair();
  return {
    client,
    socket,
    events,
    pair,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
    ack: (sequence: number) =>
      socket.receive({ type: "acknowledged", sequence }),
  };
}

test("continuous actions share 100ms pacing and a matching ACK adds at least 70ms", async (t) => {
  const f = await fixture(t);
  assert.equal(f.client.sendAction("POINTER", { x: 0.4, y: 0.5 }), true);
  f.advance(10);
  f.ack(1);
  f.advance(69);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.2, dy: 0 }), false);
  f.advance(1);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), false);
  f.advance(20);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.2, dy: 0 }), true);
  f.advance(100);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), false);
  f.ack(2);
  f.advance(69);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), false);
  f.advance(1);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), true);
  assert.deepEqual(
    f.socket.controls().map((message) => message.sequence),
    [1, 2, 3],
  );
});

test("compressed network arrival cannot accumulate multiple continuous packets in flight", async (t) => {
  const f = await fixture(t);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  f.advance(100);
  assert.equal(f.client.sendAction("POINTER", { x: 0.4, y: 0.5 }), false);
  f.advance(100);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), false);
  assert.equal(f.socket.controls().length, 1);
  f.advance(300);
  const firstArrival = f.now();
  f.advance(20);
  f.ack(1);
  f.advance(69);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.2, dy: 0 }), false);
  f.advance(1);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.2, dy: 0 }), true);
  const secondArrival = f.now();
  assert.ok(secondArrival - firstArrival >= 70);
  assert.equal(f.socket.controls().length, 2);
});

test("a slow ACK applies backpressure without queuing or consuming sequence numbers", async (t) => {
  const f = await fixture(t);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  for (let attempt = 0; attempt < 20; attempt++) {
    f.advance(100);
    assert.equal(f.client.sendAction("ROTATE", { dx: 0.02, dy: 0 }), false);
  }
  assert.equal(f.socket.controls().length, 1);
  f.ack(1);
  f.advance(69);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.3, dy: 0 }), false);
  f.advance(1);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.3, dy: 0 }), true);
  assert.deepEqual(
    f.socket.controls().map((message) => message.sequence),
    [1, 2],
  );
  assert.equal(f.socket.controls()[1].payload?.dx, 0.3);
});

test("STOP, BACK and ROTATE_END bypass continuous backpressure and their ACKs cannot unlock it", async (t) => {
  const f = await fixture(t);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  for (const action of ["STOP", "BACK", "ROTATE_END"] as const)
    assert.equal(f.client.sendAction(action), true);
  assert.deepEqual(
    f.socket.controls().map((message) => message.sequence),
    [1, 2, 3, 4],
  );
  for (const sequence of [2, 3, 4]) f.ack(sequence);
  f.advance(1000);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), false);
  f.ack(1);
  f.advance(70);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  for (const sequence of [1, 2, 3, 4]) f.ack(sequence);
  f.advance(1000);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), false);
  f.ack(5);
  f.advance(70);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), true);
});

for (const code of ["rate-limited", "expired-message", "stale-sequence"]) {
  test(`${code} clears only pacing state and applies a short retry backoff`, async (t) => {
    const f = await fixture(t);
    assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
    f.advance(200);
    f.socket.receive({ type: "error", code });
    assert.equal(f.client.sendAction("STOP"), true);
    f.ack(2);
    f.advance(149);
    assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), false);
    f.advance(1);
    assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
    f.ack(1);
    f.advance(1000);
    assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), false);
    f.ack(3);
    f.advance(70);
    assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), true);
    assert.equal(
      f.events.some((event) => event.type === "closed"),
      false,
    );
    assert.deepEqual(
      f.socket.controls().map((message) => message.sequence),
      [1, 2, 3, 4],
    );
  });
}

test("a duplicate ACK does not extend the post-ACK gap or unlock a newer packet", async (t) => {
  const f = await fixture(t);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  f.advance(100);
  f.ack(1);
  f.advance(50);
  f.ack(1);
  f.advance(20);
  assert.equal(f.client.sendAction("POINTER", { x: 0.2, y: 0.3 }), true);
  f.ack(1);
  f.advance(1000);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), false);
  f.ack(2);
  f.advance(70);
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), true);
});

for (const acknowledgement of [
  { sequence: 0 },
  { sequence: -1 },
  { sequence: 1.5 },
  { sequence: 2 },
  { sequence: "1" },
  { sequence: 1, extra: "untrusted" },
]) {
  test(`an anomalous ACK ${JSON.stringify(acknowledgement)} cannot release control`, async (t) => {
    const f = await fixture(t);
    assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
    f.socket.receive({ type: "acknowledged", ...acknowledgement });
    f.advance(1000);
    assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), false);
    assert.equal(f.client.sendAction("STOP"), false);
    assert.deepEqual(
      f.events.filter((event) => event.type === "closed"),
      [{ type: "closed", reason: "invalid-server-message" }],
    );
    assert.equal(f.socket.controls().length, 1);
  });
}

test("disconnect and re-pair reset pacing and sequence; old-socket ACKs are ignored", async (t) => {
  const f = await fixture(t);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  f.client.disconnect();
  assert.equal(f.client.sendAction("STOP"), false);
  const newSocket = await f.pair("new-session-fixture-000000000000");
  assert.equal(f.client.sendAction("ZOOM", { delta: 0.1 }), true);
  assert.equal(newSocket.controls()[0].sequence, 1);
  f.ack(1);
  f.socket.receive({ type: "error", code: "rate-limited" });
  f.advance(1000);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), false);
  newSocket.receive({ type: "acknowledged", sequence: 1 });
  f.advance(70);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  assert.deepEqual(
    newSocket.controls().map((message) => message.sequence),
    [1, 2],
  );
});

test("a failed socket write neither reserves an in-flight packet nor consumes its sequence", async (t) => {
  const f = await fixture(t);
  f.socket.readyState = 0;
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), false);
  f.socket.readyState = FakeWebSocket.OPEN;
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  assert.equal(f.socket.controls()[0].sequence, 1);
});

test("discrete actions retain their own debounce while continuous input awaits ACK", async (t) => {
  const f = await fixture(t);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), true);
  assert.equal(f.client.sendAction("SELECT"), true);
  assert.equal(f.client.sendAction("SELECT"), false);
  f.advance(179);
  assert.equal(f.client.sendAction("SELECT"), false);
  f.advance(1);
  assert.equal(f.client.sendAction("SELECT"), true);
  f.ack(2);
  f.ack(3);
  assert.equal(f.client.sendAction("ROTATE", { dx: 0.1, dy: 0 }), false);
});
