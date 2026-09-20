import test from "node:test";
import assert from "node:assert/strict";
import { GestureController } from "../src/gesture/GestureController";
import { interaction } from "../src/interaction/InteractionController";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { gestureFeedback } from "../src/gesture/gestureFeedback";
import { gestureTargets } from "../src/gesture/gestureTargets";
import type { HandFeatures, Gesture } from "../src/gesture/GestureTypes";
import { rotation } from "../src/interaction/rotation";

const hand = (gesture: Gesture, x = 0.3, id = "left"): HandFeatures => ({
  id,
  center: { x, y: 0.5 },
  pointer: { x, y: 0.3 },
  pinchPoint: { x, y: 0.3 },
  velocity: { x: 0, y: 0 },
  scale: 0.2,
  openness: gesture === "FIST" ? 0 : 1,
  pinchDistance: gesture === "PINCH" || gesture === "FIST" ? 0.1 : 0.7,
  pinchStrength: gesture === "PINCH" ? 1 : 0,
  gesture,
  confidence: 0.95,
  landmarks: [],
  palmFacing: true,
  palmDirection: [0, 0, 1],
});
const pair = (gesture: Gesture, distance: number) => [
  hand(gesture, 0.5 - distance / 2),
  hand(gesture, 0.5 + distance / 2, "right"),
];
function scenario(
  run: (s: {
    send: (hands: HandFeatures[], dt?: number) => void;
    warm: (two?: boolean) => void;
    hold: (hands: HandFeatures[], duration: number) => void;
    calls: string[];
    controller: GestureController;
  }) => void,
) {
  const controller = new GestureController();
  const originalActivateUI = gestureTargets.activateUI;
  const originals = {
    selectBody: interaction.selectBody,
    next: interaction.next,
    return: interaction.return,
    collapse: interaction.collapse,
    rebirth: interaction.rebirth,
    scale: interaction.scale,
    endScale: interaction.endScale,
    isLocked: interaction.isLocked,
  };
  const calls: string[] = [];
  gestureTargets.activateUI = (id) => {
    calls.push(`ui:${id}`);
    return true;
  };
  interaction.selectBody = (id) => {
    calls.push(`select:${id}`);
    return true;
  };
  interaction.next = (direction) => {
    calls.push(`swipe:${direction}`);
    return true;
  };
  interaction.return = () => {
    calls.push("back");
    return true;
  };
  interaction.collapse = () => {
    calls.push("collapse");
    store.set({ mode: "COLLAPSE" });
    return true;
  };
  interaction.rebirth = () => {
    calls.push("rebirth");
    return true;
  };
  interaction.scale = (value) => {
    calls.push("zoom");
    particles.targetScale = Math.max(0.35, Math.min(1.75, value));
    return true;
  };
  interaction.endScale = () => true;
  interaction.isLocked = () =>
    store.get().transitioning || store.get().mode === "INTRO";
  store.set({
    mode: "SOLAR_SYSTEM",
    tracking: "online",
    transitioning: false,
    infoVisible: false,
    selected: null,
    hover: null,
  });
  Object.assign(particles, {
    targetScale: 1,
    scale: 1,
    targetRotation: 0,
    rotationVelocity: 0,
    dragging: false,
  });
  controller.reset();
  let time = 1000;
  const send = (hands: HandFeatures[], dt = 50) => {
    time += dt;
    controller.update({ hands, time });
    // Routing assertions use an ideal renderer; damping is tested separately.
    particles.scale = particles.targetScale;
  };
  const hold = (hands: HandFeatures[], duration: number) => {
    for (let n = 0; n <= duration; n += 50) send(hands);
  };
  const warm = (two = false) =>
    hold(two ? pair("OPEN_PALM", 0.6) : [hand("OPEN_PALM")], 300);
  try {
    run({ send, hold, warm, calls, controller });
  } finally {
    controller.reset();
    Object.assign(interaction, originals);
    gestureTargets.activateUI = originalActivateUI;
    gestureTargets.set(null);
  }
}

