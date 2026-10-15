import test from "node:test";
import assert from "node:assert/strict";
import { HandTrackingManager } from "../src/gesture/HandTrackingManager";
import { RemoteGestureSink } from "../src/controller/RemoteGestureSink";
import { CONTROLLER_CAMERA_FPS } from "../src/controller/ControllerCameraSession";
import { cameraDiagnostics } from "../src/gesture/cameraDiagnostics";
import { handFixture } from "./fixtures/hands";

function cadenceFixture(inferenceMs: number, frameIntervalMs?: number) {
  let now = 1000;
  let serial = 0;
  const queue = new Map<number, { callback: () => void; delay: number }>();
  const frames: { time: number; id: string | undefined }[] = [];
  const feedback: string[] = [];
  const actions: string[] = [];
  const sink = new RemoteGestureSink({
    send: (action) => {
      actions.push(action);
      return true;
    },
    feedback: (value) => feedback.push(value.status),
  });
  sink.setContext(true, {
    mode: "PLANET_OVERVIEW",
    selected: "earth",
    available: ["ROTATE_START", "ROTATE", "ROTATE_END", "POINTER", "STOP"],
  });
  const fixture = handFixture("OPEN_PALM");
  const video = {
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 1,
    play: async () => {},
    pause: () => {},
  } as unknown as HTMLVideoElement;
  const manager = new HandTrackingManager(
    {
      ...(frameIntervalMs === undefined ? {} : { frameIntervalMs }),
      now: () => now,
      requestStream: async () =>
        ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream,
      createVideo: () => video,
      createModel: async () => ({
        close: () => {},
        detectForVideo: () => {
          now += inferenceMs;
          return {
            landmarks: [
              fixture.points.map((point) => ({ ...point, visibility: 1 })),
            ],
            worldLandmarks: [
              fixture.world.map((point) => ({ ...point, visibility: 1 })),
            ],
            handedness: [
              [{ categoryName: "Right", displayName: "", score: 1, index: 0 }],
            ],
            handednesses: [],
          };
        },
      }),
      schedule: (callback, delay) => {
        queue.set(++serial, { callback, delay });
        return serial;
      },
      cancel: (id) => {
        queue.delete(id);
      },
      preferredCompatibility: () => false,
    },
    {
      update: (frame) => {
        frames.push({ time: frame.time, id: frame.hands[0]?.id });
        sink.update(frame);
      },
      reset: () => sink.reset(),
    },
  );
  const tick = (advanceVideo = true) => {
    const entry = queue.entries().next().value;
    assert.ok(entry);
    queue.delete(entry[0]);
    now += entry[1].delay;
    if (advanceVideo) video.currentTime += 1 / CONTROLLER_CAMERA_FPS;
    entry[1].callback();
  };
  return { manager, frames, feedback, actions, queue, tick };
}

for (const inferenceMs of [0, 40, 120]) {
  test(`mobile total frame cadence subtracts ${inferenceMs}ms processing instead of adding another wait`, async (t) => {
    const f = cadenceFixture(inferenceMs, 1000 / CONTROLLER_CAMERA_FPS);
    t.after(() => f.manager.stop());
    await f.manager.start();
    for (let i = 0; i < 12; i++) f.tick();
    const expected = Math.max(inferenceMs, 1000 / CONTROLLER_CAMERA_FPS);
    for (let i = 1; i < f.frames.length; i++)
      assert.ok(
        Math.abs(f.frames[i].time - f.frames[i - 1].time - expected) < 1e-8,
      );
    assert.ok(f.frames[0].id);
    assert.equal(new Set(f.frames.map((frame) => frame.id)).size, 1);
    assert.ok(
      f.feedback.includes("ready"),
      "ordinary frames must progress past re-entry",
    );
    assert.equal(cameraDiagnostics.get().inferenceMs, inferenceMs);
    assert.deepEqual(
      f.actions,
      [],
      "an open palm must not generate scene actions",
    );
  });
}

test("desktop scheduling retains its existing 20fps default", async (t) => {
  const f = cadenceFixture(40);
  t.after(() => f.manager.stop());
  await f.manager.start();
  f.tick();
  assert.equal(f.frames[1].time - f.frames[0].time, 50);
});

test("a frozen mobile video still clears tracking rather than repeating an old hand", async (t) => {
  const f = cadenceFixture(0, 1000 / CONTROLLER_CAMERA_FPS);
  t.after(() => f.manager.stop());
  await f.manager.start();
  for (let i = 0; i < 12; i++) f.tick();
  for (let i = 0; i < 5; i++) f.tick(false);
  assert.equal(f.frames.at(-1)?.id, undefined);
  assert.equal(f.feedback.at(-1), "idle");
});
