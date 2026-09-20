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
  particles.targetScale = 1;
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

const pair = (gesture: Gesture, distance: number): HandFeatures[] => [
  hand(gesture, 0.5 - distance / 2),
  hand(gesture, 0.5 + distance / 2),
];
const withActions = (
  run: (calls: {
    collapse: number;
    enter: number;
    info: number;
    back: number;
    scales: number[];
    ended: number;
    next: number[];
  }) => void,
) => {
  reset();
  const calls = {
    collapse: 0,
    enter: 0,
    info: 0,
    back: 0,
    scales: [] as number[],
    ended: 0,
    next: [] as number[],
  };
  const original = {
    collapse: interaction.collapse,
    enterSun: interaction.enterSun,
    info: interaction.info,
    return: interaction.return,
    scale: interaction.scale,
    endScale: interaction.endScale,
    next: interaction.next,
  };
  interaction.collapse = () => {
    calls.collapse++;
    store.set({ mode: "COLLAPSE" });
    interaction.machine.state = "COLLAPSE";
  };
  interaction.enterSun = () => {
    calls.enter++;
    store.set({ mode: "SUN_INTERIOR" });
    interaction.machine.state = "SUN_INTERIOR";
  };
  interaction.info = () => {
    calls.info++;
  };
  interaction.return = () => {
    calls.back++;
  };
  interaction.scale = (value) => {
    calls.scales.push(value);
    particles.targetScale = value;
  };
  interaction.endScale = () => {
    calls.ended++;
  };
  interaction.next = (direction) => {
    calls.next.push(direction);
  };
  try {
    run(calls);
  } finally {
    Object.assign(interaction, original);
    reset();
  }
};

test("three fingers show information while V returns, with one action per hold", () => {
  withActions((calls) => {
    store.set({ mode: "PLANET_FOCUS", selected: "earth" });
    interaction.machine.state = "PLANET_FOCUS";
    for (const time of [1000, 1100, 1200])
      gestures.update({ hands: [hand("THREE")], time });
    assert.equal(calls.info, 0);
    for (const time of [1300, 1400, 1500])
      gestures.update({ hands: [hand("THREE")], time });
    assert.equal(calls.info, 1);
    for (const time of [1600, 1700, 1800, 1900, 2000])
      gestures.update({ hands: [hand("V_SIGN")], time });
    assert.equal(calls.back, 1);
  });
});

test("single fists and open palms no longer collapse, return or enter the Sun", () => {
  withActions((calls) => {
    for (const [gesture, start] of [
      ["FIST", 1000],
      ["OPEN_PALM", 1700],
    ] as const)
      for (let i = 0; i < 10; i++)
        gestures.update({ hands: [hand(gesture)], time: start + i * 50 });
    assert.equal(calls.collapse, 0);
    assert.equal(calls.enter, 0);
    assert.equal(calls.back, 0);
  });
});

test("two open hands at a fixed separation do not zoom or enter the Sun", () => {
  withActions((calls) => {
    for (let i = 0; i < 20; i++)
      gestures.update({ hands: pair("OPEN_PALM", 0.6), time: 1000 + i * 50 });
    assert.deepEqual(calls.scales, []);
    assert.equal(calls.enter, 0);
    assert.equal(calls.collapse, 0);
  });
});

test("dual pinches zoom relative to their captured size and releasing either hand stops scaling", () => {
  withActions((calls) => {
    for (const [time, distance] of [
      [1000, 0.4],
      [1050, 0.4],
      [1100, 0.6],
      [1150, 0.2],
    ])
      gestures.update({ hands: pair("PINCH", distance), time });
    assert.deepEqual(
      calls.scales.map((value) => Math.round(value * 100)),
      [150, 50],
    );
    gestures.update({
      hands: [hand("PINCH", 0.4), hand("OPEN_PALM", 0.6)],
      time: 1200,
    });
    assert.equal(calls.ended, 1);
    assert.equal(calls.scales.length, 2);
    assert.equal(calls.collapse, 0);
    assert.equal(calls.enter, 0);
  });
});