test("moving a pointing finger never selects, swipes, returns, rotates or zooms", () =>
  scenario(({ warm, send, calls }) => {
    warm();
    store.set({ mode: "PLANET_FOCUS", selected: "earth" });
    for (let i = 0; i < 20; i++) {
      const h = hand("POINT", 0.15 + i * 0.03);
      h.velocity.x = 2;
      send([h]);
    }
    assert.deepEqual(calls, []);
    assert.equal(particles.targetRotation, 0);
    assert.equal(particles.targetScale, 1);
  }));
for (const target of ["earth", "sun"] as const)
  test(`point and one stable pinch selects ${target} exactly once`, () =>
    scenario(({ warm, send, hold, calls }) => {
      warm();
      gestureTargets.set({ kind: "body", id: target, label: target });
      send([hand("POINT")]);
      hold([hand("PINCH")], 1000);
      assert.deepEqual(calls, [`select:${target}`]);
      send([hand("POINT")]);
      hold([hand("PINCH")], 200);
      assert.deepEqual(calls, [`select:${target}`, `select:${target}`]);
    }));
test("a brief accidental pinch cannot select", () =>
  scenario(({ warm, send, calls }) => {
    warm();
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    send([hand("POINT")]);
    send([hand("PINCH")]);
    send([hand("POINT")]);
    assert.deepEqual(calls, []);
  }));
test("pinch captures the original target instead of jumping to a neighbour mid-hold", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    send([hand("POINT")]);
    send([hand("PINCH")]);
    gestureTargets.set({ kind: "body", id: "mars", label: "火星" });
    hold([hand("PINCH")], 200);
    assert.deepEqual(calls, ["select:earth"]);
  }));
test("an empty-space pinch dragged across a planet rotates instead of selecting", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    send([hand("POINT")]);
    hold([hand("PINCH")], 200);
    gestureTargets.set({ kind: "body", id: "mars", label: "火星" });
    for (let i = 1; i < 8; i++) send([hand("PINCH", 0.3 + i * 0.025)]);
    assert.deepEqual(calls, []);
    assert.ok(particles.targetRotation > 0);
    assert.equal(gestureFeedback.get().action, "PINCH_DRAG");
    send([hand("OPEN_PALM", 0.5)]);
    const before = particles.targetRotation;
    rotation.update(0.05);
    assert.ok(particles.targetRotation > before);
    assert.ok(particles.rotationVelocity > 0);
    assert.ok(particles.rotationVelocity <= 2.4);
  }));
test("pointing away to empty space clears a recent body target before pinching", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    send([hand("POINT")]);
    gestureTargets.set(null);
    send([hand("POINT", 0.8)]);
    hold([hand("PINCH", 0.8)], 250);
    assert.deepEqual(calls, []);
  }));
test("a held pinch that first appears in the camera must release after the re-entry delay", () =>
  scenario(({ send, hold, calls }) => {
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    hold([hand("PINCH")], 500);
    assert.deepEqual(calls, []);
    assert.equal(gestureFeedback.get().needsRelease, true);
    send([hand("POINT")]);
    hold([hand("PINCH")], 200);
    assert.deepEqual(calls, ["select:earth"]);
  }));
test("re-entry blocks fist, swipe, zoom and effects as well as clicks", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    send([]);
    store.set({ mode: "PLANET_FOCUS", selected: "earth" });
    hold([hand("FIST")], 200);
    assert.deepEqual(calls, []);
    assert.equal(gestureFeedback.get().readiness, "RECONNECTING");
    send([]);
    hold(pair("PINCH", 0.2), 200);
    assert.deepEqual(calls, []);
  }));
