import test from "node:test";
import assert from "node:assert/strict";
import {
  InteractionStateMachine,
  type InteractionEvent,
} from "../src/interaction/InteractionStateMachine";
import { planets } from "../src/data/planets";
const operations: InteractionEvent[] = [
  "POINT",
  "SELECT",
  "RETURN",
  "INFO",
  "SCALE",
  "COLLAPSE",
  "ENTER_SUN",
  "OPEN",
];
function ready() {
  const machine = new InteractionStateMachine();
  machine.send("READY");
  return machine;
}
function rejectsNavigation(machine: InteractionStateMachine) {
  assert.equal(machine.locked, true);
  for (const event of operations)
    assert.equal(
      machine.send(event),
      false,
      `${machine.state} must reject ${event}`,
    );
}
test("intro and every camera transition reject conflicting input", () => {
  const machine = new InteractionStateMachine();
  rejectsNavigation(machine);
  machine.send("READY");
  machine.send("SELECT");
  rejectsNavigation(machine);
  machine.send("TRANSITION_END");
  assert.equal(machine.state, "PLANET_FOCUS");
  assert.equal(machine.send("RETURN"), true);
  assert.equal(machine.state, "TRANSITION");
  rejectsNavigation(machine);
  machine.send("TRANSITION_END");
  assert.equal(machine.state, "SOLAR_SYSTEM");
  assert.equal(machine.locked, false);
});
test("point is hover only and never changes app state", () => {
  const machine = ready();
  for (let i = 0; i < 100; i++) machine.send("POINT");
  assert.equal(machine.state, "SOLAR_SYSTEM");
  machine.send("SELECT");
  machine.send("TRANSITION_END");
  machine.send("POINT");
  assert.equal(machine.state, "PLANET_FOCUS");
});
test("sun uses a locked fly-in before entering its stable interior", () => {
  const machine = ready();
  assert.equal(machine.send("ENTER_SUN"), true);
  assert.equal(machine.state, "SUN_FOCUS");
  rejectsNavigation(machine);
  machine.send("TRANSITION_END");
  assert.equal(machine.state, "SUN_INTERIOR");
  for (const event of [
    "COLLAPSE",
    "SELECT",
    "SCALE",
    "INFO",
    "ENTER_SUN",
  ] as const)
    assert.equal(machine.send(event), false);
  assert.equal(machine.send("RETURN"), true);
  rejectsNavigation(machine);
  machine.send("TRANSITION_END");
  assert.equal(machine.state, "SOLAR_SYSTEM");
});
test("collapse must finish before its separate rebirth can run", () => {
  const machine = ready();
  machine.send("COLLAPSE");
  rejectsNavigation(machine);
  machine.send("TRANSITION_END");
  assert.equal(machine.state, "COLLAPSE");
  assert.equal(machine.locked, false);
  assert.equal(machine.send("ENTER_SUN"), false);
  assert.equal(machine.send("OPEN"), true);
  assert.equal(machine.state, "BIG_BANG");
  rejectsNavigation(machine);
  assert.equal(machine.send("BANG_END"), true);
  assert.equal(machine.state, "SOLAR_SYSTEM");
});
test("the collapse easter egg is restricted to overview", () => {
  const machine = ready();
  machine.send("SELECT");
  machine.send("TRANSITION_END");
  assert.equal(machine.send("COLLAPSE"), false);
  machine.send("ENTER_SUN");
  machine.send("TRANSITION_END");
  assert.equal(machine.send("COLLAPSE"), false);
});
test("scale release restores the exact previous focused state", () => {
  for (const showInfo of [false, true]) {
    const machine = ready();
    machine.send("SELECT");
    machine.send("TRANSITION_END");
    if (showInfo) machine.send("INFO");
    const before = machine.state;
    assert.equal(machine.send("SCALE"), true);
    assert.equal(machine.send("SELECT"), false);
    assert.equal(machine.send("COLLAPSE"), false);
    assert.equal(machine.send("SCALE_END"), true);
    assert.equal(machine.state, before);
  }
});
test("planet visual sizes and physical data stay separate and ordered", () => {
  assert.deepEqual(
    planets.map((planet) => planet.id),
    [
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
    ],
  );
  planets.forEach((planet, index) => {
    assert.ok(planet.realRadius > 1000);
    assert.ok(planet.visualRadius < 2);
    if (index) assert.ok(planet.distance > planets[index - 1].distance);
  });
});
