import test from "node:test";
import assert from "node:assert/strict";
import { assertControllerStartupBundle } from "../scripts/controller-bundle";

const entry = "/project/controller/index.html";
const chunk = (
  moduleIds: string[],
  imports: string[] = [],
  dynamicImports: string[] = [],
  facadeModuleId: string | null = null,
) => ({
  type: "chunk" as const,
  moduleIds,
  imports,
  dynamicImports,
  facadeModuleId,
});

test("controller startup allows shared React and leaves dynamic camera chunks lazy", () => {
  assert.doesNotThrow(() =>
    assertControllerStartupBundle(
      {
        "controller.js": chunk([], ["react.js"], ["camera.js"], entry),
        "react.js": chunk(["/project/node_modules/react/index.js"]),
        "camera.js": chunk([], ["three.js"]),
        "three.js": chunk([
          "/project/node_modules/three/build/three.module.js",
        ]),
        "controller/index.html": { type: "asset" },
      },
      entry,
    ),
  );
});

test("controller startup rejects 3D modules hidden in transitive shared chunks", () => {
  for (const dependency of [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
  ]) {
    assert.throws(
      () =>
        assertControllerStartupBundle(
          {
            "controller.js": chunk([], ["runtime.js"], [], entry),
            "runtime.js": chunk([], ["shared.js"]),
            "shared.js": chunk([
              `/project/node_modules/${dependency}/index.js`,
            ]),
          },
          entry,
        ),
      /Controller startup must not load the 3D engine: shared\.js/,
    );
  }
});

test("controller startup guard handles cycles and inspects the entry itself", () => {
  assert.doesNotThrow(() =>
    assertControllerStartupBundle(
      {
        "controller.js": chunk([], ["runtime.js"], [], entry),
        "runtime.js": chunk([], ["controller.js"]),
      },
      entry,
    ),
  );
  assert.throws(
    () =>
      assertControllerStartupBundle(
        {
          "controller.js": chunk(
            ["/project/node_modules/three/build/three.module.js"],
            [],
            [],
            entry,
          ),
        },
        entry,
      ),
    /Controller startup must not load the 3D engine/,
  );
});

test("controller startup guard fails when the controller entry is missing", () => {
  assert.throws(
    () => assertControllerStartupBundle({}, entry),
    /Controller entry is missing from the build/,
  );
});
