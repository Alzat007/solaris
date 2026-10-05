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

export type EarthProviderConfig =
  | { mode: "local" }
  | { mode: "ion"; accessToken: string };

export function earthProviderConfig(
  search: string,
  env: { VITE_CESIUM_ION_READ_TOKEN?: string },
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
  return { mode: "ion", accessToken };
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
  const ensureActive = () => {
    if (signal?.aborted) throw new Error("地图加载已取消");
  };
  ensureActive();
  if (config.mode === "local") {
    const imagery = await factories.local(`${baseUrl}textures/earth-day.jpg`);
    ensureActive();
    return {
      mode: "local",
      imagery,
      terrain: new EllipsoidTerrainProvider(),
      minimumHeight: 250_000,
      coverage: "本地低精度预览 · ion 未连接 · 地形/建筑未接入",
    };
  }
  try {
    const terrain = await factories.terrain(
      EARTH_ION_ASSETS.terrain,
      config.accessToken,
    );
    // SDK factory requests already in flight are not abortable through this API.
    // Do not start a new imagery session after an earlier stage was canceled.
    ensureActive();
    const imagery = await factories.imagery(
      EARTH_ION_ASSETS.satelliteWithLabels,
      config.accessToken,
    );
    ensureActive();
    return {
      mode: "ion",
      imagery,
      terrain,
      minimumHeight: 100,
      coverage: "ion 卫星/标签 + 地形 · 建筑网格未接入 · 区域精度待实测",
    };
  } catch {
    ensureActive();
    // SDK errors can contain request URLs and token query parameters.
    throw new Error(
      "Cesium ion 加载失败：请检查资源权限、URL 限制、网络与配额；未回退为已连接状态。",
    );
  }
}