test("all actions are locked throughout a scene transition; held pinches do not fire on unlock", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    store.set({ transitioning: true });
    hold([hand("PINCH")], 300);
    hold([hand("FIST")], 650);
    hold(pair("OPEN_PALM", 0.18), 1100);
    assert.deepEqual(calls, []);
    hold([hand("PINCH")], 350);
    store.set({ transitioning: false });
    hold([hand("PINCH")], 400);
    assert.deepEqual(calls, []);
    send([hand("POINT")]);
    hold([hand("PINCH")], 200);
    assert.deepEqual(calls, ["select:earth"]);
  }));
for (const mode of ["SUN_INTERIOR", "COLLAPSE"] as const)
  test(`one pinch can confirm a HUD target in ${mode} without enabling body selection`, () =>
    scenario(({ warm, send, hold, calls }) => {
      warm();
      store.set({ mode });
      gestureTargets.set({ kind: "ui", id: "show-help", label: "操作指南" });
      send([hand("POINT")]);
      hold([hand("PINCH")], 1000);
      assert.deepEqual(calls, ["ui:show-help"]);
      gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
      send([hand("POINT")]);
      hold([hand("PINCH")], 200);
      assert.deepEqual(calls, ["ui:show-help"]);
    }));
test("HUD pinch confirmation stays locked through transitions and requires release on unlock", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    store.set({ mode: "SUN_INTERIOR", transitioning: true });
    gestureTargets.set({
      kind: "ui",
      id: "back-from-sun",
      label: "返回太阳系",
    });
    hold([hand("PINCH")], 350);
    assert.deepEqual(calls, []);
    store.set({ transitioning: false });
    hold([hand("PINCH")], 400);
    assert.deepEqual(calls, []);
    send([hand("POINT")]);
    hold([hand("PINCH")], 200);
    assert.deepEqual(calls, ["ui:back-from-sun"]);
  }));
const vHand = (degrees = 0, x = 0.3, id = "left") => ({
  ...hand("V_GESTURE", x, id),
  palmRoll: (degrees * Math.PI) / 180,
  palmRollValid: true,
  vConfidence: 0.95,
  trackingConfidence: 1,
});
test("two-hand pinches no longer zoom or select", () =>
  scenario(({ warm, hold, calls }) => {
    warm(true);
    hold(pair("PINCH", 0.4), 300);
    hold(pair("PINCH", 0.8), 300);
    assert.equal(particles.targetScale, 1);
    assert.deepEqual(calls, []);
  }));
test("legacy five-finger opening and closing never starts a zoom", () =>
  scenario(({ warm, hold, calls }) => {
    warm();
    for (const aperture of [0.04, 0.4, 0.8, 0.04])
      hold(
        [
          {
            ...hand("FIVE_PINCH"),
            gripAperture: aperture,
            gripConfidence: 0.95,
          },
        ],
        350,
      );
    hold([hand("OPEN_PALM")], 700);
    assert.equal(particles.targetScale, 1);
    assert.deepEqual(calls, []);
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
  }));
test("stationary V arms once, right turns enlarge, left turns shrink and release freezes size", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    hold([vHand()], 200);
    assert.equal(gestureFeedback.get().zoomMode, "V_DETECTED");
    assert.deepEqual(calls, []);
    send([vHand()]);
    assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ARMED");
    hold([vHand()], 500);
    assert.equal(particles.targetScale, 1);
    const base = gestureFeedback.get().zoomBaseAngle;
    hold([vHand(30)], 350);
    assert.ok(particles.targetScale > 1.04);
    const enlarged = particles.targetScale;
    hold([vHand(-30)], 600);
    assert.ok(particles.targetScale < enlarged);
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    send([hand("OPEN_PALM")]);
    const stopped = particles.targetScale;
    assert.equal(gestureFeedback.get().zoomSpeed, 0);
    hold([hand("OPEN_PALM")], 500);
    assert.equal(particles.targetScale, stopped);
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
    assert.ok(calls.every((call) => call === "zoom"));
  }));
