import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  HandTrackingManager,
  type TrackingDependencies,
  type TrackingInputSink,
} from "../src/gesture/HandTrackingManager";
import type { HandFrame } from "../src/gesture/GestureTypes";
import { gestures } from "../src/gesture/GestureController";
import { interaction } from "../src/interaction/InteractionController";
import { handFixture } from "./fixtures/hands";

const detection = (): HandLandmarkerResult => {
  const fixture = handFixture("POINT");
  return {
    landmarks: [fixture.points.map((point) => ({ ...point, visibility: 1 }))],
    worldLandmarks: [fixture.world.map((point) => ({ ...point, visibility: 1 }))],
    handedness: [[{ categoryName: "Right", displayName: "", score: 1, index: 0 }]],
    handednesses: [],
  };
};
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function setup(
  t: TestContext,
  sink?: TrackingInputSink,
  overrides: Partial<TrackingDependencies> = {},
) {
  let time = 1_000;
  let serial = 0;
  let stops = 0;
  let requests = 0;
  let models = 0;
  let closes = 0;
  const queue = new Map<number, () => void>();
  const video = {
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 1,
    play: async () => {},
    pause: () => {},
  } as unknown as HTMLVideoElement;
  const stream = {
    getTracks: () => [{ stop: () => stops++ }],
  } as unknown as MediaStream;
  const manager = new HandTrackingManager({
    requestStream: async () => {
      requests++;
      return stream;
    },
    createVideo: () => video,
    createModel: async () => {
      models++;
      return { detectForVideo: detection, close: () => closes++ };
    },
    now: () => time,
    schedule: (callback) => {
      queue.set(++serial, callback);
      return serial;
    },
    cancel: (id) => {
      queue.delete(id);
    },
    preferredCompatibility: () => false,
    ...overrides,
  }, sink);
  const tick = async (dt = 50, advance = true) => {
    time += dt;
    if (advance) video.currentTime += dt / 1000;
    const next = queue.entries().next().value;
    assert.ok(next, "camera schedules a frame");
    queue.delete(next[0]);
    next[1]();
    await flush();
  };
  t.after(() => manager.stop());
  return {
    manager, tick, queue,
    stops: () => stops,
    requests: () => requests,
    models: () => models,
    closes: () => closes,
  };
}

function capture(t: TestContext) {
  const legacy: string[] = [];
  t.mock.method(gestures, "update", () => legacy.push("update"));
  t.mock.method(gestures, "reset", () => legacy.push("reset"));
  t.mock.method(interaction, "endScale", () => {
    legacy.push("endScale");
    return false;
  });
  const frames: HandFrame[] = [];
  let resets = 0;
  const sink: TrackingInputSink = {
    update: (frame) => frames.push(frame),
    reset: () => resets++,
  };
  return { legacy, frames, sink, resets: () => resets };
}

test("custom sink receives filtered frames and stopping never calls the old motor", async (t) => {
  const c = capture(t);
  const s = setup(t, c.sink);
  await s.manager.start();
  assert.equal(c.frames.length, 1);
  assert.equal(c.frames[0].hands.length, 1);
  assert.ok(c.frames[0].hands[0].id);
  assert.ok(Number.isFinite(c.frames[0].hands[0].pointer.x));
  s.manager.stop();
  assert.equal(c.resets(), 1);
  assert.equal(s.stops(), 1);
  assert.equal(s.queue.size, 0);
  assert.deepEqual(c.legacy, []);
});

test("CPU switching and frozen video deliver empty frames only to the injected sink", async (t) => {
  const c = capture(t);
  const s = setup(t, c.sink);
  await s.manager.start();
  await s.manager.useCompatibilityMode();
  assert.ok(c.frames.some((frame) => frame.hands.length === 0));
  assert.equal(c.resets(), 0);
  const count = c.frames.length;
  await s.tick(250, false);
  assert.equal(c.frames.length, count + 1);
  assert.deepEqual(c.frames.at(-1)?.hands, []);
  assert.deepEqual(c.legacy, []);
});

test("inference failure resets the injected sink and releases its session", async (t) => {
  const c = capture(t);
  const s = setup(t, c.sink, {
    preferredCompatibility: () => true,
    createModel: async () => ({
      detectForVideo: () => {
        throw new Error("CPU inference stopped");
      },
      close: () => {},
    }),
  });
  await s.manager.start();
  assert.equal(c.resets(), 1);
  assert.equal(c.frames.length, 0);
  assert.equal(s.stops(), 1);
  assert.equal(s.queue.size, 0);
  assert.deepEqual(c.legacy, []);
});

test("omitting the sink retains the original update and reset/endScale order", async (t) => {
  const c = capture(t);
  const s = setup(t);
  await s.manager.start();
  assert.deepEqual(c.legacy, ["update"]);
  s.manager.stop();
  assert.deepEqual(c.legacy, ["update", "reset", "endScale"]);
  assert.equal(c.frames.length, 0);
  assert.equal(c.resets(), 0);
});

