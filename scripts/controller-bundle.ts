import assert from "node:assert/strict";
import type { Rollup } from "vite";

type BundleEntry =
  | Pick<Rollup.OutputAsset, "type">
  | Pick<
      Rollup.OutputChunk,
      "type" | "facadeModuleId" | "imports" | "dynamicImports" | "moduleIds"
    >;

export function assertControllerStartupBundle(
  bundle: Record<string, BundleEntry>,
  controllerEntry: string,
) {
  const entry = Object.entries(bundle).find(
    ([, item]) =>
      item.type === "chunk" && item.facadeModuleId === controllerEntry,
  );
  assert.ok(entry, "Controller entry is missing from the build");
  const pending = [entry[0]];
  const seen = new Set<string>();
  while (pending.length) {
    const fileName = pending.pop()!;
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const chunk = bundle[fileName];
    if (!chunk || chunk.type !== "chunk") continue;
    assert.ok(
      !chunk.moduleIds.some((id) =>
        /\/node_modules\/(three|@react-three\/fiber|@react-three\/drei)\//.test(
          id,
        ),
      ),
      `Controller startup must not load the 3D engine: ${fileName}`,
    );
    // Dynamic imports run only after interaction, not during controller startup.
    pending.push(...chunk.imports);
  }
}