test("V candidate and active dial suppress target selection, drag and fast swipe movement", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    store.set({ mode: "PLANET_FOCUS", selected: "earth" });
    gestureTargets.set({ kind: "body", id: "mars", label: "火星" });
    for (let i = 0; i < 30; i++) {
      const h = vHand(0, 0.2 + (i % 7) * 0.08);
      h.velocity.x = 5;
      h.pinchDistance = 0.05;
      send([h]);
    }
    assert.equal(particles.targetScale, 1);
    assert.equal(particles.targetRotation, 0);
    assert.equal(gestureFeedback.get().action, "V_ZOOM");
    assert.equal(gestureFeedback.get().target, null);
    assert.ok(calls.every((call) => call === "zoom"));
    // A held PINCH cannot inherit a target when the dial releases.
    hold([hand("PINCH")], 600);
    assert.ok(calls.every((call) => call === "zoom"));
    send([hand("POINT")]);
    gestureTargets.set({ kind: "body", id: "mars", label: "火星" });
    hold([hand("PINCH")], 200);
    assert.equal(
      calls.filter((call: string) => call === "select:mars").length,
      1,
    );
  }));
test("an owned V is retained when a second hand enters, reorders or tries a fist/pinch", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    store.set({ mode: "PLANET_FOCUS", selected: "earth" });
    hold([vHand()], 350);
    const base = gestureFeedback.get().zoomBaseAngle;
    hold([hand("FIST", 0.7, "right"), vHand(25)], 750);
    assert.equal(gestureFeedback.get().readiness, "READY");
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    send([vHand(25), hand("PINCH", 0.7, "right")]);
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    assert.ok(particles.targetScale > 1);
    assert.ok(calls.every((call) => call === "zoom"));
  }));
test("one or two missing frames freeze the dial without recapturing its baseline", () =>
  scenario(({ warm, send, hold }) => {
    warm();
    hold([vHand()], 350);
    hold([vHand(30)], 200);
    const before = particles.targetScale;
    const base = gestureFeedback.get().zoomBaseAngle;
    send([]);
    send([]);
    assert.equal(gestureFeedback.get().zoomSpeed, 0);
    assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ACTIVE");
    assert.equal(particles.targetScale, before);
    send([vHand(30)]);
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    assert.equal(gestureFeedback.get().readiness, "READY");
    assert.equal(particles.targetScale, before);
    send([vHand(30)]);
    assert.ok(particles.targetScale > before);
    hold([], 250);
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
    assert.equal(gestureFeedback.get().zoomSpeed, 0);
  }));
test("missing V owner pauses while the second hand remains, then resumes the same base", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    hold([vHand()], 350);
    hold([vHand(30), hand("OPEN_PALM", 0.7, "right")], 200);
    const before = particles.targetScale;
    const base = gestureFeedback.get().zoomBaseAngle;
    send([hand("OPEN_PALM", 0.7, "right")]);
    send([hand("FIST", 0.7, "right")]);
    assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ACTIVE");
    assert.equal(gestureFeedback.get().zoomSpeed, 0);
    assert.equal(particles.targetScale, before);
    send([vHand(30), hand("OPEN_PALM", 0.7, "right")]);
    assert.equal(gestureFeedback.get().zoomBaseAngle, base);
    assert.equal(particles.targetScale, before);
    send([vHand(30)]);
    assert.ok(particles.targetScale > before);
    assert.ok(calls.every((call) => call === "zoom"));
  }));
test("stopping a moving dial trims render catch-up without changing the rendered scale", () =>
  scenario(({ warm, send, hold }) => {
    warm();
    hold([vHand()], 350);
    hold([vHand(40)], 400);
    const target = particles.targetScale;
    // Emulate a renderer that trails the target during continuous input.
    const rendered = target - 0.12;
    particles.scale = rendered;
    send([hand("OPEN_PALM")]);
    assert.ok(particles.targetScale <= rendered + 0.010001);
    assert.ok(particles.targetScale >= rendered);
    assert.equal(gestureFeedback.get().zoomSpeed, 0);
  }));