test("switching input sinks resets both owners without reopening the camera or detector", async (t) => {
  const firstFrames: HandFrame[] = [];
  const secondFrames: HandFrame[] = [];
  const resets: string[] = [];
  const first: TrackingInputSink = {
    update: (frame) => firstFrames.push(frame),
    reset: () => resets.push("first"),
  };
  const second: TrackingInputSink = {
    update: (frame) => secondFrames.push(frame),
    reset: () => resets.push("second"),
  };
  const s = setup(t, first);
  await s.manager.start();
  const video = s.manager.video;
  const timer = [...s.queue.keys()];
  const restore = s.manager.useInputSink(second);
  assert.deepEqual(resets, ["first", "second"]);
  assert.equal(s.manager.video, video);
  assert.deepEqual([...s.queue.keys()], timer);
  assert.equal(s.requests(), 1);
  assert.equal(s.models(), 1);
  assert.equal(s.stops(), 0);
  assert.equal(s.closes(), 0);
  await s.tick();
  assert.equal(firstFrames.length, 1);
  assert.equal(secondFrames.length, 1);
  restore();
  assert.deepEqual(resets, ["first", "second", "second", "first"]);
  await s.tick();
  assert.equal(firstFrames.length, 2);
  assert.equal(secondFrames.length, 1);
  assert.equal(s.manager.video, video);
  assert.equal(s.requests(), 1);
  assert.equal(s.models(), 1);
  assert.equal(s.stops(), 0);
  assert.equal(s.closes(), 0);
  restore();
  assert.equal(resets.length, 4);
  s.manager.stop();
  assert.equal(s.stops(), 1);
  assert.equal(s.closes(), 1);
});

test("switching from the default input sink restores its original update and reset order", async (t) => {
  const c = capture(t);
  const s = setup(t);
  await s.manager.start();
  const restore = s.manager.useInputSink(c.sink);
  assert.deepEqual(c.legacy, ["update", "reset", "endScale"]);
  assert.equal(c.resets(), 1);
  await s.tick();
  assert.equal(c.frames.length, 1);
  assert.equal(c.legacy.length, 3);
  restore();
  assert.equal(c.resets(), 2);
  assert.deepEqual(c.legacy, ["update", "reset", "endScale", "reset", "endScale"]);
  await s.tick();
  assert.equal(c.legacy.at(-1), "update");
  assert.equal(c.frames.length, 1);
  assert.equal(s.requests(), 1);
  assert.equal(s.models(), 1);
});

test("a stale different-sink disposer cannot interrupt the current input owner", async (t) => {
  const c = capture(t);
  const newestFrames: HandFrame[] = [];
  const newest: TrackingInputSink = {
    update: (frame) => newestFrames.push(frame),
    reset: () => {},
  };
  const s = setup(t);
  await s.manager.start();
  const staleRestore = s.manager.useInputSink(c.sink);
  const restoreNewest = s.manager.useInputSink(newest);
  const resetCount = c.resets();
  staleRestore();
  assert.equal(c.resets(), resetCount);
  await s.tick();
  assert.equal(newestFrames.length, 1);
  assert.equal(c.frames.length, 0);
  assert.equal(s.stops(), 0);
  assert.equal(s.closes(), 0);
  restoreNewest();
  await s.tick();
  assert.equal(newestFrames.length, 1);
  assert.equal(c.frames.length, 0);
  assert.equal(c.legacy.at(-1), "update");
  staleRestore();
});

test("reusing one sink has independent leases and an old disposer cannot release the new one", async (t) => {
  const c = capture(t);
  const s = setup(t);
  await s.manager.start();
  const firstRestore = s.manager.useInputSink(c.sink);
  const secondRestore = s.manager.useInputSink(c.sink);
  const resets = c.resets();
  firstRestore();
  assert.equal(c.resets(), resets);
  await s.tick();
  assert.equal(c.frames.length, 1);
  assert.equal(c.legacy.filter((event) => event === "update").length, 1);
  secondRestore();
  await s.tick();
  assert.equal(c.frames.length, 1);
  assert.equal(c.legacy.filter((event) => event === "update").length, 2);
  const restoredResets = c.resets();
  firstRestore();
  secondRestore();
  assert.equal(c.resets(), restoredResets);
  assert.equal(s.requests(), 1);
  assert.equal(s.models(), 1);
  assert.equal(s.stops(), 0);
  assert.equal(s.closes(), 0);
});

test("releasing the current lease restores the most recent unreleased owner", async (t) => {
  const frames: string[] = [];
  const resets: string[] = [];
  const sink = (name: string): TrackingInputSink => ({
    update: () => frames.push(name),
    reset: () => resets.push(name),
  });
  const s = setup(t, sink("original"));
  await s.manager.start();
  const restoreFirst = s.manager.useInputSink(sink("first"));
  const restoreMiddle = s.manager.useInputSink(sink("middle"));
  const restoreLast = s.manager.useInputSink(sink("last"));
  const resetCount = resets.length;
  restoreMiddle();
  assert.equal(resets.length, resetCount);
  await s.tick();
  assert.deepEqual(frames, ["original", "last"]);
  restoreLast();
  assert.deepEqual(resets.slice(-2), ["last", "first"]);
  await s.tick();
  assert.deepEqual(frames, ["original", "last", "first"]);
  restoreFirst();
  assert.deepEqual(resets.slice(-2), ["first", "original"]);
  await s.tick();
  assert.deepEqual(frames, ["original", "last", "first", "original"]);
  assert.equal(s.requests(), 1);
  assert.equal(s.models(), 1);
  assert.equal(s.stops(), 0);
  assert.equal(s.closes(), 0);
});
