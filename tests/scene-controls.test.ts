import test from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { interaction } from "../src/interaction/InteractionController";
import { particles } from "../src/particles/ParticleEngine";
import { store } from "../src/interaction/store";

function reset() {
  gsap.killTweensOf(particles);
  interaction.machine.state = "SOLAR_SYSTEM";
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    hover: null,
    heldUniverse: false,
    sound: false,
  });
  Object.assign(particles, {
    sunInterior: 0,
    collapse: 0,
    focus: 0,
    explosion: 0,
    targetScale: 1,
  });
}
function finishMotion() {
  for (const tween of gsap.getTweensOf(particles)) tween.progress(1);
}

test("entering the sun during collapse cancels contraction and clears selection", () => {
  reset();
  store.set({ selected: "earth", hover: "mars" });
  interaction.collapse();
  interaction.enterSun();
  finishMotion();
  assert.equal(store.get().mode, "SUN_INTERIOR");
  assert.equal(store.get().selected, null);
  assert.equal(store.get().hover, null);
  assert.equal(particles.sunInterior, 1);
  assert.equal(particles.collapse, 0);
  interaction.return();
  finishMotion();
  assert.equal(store.get().mode, "SOLAR_SYSTEM");
  assert.equal(particles.sunInterior, 0);
  assert.equal(particles.collapse, 0);
  assert.equal(particles.targetScale, 1);
  reset();
});

test("a return during sun entry wins over the unfinished entry animation", () => {
  reset();
  interaction.enterSun();
  interaction.return();
  finishMotion();
  assert.equal(interaction.machine.state, "SOLAR_SYSTEM");
  assert.equal(particles.sunInterior, 0);
  reset();
});

test("sun interior ignores zoom and planet selection until it is exited", () => {
  reset();
  interaction.enterSun();
  interaction.scale(0.2);
  interaction.select("earth");
  assert.equal(particles.targetScale, 1);
  assert.equal(store.get().selected, null);
  assert.equal(interaction.machine.state, "SUN_INTERIOR");
  reset();
});

test("releasing zoom keeps its size and selected planet", () => {
  reset();
  interaction.machine.state = "PLANET_FOCUS";
  store.set({ mode: "PLANET_FOCUS", selected: "earth" });
  interaction.scale(0.3);
  interaction.endScale();
  assert.equal(particles.targetScale, 0.3);
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().mode, "PLANET_FOCUS");
  reset();
});
