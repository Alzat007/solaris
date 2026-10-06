import { RequestState } from "cesium";
import {
  safeEarthError,
  type EarthDataError,
  type EarthDataStage,
  type EarthProviderBundle,
} from "./earthProvider";

export { safeEarthError } from "./earthProvider";

export interface EarthLayerDiagnostics {
  requested: number;
  received: number;
  failed: number;
  /** Successful provider levels, not source resolution; empty in single-image local mode. */
  levels: number[];
}

export interface EarthDataSnapshot {
  mode: EarthProviderBundle["mode"];
  imagery: EarthLayerDiagnostics;
  terrain: EarthLayerDiagnostics;
  lastError?: EarthDataError;
}

export interface EarthProviderDiagnostics {
  snapshot(): EarthDataSnapshot;
  dispose(): void;
}

type RequestMethod = (...args: unknown[]) => unknown;

/** Observe provider returns only: no new requests, tile storage, endpoint or token inspection. */
export function instrumentEarthProvider(
  bundle: EarthProviderBundle,
): EarthProviderDiagnostics {
  const makeLayer = (): EarthLayerDiagnostics => ({
    requested: 0,
    received: 0,
    failed: 0,
    levels: [],
  });
  const state: EarthDataSnapshot = {
    mode: bundle.mode,
    imagery: makeLayer(),
    terrain: makeLayer(),
  };
  let active = true;
  const restorers: (() => void)[] = [];

  const wrap = (
    provider: object,
    methodName: "requestImage" | "requestTileGeometry",
    stage: EarthDataStage,
  ) => {
    const methods = provider as unknown as Record<string, RequestMethod>;
    const original = methods[methodName];
    if (typeof original !== "function")
      throw new Error("地图提供器缺少公开请求接口。");
    const descriptor = Object.getOwnPropertyDescriptor(provider, methodName);
    const counters = state[stage];
    const recordFailure = (error: unknown, request: unknown) => {
      if (!active) return;
      const canceled =
        typeof request === "object" &&
        request !== null &&
        "state" in request &&
        request.state === RequestState.CANCELLED;
      const safe = safeEarthError(
        canceled ? { name: "AbortError" } : error,
        stage,
      );
      if (safe.code !== "CANCELED") {
        counters.failed++;
        state.lastError = {
          stage: safe.stage,
          ...(safe.statusCode === undefined
            ? {}
            : { statusCode: safe.statusCode }),
          code: safe.code,
        };
      }
    };
    const recordReceived = (value: unknown, level: unknown) => {
      if (!active || value === undefined) return;
      counters.received++;
      if (
        bundle.mode === "ion" &&
        typeof level === "number" &&
        Number.isInteger(level) &&
        level >= 0 &&
        !counters.levels.includes(level)
      ) {
        counters.levels.push(level);
        counters.levels.sort((a, b) => a - b);
      }
    };
    const wrapped: RequestMethod = function (this: object, ...args) {
      let result: unknown;
      try {
        result = original.apply(this, args);
      } catch (error) {
        if (active) counters.requested++;
        recordFailure(error, args[3]);
        throw error;
      }
      // Cesium uses undefined for a throttled request and retries it itself.
      if (result === undefined) return undefined;
      if (active) counters.requested++;
      if (
        typeof result === "object" &&
        result !== null &&
        "then" in result &&
        typeof result.then === "function"
      ) {
        // Observe the existing promise without replacing its rejection or identity.
        void Promise.resolve(result).then(
          (value) => {
            recordReceived(value, args[2]);
          },
          (error: unknown) => {
            recordFailure(error, args[3]);
          },
        );
        return result;
      }
      recordReceived(result, args[2]);
      return result;
    };
    methods[methodName] = wrapped;
    restorers.push(() => {
      if (methods[methodName] !== wrapped) return;
      if (descriptor) Object.defineProperty(provider, methodName, descriptor);
      else delete methods[methodName];
    });
  };

  let installationStage: EarthDataStage = "imagery";
  try {
    wrap(bundle.imagery, "requestImage", "imagery");
    installationStage = "terrain";
    wrap(bundle.terrain, "requestTileGeometry", "terrain");
  } catch (error) {
    active = false;
    for (const restore of restorers.reverse()) restore();
    throw safeEarthError(error, installationStage);
  }

  return {
    snapshot: () => ({
      mode: state.mode,
      imagery: { ...state.imagery, levels: [...state.imagery.levels] },
      terrain: { ...state.terrain, levels: [...state.terrain.levels] },
      ...(state.lastError ? { lastError: { ...state.lastError } } : {}),
    }),
    dispose: () => {
      if (!active) return;
      active = false;
      for (const restore of restorers.reverse()) restore();
    },
  };
}
