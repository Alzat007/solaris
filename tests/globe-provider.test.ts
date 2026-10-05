import test from "node:test";
import assert from "node:assert/strict";
import { Ion } from "cesium";
import {
  EARTH_ION_ASSETS,
  earthProviderConfig,
  loadEarthProvider,
} from "../src/globeLab/earthProvider";

test("local mode remains default even with an available token", () => {
  assert.deepEqual(
    earthProviderConfig("?qa=1", {
      VITE_CESIUM_ION_READ_TOKEN: "not-a-real-token",
    }),
    { mode: "local" },
  );
});
test("missing credentials are unconnected and automated real-data calls are refused", () => {
  assert.throws(() => earthProviderConfig("?data=ion", {}), /未连接/);
  assert.throws(
    () =>
      earthProviderConfig("?data=ion&qa=1", {
        VITE_CESIUM_ION_READ_TOKEN: "unused",
      }),
    /自动回归/,
  );
});
test("local loading uses only the existing local texture", async () => {
  const calls: string[] = [];
  const factories = {
    local: async (url: string) => {
      calls.push(url);
      return {} as never;
    },
    imagery: async () => {
      throw new Error("must not connect");
    },
    terrain: async () => {
      throw new Error("must not connect");
    },
  };
  const result = await loadEarthProvider(
    { mode: "local" },
    "/solaris/",
    factories,
  );
  assert.deepEqual(calls, ["/solaris/textures/earth-day.jpg"]);
  assert.equal(result.minimumHeight, 250000);
  assert.match(result.coverage, /未连接/);
});
test("ion loading passes explicit credentials only to the selected terrain and labeled imagery", async () => {
  const calls: [string, number, string][] = [];
  const before = Ion.defaultAccessToken;
  const factories = {
    local: async () => {
      throw new Error("must not fall back");
    },
    terrain: async (id: number, token: string) => {
      calls.push(["terrain", id, token]);
      return {} as never;
    },
    imagery: async (id: number, token: string) => {
      calls.push(["imagery", id, token]);
      return {} as never;
    },
  };
  const result = await loadEarthProvider(
    { mode: "ion", accessToken: "synthetic-read-token" },
    "/",
    factories,
  );
  assert.deepEqual(calls, [
    ["terrain", 1, "synthetic-read-token"],
    ["imagery", EARTH_ION_ASSETS.satelliteWithLabels, "synthetic-read-token"],
  ]);
  assert.equal(Ion.defaultAccessToken, before);
  assert.equal(result.mode, "ion");
  assert.match(result.coverage, /建筑网格未接入/);
});
test("resource failure is sanitized and cannot claim connection or substitute local imagery", async () => {
  let localCalls = 0;
  await assert.rejects(
    loadEarthProvider(
      { mode: "ion", accessToken: "private-placeholder" },
      "/",
      {
        local: async () => {
          localCalls++;
          return {} as never;
        },
        terrain: async () => {
          throw new Error(
            "https://example.com?access_token=private-placeholder",
          );
        },
        imagery: async () => ({}) as never,
      },
    ),
    (error: Error) => {
      assert.ok(!error.message.includes("private-placeholder"));
      return /加载失败/.test(error.message);
    },
  );
  assert.equal(localCalls, 0);
});

test("canceled late terrain never launches a new imagery session", async () => {
  const controller = new AbortController();
  let finish!: (value: never) => void;
  const terrain = new Promise<never>((resolve) => {
    finish = resolve;
  });
  let imageryCalls = 0;
  const loading = loadEarthProvider(
    { mode: "ion", accessToken: "synthetic-token" },
    "/",
    {
      local: async () => ({}) as never,
      terrain: async () => terrain,
      imagery: async () => {
        imageryCalls++;
        return {} as never;
      },
    },
    controller.signal,
  );
  controller.abort();
  finish({} as never);
  await assert.rejects(loading, /已取消/);
  assert.equal(imageryCalls, 0);
});
test("already canceled loading does not request any provider", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const request = async () => {
    calls++;
    return {} as never;
  };
  await assert.rejects(
    loadEarthProvider(
      { mode: "ion", accessToken: "unused" },
      "/",
      { local: request, terrain: request, imagery: request },
      controller.signal,
    ),
    /已取消/,
  );
  assert.equal(calls, 0);
});
