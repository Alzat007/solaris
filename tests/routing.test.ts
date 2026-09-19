import test from "node:test";
import assert from "node:assert/strict";
import { gestures } from "../src/gesture/GestureController";
import { interaction } from "../src/interaction/InteractionController";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import type { HandFeatures, Gesture } from "../src/gesture/GestureTypes";
import type { PlanetId } from "../src/data/planets";
const hand = (gesture: Gesture, x = 0.3): HandFeatures => ({
  center: { x, y: 0.5 },
  pointer: { x, y: 0.3 },
  velocity: { x: 0, y: 0 },
  scale: 0.2,
  openness: 1,
  pinchDistance: 1,
  pinchStrength: 0,
  gesture,
  confidence: 0.95,
  landmarks: [],
  palmFacing: true,
  palmDirection: [0, 0, 1],
});
const reset = () => {
  gestures.reset();
  store.set({
    tracking: "online",
    mode: "SOLAR_SYSTEM",
    hover: null,
    selected: null,
    heldUniverse: false,
  });
  interaction.machine.state = "SOLAR_SYSTEM";
  particles.targetAnchor.set(0, 0, 0);
};
const withSelections = (run: (selected: PlanetId[]) => void) => {
  reset();
  const selected: PlanetId[] = [];
  const original = interaction.select;
  interaction.select = (id) => {
    selected.push(id);
  };
  try {
    run(selected);
  } finally {
    interaction.select = original;
    reset();
  }
};
test("two open palms can release collapse without entering scale mode", () => {
  reset();
  store.set({ mode: "COLLAPSE" });
  interaction.machine.state = "COLLAPSE";
  let count = 0;
  const original = interaction.bang;
  interaction.bang = () => {
    count++;
  };
  try {
    gestures.update({
      hands: [hand("OPEN_PALM"), hand("OPEN_PALM", 0.7)],
      time: 1000,
    });
    gestures.update({
      hands: [hand("OPEN_PALM"), hand("OPEN_PALM", 0.7)],
      time: 1250,
    });
    assert.equal(count, 1);
    assert.equal(store.get().mode, "COLLAPSE");
  } finally {
    interaction.bang = original;
    reset();
  }
});
test("two-hand motion cannot change the anchor during Big Bang", () => {
  reset();
  store.set({ mode: "BIG_BANG" });
  interaction.machine.state = "BIG_BANG";
  for (let i = 0; i < 20; i++)
    gestures.update({
      hands: [
        hand("OPEN_PALM", 0.1 + i * 0.015),
        hand("OPEN_PALM", 0.9 - i * 0.015),
      ],
      time: 2000 + i * 60,
    });
  assert.deepEqual(particles.targetAnchor.toArray(), [0, 0, 0]);
  assert.equal(store.get().heldUniverse, false);
  reset();
});
test("an old pointer target expires instead of being refreshed by unrelated gestures", () => {
  reset();
  let selected = 0;
  const original = interaction.select;
  interaction.select = () => {
    selected++;
  };
  try {
    store.set({ hover: "earth" });
    gestures.update({ hands: [hand("POINT")], time: 1000 });
    gestures.update({ hands: [hand("NONE")], time: 1200 });
    gestures.update({ hands: [hand("PINCH")], time: 1800 });
    gestures.update({ hands: [hand("PINCH")], time: 1900 });
    assert.equal(selected, 0);
  } finally {
    interaction.select = original;
    reset();
  }
});
test("a direct pinch selects the currently targeted planet without pointing first", () => {
  withSelections((selected) => {
    store.set({ hover: "earth" });
    gestures.update({ hands: [hand("PINCH")], time: 1000 });
    gestures.update({ hands: [hand("PINCH")], time: 1100 });
    assert.deepEqual(selected, ["earth"]);
  });
});
test("a slow point-to-pinch motion can select the current target after the pointer cache expires", () => {
  withSelections((selected) => {
    store.set({ hover: "earth" });
    gestures.update({ hands: [hand("POINT")], time: 1000 });
    gestures.update({ hands: [hand("PINCH")], time: 1500 });
    gestures.update({ hands: [hand("PINCH")], time: 1600 });
    assert.deepEqual(selected, ["earth"]);
  });
});
test("a held pinch can enter a target later and selects only once until released", () => {
  withSelections((selected) => {
    gestures.update({ hands: [hand("PINCH")], time: 1000 });
    gestures.update({ hands: [hand("PINCH")], time: 1100 });
    assert.deepEqual(selected, []);
    store.set({ hover: "mars" });
    gestures.update({ hands: [hand("PINCH")], time: 1200 });
    assert.deepEqual(selected, ["mars"]);
    store.set({ hover: "venus", mode: "PLANET_TRANSITION" });
    interaction.machine.state = "PLANET_TRANSITION";
    gestures.update({ hands: [hand("PINCH")], time: 1300 });
    store.set({ mode: "PLANET_FOCUS" });
    interaction.machine.state = "PLANET_FOCUS";
    gestures.update({ hands: [hand("PINCH")], time: 1500 });
    gestures.update({ hands: [hand("PINCH")], time: 1600 });
    assert.deepEqual(selected, ["mars"]);
    gestures.update({ hands: [hand("NONE")], time: 1700 });
    store.set({ hover: "venus" });
    gestures.update({ hands: [hand("PINCH")], time: 1800 });
    gestures.update({ hands: [hand("PINCH")], time: 1900 });
    assert.deepEqual(selected, ["mars", "venus"]);
  });
});
test("a current pinch target takes precedence over the recent pointer target", () => {
  withSelections((selected) => {
    store.set({ hover: "earth" });
    gestures.update({ hands: [hand("POINT")], time: 1000 });
    store.set({ hover: "jupiter" });
    gestures.update({ hands: [hand("PINCH")], time: 1100 });
    gestures.update({ hands: [hand("PINCH")], time: 1200 });
    assert.deepEqual(selected, ["jupiter"]);
  });
});
test("low confidence disarms a pending pinch until another stable hold", () => {
  withSelections((selected) => {
    gestures.update({ hands: [hand("PINCH")], time: 1000 });
    gestures.update({ hands: [hand("PINCH")], time: 1100 });
    store.set({ hover: "earth" });
    gestures.update({
      hands: [{ ...hand("PINCH"), confidence: 0.2 }],
      time: 1200,
    });
    gestures.update({ hands: [hand("PINCH")], time: 1300 });
    assert.deepEqual(selected, []);
    gestures.update({ hands: [hand("PINCH")], time: 1400 });
    assert.deepEqual(selected, ["earth"]);
  });
});
test("a marginal confidence dip can re-arm a pending pinch without selecting twice", () => {
  withSelections((selected) => {
    gestures.update({ hands: [hand("PINCH")], time: 1000 });
    gestures.update({ hands: [hand("PINCH")], time: 1100 });
    store.set({ hover: "earth" });
    gestures.update({
      hands: [{ ...hand("PINCH"), confidence: 0.48 }],
      time: 1150,
    });
    assert.deepEqual(selected, []);
    gestures.update({ hands: [hand("PINCH")], time: 1200 });
    gestures.update({ hands: [hand("PINCH")], time: 1300 });
    assert.deepEqual(selected, ["earth"]);
    store.set({ hover: "venus" });
    gestures.update({
      hands: [{ ...hand("PINCH"), confidence: 0.48 }],
      time: 1350,
    });
    gestures.update({ hands: [hand("PINCH")], time: 1400 });
    gestures.update({ hands: [hand("PINCH")], time: 1500 });
    assert.deepEqual(selected, ["earth"]);
  });
});
test("sustained marginal confidence requires a new stable hold before selecting", () => {
  withSelections((selected) => {
    gestures.update({ hands: [hand("PINCH")], time: 1000 });
    gestures.update({ hands: [hand("PINCH")], time: 1100 });
    store.set({ hover: "earth" });
    for (const time of [1150, 1200, 1250])
      gestures.update({
        hands: [{ ...hand("PINCH"), confidence: 0.48 }],
        time,
      });
    gestures.update({ hands: [hand("PINCH")], time: 1300 });
    assert.deepEqual(selected, []);
    gestures.update({ hands: [hand("PINCH")], time: 1400 });
    assert.deepEqual(selected, ["earth"]);
  });
});
test("reset clears the cached pointer target and pending pinch", () => {
  withSelections((selected) => {
    store.set({ hover: "earth" });
    gestures.update({ hands: [hand("POINT")], time: 1000 });
    gestures.reset();
    gestures.update({ hands: [hand("PINCH")], time: 1100 });
    gestures.update({ hands: [hand("PINCH")], time: 1200 });
    assert.deepEqual(selected, []);
  });
});
test("lost tracking clears cached and current targets before a new pinch", () => {
  withSelections((selected) => {
    store.set({ hover: "earth" });
    gestures.update({ hands: [hand("POINT")], time: 1000 });
    gestures.update({ hands: [], time: 1200 });
    assert.equal(store.get().hover, null);
    // Avoid the connection animation while exercising only gesture routing.
    store.set({ tracking: "online" });
    gestures.update({ hands: [hand("PINCH")], time: 1300 });
    gestures.update({ hands: [hand("PINCH")], time: 1400 });
    assert.deepEqual(selected, []);
  });
});
