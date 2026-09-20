import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  HandTrackingManager,
  type TrackingDependencies,
} from "../src/gesture/HandTrackingManager";
import { cameraDiagnostics } from "../src/gesture/cameraDiagnostics";
import { store } from "../src/interaction/store";
import { handFixture } from "./fixtures/hands";

type Model = Awaited<ReturnType<TrackingDependencies["createModel"]>>;
const empty = (): HandLandmarkerResult => ({
  landmarks: [],
  worldLandmarks: [],
  handedness: [],
  handednesses: [],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function flush() {
  // Complete the finite camera/play/model promise chain without real timers.
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function fakeModel(infer: () => HandLandmarkerResult = empty) {
  const calls = { detect: 0, close: 0 };
  const model: Model = {
    detectForVideo: () => {
      calls.detect++;
      return infer();
    },
    close: () => {
      calls.close++;
    },
  };
  return { model, calls };
}
function fakeCamera() {
  const calls = { stop: 0, play: 0, pause: 0 };
  const track = {
    stop: () => {
      calls.stop++;
    },
  };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  const video = {
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 1,
    srcObject: null,
    muted: false,
    playsInline: false,
    play: async () => {
      calls.play++;
    },
    pause: () => {
      calls.pause++;
    },
  } as unknown as HTMLVideoElement;
  return { stream, video, calls };
}
function setup(t: TestContext, options: Partial<TrackingDependencies> = {}) {
  store.set({ tracking: "off", gesture: "NONE", confidence: 0 });
  cameraDiagnostics.reset();
  let clock = 1_000;
  let serial = 0;
  let cameraRequests = 0;
  const camera = fakeCamera();
  const gpu = fakeModel();
  const cpu = fakeModel();
  const queued = new Map<number, () => void>();
  const modelRequests: Array<{
    delegate: "GPU" | "CPU";
    compatibility: boolean;
  }> = [];
  const deps: TrackingDependencies = {
    requestStream: async () => {
      cameraRequests++;
      return camera.stream;
    },
    createVideo: () => camera.video,
    createModel: async (delegate, compatibility) => {
      modelRequests.push({ delegate, compatibility });
      return delegate === "GPU" ? gpu.model : cpu.model;
    },
    now: () => clock,
    schedule: (callback) => {
      const id = ++serial;
      queued.set(id, callback);
      return id;
    },
    cancel: (id) => {
      queued.delete(id);
    },
    preferredCompatibility: () => false,
    ...options,
  };
  const manager = new HandTrackingManager(deps);
  const tick = async (milliseconds = 50, advanceVideo = true) => {
    clock += milliseconds;
    if (advanceVideo) camera.video.currentTime += milliseconds / 1_000;
    const next = queued.entries().next().value;
    assert.ok(next, "tracking must schedule the next frame");
    queued.delete(next[0]);
    next[1]();
    await flush();
  };
  t.after(() => manager.stop());
  return {
    manager,
    camera,
    gpu,
    cpu,
    queued,
    modelRequests,
    tick,
    cameraRequests: () => cameraRequests,
  };
}

test("stopping while camera permission is pending releases the late stream", async (t) => {
  const camera = fakeCamera();
  const permission = deferred<MediaStream>();
  const s = setup(t, { requestStream: () => permission.promise });
  const starting = s.manager.start();
  s.manager.stop();
  permission.resolve(camera.stream);
  await starting;
  assert.equal(camera.calls.stop, 1);
  assert.equal(s.modelRequests.length, 0);
  assert.equal(s.manager.video, null);
  assert.equal(store.get().tracking, "off");
  assert.equal(s.queued.size, 0);
});

test("repeated starts while permission is pending cannot open a second camera", async (t) => {
  const camera = fakeCamera();
  const permission = deferred<MediaStream>();
  let requests = 0;
  const s = setup(t, {
    requestStream: () => {
      requests++;
      return permission.promise;
    },
    createVideo: () => camera.video,
  });
  const first = s.manager.start();
  await s.manager.start();
  await s.manager.start();
  permission.resolve(camera.stream);
  await first;
  assert.equal(requests, 1);
  assert.equal(s.modelRequests.length, 1);
  assert.equal(s.queued.size, 1);
});

test("stopping during model loading closes the late model and the camera once", async (t) => {
  const pending = deferred<Model>();
  const late = fakeModel();
  const s = setup(t, { createModel: () => pending.promise });
  const starting = s.manager.start();
  await flush();
  assert.equal(s.manager.video, s.camera.video);
  assert.equal(cameraDiagnostics.get().stage, "model");
  s.manager.stop();
  pending.resolve(late.model);
  await starting;
  assert.equal(late.calls.close, 1);
  assert.equal(late.calls.detect, 0);
  assert.equal(s.camera.calls.stop, 1);
  assert.equal(s.camera.video.srcObject, null);
  assert.equal(store.get().tracking, "off");
});

test("a superseded model failure cannot stop a newer running session", async (t) => {
  const oldLoad = deferred<Model>();
  const current = fakeModel();
  const cameras = [fakeCamera(), fakeCamera()];
  let requests = 0;
  let models = 0;
  const s = setup(t, {
    requestStream: async () => cameras[requests++].stream,
    createVideo: () => cameras[requests - 1].video,
    createModel: async () => (++models === 1 ? oldLoad.promise : current.model),
  });
  const previous = s.manager.start();
  await flush();
  s.manager.stop();
  await s.manager.start();
  oldLoad.reject(new Error("superseded GPU load failed"));
  await previous;
  assert.equal(s.manager.video, cameras[1].video);
  assert.equal(current.calls.close, 0);
  assert.equal(cameras[1].calls.stop, 0);
  assert.equal(store.get().tracking, "seeking");
  assert.equal(cameraDiagnostics.get().stage, "running");
});

test("a superseded successful model is closed without replacing the current model", async (t) => {
  const oldLoad = deferred<Model>();
  const late = fakeModel();
  const current = fakeModel();
  const cameras = [fakeCamera(), fakeCamera()];
  let requests = 0;
  let models = 0;
  const s = setup(t, {
    requestStream: async () => cameras[requests++].stream,
    createVideo: () => cameras[requests - 1].video,
    createModel: async () => (++models === 1 ? oldLoad.promise : current.model),
  });
  const previous = s.manager.start();
  await flush();
  s.manager.stop();
  await s.manager.start();
  oldLoad.resolve(late.model);
  await previous;
  assert.equal(late.calls.close, 1);
  assert.equal(late.calls.detect, 0);
  assert.equal(current.calls.close, 0);
  assert.equal(s.manager.video, cameras[1].video);
});

test("GPU initialization failure falls back to CPU without asking for another camera", async (t) => {
  const cpu = fakeModel();
  const requests: string[] = [];
  const s = setup(t, {
    createModel: async (delegate) => {
      requests.push(delegate);
      if (delegate === "GPU") throw new Error("GPU unavailable");
      return cpu.model;
    },
  });
  await s.manager.start();
  assert.deepEqual(requests, ["GPU", "CPU"]);
  assert.equal(s.cameraRequests(), 1);
  assert.equal(s.camera.calls.stop, 0);
  assert.equal(cpu.calls.detect, 1);
  assert.equal(cameraDiagnostics.get().backend, "CPU");
  assert.equal(cameraDiagnostics.get().stage, "running");
});

test("GPU inference failure switches once to CPU while retaining the video stream", async (t) => {
  const gpu = fakeModel(() => {
    throw new Error("lost WebGL context");
  });
  const cpu = fakeModel();
  const requests: string[] = [];
  const s = setup(t, {
    createModel: async (delegate) => {
      requests.push(delegate);
      return delegate === "GPU" ? gpu.model : cpu.model;
    },
  });
  await s.manager.start();
  await flush();
  assert.deepEqual(requests, ["GPU", "CPU"]);
  assert.equal(gpu.calls.close, 1);
  assert.equal(s.cameraRequests(), 1);
  assert.equal(s.camera.calls.stop, 0);
  assert.equal(s.manager.video, s.camera.video);
  assert.equal(cameraDiagnostics.get().backend, "CPU");
  await s.tick();
  assert.ok(cpu.calls.detect >= 1);
  assert.deepEqual(requests, ["GPU", "CPU"]);
});

test("manual compatibility retry uses CPU options and preserves the camera", async (t) => {
  const s = setup(t);
  await s.manager.start();
  await s.manager.useCompatibilityMode();
  assert.deepEqual(s.modelRequests, [
    { delegate: "GPU", compatibility: false },
    { delegate: "CPU", compatibility: true },
  ]);
  assert.equal(s.cameraRequests(), 1);
  assert.equal(s.camera.calls.stop, 0);
  assert.equal(s.gpu.calls.close, 1);
  assert.equal(cameraDiagnostics.get().compatibility, true);
  assert.equal(cameraDiagnostics.get().backend, "CPU");
});

test("repeated compatibility clicks share one model switch and retain the preference", async (t) => {
  const cpuLoad = deferred<Model>();
  const requests: Array<{ delegate: "GPU" | "CPU"; compatibility: boolean }> =
    [];
  const s = setup(t, {
    createModel: async (delegate, compatibility) => {
      requests.push({ delegate, compatibility });
      return delegate === "CPU" && requests.length === 2
        ? cpuLoad.promise
        : fakeModel().model;
    },
  });
  await s.manager.start();
  const switching = s.manager.useCompatibilityMode();
  await s.manager.useCompatibilityMode();
  cpuLoad.resolve(fakeModel().model);
  await switching;
  await s.manager.useCompatibilityMode();
  assert.deepEqual(requests, [
    { delegate: "GPU", compatibility: false },
    { delegate: "CPU", compatibility: true },
  ]);
  assert.equal(s.queued.size, 1);
  s.manager.stop();
  await s.manager.start();
  assert.deepEqual(requests[2], { delegate: "CPU", compatibility: true });
});

test("CPU query preference starts directly in compatibility mode", async (t) => {
  const s = setup(t, { preferredCompatibility: () => true });
  await s.manager.start();
  assert.deepEqual(s.modelRequests, [{ delegate: "CPU", compatibility: true }]);
  assert.equal(s.gpu.calls.detect, 0);
  assert.equal(s.cpu.calls.detect, 1);
  assert.equal(cameraDiagnostics.get().compatibility, true);
});

test("stopping during CPU switching closes a late CPU model without restarting", async (t) => {
  const gpu = fakeModel();
  const cpu = fakeModel();
  const cpuLoad = deferred<Model>();
  const s = setup(t, {
    createModel: async (delegate) =>
      delegate === "GPU" ? gpu.model : cpuLoad.promise,
  });
  await s.manager.start();
  const switching = s.manager.useCompatibilityMode();
  await flush();
  assert.equal(cameraDiagnostics.get().stage, "switching");
  s.manager.stop();
  cpuLoad.resolve(cpu.model);
  await switching;
  assert.equal(gpu.calls.close, 1);
  assert.equal(cpu.calls.close, 1);
  assert.equal(cpu.calls.detect, 0);
  assert.equal(s.camera.calls.stop, 1);
  assert.equal(s.queued.size, 0);
  assert.equal(store.get().tracking, "off");
  assert.equal(cameraDiagnostics.get().stage, "idle");
});

test("a pending CPU-switch rejection does not overwrite a later stop", async (t) => {
  const gpu = fakeModel();
  const cpuLoad = deferred<Model>();
  const s = setup(t, {
    createModel: async (delegate) =>
      delegate === "GPU" ? gpu.model : cpuLoad.promise,
  });
  await s.manager.start();
  const switching = s.manager.useCompatibilityMode();
  s.manager.stop();
  cpuLoad.reject(new Error("CPU model load failed"));
  await switching;
  assert.equal(store.get().tracking, "off");
  assert.equal(cameraDiagnostics.get().stage, "idle");
  assert.equal(s.camera.calls.stop, 1);
});

test("empty detections report a running model and never auto-switch the backend", async (t) => {
  const s = setup(t);
  await s.manager.start();
  for (let i = 0; i < 12; i++) await s.tick(1_000);
  assert.deepEqual(s.modelRequests, [
    { delegate: "GPU", compatibility: false },
  ]);
  assert.equal(cameraDiagnostics.get().stage, "running");
  assert.ok(cameraDiagnostics.get().frames >= 12);
  assert.equal(cameraDiagnostics.get().rawHands, 0);
  assert.equal(cameraDiagnostics.get().validHands, 0);
  assert.ok(cameraDiagnostics.get().emptyForMs >= 10_000);
  assert.equal(s.camera.calls.stop, 0);
});

test("diagnostics distinguish a raw model hand rejected by geometry filtering", async (t) => {
  const malformed = fakeModel(() => ({ ...empty(), landmarks: [[]] }));
  const s = setup(t, { createModel: async () => malformed.model });
  await s.manager.start();
  assert.equal(cameraDiagnostics.get().rawHands, 1);
  assert.equal(cameraDiagnostics.get().validHands, 0);
  assert.equal(store.get().tracking, "seeking");
  assert.deepEqual(s.manager.frame.hands, []);
});

test("a frozen video does not keep the previous tracked hand active", async (t) => {
  const fixture = handFixture("OPEN_PALM");
  const model = fakeModel(
    () =>
      ({
        ...empty(),
        landmarks: [fixture.points],
        worldLandmarks: [fixture.world],
      }) as HandLandmarkerResult,
  );
  const s = setup(t, { createModel: async () => model.model });
  await s.manager.start();
  assert.equal(s.manager.frame.hands.length, 1);
  assert.equal(store.get().tracking, "online");
  await s.tick(500, false);
  assert.equal(s.manager.frame.hands.length, 0);
  assert.equal(store.get().tracking, "seeking");
  // Brief frame gaps cancel gestures; the user-visible frozen warning waits
  // for a sustained stall rather than flickering on transient dropped frames.
  assert.equal(cameraDiagnostics.get().frozen, false);
  await s.tick(2_000, false);
  assert.equal(cameraDiagnostics.get().frozen, true);
  assert.equal(model.calls.detect, 1);
});

test("CPU inference failure releases resources and reports failure without retry loops", async (t) => {
  const cpu = fakeModel(() => {
    throw new Error("CPU inference failed");
  });
  let modelRequests = 0;
  const s = setup(t, {
    preferredCompatibility: () => true,
    createModel: async () => {
      modelRequests++;
      return cpu.model;
    },
  });
  await s.manager.start();
  await flush();
  assert.equal(modelRequests, 1);
  assert.equal(cpu.calls.close, 1);
  assert.equal(s.camera.calls.stop, 1);
  assert.equal(s.manager.video, null);
  assert.equal(s.queued.size, 0);
  assert.equal(store.get().tracking, "unavailable");
  assert.equal(cameraDiagnostics.get().stage, "failed");
});

test("both model backends failing release a working camera and name the model failure", async (t) => {
  const requests: string[] = [];
  const s = setup(t, {
    createModel: async (delegate) => {
      requests.push(delegate);
      throw new Error("model creation failed");
    },
  });
  await s.manager.start();
  assert.deepEqual(requests, ["GPU", "CPU"]);
  assert.equal(s.camera.calls.stop, 1);
  assert.equal(s.manager.video, null);
  assert.equal(s.queued.size, 0);
  assert.equal(store.get().tracking, "unavailable");
  assert.match(store.get().cameraError, /模型/);
  assert.equal(cameraDiagnostics.get().stage, "failed");
});

test("GPU disposal failure does not prevent independent CPU recovery", async (t) => {
  const s = setup(t);
  s.gpu.model.close = () => {
    throw new Error("GPU context was lost");
  };
  await s.manager.start();
  await s.manager.useCompatibilityMode();
  assert.equal(cameraDiagnostics.get().backend, "CPU");
  assert.equal(cameraDiagnostics.get().stage, "running");
  assert.equal(s.cameraRequests(), 1);
  assert.equal(s.camera.calls.stop, 0);
  assert.ok(s.cpu.calls.detect > 0);
});