test("removing one hand after dual pinch requires release before selecting a planet", () => {
  withSelections((selected) => {
    store.set({ hover: "earth" });
    for (const time of [1000, 1050, 1100])
      gestures.update({ hands: pair("PINCH", 0.4), time });
    for (const time of [1150, 1200, 1300])
      gestures.update({ hands: [hand("PINCH")], time });
    assert.deepEqual(selected, []);
    gestures.update({ hands: [hand("POINT")], time: 1400 });
    store.set({ hover: "earth" });
    gestures.update({ hands: [hand("PINCH")], time: 1450 });
    gestures.update({ hands: [hand("PINCH")], time: 1550 });
    assert.deepEqual(selected, ["earth"]);
  });
});

test("shrinking with dual pinches and releasing nearby never turns into collapse", () => {
  withActions((calls) => {
    for (let i = 0; i < 12; i++)
      gestures.update({
        hands: pair("PINCH", Math.max(0.1, 0.4 - i * 0.05)),
        time: 1000 + i * 50,
      });
    for (let i = 0; i < 15; i++)
      gestures.update({ hands: pair("OPEN_PALM", 0.1), time: 1600 + i * 50 });
    assert.equal(calls.collapse, 0);
    assert.equal(calls.enter, 0);
  });
});

test("holding both hands together collapses once; one near frame cannot collapse", () => {
  withActions((calls) => {
    for (const [time, distance] of [
      [1000, 0.4],
      [1050, 0.3],
      [1100, 0.2],
      [1150, 0.14],
    ])
      gestures.update({ hands: pair("OPEN_PALM", distance), time });
    assert.equal(calls.collapse, 0);
    for (let i = 0; i < 15; i++)
      gestures.update({ hands: pair("OPEN_PALM", 0.14), time: 1200 + i * 50 });
    assert.equal(calls.collapse, 1);
    assert.equal(store.get().gesture, "TWO_HAND_COLLAPSE");
  });
});

test("quickly spreading two open hands enters the Sun from the solar system", () => {
  withActions((calls) => {
    for (const [time, distance] of [
      [1000, 0.2],
      [1050, 0.28],
      [1100, 0.4],
    ])
      gestures.update({ hands: pair("OPEN_PALM", distance), time });
    assert.equal(calls.enter, 1);
    assert.equal(store.get().gesture, "TWO_HAND_EXPAND");
    assert.equal(calls.collapse, 0);
  });
});

test("collapse keeps paired motion history so immediately spreading both palms enters the Sun", () => {
  withActions((calls) => {
    for (let i = 0; i < 9; i++)
      gestures.update({ hands: pair("OPEN_PALM", 0.14), time: 1000 + i * 50 });
    assert.equal(calls.collapse, 1);
    gestures.update({ hands: pair("OPEN_PALM", 0.24), time: 1450 });
    gestures.update({ hands: pair("OPEN_PALM", 0.4), time: 1500 });
    assert.equal(calls.enter, 1);
  });
});

test("slow separation, moving only one hand, and closed-hand spreading do not enter the Sun", () => {
  withActions((calls) => {
    for (let i = 0; i < 20; i++)
      gestures.update({
        hands: pair("OPEN_PALM", 0.2 + i * 0.01),
        time: 1000 + i * 50,
      });
    assert.equal(calls.enter, 0);
    gestures.reset();
    for (const [time, x] of [
      [3000, 0.5],
      [3050, 0.6],
      [3100, 0.7],
    ])
      gestures.update({
        hands: [hand("OPEN_PALM", 0.3), hand("OPEN_PALM", x)],
        time,
      });
    assert.equal(calls.enter, 0);
    gestures.reset();
    for (const [time, distance] of [
      [4000, 0.2],
      [4050, 0.28],
      [4100, 0.4],
    ])
      gestures.update({ hands: pair("FIST", distance), time });
    assert.equal(calls.enter, 0);
  });
});