test("uncertain V confidence or a side-on palm cannot arm or produce a swipe", () =>
  scenario(({ warm, hold, calls }) => {
    warm();
    store.set({ mode: "PLANET_FOCUS", selected: "earth" });
    hold([{ ...vHand(35), vConfidence: 0.3, velocity: { x: 4, y: 0 } }], 800);
    hold([{ ...vHand(35), palmRollValid: false }], 800);
    assert.deepEqual(calls, []);
    assert.equal(particles.targetScale, 1);
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
  }));
for (const mode of ["SUN_INTERIOR", "COLLAPSE"] as const)
  test(`V cannot zoom in ${mode}`, () =>
    scenario(({ warm, hold, calls }) => {
      warm();
      store.set({ mode });
      hold([vHand()], 350);
      hold([vHand(40)], 500);
      assert.deepEqual(calls, []);
      assert.equal(particles.targetScale, 1);
    }));
test("a transition cancels an active dial and fresh V must hold again after unlock", () =>
  scenario(({ warm, send, hold }) => {
    warm();
    hold([vHand()], 350);
    hold([vHand(30)], 200);
    const before = particles.targetScale;
    store.set({ transitioning: true });
    hold([vHand(40)], 700);
    assert.equal(gestureFeedback.get().zoomMode, "IDLE");
    assert.equal(particles.targetScale, before);
    store.set({ transitioning: false });
    hold([vHand(40)], 200);
    assert.equal(gestureFeedback.get().zoomMode, "V_DETECTED");
    send([vHand(40)]);
    assert.equal(gestureFeedback.get().zoomMode, "ZOOM_DIAL_ARMED");
    assert.equal(particles.targetScale, before);
  }));
test("reducing two held pinches to one cannot select a target", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm(true);
    hold(pair("PINCH", 0.4), 250);
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    hold([hand("PINCH")], 600);
    assert.equal(
      calls.some((c: string) => c.startsWith("select")),
      false,
    );
    send([hand("POINT")]);
    hold([hand("PINCH")], 200);
    assert.equal(calls.filter((c) => c.startsWith("select")).length, 1);
  }));
test("releasing two close pinches as palms does not collapse", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm(true);
    hold(pair("PINCH", 0.6), 200);
    for (let i = 0; i < 10; i++) send(pair("PINCH", 0.6 - i * 0.045));
    hold(pair("OPEN_PALM", 0.15), 1300);
    assert.equal(calls.includes("collapse"), false);
  }));
for (const mode of ["PLANET_FOCUS", "SUN_INTERIOR", "COLLAPSE"] as const)
  test(`a 600ms fist returns from ${mode}, but cancelling halfway does nothing`, () =>
    scenario(({ warm, send, hold, calls }) => {
      warm();
      store.set({ mode });
      hold([hand("FIST")], 300);
      assert.ok(gestureFeedback.get().fistProgress > 0);
      send([hand("OPEN_PALM")]);
      assert.equal(gestureFeedback.get().fistProgress, 0);
      assert.deepEqual(calls, []);
      hold([hand("FIST")], 650);
      assert.deepEqual(calls, ["back"]);
      hold([hand("FIST")], 1000);
      assert.deepEqual(calls, ["back"]);
    }));
test("legacy V and THREE poses do not navigate", () =>
  scenario(({ warm, hold, calls }) => {
    warm();
    store.set({ mode: "PLANET_FOCUS" });
    hold([hand("V_SIGN")], 800);
    hold([hand("THREE")], 800);
    assert.deepEqual(calls, []);
  }));
for (const direction of [-1, 1])
  test(`open-hand flick ${direction} switches only a focused planet with the requested direction`, () =>
    scenario(({ warm, send, hold, calls }) => {
      warm();
      const flick = () => {
        for (let i = 0; i < 5; i++) {
          const h = hand("OPEN_PALM", 0.5 + direction * i * 0.05);
          h.velocity.x = direction * 1.2;
          send([h]);
        }
      };
      flick();
      assert.deepEqual(calls, []);
      store.set({ mode: "PLANET_FOCUS", selected: "earth" });
      hold([hand("OPEN_PALM", 0.5)], 300);
      flick();
      assert.deepEqual(calls, [`swipe:${-direction}`]);
      flick();
      assert.equal(calls.length, 1);
    }));
