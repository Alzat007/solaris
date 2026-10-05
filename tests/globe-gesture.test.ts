import test from "node:test";
import assert from "node:assert/strict";
import {
  GlobeGestureBridge,
  type GlobeGestureActions,
} from "../src/globeLab/GlobeGestureBridge";
import type { Gesture, HandFeatures } from "../src/gesture/GestureTypes";
import { gestureConfig as config } from "../src/gesture/gestureConfig";

const hand = (
  gesture: Gesture = "OPEN_PALM",
  patch: Partial<HandFeatures> = {},
): HandFeatures => ({
  id: "hand-a",
  handedness: "Right",
  gesture,
  confidence: 0.9,
  trackingConfidence: 1,
  vConfidence: 0.9,
  palmRoll: 0,
  palmRollValid: true,
  center: { x: 0.5, y: 0.5 },
  pointer: { x: 0.5, y: 0.4 },
  velocity: { x: 0, y: 0 },
  scale: 0.2,
  openness: 0.5,
  pinchDistance: gesture === "PINCH" ? 0.15 : 0.8,
  pinchStrength: gesture === "PINCH" ? 1 : 0,
  landmarks: [],
  palmFacing: true,
  palmDirection: [0, 0, 1],
  ...patch,
});
type Call =
  | ["begin" | "drag" | "zoom", number, number, number?]
  | ["end" | "cancel"];

function setup(
  ui: Partial<
    Pick<
      GlobeGestureActions,
      "pointerHover" | "activateAt" | "isNavigationBlocked"
    >
  > = {},
) {
  const calls: Call[] = [];
  const bridge = new GlobeGestureBridge({
    beginDrag: (x, y) => calls.push(["begin", x, y]),
    dragTo: (x, y) => calls.push(["drag", x, y]),
    endDrag: () => calls.push(["end"]),
    zoom: (amount, x, y) => calls.push(["zoom", amount, x, y]),
    cancelFlight: () => calls.push(["cancel"]),
    ...ui,
  });
  let time = 0;
  const send = (hands: HandFeatures[], dt = 50) => {
    time += dt;
    bridge.update({ hands, time });
  };
  const pose = (gesture: Gesture, patch: Partial<HandFeatures> = {}) =>
    send([hand(gesture, patch)]);
  const hold = (
    gesture: Gesture,
    frames: number,
    patch: Partial<HandFeatures> = {},
  ) => {
    for (let i = 0; i < frames; i++) pose(gesture, patch);
  };
  const ready = () => hold("OPEN_PALM", 6);
  const grab = () => {
    hold("PINCH", 4);
    pose("PINCH", { pointer: { x: 0.6, y: 0.3 } });
  };
  const zoom = () => {
    hold("V_GESTURE", 7);
    hold("V_GESTURE", 5, { palmRoll: Math.PI / 4 });
  };
  return { bridge, calls, send, pose, hold, ready, grab, zoom };
}

test("a released, confirmed pinch drives two-axis drag and stops on release", () => {
  const s = setup();
  s.ready();
  s.grab();
  s.pose("PINCH", { pointer: { x: 0.65, y: 0.35 } });
  s.pose("OPEN_PALM");
  assert.deepEqual(s.calls, [
    ["begin", 0.6, 0.3],
    ["drag", 0.65, 0.35],
    ["end"],
  ]);
});

test("reentry requires both the existing readiness delay and a released pose", () => {
  const s = setup();
  s.hold("PINCH", 20, { pointer: { x: 0.8, y: 0.2 } });
  assert.equal(s.calls.length, 0);
  s.pose("OPEN_PALM");
  s.grab();
  assert.equal(s.calls[0]?.[0], "begin");

  const fresh = setup();
  fresh.pose("OPEN_PALM");
  fresh.hold("PINCH", 3, { pointer: { x: 0.8, y: 0.2 } });
  assert.equal(fresh.calls.length, 0);
});

test("pinch drag retains its hand identity across detection ordering changes", () => {
  const s = setup();
  s.ready();
  s.grab();
  const owner = hand("PINCH", { pointer: { x: 0.63, y: 0.34 } });
  const other = hand("V_GESTURE", {
    id: "hand-b",
    pointer: { x: 0.9, y: 0.9 },
  });
  s.send([other, owner]);
  assert.deepEqual(s.calls.at(-1), ["drag", 0.63, 0.34]);
  assert.equal(s.calls.filter((call) => call[0] === "zoom").length, 0);
});

