import test from "node:test";
import assert from "node:assert/strict";
import { RequestState } from "cesium";
import {
  instrumentEarthProvider,
  safeEarthError,
} from "../src/globeLab/dataDiagnostics";
import type { EarthProviderBundle } from "../src/globeLab/earthProvider";

function bundle(
  imagery: object,
  terrain: object = { requestTileGeometry: () => undefined },
  mode: EarthProviderBundle["mode"] = "ion",
): EarthProviderBundle {
  return {
    mode,
    imagery,
    terrain,
    minimumHeight: 100,
    coverage: "synthetic",
  } as EarthProviderBundle;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("instrumentation preserves promise identity, request parameters, this and successful values", async () => {
  const image = { syntheticImage: true };
  const promise = Promise.resolve(image);
  const request = { syntheticRequest: true };
  let receivedArgs: unknown[] = [];
  let receivedThis: unknown;
  const imagery = {
    requestImage: function (...args: unknown[]) {
      receivedArgs = args;
      receivedThis = this;
      return promise;
    },
  };
  const original = imagery.requestImage;
  const diagnostics = instrumentEarthProvider(bundle(imagery));
  const result = imagery.requestImage(2, 3, 11, request);
  assert.equal(result, promise);
  assert.equal(await result, image);
  assert.equal(receivedThis, imagery);
  assert.deepEqual(receivedArgs, [2, 3, 11, request]);
  assert.equal(receivedArgs[3], request);
  assert.deepEqual(diagnostics.snapshot(), {
    mode: "ion",
    imagery: { requested: 1, received: 1, failed: 0, levels: [11] },
    terrain: { requested: 0, received: 0, failed: 0, levels: [] },
  });
  diagnostics.dispose();
  assert.equal(imagery.requestImage, original);
});

test("undefined throttle returns are preserved and native retries remain caller controlled", async () => {
  const image = {};
  let calls = 0;
  const imagery = {
    requestImage: (..._args: unknown[]) =>
      ++calls === 1 ? undefined : Promise.resolve(image),
  };
  const diagnostics = instrumentEarthProvider(bundle(imagery));
  assert.equal(imagery.requestImage(1, 2, 4), undefined);
  assert.equal(diagnostics.snapshot().imagery.requested, 0);
  assert.equal(calls, 1);
  assert.equal(await imagery.requestImage(1, 2, 4), image);
  assert.equal(calls, 2);
  assert.deepEqual(diagnostics.snapshot().imagery, {
    requested: 1,
    received: 1,
    failed: 0,
    levels: [4],
  });
  diagnostics.dispose();
});

test("failure observation preserves raw SDK rejection identity while snapshot stays sanitized", async () => {
  const secret = "synthetic-secret-url-token";
  const error = {
    message: `https://invalid/?token=${secret}`,
    error: { statusCode: 403, response: secret },
    headers: secret,
  };
  const promise = Promise.reject(error);
  const imagery = { requestImage: (..._args: unknown[]) => promise };
  const diagnostics = instrumentEarthProvider(bundle(imagery));
  const result = imagery.requestImage(0, 0, 9);
  assert.equal(result, promise);
  await assert.rejects(result, (value: unknown) => value === error);
  assert.deepEqual(diagnostics.snapshot(), {
    mode: "ion",
    imagery: { requested: 1, received: 0, failed: 1, levels: [] },
    terrain: { requested: 0, received: 0, failed: 0, levels: [] },
    lastError: { stage: "imagery", statusCode: 403, code: "HTTP_ERROR" },
  });
  assert.ok(!JSON.stringify(diagnostics.snapshot()).includes(secret));
  assert.ok(!String(safeEarthError(error, "imagery")).includes(secret));
  diagnostics.dispose();
});

test("synchronous exceptions retain identity and safe stage metadata", () => {
  const error = {
    originalError: { statusCode: 429 },
    message: "synthetic-private-url",
  };
  const terrain = {
    requestTileGeometry: (..._args: unknown[]) => {
      throw error;
    },
  };
  const diagnostics = instrumentEarthProvider(
    bundle({ requestImage: () => undefined }, terrain),
  );
  assert.throws(
    () => terrain.requestTileGeometry(1, 1, 10),
    (value: unknown) => value === error,
  );
  assert.deepEqual(diagnostics.snapshot().lastError, {
    stage: "terrain",
    statusCode: 429,
    code: "HTTP_ERROR",
  });
  assert.equal(diagnostics.snapshot().terrain.failed, 1);
  diagnostics.dispose();
});

test("canceled requests and AbortError do not become connection failures", async () => {
  const canceled = deferred<object>();
  const aborted = deferred<object>();
  let call = 0;
  const request = { state: RequestState.ACTIVE };
  const imagery = {
    requestImage: (..._args: unknown[]) =>
      call++ === 0 ? canceled.promise : aborted.promise,
  };
  const diagnostics = instrumentEarthProvider(bundle(imagery));
  const first = imagery.requestImage(0, 0, 3, request);
  request.state = RequestState.CANCELLED;
  canceled.reject(undefined);
  await assert.rejects(first, (value: unknown) => value === undefined);
  const second = imagery.requestImage(1, 1, 3);
  const abortError = Object.assign(new Error("synthetic-private-url"), {
    name: "AbortError",
  });
  aborted.reject(abortError);
  await assert.rejects(second, (value: unknown) => value === abortError);
  assert.deepEqual(diagnostics.snapshot().imagery, {
    requested: 2,
    received: 0,
    failed: 0,
    levels: [],
  });
  assert.equal(diagnostics.snapshot().lastError, undefined);
  diagnostics.dispose();
});

test("successful levels are unique sorted provider levels, not inferred source resolution", async () => {
  const imagery = {
    requestImage: (..._args: unknown[]) => Promise.resolve({}),
  };
  const terrain = {
    requestTileGeometry: (..._args: unknown[]) => Promise.resolve({}),
  };
  const diagnostics = instrumentEarthProvider(bundle(imagery, terrain));
  await imagery.requestImage(0, 0, 12);
  await imagery.requestImage(0, 0, 7);
  await imagery.requestImage(0, 0, 12);
  await terrain.requestTileGeometry(0, 0, 5);
  assert.deepEqual(diagnostics.snapshot().imagery, {
    requested: 3,
    received: 3,
    failed: 0,
    levels: [7, 12],
  });
  assert.deepEqual(diagnostics.snapshot().terrain, {
    requested: 1,
    received: 1,
    failed: 0,
    levels: [5],
  });
  const copy = diagnostics.snapshot();
  copy.imagery.levels.push(99);
  copy.imagery.received = 999;
  assert.deepEqual(diagnostics.snapshot().imagery.levels, [7, 12]);
  assert.equal(diagnostics.snapshot().imagery.received, 3);
  diagnostics.dispose();
});

test("local single-image and flat ellipsoid callbacks never claim hierarchical tile detail", async () => {
  const imagery = {
    requestImage: (..._args: unknown[]) => Promise.resolve({}),
  };
  const terrain = {
    requestTileGeometry: (..._args: unknown[]) => Promise.resolve({}),
  };
  const diagnostics = instrumentEarthProvider(
    bundle(imagery, terrain, "local"),
  );
  await imagery.requestImage(0, 0, 0);
  await terrain.requestTileGeometry(0, 0, 15);
  assert.equal(diagnostics.snapshot().mode, "local");
  assert.deepEqual(diagnostics.snapshot().imagery.levels, []);
  assert.deepEqual(diagnostics.snapshot().terrain.levels, []);
  assert.equal(diagnostics.snapshot().imagery.received, 1);
  diagnostics.dispose();
});

test("dispose restores inherited methods and late fulfillment cannot update snapshots", async () => {
  const image = deferred<object>();
  const prototype = { requestImage: (..._args: unknown[]) => image.promise };
  const imagery = Object.create(prototype) as typeof prototype;
  const diagnostics = instrumentEarthProvider(bundle(imagery));
  const result = imagery.requestImage(0, 0, 13);
  assert.equal(result, image.promise);
  assert.equal(Object.hasOwn(imagery, "requestImage"), true);
  diagnostics.dispose();
  diagnostics.dispose();
  assert.equal(Object.hasOwn(imagery, "requestImage"), false);
  assert.equal(imagery.requestImage, prototype.requestImage);
  const before = diagnostics.snapshot();
  image.resolve({});
  await result;
  assert.deepEqual(diagnostics.snapshot(), before);
});

test("dispose prevents old promise failures from mutating diagnostics", async () => {
  const tile = deferred<object>();
  const terrain = {
    requestTileGeometry: (..._args: unknown[]) => tile.promise,
  };
  const original = terrain.requestTileGeometry;
  const diagnostics = instrumentEarthProvider(
    bundle({ requestImage: () => undefined }, terrain),
  );
  const result = terrain.requestTileGeometry(0, 0, 14);
  diagnostics.dispose();
  assert.equal(terrain.requestTileGeometry, original);
  const before = diagnostics.snapshot();
  const error = { statusCode: 500, message: "synthetic-private-url" };
  tile.reject(error);
  await assert.rejects(result, (value: unknown) => value === error);
  assert.deepEqual(diagnostics.snapshot(), before);
});

test("partial instrumentation failure safely restores the first provider", () => {
  const imagery = { requestImage: () => undefined };
  const terrain = Object.freeze({ requestTileGeometry: () => undefined });
  const original = imagery.requestImage;
  assert.throws(
    () => instrumentEarthProvider(bundle(imagery, terrain)),
    (error: unknown) =>
      error instanceof Error &&
      "stage" in error &&
      error.stage === "terrain" &&
      !error.message.includes("requestTileGeometry"),
  );
  assert.equal(imagery.requestImage, original);
});
