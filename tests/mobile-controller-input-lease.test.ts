import test from "node:test";
import assert from "node:assert/strict";
import { HandTrackingManager } from "../src/gesture/HandTrackingManager";
import { gestures } from "../src/gesture/GestureController";
import { interaction } from "../src/interaction/InteractionController";
import { ControllerCameraSession } from "../src/controller/ControllerCameraSession";
import { handFixture } from "./fixtures/hands";

test("phone input lease never drives the old desktop motor and releases camera/model/timer", async (t) => {
  const legacy: string[] = [];
  t.mock.method(gestures, "update", () => legacy.push("update"));
  t.mock.method(gestures, "reset", () => legacy.push("reset"));
  t.mock.method(interaction, "endScale", () => {
    legacy.push("endScale");
    return false;
  });
  const fixture = handFixture("POINT");
  const queue = new Map<number, () => void>();
  let time = 1000,
    serial = 0,
    tracksStopped = 0,
    modelsClosed = 0,
    updates = 0,
    resets = 0;
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
      requestStream: async () =>
        ({
          getTracks: () => [{ stop: () => tracksStopped++ }],
        }) as unknown as MediaStream,
      createVideo: () => video,
      createModel: async () => ({
        close: () => {
          modelsClosed++;
        },
        detectForVideo: () => ({
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
        }),
      }),
      now: () => time,
      schedule: (callback) => {
        queue.set(++serial, callback);
        return serial;
      },
      cancel: (id) => {
        queue.delete(id);
      },
      preferredCompatibility: () => false,
    },
    { update: () => {}, reset: () => {} },
  );
  const camera = new ControllerCameraSession(
    async () => manager,
    {
      update: (frame) => {
        updates++;
        assert.ok(frame.hands[0]?.id);
      },
      reset: () => {
        resets++;
      },
    },
    { phase: () => {}, video: () => {} },
  );
  t.after(() => camera.stop());
  await camera.start();
  assert.equal(updates, 1);
  time += 66;
  video.currentTime += 0.066;
  const pending = queue.entries().next().value;
  assert.ok(pending);
  queue.delete(pending[0]);
  pending[1]();
  assert.equal(updates, 2);
  camera.stop();
  assert.deepEqual(legacy, []);
  assert.equal(tracksStopped, 1);
  assert.equal(modelsClosed, 1);
  assert.equal(queue.size, 0);
  assert.ok(resets >= 2);
  assert.equal(camera.phase, "off");
});
