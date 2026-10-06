import test from "node:test";
import assert from "node:assert/strict";
import { Ion } from "cesium";
import {
  EARTH_ION_ASSETS,
  earthProviderConfig,
  loadEarthProvider,
  safeEarthError,
  SafeEarthProviderError,
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

test("ion configuration uses default asset IDs and accepts explicit positive IDs", () => {
  assert.deepEqual(
    earthProviderConfig("?data=ion", {
      VITE_CESIUM_ION_READ_TOKEN: " synthetic-token ",
    }),
    {
      mode: "ion",
      accessToken: "synthetic-token",
      assetIds: { terrain: 1, imagery: 3830183 },
    },
  );
  assert.deepEqual(
    earthProviderConfig("?data=ion", {
      VITE_CESIUM_ION_READ_TOKEN: "synthetic-token",
      VITE_CESIUM_TERRAIN_ASSET_ID: " 101 ",
      VITE_CESIUM_IMAGERY_ASSET_ID: "202",
    }),
    {
      mode: "ion",
      accessToken: "synthetic-token",
      assetIds: { terrain: 101, imagery: 202 },
    },
  );
});

test("invalid asset IDs fail safely and local mode never evaluates ion configuration", () => {
  for (const value of [
    "0",
    "-1",
    "1.5",
    "1e3",
    "01",
    "Infinity",
    "9007199254740992",
    "secret-url",
  ]) {
    assert.throws(
      () =>
        earthProviderConfig("?data=ion", {
          VITE_CESIUM_ION_READ_TOKEN: "synthetic-token",
          VITE_CESIUM_IMAGERY_ASSET_ID: value,
        }),
      (error: Error) =>
        /正整数/.test(error.message) && !error.message.includes(value),
    );
  }
  assert.deepEqual(
    earthProviderConfig("?data=local", {
      VITE_CESIUM_TERRAIN_ASSET_ID: "not-an-id",
    }),
    { mode: "local" },
  );
});

test("explicit configured assets are reused without global credentials or fallback", async () => {
  const calls: [string, number][] = [];
  const result = await loadEarthProvider(
    {
      mode: "ion",
      accessToken: "synthetic-token",
      assetIds: { terrain: 101, imagery: 202 },
    },
    "/",
    {
      local: async () => {
        throw new Error("no fallback");
      },
      terrain: async (id) => {
        calls.push(["terrain", id]);
        return {} as never;
      },
      imagery: async (id) => {
        calls.push(["imagery", id]);
        return {} as never;
      },
    },
  );
  assert.deepEqual(calls, [
    ["terrain", 101],
    ["imagery", 202],
  ]);
  assert.match(result.coverage, /提供器已初始化/);
  assert.match(result.coverage, /精度待实测/);
});

test("factory errors retain only sanitized stage and nested HTTP status", async () => {
  for (const stage of ["terrain", "imagery"] as const) {
    const secret = "synthetic-secret-query-value";
    const sdkError = {
      message: `https://example.invalid/?token=${secret}`,
      error: { statusCode: 403, response: secret, headers: { token: secret } },
    };
    let imageryCalls = 0;
    await assert.rejects(
      loadEarthProvider({ mode: "ion", accessToken: secret }, "/", {
        local: async () => {
          throw new Error("no fallback");
        },
        terrain: async () => {
          if (stage === "terrain") throw sdkError;
          return {} as never;
        },
        imagery: async () => {
          imageryCalls++;
          throw sdkError;
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof SafeEarthProviderError);
        assert.equal(error.stage, stage);
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "HTTP_ERROR");
        assert.ok(!String(error).includes(secret));
        assert.ok(!JSON.stringify(error).includes(secret));
        assert.equal("cause" in error, false);
        assert.equal("response" in error, false);
        assert.equal("headers" in error, false);
        assert.ok(!error.message.includes("缺少权限"));
        return true;
      },
    );
    assert.equal(imageryCalls, stage === "terrain" ? 0 : 1);
  }
});

test("safe errors traverse bounded nested errors without reading raw messages or accessors", () => {
  let rawReads = 0;
  const nested: Record<string, unknown> = { statusCode: 429 };
  nested.error = nested;
  Object.defineProperty(nested, "message", {
    get: () => {
      rawReads++;
      throw new Error("secret");
    },
  });
  Object.defineProperty(nested, "response", {
    get: () => {
      rawReads++;
      throw new Error("secret");
    },
  });
  const safe = safeEarthError({ cause: { originalError: nested } }, "imagery");
  assert.equal(safe.statusCode, 429);
  assert.equal(safe.code, "HTTP_ERROR");
  assert.equal(rawReads, 0);
  for (const statusCode of ["403", -1, 0, 999, NaN]) {
    const ignored = safeEarthError({ statusCode }, "terrain");
    assert.equal(ignored.statusCode, undefined);
    assert.equal(ignored.code, "REQUEST_FAILED");
  }
});

test("local factory failure is sanitized and labeled as imagery rather than ion success", async () => {
  await assert.rejects(
    loadEarthProvider({ mode: "local" }, "/", {
      local: async () => {
        throw { error: { statusCode: 404 }, message: "secret-url" };
      },
      terrain: async () => ({}) as never,
      imagery: async () => ({}) as never,
    }),
    (error: unknown) =>
      error instanceof SafeEarthProviderError &&
      error.stage === "imagery" &&
      error.statusCode === 404 &&
      !error.message.includes("secret-url"),
  );
});

test("canceled failed initialization is reported as canceled without starting imagery", async () => {
  const controller = new AbortController();
  let rejectTerrain!: (error: unknown) => void;
  let imageryCalls = 0;
  const loading = loadEarthProvider(
    { mode: "ion", accessToken: "synthetic-token" },
    "/",
    {
      local: async () => ({}) as never,
      terrain: () =>
        new Promise<never>((_, reject) => {
          rejectTerrain = reject;
        }),
      imagery: async () => {
        imageryCalls++;
        return {} as never;
      },
    },
    controller.signal,
  );
  controller.abort();
  rejectTerrain({ statusCode: 403, message: "secret" });
  await assert.rejects(
    loading,
    (error: unknown) =>
      error instanceof SafeEarthProviderError &&
      error.code === "CANCELED" &&
      error.stage === "terrain" &&
      error.statusCode === undefined,
  );
  assert.equal(imageryCalls, 0);
});

test("invalid programmatic asset IDs do not start factories", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return {} as never;
  };
  await assert.rejects(
    loadEarthProvider(
      {
        mode: "ion",
        accessToken: "unused",
        assetIds: { terrain: -1, imagery: 2 },
      },
      "/",
      { local: request, terrain: request, imagery: request },
    ),
    /正整数/,
  );
  assert.equal(calls, 0);
});