test("one uncertain hand discards motion history before a later wide separation", () => {
  withActions((calls) => {
    gestures.update({ hands: pair("OPEN_PALM", 0.2), time: 1000 });
    const uncertain = pair("OPEN_PALM", 0.3);
    uncertain[1].confidence = 0.3;
    gestures.update({ hands: uncertain, time: 1050 });
    gestures.update({ hands: pair("OPEN_PALM", 0.5), time: 1100 });
    gestures.update({ hands: pair("OPEN_PALM", 0.6), time: 1150 });
    assert.equal(calls.enter, 0);
  });
});

test("brief occlusion, one remaining hand, and dropped frames cannot manufacture an opening", () => {
  withActions((calls) => {
    for (const missing of [[], [hand("OPEN_PALM")]]) {
      gestures.reset();
      gestures.update({ hands: pair("OPEN_PALM", 0.2), time: 1000 });
      gestures.update({ hands: missing, time: 1050 });
      gestures.update({ hands: pair("OPEN_PALM", 0.5), time: 1100 });
      gestures.update({ hands: pair("OPEN_PALM", 0.6), time: 1150 });
      assert.equal(calls.enter, 0);
    }
    gestures.reset();
    gestures.update({ hands: pair("OPEN_PALM", 0.2), time: 2000 });
    gestures.update({ hands: pair("OPEN_PALM", 0.4), time: 2400 });
    gestures.update({ hands: pair("OPEN_PALM", 0.5), time: 2450 });
    assert.equal(calls.enter, 0);
  });
});

test("hand detection ordering changes do not affect a two-hand opening", () => {
  withActions((calls) => {
    gestures.update({ hands: pair("OPEN_PALM", 0.2), time: 1000 });
    gestures.update({ hands: pair("OPEN_PALM", 0.28).reverse(), time: 1050 });
    gestures.update({ hands: pair("OPEN_PALM", 0.4), time: 1100 });
    assert.equal(calls.enter, 1);
  });
});

test("inside the Sun, three fingers and pinches are inert; V returns and joined hands collapse", () => {
  withActions((calls) => {
    store.set({ mode: "SUN_INTERIOR" });
    interaction.machine.state = "SUN_INTERIOR";
    for (const [gesture, start] of [
      ["THREE", 1000],
      ["PINCH", 1700],
    ] as const)
      for (let i = 0; i < 10; i++)
        gestures.update({ hands: [hand(gesture)], time: start + i * 50 });
    assert.equal(calls.info, 0);
    for (let i = 0; i < 8; i++)
      gestures.update({ hands: [hand("V_SIGN")], time: 2300 + i * 50 });
    assert.equal(calls.back, 1);
    for (const [time, distance] of [
      [3000, 0.2],
      [3050, 0.28],
      [3100, 0.4],
    ])
      gestures.update({ hands: pair("OPEN_PALM", distance), time });
    assert.equal(calls.enter, 0);
    for (let i = 0; i < 10; i++)
      gestures.update({ hands: pair("OPEN_PALM", 0.14), time: 3150 + i * 50 });
    assert.equal(calls.collapse, 1);
  });
});

test("horizontal swipes still switch planets and do not accidentally trigger V return", () => {
  withActions((calls) => {
    store.set({ mode: "PLANET_FOCUS", selected: "earth" });
    interaction.machine.state = "PLANET_FOCUS";
    for (const [time, x] of [
      [1000, 0.2],
      [1050, 0.27],
      [1100, 0.36],
    ])
      gestures.update({
        hands: [{ ...hand("V_SIGN", x), velocity: { x: 0.9, y: 0.02 } }],
        time,
      });
    assert.deepEqual(calls.next, [1]);
    assert.equal(calls.back, 0);
  });
});
