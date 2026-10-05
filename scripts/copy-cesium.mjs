import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  const destination = resolve(root, "public/cesium", name);
  await mkdir(destination, { recursive: true });
  await cp(
    resolve(root, "node_modules/cesium/Build/Cesium", name),
    destination,
    { recursive: true },
  );
}
await cp(
  resolve(root, "node_modules/cesium/LICENSE.md"),
  resolve(root, "public/cesium/LICENSE.md"),
);
