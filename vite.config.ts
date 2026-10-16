import {
  defineConfig,
  loadEnv,
  normalizePath,
  type Plugin,
  type ResolvedConfig,
} from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { createBuildInfo, readGitBuildState } from "./scripts/build-info";
import { assertControllerStartupBundle } from "./scripts/controller-bundle";

function buildInfoPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "solaris-build-info",
    apply: "build",
    enforce: "post",
    configResolved(value) {
      config = value;
    },
    generateBundle: {
      // 等待 Vite 完成动态 import 依赖改写，再计算最终字节摘要。
      order: "post",
      handler(_options, bundle) {
        assertControllerStartupBundle(
          bundle,
          normalizePath(resolve(config.root, "controller/index.html")),
        );
        const manifest = createBuildInfo(
          {
            ...readGitBuildState(config.root),
            mode: config.mode,
            base: config.base,
            env: config.env,
          },
          bundle,
        );
        this.emitFile({
          type: "asset",
          fileName: "build-info.json",
          source: `${JSON.stringify(manifest, null, 2)}\n`,
        });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), buildInfoPlugin()],
    base: env.VITE_BASE_PATH || "/",
    server: { port: 5173 },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, "index.html"),
          globeLab: resolve(import.meta.dirname, "globe-lab.html"),
          controller: resolve(import.meta.dirname, "controller/index.html"),
        },
        output: {
          manualChunks(id) {
            // Keep controller UI/runtime imports independent of the 3D modules.
            if (
              /\/node_modules\/(react|react-dom|scheduler)\//.test(id) ||
              id === "\0commonjsHelpers.js" ||
              id === "\0vite/preload-helper.js"
            )
              return "react";
            if (
              /\/node_modules\/(three|@react-three\/fiber|@react-three\/drei)\//.test(
                id,
              )
            )
              return "three";
            if (id.includes("/node_modules/@mediapipe/tasks-vision/"))
              return "vision";
          },
        },
      },
    },
  };
});
