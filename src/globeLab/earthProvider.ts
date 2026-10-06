import {
  CesiumTerrainProvider,
  Credit,
  EllipsoidTerrainProvider,
  IonImageryProvider,
  IonResource,
  SingleTileImageryProvider,
  type ImageryProvider,
  type TerrainProvider,
} from "cesium";

export const EARTH_ION_ASSETS = {
  terrain: 1,
  satelliteWithLabels: 3830183,
} as const;

export interface EarthAssetIds {
  terrain: number;
  imagery: number;
}

export type EarthProviderConfig =
  | { mode: "local" }
  | { mode: "ion"; accessToken: string; assetIds?: EarthAssetIds };

export interface EarthProviderEnvironment {
  VITE_CESIUM_ION_READ_TOKEN?: string;
  VITE_CESIUM_TERRAIN_ASSET_ID?: string;
  VITE_CESIUM_IMAGERY_ASSET_ID?: string;
}

export type EarthDataStage = "terrain" | "imagery";
export type EarthDataErrorCode = "HTTP_ERROR" | "REQUEST_FAILED" | "CANCELED";

export interface EarthDataError {
  stage: EarthDataStage;
  statusCode?: number;
  code: EarthDataErrorCode;
}

export class SafeEarthProviderError extends Error implements EarthDataError {
  readonly stage: EarthDataStage;
  readonly statusCode?: number;
  readonly code: EarthDataErrorCode;

  constructor(details: EarthDataError) {
    const layer = details.stage === "terrain" ? "地形" : "影像";
    super(
      details.code === "CANCELED"
        ? "地图加载已取消"
        : `地图${layer}加载失败${details.statusCode ? `（HTTP ${details.statusCode}）` : ""}：请检查资源、URL 限制、网络与配额；未回退为已连接状态。`,
    );
    this.name =
      details.code === "CANCELED" ? "AbortError" : "EarthProviderError";
    this.stage = details.stage;
    this.statusCode = details.statusCode;
    this.code = details.code;
  }
}

/** Copy only numeric status and cancellation metadata, never SDK URLs or messages. */
export function safeEarthError(
  error: unknown,
  stage: EarthDataStage,
): SafeEarthProviderError {
  const pending: unknown[] = [error];
  const visited = new Set<object>();
  let statusCode: number | undefined;
  let canceled = false;
  for (let index = 0; index < pending.length && index < 12; index++) {
    const current = pending[index];
    if (typeof current !== "object" || current === null || visited.has(current))
      continue;
    visited.add(current);
    const value = (key: string): unknown => {
      try {
        return Object.getOwnPropertyDescriptor(current, key)?.value;
      } catch {
        return undefined;
      }
    };
    if (
      value("name") === "AbortError" ||
      value("code") === "CANCELED" ||
      (typeof DOMException !== "undefined" &&
        current instanceof DOMException &&
        current.name === "AbortError")
    )
      canceled = true;
    for (const key of ["statusCode", "status"]) {
      const candidate = value(key);
      if (
        statusCode === undefined &&
        typeof candidate === "number" &&
        Number.isInteger(candidate) &&
        candidate >= 100 &&
        candidate <= 599
      )
        statusCode = candidate;
    }
    for (const key of ["error", "cause", "originalError"])
      pending.push(value(key));
  }
  return new SafeEarthProviderError({
    stage,
    ...(statusCode === undefined ? {} : { statusCode }),
    code: canceled ? "CANCELED" : statusCode ? "HTTP_ERROR" : "REQUEST_FAILED",
  });
}

function positiveAssetId(value: string | undefined, fallback: number): number {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  if (!/^[1-9]\d*$/.test(normalized))
    throw new Error("Cesium ion 资源 ID 必须为有效正整数。");
  const id = Number(normalized);
  if (!Number.isSafeInteger(id))
    throw new Error("Cesium ion 资源 ID 必须为有效正整数。");
  return id;
}

