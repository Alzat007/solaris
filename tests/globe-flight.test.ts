import test from "node:test";
import assert from "node:assert/strict";
import { FlightSession } from "../src/globeLab/FlightSession";

function fixture() {
  let pose = 10;
  let stopped = 0;
  const completes: (() => void)[] = [];
  const session = new FlightSession<number, number>({
    capture: () => pose,
    restore: (value) => {
      pose = value;
    },
    stop: () => {
      stopped++;
    },
    fly: (_destination, complete) => {
      completes.push(complete);
    },
    arrive: (destination) => {
      pose = destination;
    },
  });
  return {
    session,
    completes,
    get pose() {
      return pose;
    },
    set pose(value) {
      pose = value;
    },
    get stopped() {
      return stopped;
    },
  };
}

test("manual takeover stops flight without jumping back", () => {
  const f = fixture();
  f.session.start(100);
  f.pose = 42;
  assert.equal(f.session.takeover(), true);
  assert.equal(f.pose, 42);
  assert.equal(f.stopped, 1);
  f.completes[0]();
  assert.equal(f.pose, 42);
  assert.equal(f.session.mode, "MANUAL");
});

test("explicit cancel restores the exact origin and ignores stale completion", () => {
  const f = fixture();
  f.session.start(100);
  f.pose = 42;
  assert.equal(f.session.cancel(), true);
  assert.equal(f.pose, 10);
  f.session.start(200);
  f.completes[0]();
  assert.equal(f.session.mode, "AUTO_FLIGHT");
  f.completes[1]();
  assert.equal(f.session.mode, "MANUAL");
});

test("repeated confirmation does not start a second camera flight", () => {
  const f = fixture();
  assert.equal(f.session.start(100), true);
  assert.equal(f.session.start(200), false);
  assert.equal(f.completes.length, 1);
});

test("skip arrives once and cannot be undone by old callbacks", () => {
  const f = fixture();
  f.session.start(100);
  assert.equal(f.session.skip(), true);
  assert.equal(f.pose, 100);
  assert.equal(f.session.cancel(), false);
  f.completes[0]();
  assert.equal(f.pose, 100);
});

test("a failed flight restores origin and unlocks navigation", () => {
  let restored = false;
  const session = new FlightSession({
    capture: () => 10,
    restore: () => {
      restored = true;
    },
    stop: () => {},
    fly: () => {
      throw new Error("render failed");
    },
    arrive: () => {},
  });
  assert.throws(() => session.start(100), /render failed/);
  assert.equal(session.mode, "MANUAL");
  assert.equal(restored, true);
});
