import test from "node:test";
import assert from "node:assert/strict";
import { Group, PerspectiveCamera, Vector2 } from "three";
import { pickPlanet, projectPlanetTarget } from "../src/scene/planetPicking";
import type { PlanetId } from "../src/data/planets";
import type { CelestialId } from "../src/gesture/gestureFeedback";

const setup = (width: number, height: number, radius = 1) => {
  const camera = new PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  const planet = new Group();
  planet.scale.setScalar(radius);
  planet.updateMatrixWorld();
  const objects = new Map<PlanetId, Group>([["earth", planet]]);
  return { camera, objects, planet };
};

test("a planet can be targeted across its visible surface, not only its centre", () => {
  const { camera, objects } = setup(1200, 800, 2);
  assert.equal(
    pickPlanet(new Vector2(0.2, 0), camera, 1200, 800, objects),
    "earth",
  );
});

test("small targets have equal pixel tolerance on portrait and landscape screens", () => {
  for (const [width, height] of [
    [1200, 800],
    [390, 844],
  ]) {
    const { camera, objects } = setup(width, height, 0.05);
    for (const [x, y] of [
      [20, 0],
      [0, 20],
    ]) {
      assert.equal(
        pickPlanet(
          new Vector2((x * 2) / width, (y * 2) / height),
          camera,
          width,
          height,
          objects,
        ),
        "earth",
      );
    }
    assert.equal(
      pickPlanet(
        new Vector2((50 * 2) / width, 0),
        camera,
        width,
        height,
        objects,
      ),
      null,
    );
  }
});

test("hidden, collapsed or behind-camera planets cannot become selectable targets", () => {
  const { camera, objects, planet } = setup(800, 800);
  planet.visible = false;
  assert.equal(pickPlanet(new Vector2(), camera, 800, 800, objects), null);
  planet.visible = true;
  planet.scale.setScalar(0.001);
  assert.equal(pickPlanet(new Vector2(), camera, 800, 800, objects), null);
  planet.scale.setScalar(1);
  planet.position.z = 20;
  assert.equal(pickPlanet(new Vector2(), camera, 800, 800, objects), null);
});

test("the sun is picked across its full 3.05-unit surface", () => {
  const { camera, planet } = setup(1200, 800);
  planet.userData.pickRadius = 3.05;
  const objects = new Map<CelestialId, Group>([["sun", planet]]);
  assert.equal(
    pickPlanet(new Vector2(0.35, 0), camera, 1200, 800, objects),
    "sun",
  );
  planet.userData.pickRadius = 1;
  assert.equal(
    pickPlanet(new Vector2(0.35, 0), camera, 1200, 800, objects),
    null,
  );
});

test("hidden parent hierarchies exclude both planet and Sun targets", () => {
  const { camera, planet } = setup(800, 800);
  const parent = new Group();
  parent.add(planet);
  const objects = new Map<CelestialId, Group>([["sun", planet]]);
  parent.visible = false;
  assert.equal(pickPlanet(new Vector2(), camera, 800, 800, objects), null);
  parent.visible = true;
  assert.equal(pickPlanet(new Vector2(), camera, 800, 800, objects), "sun");
});

test("gesture hover expands the disc by 30 percent without changing mouse picking", () => {
  const { camera, objects } = setup(1200, 800);
  const screen = projectPlanetTarget("earth", camera, 1200, 800, objects)!;
  const at = (ratio: number) =>
    new Vector2((screen.radius * ratio * 2) / 1200, 0);
  assert.equal(pickPlanet(at(1.25), camera, 1200, 800, objects), null);
  assert.equal(pickPlanet(at(1.25), camera, 1200, 800, objects, 1.3), "earth");
  assert.equal(pickPlanet(at(1.4), camera, 1200, 800, objects, 1.3), null);
});
test("target-ring projection follows the visible body and rejects hidden objects", () => {
  const { camera, objects, planet } = setup(1200, 800);
  const screen = projectPlanetTarget("earth", camera, 1200, 800, objects)!;
  assert.equal(screen.x, 600);
  assert.equal(screen.y, 400);
  assert.ok(screen.radius > 90 && screen.radius < 100);
  planet.position.x = 1;
  planet.updateMatrixWorld();
  assert.ok(
    projectPlanetTarget("earth", camera, 1200, 800, objects)!.x > screen.x,
  );
  planet.visible = false;
  assert.equal(projectPlanetTarget("earth", camera, 1200, 800, objects), null);
  assert.equal(projectPlanetTarget("sun", camera, 1200, 800, objects), null);
});