test("open palms must deliberately approach for a second to collapse, then spread to rebirth", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm(true);
    hold(pair("OPEN_PALM", 0.6), 300);
    assert.deepEqual(calls, []);
    for (let i = 1; i <= 26; i++) send(pair("OPEN_PALM", 0.6 - i * 0.016));
    assert.deepEqual(calls, ["collapse"]);
    hold(pair("OPEN_PALM", 0.18), 1100);
    for (let i = 1; i <= 10; i++) send(pair("OPEN_PALM", 0.18 + i * 0.03));
    assert.deepEqual(calls, ["collapse", "rebirth"]);
  }));
test("static near palms, fast closure, and outward palms in overview never trigger navigation", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm(true);
    send(pair("OPEN_PALM", 0.16));
    hold(pair("OPEN_PALM", 0.16), 1500);
    for (let i = 1; i < 8; i++) send(pair("OPEN_PALM", 0.16 + i * 0.08));
    assert.deepEqual(calls, []);
  }));
test("low confidence interrupts a pinch and requires a fresh stable release", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    send([hand("POINT")]);
    send([hand("PINCH")]);
    send([{ ...hand("PINCH"), confidence: 0.3 }]);
    hold([hand("PINCH")], 500);
    assert.deepEqual(calls, []);
    send([hand("POINT")]);
    hold([hand("PINCH")], 200);
    assert.deepEqual(calls, ["select:earth"]);
  }));
test("a long frame gap is treated as reconnecting and cannot generate a swipe", () =>
  scenario(({ warm, send, calls }) => {
    warm();
    store.set({ mode: "PLANET_FOCUS" });
    send([hand("OPEN_PALM", 0.2)]);
    const h = hand("OPEN_PALM", 0.8);
    h.velocity.x = 5;
    send([h], 500);
    assert.deepEqual(calls, []);
    assert.equal(gestureFeedback.get().readiness, "RECONNECTING");
  }));

test("uncertain palm pose pauses collapse while valid tracking stays ready", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm(true);
    for (let i = 0; i < 12; i++) {
      const hands = pair("OPEN_PALM", 0.6 - i * 0.016);
      hands.forEach((h) => {
        h.trackingConfidence = 1;
      });
      send(hands);
    }
    const before = gestureFeedback.get().specialProgress;
    const weak = pair("OPEN_PALM", 0.42);
    weak[0].gesture = "NONE";
    weak[0].confidence = 0.4;
    weak.forEach((h) => {
      h.trackingConfidence = 1;
    });
    hold(weak, 100);
    assert.equal(gestureFeedback.get().readiness, "READY");
    assert.equal(gestureFeedback.get().specialStage, "PAUSED");
    assert.equal(gestureFeedback.get().specialProgress, before);
    assert.equal(calls.includes("collapse"), false);
    hold(pair("OPEN_PALM", 0.32), 950);
    assert.deepEqual(calls, ["collapse"]);
  }));

test("valid tracking never turns an uncertain pinch or fist into an action", () =>
  scenario(({ warm, send, hold, calls }) => {
    warm();
    gestureTargets.set({ kind: "body", id: "earth", label: "地球" });
    send([hand("POINT")]);
    const weak = { ...hand("PINCH"), trackingConfidence: 1, confidence: 0.3 };
    hold([weak], 500);
    assert.equal(gestureFeedback.get().readiness, "READY");
    assert.deepEqual(calls, []);
    store.set({ mode: "PLANET_FOCUS", selected: "earth" });
    hold([{ ...hand("FIST"), trackingConfidence: 1, confidence: 0.3 }], 800);
    assert.deepEqual(calls, []);
  }));