test("lost or uncertain drag input freezes immediately and cannot inherit movement", () => {
  for (const loss of [[], [hand("PINCH", { confidence: 0.2 })]]) {
    const s = setup();
    s.ready();
    s.grab();
    s.send(loss);
    assert.deepEqual(s.calls.at(-1), ["end"]);
    const count = s.calls.length;
    s.hold("PINCH", 12, { pointer: { x: 0.95, y: 0.95 } });
    assert.equal(s.calls.length, count);
    s.pose("OPEN_PALM");
    s.grab();
    assert.deepEqual(s.calls.at(-1), ["begin", 0.6, 0.3]);
  }
});

test("V dial produces signed camera increments without the old scene-scale cap", () => {
  const s = setup();
  s.ready();
  s.hold("V_GESTURE", 8);
  assert.equal(s.calls.length, 0);
  s.hold("V_GESTURE", 100, { palmRoll: Math.PI / 4 });
  const inward = s.calls.filter((call) => call[0] === "zoom");
  assert.ok(inward.length > 90);
  assert.ok(inward.reduce((sum, call) => sum + (call[1] ?? 0), 0) > 1.75);
  assert.ok(
    inward.every(
      (call) => call[1]! > 0 && call[1]! <= config.V_ZOOM_MAX_SPEED * 0.05,
    ),
  );
  assert.ok(inward.every((call) => call[2] === 0.5 && call[3] === 0.4));
  const count = s.calls.length;
  s.hold("V_GESTURE", 30, { palmRoll: -Math.PI / 4 });
  assert.ok(
    s.calls.slice(count).some((call) => call[0] === "zoom" && call[1]! < 0),
  );
  assert.equal(
    s.calls.filter((call) => call[0] === "begin" || call[0] === "cancel")
      .length,
    0,
  );
});

test("V hand loss has no output and its recovery frame never replays lost motion", () => {
  const s = setup();
  s.ready();
  s.zoom();
  const count = s.calls.length;
  s.send([]);
  assert.equal(s.calls.length, count);
  s.pose("V_GESTURE", { palmRoll: Math.PI / 4 });
  assert.equal(s.calls.length, count);
  s.pose("V_GESTURE", { palmRoll: Math.PI / 4 });
  assert.equal(s.calls.length, count + 1);
  assert.ok(s.calls.at(-1)![1]! <= config.V_ZOOM_MAX_SPEED * 0.05);
});

test("another visible hand cannot take over a missing V owner", () => {
  const s = setup();
  s.ready();
  s.zoom();
  const count = s.calls.length;
  for (let i = 0; i < 12; i++) {
    s.send([hand("V_GESTURE", { id: "hand-b", palmRoll: Math.PI / 2 })]);
  }
  assert.equal(s.calls.length, count);
});

test("a deliberate fist cancels only once until released, and zoom owns arbitration", () => {
  const s = setup();
  s.ready();
  s.hold("FIST", 35);
  assert.deepEqual(s.calls, [["cancel"]]);
  s.pose("OPEN_PALM");
  s.hold("FIST", 13);
  assert.deepEqual(s.calls, [["cancel"], ["cancel"]]);

  const zoom = setup();
  zoom.ready();
  zoom.zoom();
  zoom.hold("FIST", 30);
  assert.equal(zoom.calls.filter((call) => call[0] === "cancel").length, 0);
});

test("clock gaps, invalid coordinates and reset end drag without later stale actions", () => {
  for (const fault of ["gap", "nan", "reset"] as const) {
    const s = setup();
    s.ready();
    s.grab();
    if (fault === "gap") s.send([hand("PINCH")], config.FRAME_GAP_RESET + 1);
    if (fault === "nan") s.pose("PINCH", { pointer: { x: NaN, y: 0.3 } });
    if (fault === "reset") s.bridge.reset();
    assert.deepEqual(s.calls.at(-1), ["end"]);
    s.bridge.reset();
    const count = s.calls.length;
    s.hold("PINCH", 10, { pointer: { x: 0.9, y: 0.9 } });
    assert.equal(s.calls.length, count);
  }
});

test("bridge coordinates remain normalized and no zero-time zoom is dispatched", () => {
  const s = setup();
  s.ready();
  s.grab();
  s.pose("PINCH", { pointer: { x: -2, y: 3 } });
  assert.deepEqual(s.calls.at(-1), ["drag", 0, 1]);
  s.pose("OPEN_PALM");
  s.zoom();
  const count = s.calls.length;
  s.send([hand("V_GESTURE", { palmRoll: Math.PI / 4 })], 0);
  assert.equal(s.calls.length, count);
});

