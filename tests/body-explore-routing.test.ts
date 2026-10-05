import test from "node:test";
import assert from "node:assert/strict";
import {
  InteractionStateMachine,
  type InteractionEvent,
  type InteractionState,
} from "../src/interaction/InteractionStateMachine";

function focusedBody() {
  const machine = new InteractionStateMachine();
  assert.equal(machine.send("READY"), true);
  assert.equal(machine.send("SELECT"), true);
  assert.equal(machine.send("TRANSITION_END"), true);
  return machine;
}

function exploringBody() {
  const machine = focusedBody();
  assert.equal(machine.send("ENTER_BODY_EXPLORE"), true);
  return machine;
}

test("continuous body exploration starts only after a stable planet overview", () => {
  const machine = focusedBody();
  assert.equal(machine.state, "PLANET_OVERVIEW");
  assert.equal(machine.send("ENTER_BODY_EXPLORE"), true);
  assert.equal(machine.state, "BODY_EXPLORE");
  assert.equal(machine.locked, false);
});

test("body exploration cannot bypass intro, selection or existing prototype routes", () => {
  for (const state of [
    "INTRO",
    "SOLAR_SYSTEM",
    "POINTER",
    "PLANET_TRANSITION",
    "INFO",
    "EARTH_CONTINENT_PICKER",
    "EARTH_COUNTRY_PICKER",
    "EARTH_CITY_PICKER",
    "PLANET_REGION_PICKER",
    "DESCENT_TRANSITION",
    "LOCATION_OVERVIEW",
    "INFO_PANEL_OPEN",
    "SUN_INTERIOR",
    "TRANSITION",
  ] satisfies InteractionState[]) {
    const machine = new InteractionStateMachine();
    machine.state = state;
    assert.equal(machine.send("ENTER_BODY_EXPLORE"), false, state);
    assert.equal(machine.state, state);
  }
});

test("body exploration rejects competing legacy camera and directory commands", () => {
  const machine = exploringBody();
  for (const event of [
    "SELECT",
    "ENTER_SUN",
    "SCALE",
    "INFO",
    "COLLAPSE",
    "BROWSE",
    "BROWSE_EARTH",
    "ENTER_LOCATION",
    "OPEN_HOTSPOT",
    "ENTER_BODY_EXPLORE",
    "TRANSITION_END",
    "TRANSITION_CANCEL",
  ] satisfies InteractionEvent[]) {
    assert.equal(machine.can(event), false, event);
    assert.equal(machine.send(event), false, event);
    assert.equal(machine.state, "BODY_EXPLORE");
  }
});

test("cancelling a return restores the stable body exploration state", () => {
  const machine = exploringBody();
  assert.equal(machine.send("RETURN"), true);
  assert.equal(machine.state, "TRANSITION");
  assert.equal(machine.locked, true);
  assert.equal(machine.send("ENTER_BODY_EXPLORE"), false);
  assert.equal(machine.send("SELECT"), false);
  assert.equal(machine.send("TRANSITION_CANCEL"), true);
  assert.equal(machine.state, "BODY_EXPLORE");
  assert.equal(machine.locked, false);
  assert.equal(machine.send("RETURN"), true);
  assert.equal(machine.send("TRANSITION_CANCEL"), true);
  assert.equal(machine.state, "BODY_EXPLORE");
});

test("completed body return releases camera ownership before another selection", () => {
  const machine = exploringBody();
  assert.equal(machine.send("RETURN"), true);
  assert.equal(machine.send("ENTER_SUN"), false);
  assert.equal(machine.send("TRANSITION_END"), true);
  assert.equal(machine.state, "SOLAR_SYSTEM");
  assert.equal(machine.send("SELECT"), true);
  assert.equal(machine.state, "PLANET_TRANSITION");
  assert.equal(machine.send("TRANSITION_CANCEL"), true);
  assert.equal(machine.state, "SOLAR_SYSTEM");
});

test("legacy overview, info and location prototype transitions remain available", () => {
  const machine = focusedBody();
  assert.equal(machine.send("INFO"), true);
  assert.equal(machine.send("SELECT"), true);
  assert.equal(machine.send("TRANSITION_CANCEL"), true);
  assert.equal(machine.state, "INFO");
  assert.equal(machine.send("BROWSE_EARTH"), true);
  assert.equal(machine.send("PICK_CONTINENT"), true);
  assert.equal(machine.send("PICK_COUNTRY"), true);
  assert.equal(machine.send("ENTER_LOCATION"), true);
  assert.equal(machine.send("LOCATION_READY"), true);
  assert.equal(machine.send("OPEN_HOTSPOT"), true);
  assert.equal(machine.send("CLOSE_HOTSPOT"), true);
  assert.equal(machine.state, "LOCATION_OVERVIEW");
  assert.equal(machine.send("LOCATION_CANCEL"), true);
  assert.equal(machine.state, "EARTH_CITY_PICKER");
});
