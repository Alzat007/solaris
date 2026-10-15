import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ControllerCameraSession,
  controllerCameraConstraints,
  CONTROLLER_CAMERA_FPS,
  type ControllerCameraManager,
  type ControllerCameraPhase,
} from "../src/controller/ControllerCameraSession";
import { consumeControllerEntry } from "../src/controller/controllerEntry";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function cameraFixture() {
  let starts = 0,
    stops = 0,
    leases = 0,
    releases = 0,
    resets = 0;
  const phases: ControllerCameraPhase[] = [],
    videos: (HTMLVideoElement | null)[] = [];
  const manager: ControllerCameraManager = {
    video: {} as HTMLVideoElement,
    start: async () => {
      starts++;
    },
    stop: () => {
      stops++;
      manager.video = null;
    },
    useInputSink: () => {
      leases++;
      return () => {
        releases++;
      };
    },
  };
  const sink = {
    update: () => {},
    reset: () => {
      resets++;
    },
  };
  const callbacks = {
    phase: (phase: ControllerCameraPhase) => phases.push(phase),
    video: (video: HTMLVideoElement | null) => videos.push(video),
  };
  return {
    manager,
    sink,
    callbacks,
    phases,
    videos,
    counts: () => ({ starts, stops, leases, releases, resets }),
  };
}

test("constructing the mobile camera never requests or starts it; explicit start is singular", async () => {
  const f = cameraFixture();
  let factories = 0;
  const camera = new ControllerCameraSession(
    async () => {
      factories++;
      return f.manager;
    },
    f.sink,
    f.callbacks,
  );
  assert.equal(factories, 0);
  assert.equal(camera.phase, "off");
  await Promise.all([camera.start(), camera.start()]);
  assert.equal(factories, 1);
  assert.equal(f.counts().starts, 1);
  assert.equal(camera.phase, "on");
  camera.stop();
  assert.equal(f.counts().stops, 1);
  assert.equal(f.counts().releases, 1);
  assert.equal(f.videos.at(-1), null);
});

test("background or disconnection while a factory is pending cannot later start the camera", async () => {
  const f = cameraFixture(),
    factory = deferred<ControllerCameraManager>();
  const camera = new ControllerCameraSession(
    () => factory.promise,
    f.sink,
    f.callbacks,
  );
  const loading = camera.start();
  camera.stop();
  factory.resolve(f.manager);
  await loading;
  assert.equal(f.counts().starts, 0);
  assert.equal(f.counts().leases, 0);
  assert.equal(camera.phase, "off");
  assert.equal(f.counts().stops, 1);
});

test("cancellation during a late permission result releases manager, sink and video", async () => {
  const f = cameraFixture(),
    pending = deferred<void>();
  f.manager.start = () => pending.promise;
  const camera = new ControllerCameraSession(
    async () => f.manager,
    f.sink,
    f.callbacks,
  );
  const loading = camera.start();
  await Promise.resolve();
  camera.stop();
  pending.resolve();
  await loading;
  assert.equal(camera.phase, "off");
  assert.equal(f.counts().stops, 1);
  assert.equal(f.counts().releases, 1);
  assert.ok(f.counts().resets > 0);
  assert.equal(f.videos.at(-1), null);
});

test("camera rejection clears its lease and preserves touch fallback without leaking errors", async () => {
  const f = cameraFixture();
  f.manager.start = async () => {
    throw new Error("private device details");
  };
  const camera = new ControllerCameraSession(
    async () => f.manager,
    f.sink,
    f.callbacks,
  );
  await camera.start();
  assert.equal(camera.phase, "error");
  assert.equal(f.counts().stops, 1);
  assert.equal(f.counts().releases, 1);
  assert.deepEqual(f.phases, ["loading", "error"]);
});

test("phone camera uses no microphone, 640x480 and capped 15fps without changing desktop defaults", () => {
  assert.deepEqual(controllerCameraConstraints(), {
    audio: false,
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15, max: 15 },
      facingMode: "user",
    },
  });
  assert.equal(CONTROLLER_CAMERA_FPS, 15);
});

test("pairing claim is fragment-only, consumed immediately, and cannot choose a relay origin", () => {
  const replaced: string[] = [];
  const entry = consumeControllerEntry(
    {
      hash: `#session=${"s".repeat(24)}&claim=${"c".repeat(40)}`,
      pathname: "/solaris/controller/",
      search: "?lang=en&relay=https://evil.example",
    },
    (url) => replaced.push(url),
    "https://relay.example",
  );
  assert.ok(entry.pairing);
  assert.equal(entry.serviceUrl, "https://relay.example");
  assert.equal(entry.language, "en");
  assert.equal(replaced[0], "/solaris/controller/?lang=en");
  assert.doesNotMatch(replaced[0], /session=|claim=/);
  assert.equal(
    consumeControllerEntry(
      {
        hash: "",
        pathname: "/controller/",
        search: `?session=${"s".repeat(24)}&claim=${"c".repeat(40)}`,
      },
      () => {},
      "https://relay.example",
    ).pairing,
    null,
  );
});

test("invalid configuration or invalid fragment stays unpaired and never accepts credentials from query", () => {
  for (const origin of [
    "http://relay.example",
    "https://name:password@relay.example",
    "https://relay.example/path",
    "https://relay.example/?token=value",
  ]) {
    const entry = consumeControllerEntry(
      { hash: "#claim=invalid", pathname: "/controller/", search: "" },
      () => {},
      origin,
    );
    assert.equal(entry.serviceUrl, "");
    assert.equal(entry.pairing, null);
  }
});

test("controller entry stays independent of scene rendering, storage and automatic camera activation", () => {
  const entry = readFileSync(
    new URL("../src/controller/main.tsx", import.meta.url),
    "utf8",
  );
  const app = readFileSync(
    new URL("../src/controller/ControllerApp.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    entry + app,
    /SolarScene|SolarSystem|<Canvas|localStorage|sessionStorage|console\./,
  );
  assert.match(app, /visibilitychange/);
  assert.match(app, /pagehide/);
  assert.match(app, /useInputSink|ControllerCameraSession/);
  assert.match(app, /HandTrackingManager/);
  assert.doesNotMatch(app, /gestures\.update|interaction\./);
  const html = readFileSync(
    new URL("../controller/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /name="referrer" content="no-referrer"/);
});