test("hover only highlights and a confirmed short pinch activates its original point once on release", () => {
  const hovered: number[][] = [];
  const activated: number[][] = [];
  const s = setup({
    pointerHover: (x, y) => hovered.push([x, y]),
    activateAt: (x, y) => activated.push([x, y]),
  });
  s.ready();
  s.pose("POINT", { pointer: { x: 0.7, y: 0.3 } });
  assert.deepEqual(hovered.at(-1), [0.7, 0.3]);
  assert.deepEqual(activated, []);
  s.hold("PINCH", 4);
  assert.deepEqual(activated, []);
  s.pose("OPEN_PALM", { pointer: { x: 0.505, y: 0.405 } });
  assert.deepEqual(activated, [[0.5, 0.4]]);
  assert.deepEqual(s.calls, []);
  s.hold("OPEN_PALM", 6);
  assert.equal(activated.length, 1);
});

test("brief unconfirmed and long stationary pinches never activate", () => {
  for (const frames of [2, 16]) {
    const activated: number[][] = [];
    const s = setup({ activateAt: (x, y) => activated.push([x, y]) });
    s.ready();
    s.hold("PINCH", frames);
    s.pose("OPEN_PALM");
    assert.deepEqual(activated, []);
    assert.deepEqual(s.calls, []);
  }
});

test("dragging a confirmed pinch excludes activation even after returning to its origin", () => {
  const activated: number[][] = [];
  const s = setup({ activateAt: (x, y) => activated.push([x, y]) });
  s.ready();
  s.grab();
  s.pose("PINCH");
  s.pose("OPEN_PALM");
  assert.deepEqual(activated, []);
  assert.deepEqual(s.calls, [["begin", 0.6, 0.3], ["drag", 0.5, 0.4], ["end"]]);
});

test("movement before hold confirmation cannot become a click by returning to the start", () => {
  const activated: number[][] = [];
  const s = setup({ activateAt: (x, y) => activated.push([x, y]) });
  s.ready();
  s.pose("PINCH");
  s.pose("PINCH", { pointer: { x: 0.6, y: 0.3 } });
  s.hold("PINCH", 2);
  s.pose("OPEN_PALM");
  assert.deepEqual(activated, []);
  assert.deepEqual(s.calls, []);
});

test("loss, uncertainty, gaps and canceled poses never release-activate a pending pinch", () => {
  for (const fault of ["loss", "confidence", "gap", "reset", "pose"] as const) {
    const activated: number[][] = [];
    const s = setup({ activateAt: (x, y) => activated.push([x, y]) });
    s.ready();
    s.hold("PINCH", 4);
    if (fault === "loss") s.send([]);
    if (fault === "confidence") s.pose("PINCH", { confidence: 0.2 });
    if (fault === "gap")
      s.send([hand("OPEN_PALM")], config.FRAME_GAP_RESET + 1);
    if (fault === "reset") s.bridge.reset();
    if (fault === "pose") s.pose("FIST");
    s.hold("OPEN_PALM", 6);
    assert.deepEqual(activated, [], fault);
  }
});

test("a newly opened panel consumes the click and accepts only a fresh released fist", () => {
  let blocked = false;
  const activated: number[][] = [];
  const s = setup({
    activateAt: (x, y) => {
      activated.push([x, y]);
      blocked = true;
    },
    isNavigationBlocked: () => blocked,
  });
  s.ready();
  s.hold("PINCH", 4);
  s.pose("OPEN_PALM");
  assert.deepEqual(activated, [[0.5, 0.4]]);
  s.hold("FIST", 20);
  assert.deepEqual(s.calls, []);
  s.ready();
  s.hold("FIST", 20);
  assert.deepEqual(s.calls, [["cancel"]]);
  s.hold("FIST", 20);
  assert.deepEqual(s.calls, [["cancel"]]);
});

test("blocked navigation suppresses pinch, V zoom and hover without disabling fresh fist back", () => {
  let hovered = 0;
  let activated = 0;
  const s = setup({
    isNavigationBlocked: () => true,
    pointerHover: () => hovered++,
    activateAt: () => activated++,
  });
  s.ready();
  s.grab();
  s.pose("OPEN_PALM");
  s.zoom();
  s.ready();
  s.hold("FIST", 13);
  assert.deepEqual(s.calls, [["cancel"]]);
  assert.equal(hovered, 0);
  assert.equal(activated, 0);
});

test("opening during a grab ends it and closing requires release before navigation resumes", () => {
  let blocked = false;
  const s = setup({ isNavigationBlocked: () => blocked });
  s.ready();
  s.grab();
  blocked = true;
  s.pose("PINCH", { pointer: { x: 0.9, y: 0.9 } });
  assert.deepEqual(s.calls, [["begin", 0.6, 0.3], ["end"]]);
  s.hold("PINCH", 10, { pointer: { x: 0.2, y: 0.2 } });
  blocked = false;
  s.hold("PINCH", 10, { pointer: { x: 0.8, y: 0.8 } });
  assert.equal(s.calls.length, 2);
  s.ready();
  s.grab();
  assert.deepEqual(s.calls.at(-1), ["begin", 0.6, 0.3]);
});