function resolveAssetIds(ids?: EarthAssetIds): EarthAssetIds {
  const resolved = ids ?? {
    terrain: EARTH_ION_ASSETS.terrain,
    imagery: EARTH_ION_ASSETS.satelliteWithLabels,
  };
  if (
    !Number.isSafeInteger(resolved.terrain) ||
    resolved.terrain <= 0 ||
    !Number.isSafeInteger(resolved.imagery) ||
    resolved.imagery <= 0
  )
    throw new Error("Cesium ion 资源 ID 必须为有效正整数。");
  return resolved;
}

export function earthProviderConfig(
  search: string,
  env: EarthProviderEnvironment,
): EarthProviderConfig {
  const params = new URLSearchParams(search);
  if (params.get("data") !== "ion") return { mode: "local" };
  // Real imagery sessions must not be launched by the automated regression route.
  if (params.get("qa") === "1")
    throw new Error("真实数据不用于自动回归；请移除 qa=1 后人工验证。");
  const accessToken = env.VITE_CESIUM_ION_READ_TOKEN?.trim();
  if (!accessToken)
    throw new Error(
      "Cesium ion 未连接：请先在本机配置受限 assets:read 客户端令牌。",
    );
  return {
    mode: "ion",
    accessToken,
    assetIds: {
      terrain: positiveAssetId(
        env.VITE_CESIUM_TERRAIN_ASSET_ID,
        EARTH_ION_ASSETS.terrain,
      ),
      imagery: positiveAssetId(
        env.VITE_CESIUM_IMAGERY_ASSET_ID,
        EARTH_ION_ASSETS.satelliteWithLabels,
      ),
    },
  };
}

export interface EarthProviderBundle {
  mode: "local" | "ion";
  imagery: ImageryProvider;
  terrain: TerrainProvider;
  minimumHeight: number;
  coverage: string;
}

const providerFactories = {
  imagery: (id: number, accessToken: string) =>
    IonImageryProvider.fromAssetId(id, { accessToken }),
  terrain: async (id: number, accessToken: string) =>
    CesiumTerrainProvider.fromUrl(
      await IonResource.fromAssetId(id, { accessToken }),
    ),
  local: (url: string) =>
    SingleTileImageryProvider.fromUrl(url, {
      credit: new Credit("Local Earth imagery · Three.js r160 examples", true),
    }),
};

/** Explicit per-provider credentials; never change Ion.defaultAccessToken. */
export async function loadEarthProvider(
  config: EarthProviderConfig,
  baseUrl: string,
  factories: typeof providerFactories = providerFactories,
  signal?: AbortSignal,
): Promise<EarthProviderBundle> {
  let stage: EarthDataStage = config.mode === "local" ? "imagery" : "terrain";
  const ensureActive = () => {
    if (signal?.aborted) throw safeEarthError({ name: "AbortError" }, stage);
  };
  ensureActive();
  if (config.mode === "local") {
    try {
      const imagery = await factories.local(`${baseUrl}textures/earth-day.jpg`);
      ensureActive();
      return {
        mode: "local",
        imagery,
        terrain: new EllipsoidTerrainProvider(),
        minimumHeight: 250_000,
        coverage:
          "本地低精度单幅影像预览（非分级瓦片）· ion 未连接 · 真实地形/建筑未接入",
      };
    } catch (error) {
      ensureActive();
      throw safeEarthError(error, stage);
    }
  }
  const assetIds = resolveAssetIds(config.assetIds);
  try {
    const terrain = await factories.terrain(
      assetIds.terrain,
      config.accessToken,
    );
    // SDK factory requests already in flight are not abortable through this API.
    // Do not start a new imagery session after an earlier stage was canceled.
    ensureActive();
    stage = "imagery";
    const imagery = await factories.imagery(
      assetIds.imagery,
      config.accessToken,
    );
    ensureActive();
    return {
      mode: "ion",
      imagery,
      terrain,
      minimumHeight: 100,
      coverage:
        "ion 影像 + 地形提供器已初始化 · 城市影像精度待实测 · 建筑网格未接入",
    };
  } catch (error) {
    ensureActive();
    throw safeEarthError(error, stage);
  }
}
