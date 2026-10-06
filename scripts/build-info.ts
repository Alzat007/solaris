import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export interface GitBuildState {
  gitCommit: string | null;
  dirty: boolean | null;
}
export function readGitBuildState(
  root: string,
  run = (args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
): GitBuildState {
  let gitCommit: string | null = null;
  let dirty: boolean | null = null;
  try {
    const value = run(["rev-parse", "--verify", "HEAD"]).trim();
    if (/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value)) gitCommit = value;
  } catch {
    // 非 Git 环境保留未知状态，不记录错误中的本机路径。
  }
  try {
    dirty = !!run(["status", "--porcelain", "--untracked-files=normal"]).trim();
  } catch {
    // 文件清单只用于判断布尔值，绝不加入公开产物。
  }
  return { gitCommit, dirty };
}

type BuildOutput =
  | { type: "chunk"; code: string }
  | { type: "asset"; source: string | Uint8Array };
const assetId = (value: string | undefined, fallback: number) => {
  if (!value?.trim()) return fallback;
  const id = Number(value.trim());
  if (!/^[1-9]\d*$/.test(value.trim()) || !Number.isSafeInteger(id))
    throw new Error(
      "Cesium asset ID configuration must be a positive safe integer",
    );
  return id;
};

export function createBuildInfo(
  settings: GitBuildState & {
    mode: string;
    base: string;
    env: Record<string, string | undefined>;
  },
  bundle: Record<string, BuildOutput>,
) {
  const files = Object.entries(bundle)
    .filter(([name]) => /\.(?:js|css|html)$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([path, output]) => {
      const source = output.type === "chunk" ? output.code : output.source;
      const bytes =
        typeof source === "string"
          ? Buffer.from(source, "utf8")
          : Buffer.from(source);
      return {
        path,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
      };
    });
  return {
    schemaVersion: 1,
    gitCommit: settings.gitCommit,
    dirty: settings.dirty,
    vite: { mode: settings.mode, base: settings.base },
    ion: {
      defaultDataMode: "local",
      requiredQuery: "data=ion",
      tokenConfigured: !!settings.env.VITE_CESIUM_ION_READ_TOKEN?.trim(),
      terrainAssetId: assetId(settings.env.VITE_CESIUM_TERRAIN_ASSET_ID, 1),
      imageryAssetId: assetId(
        settings.env.VITE_CESIUM_IMAGERY_ASSET_ID,
        3830183,
      ),
    },
    files,
  };
}
