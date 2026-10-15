import test from "node:test";
import assert from "node:assert/strict";
import { ControllerTouchRotation } from "../src/controller/ControllerTouchRotation";
import type {
  RemoteAction,
  RemotePayload,
} from "../src/remote/controlProtocol";

function fixture() {
  let allowMotion = true,
    allowStart = true;
  const sent: { action: RemoteAction; payload?: RemotePayload }[] = [];
  const rotation = new ControllerTouchRotation(
    { x: 0.5, y: 0.5 },
    0,
    (action, payload) => {
      if (
        (action === "ROTATE" && !allowMotion) ||
        (action === "ROTATE_START" && !allowStart)
      )
        return false;
      sent.push({ action, payload });
      return true;
    },
  );
  return {
    rotation,
    sent,
    motion: (enabled: boolean) => {
      allowMotion = enabled;
    },
    start: (enabled: boolean) => {
      allowStart = enabled;
    },
  };
}

test("touch backpressure preserves recent horizontal and vertical displacement", () => {
  const f = fixture();
  f.motion(false);
  f.rotation.move({ x: 0.52, y: 0.51 }, 16);
  f.rotation.move({ x: 0.54, y: 0.53 }, 32);
  f.motion(true);
  f.rotation.move({ x: 0.56, y: 0.55 }, 112);
  assert.ok(Math.abs(f.sent[1].payload!.dx! - 0.06) < 1e-8);
  assert.ok(Math.abs(f.sent[1].payload!.dy! - 0.05) < 1e-8);
  assert.equal(f.sent.length, 2);
});

test("held stationary touch does not drift or generate renewals", () => {
  const f = fixture();
  for (const time of [50, 100, 300, 1000])
    f.rotation.move({ x: 0.5, y: 0.5 }, time);
  assert.deepEqual(
    f.sent.map((call) => call.action),
    ["ROTATE_START"],
  );
});

test("a long delay drops stale displacement and requires a successful restart", () => {
  const f = fixture();
  f.motion(false);
  f.rotation.move({ x: 0.54, y: 0.5 }, 20);
  f.start(false);
  f.rotation.move({ x: 0.8, y: 0.5 }, 300);
  f.motion(true);
  f.rotation.move({ x: 0.82, y: 0.5 }, 350);
  assert.equal(f.sent.length, 1);
  f.start(true);
  f.rotation.move({ x: 0.84, y: 0.5 }, 400);
  f.rotation.move({ x: 0.86, y: 0.5 }, 450);
  assert.deepEqual(
    f.sent.map((call) => call.action),
    ["ROTATE_START", "ROTATE_START", "ROTATE"],
  );
  assert.ok(Math.abs(f.sent.at(-1)!.payload!.dx! - 0.02) < 1e-8);
});

test("an aged pending gesture is discarded and each delivered packet remains bounded", () => {
  const f = fixture();
  f.motion(false);
  f.rotation.move({ x: 0.52, y: 0.5 }, 10);
  f.motion(true);
  f.rotation.move({ x: 0.8, y: 0.5 }, 210);
  assert.equal(f.sent.length, 1);
  f.rotation.move({ x: 1, y: 0 }, 220);
  assert.deepEqual(f.sent.at(-1)?.payload, { dx: 0.15, dy: -0.15 });
});
