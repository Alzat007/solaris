import test from "node:test";
import assert from "node:assert/strict";
import type { Gesture, HandFeatures } from "../src/gesture/GestureTypes";
import {
  RemoteGestureSink,
  type RemoteGestureFeedback,
} from "../src/controller/RemoteGestureSink";
import {
  REMOTE_ACTIONS,
  validateActionPayload,
  type RemoteAction,
  type RemotePayload,
  type RemoteViewState,
} from "../src/remote/controlProtocol";

function hand(
  gesture: Gesture = "OPEN_PALM",
  patch: Partial<HandFeatures> = {},
): HandFeatures {
  return {
    id: "right",
    handedness: "Right",
    center: { x: 0.5, y: 0.5 },
    pointer: { x: 0.5, y: 0.5 },
    pointerVelocity: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    scale: 1,
    openness: 1,
    pinchDistance: gesture === "PINCH" ? 0.15 : 0.8,
    pinchStrength: gesture === "PINCH" ? 1 : 0,
    thumbSpread: 0.1,
    thumbReach: 1,
    thumbGeometryValid: true,
    pointConfidence: 0.9,
    vConfidence: 0.9,
    palmRoll: 0,
    palmRollValid: true,
    gesture,
    confidence: 0.95,
    trackingConfidence: 0.95,
    landmarks: [{ x: 0.5, y: 0.5, z: 0 }],
    palmFacing: true,
    palmDirection: [0, 0, 1],
    ...patch,
  };
}
function setup(
  accept: (
    action: RemoteAction,
    payload: RemotePayload | undefined,
    time: number,
  ) => boolean = () => true,
) {
  const calls: { action: RemoteAction; payload?: RemotePayload }[] = [];
  const delivered: typeof calls = [];
  const feedback: RemoteGestureFeedback[] = [];
  let time = 0;
  const view: RemoteViewState = {
    mode: "PLANET_OVERVIEW",
    selected: "mars",
    available: [...REMOTE_ACTIONS],
    focusTarget: { id: "body-mars", kind: "body", label: "Mars" },
  };
  const sink = new RemoteGestureSink({
    send: (action, payload) => {
      calls.push({ action, payload });
      const accepted = accept(action, payload, time);
      if (accepted) delivered.push({ action, payload });
      return accepted;
    },
    feedback: (value) => feedback.push(value),
  });
  sink.setContext(true, view);
  const send = (hands: HandFeatures[], dt = 66) => {
    time += dt;
    sink.update({ hands, time });
  };
  const pose = (
    gesture: Gesture,
    patch: Partial<HandFeatures> = {},
    count = 1,
  ) => {
    for (let i = 0; i < count; i++) send([hand(gesture, patch)]);
  };
  const ready = () => pose("OPEN_PALM", {}, 7);
  return {
    sink,
    calls,
    delivered,
    feedback,
    view,
    send,
    pose,
    ready,
    action: (action: RemoteAction) =>
      calls.filter((call) => call.action === action),
    sent: (action: RemoteAction) =>
      delivered.filter((call) => call.action === action),
  };
}

test("controller emits only normalized semantic payloads, never video or landmarks", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", { pointer: { x: 3, y: -2 } });
  assert.deepEqual(s.action("POINTER").at(-1)?.payload, { x: 1, y: 0 });
  for (const call of s.calls)
    assert.equal(validateActionPayload(call.action, call.payload), true);
  assert.doesNotMatch(
    JSON.stringify(s.calls),
    /landmarks|palmDirection|confidence|video|hands/,
  );
});

test("closed-thumb target hold then thumb-open confirms the original target only once", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  assert.equal(s.action("SELECT").length, 0);
  s.pose("POINT", { thumbSpread: 0.8 }, 8);
  assert.equal(s.action("SELECT").length, 1);
  assert.deepEqual(s.action("SELECT")[0].payload, {
    expectedTargetId: "body-mars",
  });
  s.pose("POINT", { thumbSpread: 0.8 }, 12);
  assert.equal(s.action("SELECT").length, 1);
});

test("slow closed-thumb travel releases a captured aim instead of freezing indefinitely", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  for (let step = 1; step <= 30; step++) {
    const x = 0.5 + step * 0.006;
    s.pose("POINT", {
      pointer: { x, y: 0.5 },
      pointerVelocity: { x: 0.006 / 0.066, y: 0 },
    });
  }
  assert.ok(Math.abs(s.sent("POINTER").at(-1)!.payload!.x! - 0.68) < 1e-10);
  assert.equal(s.action("SELECT").length, 0);
  assert.equal(s.feedback.at(-1)?.status, "point");
});

test("a moved aim cannot confirm stale feedback until a fresh closed-thumb hold", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  s.pose("POINT", { pointer: { x: 0.56, y: 0.5 } });
  s.pose("POINT", { pointer: { x: 0.56, y: 0.5 }, thumbSpread: 0.8 }, 5);
  assert.equal(s.action("SELECT").length, 0);
  // The TV only publishes changed targets; same-target feedback need not repeat.
  s.pose("POINT", { pointer: { x: 0.56, y: 0.5 } }, 16);
  s.pose("POINT", { pointer: { x: 0.56, y: 0.5 }, thumbSpread: 0.8 }, 5);
  assert.equal(s.action("SELECT").length, 1);
});

test("moving during acquisition also returns to live aim before a lock completes", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 3);
  for (let step = 1; step <= 20; step++)
    s.pose("POINT", {
      pointer: { x: 0.5, y: 0.5 + step * 0.006 },
      pointerVelocity: { x: 0, y: 0.006 / 0.066 },
    });
  assert.deepEqual(s.sent("POINTER").at(-1)?.payload, { x: 0.5, y: 0.62 });
  assert.equal(s.action("SELECT").length, 0);
});

test("reaim cannot capture stale feedback while transport rejects the new pointer", () => {
  let rejectPointer = false;
  const s = setup((action) => action !== "POINTER" || !rejectPointer);
  s.ready();
  s.pose("POINT", {}, 10);
  rejectPointer = true;
  s.pose("POINT", { pointer: { x: 0.65, y: 0.5 } }, 20);
  s.pose("POINT", { pointer: { x: 0.65, y: 0.5 }, thumbSpread: 0.8 }, 5);
  assert.equal(s.action("SELECT").length, 0);
  rejectPointer = false;
  s.pose("POINT", { pointer: { x: 0.65, y: 0.5 } }, 16);
  s.pose("POINT", { pointer: { x: 0.65, y: 0.5 }, thumbSpread: 0.8 }, 5);
  assert.equal(s.action("SELECT").length, 1);
});

test("reset clears a moving reaim without reviving the old captured position", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  s.pose("POINT", { pointer: { x: 0.65, y: 0.5 } });
  s.sink.reset();
  s.ready();
  s.pose("POINT", { pointer: { x: 0.35, y: 0.5 } }, 10);
  assert.deepEqual(s.sent("POINTER").at(-1)?.payload, { x: 0.35, y: 0.5 });
  s.pose("POINT", { pointer: { x: 0.35, y: 0.5 }, thumbSpread: 0.8 }, 5);
  assert.equal(s.action("SELECT").length, 1);
});

test("an open thumb entering a target must close and reacquire before confirmation", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", { thumbSpread: 0.8 }, 15);
  assert.equal(s.action("SELECT").length, 0);
  s.pose("POINT", {}, 10);
  s.pose("POINT", { thumbSpread: 0.8 }, 4);
  assert.equal(s.action("SELECT").length, 1);
});

test("changed target cannot turn an old thumb lock into a new target confirmation", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  s.sink.setContext(true, {
    ...s.view,
    focusTarget: { id: "another-target", kind: "ui" },
  });
  s.pose("POINT", { thumbSpread: 0.8 }, 4);
  assert.equal(s.action("SELECT").length, 0);
});

test("pinch hold plus travel rotates horizontally and never confirms or changes images", () => {
  const s = setup();
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.65 } });
  s.pose("PINCH", { pointer: { x: 0.59, y: 0.7 } });
  assert.equal(s.action("ROTATE_START").length, 1);
  assert.ok(Math.abs(s.action("ROTATE")[0].payload!.dx! - 0.03) < 1e-10);
  assert.equal(s.action("ROTATE")[0].payload!.dy, 0);
  s.pose("OPEN_PALM");
  assert.equal(s.action("ROTATE_END").length, 1);
  for (const action of ["SELECT", "NEXT_IMAGE", "PREVIOUS_IMAGE"] as const)
    assert.equal(s.action(action).length, 0);
});

test("stationary pinch sends no drift and a post-watchdog movement starts a fresh burst", () => {
  const s = setup();
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } }, 8);
  assert.equal(s.action("ROTATE").length, 0);
  s.pose("PINCH", { pointer: { x: 0.59, y: 0.5 } });
  assert.equal(s.action("ROTATE_START").length, 2);
  assert.equal(s.action("ROTATE").length, 1);
});

for (const direction of [-1, 1]) {
  test(`pinch closure in direction ${direction} is not counted as post-hold drag travel`, () => {
    const s = setup();
    s.ready();
    for (const travel of [0, 0.025, 0.04, 0.045, 0.048, 0.049])
      s.pose("PINCH", {
        pointer: { x: 0.5 + direction * travel, y: 0.5 },
      });
    assert.equal(s.sent("ROTATE_START").length, 0);
    assert.equal(s.sent("ROTATE").length, 0);
    s.pose("PINCH", { pointer: { x: 0.5 + direction * 0.07, y: 0.5 } });
    s.pose("PINCH", { pointer: { x: 0.5 + direction * 0.1, y: 0.5 } });
    assert.equal(s.sent("ROTATE_START").length, 1);
    assert.equal(s.sent("ROTATE").length, 1);
    assert.ok(
      Math.abs(s.sent("ROTATE")[0].payload!.dx! - direction * 0.03) < 1e-10,
    );
    s.pose("OPEN_PALM");
    assert.equal(s.sent("ROTATE_END").length, 1);
  });
}

test("a HUD target consumes pinching; two-hand pinches do not resurrect zoom", () => {
  const s = setup();
  s.ready();
  s.sink.setContext(true, {
    ...s.view,
    focusTarget: { id: "atlas-back", kind: "ui" },
  });
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.65, y: 0.5 } }, 3);
  assert.equal(s.action("ROTATE_START").length, 0);
  for (let i = 0; i < 10; i++)
    s.send([hand("PINCH"), hand("PINCH", { id: "left", handedness: "Left" })]);
  assert.equal(s.action("ZOOM").length, 0);
});

test("a retained focus-source UI target cannot consume a fresh pinch rotation", () => {
  const s = setup();
  s.sink.setContext(true, {
    ...s.view,
    focusTarget: { id: "atlas-back", kind: "ui", source: "focus" },
  });
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.62, y: 0.5 } });
  assert.equal(s.sent("ROTATE_START").length, 1);
  assert.equal(s.sent("ROTATE").length, 1);
  assert.equal(s.sent("SELECT").length, 0);
  s.pose("OPEN_PALM");
  assert.equal(s.sent("ROTATE_END").length, 1);
});

test("point confirmation requires a pointer-source target, not a retained focus-source button", () => {
  const s = setup();
  s.sink.setContext(true, {
    ...s.view,
    focusTarget: { id: "atlas-back", kind: "ui", source: "focus" },
  });
  s.ready();
  s.pose("POINT", {}, 20);
  s.pose("POINT", { thumbSpread: 0.8 }, 4);
  assert.equal(s.sent("SELECT").length, 0);
  s.sink.setContext(true, {
    ...s.view,
    focusTarget: { id: "atlas-back", kind: "ui", source: "pointer" },
  });
  s.pose("POINT", {}, 12);
  s.pose("POINT", { thumbSpread: 0.8 }, 4);
  assert.equal(s.sent("SELECT").length, 1);
  assert.equal(s.sent("SELECT")[0].payload?.expectedTargetId, "atlas-back");
});

test("held V uses the existing palm-angle dial and consumes competing fist and image actions", () => {
  const s = setup();
  s.ready();
  s.pose("V_GESTURE", {}, 6);
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 8);
  assert.ok(s.action("ZOOM").some((call) => (call.payload?.delta ?? 0) > 0));
  assert.ok(
    s.action("ZOOM").every((call) => Math.abs(call.payload!.delta!) <= 0.1),
  );
  s.pose("FIST", {}, 2);
  assert.equal(s.action("BACK").length, 0);
  assert.equal(
    s.action("NEXT_IMAGE").length + s.action("PREVIOUS_IMAGE").length,
    0,
  );
});

test("short V loss resumes without integrating the missing interval", () => {
  const s = setup();
  s.ready();
  s.pose("V_GESTURE", {}, 6);
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 5);
  const count = s.action("ZOOM").length;
  s.send([], 66);
  s.pose("V_GESTURE", { palmRoll: 0.8 });
  assert.equal(s.action("ZOOM").length, count);
});

test("fist returns once, requires release, and remains available while scene actions are blocked", () => {
  const s = setup();
  s.ready();
  s.sink.setContext(true, {
    ...s.view,
    mode: "INFO_PANEL_OPEN",
    available: ["BACK", "STOP"],
  });
  s.ready();
  s.pose("FIST", {}, 25);
  assert.equal(s.action("BACK").length, 1);
  s.pose("OPEN_PALM", {}, 12);
  s.pose("FIST", {}, 12);
  assert.equal(s.action("BACK").length, 2);
});

test("a fist release observed during Back cooldown permits a fresh hold after cooldown", () => {
  const s = setup();
  s.ready();
  s.pose("FIST", {}, 11);
  assert.equal(s.sent("BACK").length, 1);
  s.pose("OPEN_PALM", {}, 4);
  s.pose("FIST", {}, 20);
  assert.equal(s.sent("BACK").length, 2);
});

test("holding a fist through Back cooldown still cannot repeat Back", () => {
  const s = setup();
  s.ready();
  s.pose("FIST", {}, 40);
  assert.equal(s.sent("BACK").length, 1);
});

test("owner loss and disconnect terminate motion; held reacquired pinch cannot inherit drag", () => {
  const s = setup();
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.send([]);
  s.pose("PINCH", { id: "new-hand", pointer: { x: 0.7, y: 0.5 } }, 10);
  assert.equal(s.action("ROTATE_START").length, 1);
  assert.equal(s.action("ROTATE_END").length, 1);
  s.sink.setContext(false, null);
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 10);
  assert.equal(s.action("ZOOM").length, 0);
});

test("unreliable geometry, duplicate frames and time gaps cannot accumulate a confirmation", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", { thumbGeometryValid: false }, 12);
  s.pose("POINT", { thumbSpread: 0.8 }, 4);
  assert.equal(s.action("SELECT").length, 0);
  s.sink.update({ hands: [hand("POINT")], time: 1 });
  s.sink.update({ hands: [hand("POINT", { thumbSpread: 0.8 })], time: 1 });
  s.send([hand("POINT", { thumbSpread: 0.8 })], 800);
  assert.equal(s.action("SELECT").length, 0);
});

test("open-palm flick does not invent next or previous gallery gestures", () => {
  const s = setup();
  s.ready();
  s.pose(
    "OPEN_PALM",
    { velocity: { x: 4, y: 0 }, pointer: { x: 0.8, y: 0.5 } },
    8,
  );
  assert.equal(
    s.action("NEXT_IMAGE").length + s.action("PREVIOUS_IMAGE").length,
    0,
  );
});

test("a real held target keeps its frozen pointer alive without rotation or zoom drift", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  const previous = s.action("POINTER").length;
  s.pose("POINT", { pointer: { x: 0.505, y: 0.5 } }, 4);
  assert.equal(s.action("POINTER").length - previous, 4);
  assert.ok(
    s
      .action("POINTER")
      .slice(previous)
      .every((call) => call.payload?.x === 0.5 && call.payload?.y === 0.5),
  );
  assert.equal(s.action("ROTATE").length + s.action("ZOOM").length, 0);
});

test("changing TV mode interrupts an active drag and cannot carry its held pinch into a panel", () => {
  const s = setup();
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.sink.setContext(true, {
    ...s.view,
    mode: "INFO_PANEL_OPEN",
    available: ["BACK", "STOP", "NEXT_IMAGE", "PREVIOUS_IMAGE"],
  });
  s.pose("PINCH", { pointer: { x: 0.8, y: 0.5 } }, 10);
  assert.equal(s.action("ROTATE_END").length, 1);
  assert.equal(s.action("ROTATE_START").length, 1);
  assert.equal(
    s.action("NEXT_IMAGE").length + s.action("PREVIOUS_IMAGE").length,
    0,
  );
});

test("a rejected transport send never reports a successful confirmation", () => {
  const feedback: string[] = [];
  const sink = new RemoteGestureSink({
    send: (action) => action !== "SELECT",
    feedback: (value) => feedback.push(value.status),
  });
  sink.setContext(true, {
    mode: "PLANET_OVERVIEW",
    selected: "mars",
    available: [...REMOTE_ACTIONS],
    focusTarget: { id: "body-mars", kind: "body" },
  });
  let time = 0;
  for (let i = 0; i < 7; i++)
    sink.update({ hands: [hand()], time: (time += 66) });
  for (let i = 0; i < 10; i++)
    sink.update({ hands: [hand("POINT")], time: (time += 66) });
  for (let i = 0; i < 4; i++)
    sink.update({
      hands: [hand("POINT", { thumbSpread: 0.8 })],
      time: (time += 66),
    });
  assert.equal(feedback.includes("confirm"), false);
});

test("67ms transport throttling retains 66ms pinch motion until a successful send", () => {
  let lastContinuous = -Infinity;
  const s = setup((action, _payload, time) => {
    if (!["ROTATE", "ZOOM", "POINTER"].includes(action)) return true;
    if (time - lastContinuous < 67) return false;
    lastContinuous = time;
    return true;
  });
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  for (let step = 1; step <= 10; step++)
    s.pose("PINCH", { pointer: { x: 0.56 + step * 0.02, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.76, y: 0.5 } });
  assert.ok(s.action("ROTATE").length > s.sent("ROTATE").length);
  const distance = s
    .sent("ROTATE")
    .reduce((sum, call) => sum + call.payload!.dx!, 0);
  assert.ok(Math.abs(distance - 0.2) < 1e-10);
  assert.ok(
    s.sent("ROTATE").every((call) => Math.abs(call.payload!.dx!) <= 0.15),
  );
});

test("low-frequency valid frames preserve pinch distance without changing gesture thresholds", () => {
  const s = setup();
  for (let i = 0; i < 5; i++) s.send([hand()], 100);
  for (let i = 0; i < 3; i++) s.send([hand("PINCH")], 100);
  s.send([hand("PINCH", { pointer: { x: 0.56, y: 0.5 } })], 100);
  for (let step = 1; step <= 10; step++)
    s.send(
      [hand("PINCH", { pointer: { x: 0.56 + step * 0.02, y: 0.5 } })],
      100,
    );
  assert.equal(s.sent("ROTATE_START").length, 1);
  const distance = s
    .sent("ROTATE")
    .reduce((sum, call) => sum + call.payload!.dx!, 0);
  assert.ok(Math.abs(distance - 0.2) < 1e-10);
});

test("post-watchdog motion waits for a successful restart and retains the short rejected movement", () => {
  let rejectRestart = false;
  const s = setup((action) => action !== "ROTATE_START" || !rejectRestart);
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } }, 8);
  rejectRestart = true;
  s.pose("PINCH", { pointer: { x: 0.59, y: 0.5 } });
  assert.equal(s.action("ROTATE").length, 0);
  assert.equal(s.sent("ROTATE_START").length, 1);
  rejectRestart = false;
  s.pose("PINCH", { pointer: { x: 0.61, y: 0.5 } });
  assert.equal(s.sent("ROTATE_START").length, 2);
  assert.ok(Math.abs(s.sent("ROTATE")[0].payload!.dx! - 0.05) < 1e-10);
});

test("rejected rotation is bounded and an old outage backlog is not replayed", () => {
  let accepted = false;
  const s = setup((action) => action !== "ROTATE" || accepted);
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.7, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.84, y: 0.5 } });
  accepted = true;
  s.pose("PINCH", { pointer: { x: 0.98, y: 0.5 } });
  assert.equal(s.sent("ROTATE")[0].payload!.dx, 0.15);
  accepted = false;
  s.pose("PINCH", { pointer: { x: 0.94, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.94, y: 0.5 } }, 6);
  accepted = true;
  s.pose("PINCH", { pointer: { x: 0.94, y: 0.5 } });
  assert.equal(s.sent("ROTATE").length, 1);
  s.pose("PINCH", { pointer: { x: 0.92, y: 0.5 } });
  assert.ok(Math.abs(s.sent("ROTATE")[1].payload!.dx! + 0.02) < 1e-10);
});

test("a throttled V dial retains only the unsent bounded zoom integral", () => {
  const reference = setup();
  let rejected = false;
  const throttled = setup((action) => {
    if (action === "ZOOM" && !rejected) {
      rejected = true;
      return false;
    }
    return true;
  });
  for (const s of [reference, throttled]) {
    s.ready();
    s.pose("V_GESTURE", {}, 6);
    s.pose("V_GESTURE", { palmRoll: 0.8 }, 8);
  }
  const sum = (s: ReturnType<typeof setup>) =>
    s.sent("ZOOM").reduce((total, call) => total + call.payload!.delta!, 0);
  assert.equal(rejected, true);
  assert.ok(Math.abs(sum(reference) - sum(throttled)) < 1e-10);
  assert.ok(
    throttled
      .sent("ZOOM")
      .every((call) => Math.abs(call.payload!.delta!) <= 0.1),
  );
});

test("rejected V zoom stays within one bounded packet and expires without delayed replay", () => {
  let accepted = true;
  const s = setup((action) => action !== "ZOOM" || accepted);
  s.ready();
  s.pose("V_GESTURE", {}, 6);
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 6);
  accepted = false;
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 2);
  accepted = true;
  s.pose("V_GESTURE", { palmRoll: 0.8 });
  assert.equal(s.sent("ZOOM").at(-1)!.payload!.delta, 0.1);
  accepted = false;
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 10);
  accepted = true;
  s.pose("V_GESTURE", { palmRoll: 0.8 });
  assert.ok(Math.abs(s.sent("ZOOM").at(-1)!.payload!.delta! - 0.0858) < 1e-10);
  s.pose("V_GESTURE", { palmRoll: 0 });
  const count = s.sent("ZOOM").length;
  s.pose("V_GESTURE", { palmRoll: 0 }, 6);
  assert.equal(s.sent("ZOOM").length, count);
});

for (const boundary of ["release", "hand-loss", "context", "reset"] as const) {
  test(`${boundary} clears rejected pinch travel before a fresh drag`, () => {
    let accepted = false;
    const s = setup((action) => action !== "ROTATE" || accepted);
    s.ready();
    s.pose("PINCH", {}, 4);
    s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
    s.pose("PINCH", { pointer: { x: 0.62, y: 0.5 } });
    if (boundary === "release") s.pose("OPEN_PALM");
    else if (boundary === "hand-loss") s.send([]);
    else if (boundary === "context") {
      s.sink.setContext(true, { ...s.view, selected: "earth" });
    } else s.sink.reset();
    accepted = true;
    s.ready();
    s.pose("PINCH", {}, 4);
    s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
    s.pose("PINCH", { pointer: { x: 0.58, y: 0.5 } });
    assert.equal(s.sent("ROTATE").length, 1);
    assert.ok(Math.abs(s.sent("ROTATE")[0].payload!.dx! - 0.02) < 1e-10);
  });
}

for (const boundary of [
  "neutral",
  "release",
  "hand-loss",
  "context",
  "reset",
] as const) {
  test(`${boundary} clears rejected V zoom without transferring it to later input`, () => {
    let accepted = false;
    const limited = setup((action) => action !== "ZOOM" || accepted);
    const reference = setup();
    for (const s of [limited, reference]) {
      s.ready();
      s.pose("V_GESTURE", {}, 6);
      s.pose("V_GESTURE", { palmRoll: 0.8 });
      if (boundary === "neutral") s.pose("V_GESTURE", { palmRoll: 0 });
      else if (boundary === "release") s.pose("OPEN_PALM");
      else if (boundary === "hand-loss") s.send([]);
      else if (boundary === "context") {
        s.sink.setContext(true, { ...s.view, selected: "earth" });
      } else s.sink.reset();
    }
    const previousLimited = limited.sent("ZOOM").length;
    const previousReference = reference.sent("ZOOM").length;
    accepted = true;
    for (const s of [limited, reference]) {
      if (["release", "context", "reset"].includes(boundary)) {
        s.ready();
        s.pose("V_GESTURE", {}, 6);
      }
      s.pose("V_GESTURE", { palmRoll: 0.8 }, 4);
    }
    const after = (s: ReturnType<typeof setup>, index: number) =>
      s
        .sent("ZOOM")
        .slice(index)
        .map((call) => call.payload!.delta!);
    assert.deepEqual(
      after(limited, previousLimited),
      after(reference, previousReference),
    );
    assert.ok(
      after(limited, previousLimited).every((delta) => Math.abs(delta) <= 0.1),
    );
  });
}

test("ambiguous pose stops motion but keeps tracked identity without a new hand-entry delay", () => {
  const s = setup();
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.6, y: 0.5 } });
  s.pose("PINCH", { confidence: 0.2, trackingConfidence: 0.95 });
  assert.equal(s.action("ROTATE_END").length, 1);
  const starts = s.action("ROTATE_START").length;
  const rotations = s.action("ROTATE").length;
  s.pose("PINCH", { pointer: { x: 0.9, y: 0.5 } }, 5);
  assert.equal(s.action("ROTATE_START").length, starts);
  assert.equal(s.action("ROTATE").length, rotations);
  s.pose("OPEN_PALM");
  const pointers = s.action("POINTER").length;
  s.pose("POINT");
  assert.equal(s.action("POINTER").length, pointers + 1);
});

test("tracking loss still stops motion and requires the original hand-entry delay", () => {
  const s = setup();
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.pose("PINCH", { trackingConfidence: 0.2 });
  assert.equal(s.action("ROTATE_END").length, 1);
  s.pose("OPEN_PALM");
  s.pose("POINT");
  assert.equal(s.action("POINTER").length, 0);
  s.pose("POINT", {}, 4);
  assert.ok(s.action("POINTER").length > 0);
});

test("low pose confidence cannot lock, confirm, or carry an open thumb into confirmation", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", { confidence: 0.2, trackingConfidence: 0.95 }, 10);
  s.pose("POINT", { thumbSpread: 0.8 }, 8);
  assert.equal(s.action("SELECT").length, 0);
  s.pose("POINT", {}, 10);
  s.pose("POINT", { thumbSpread: 0.8 }, 4);
  assert.equal(s.action("SELECT").length, 1);
});

test("missing V input sends one immediate STOP and cannot replay pending zoom on recovery", () => {
  let acceptZoom = false;
  const s = setup((action) => action !== "ZOOM" || acceptZoom);
  s.ready();
  s.pose("V_GESTURE", {}, 6);
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 3);
  const stops = s.action("STOP").length;
  s.send([]);
  assert.equal(s.action("STOP").length, stops + 1);
  s.send([]);
  assert.equal(s.action("STOP").length, stops + 1);
  acceptZoom = true;
  s.pose("V_GESTURE", { palmRoll: 0.8 });
  assert.equal(s.sent("ZOOM").length, 0);
});

test("ambiguous V pose stops zoom and cannot resume a held dial without release", () => {
  const s = setup();
  s.ready();
  s.pose("V_GESTURE", {}, 6);
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 3);
  const stops = s.action("STOP").length;
  s.pose("V_GESTURE", { confidence: 0.2, trackingConfidence: 0.95 });
  assert.equal(s.action("STOP").length, stops + 1);
  const zooms = s.sent("ZOOM").length;
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 8);
  assert.equal(s.sent("ZOOM").length, zooms);
  s.pose("OPEN_PALM");
  s.pose("V_GESTURE", {}, 6);
  s.pose("V_GESTURE", { palmRoll: 0.8 }, 3);
  assert.ok(s.sent("ZOOM").length > zooms);
});

test("a rejected pointer cannot replace the delivered aim used by target locking", () => {
  let rejectPointer = false;
  const s = setup((action) => action !== "POINTER" || !rejectPointer);
  s.sink.setContext(true, { ...s.view, focusTarget: null });
  s.ready();
  s.pose("POINT");
  rejectPointer = true;
  s.pose("POINT", { pointer: { x: 0.52, y: 0.5 } });
  s.sink.setContext(true, s.view);
  s.pose("POINT", { pointer: { x: 0.52, y: 0.5 } });
  rejectPointer = false;
  s.pose("POINT", { pointer: { x: 0.52, y: 0.5 } });
  assert.deepEqual(s.sent("POINTER").at(-1)?.payload, { x: 0.5, y: 0.5 });
});

test("locked feedback follows the delivered aim rather than a drifting fingertip", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  s.pose("POINT", { pointer: { x: 0.52, y: 0.51 } });
  assert.equal(s.feedback.at(-1)?.status, "locking");
  assert.deepEqual(s.feedback.at(-1)?.pointer, { x: 0.5, y: 0.5 });
  assert.deepEqual(s.sent("POINTER").at(-1)?.payload, { x: 0.5, y: 0.5 });
});

test("rotation feedback retains the current fingertip without a locked selection", () => {
  const s = setup();
  s.ready();
  s.pose("PINCH", {}, 4);
  s.pose("PINCH", { pointer: { x: 0.56, y: 0.5 } });
  s.pose("PINCH", { pointer: { x: 0.59, y: 0.51 } });
  assert.equal(s.feedback.at(-1)?.status, "rotate");
  assert.deepEqual(s.feedback.at(-1)?.pointer, { x: 0.59, y: 0.51 });
});

test("continuous ready frames do not add a false selection frame-gap release", () => {
  const s = setup();
  s.pose("OPEN_PALM", {}, 5);
  s.pose("POINT", {}, 5);
  s.pose("POINT", { thumbSpread: 0.8 }, 3);
  assert.equal(s.sent("SELECT").length, 1);
});

test("closed-thumb cooldown frames observe release without adding a second delay", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  s.pose("POINT", { thumbSpread: 0.8 }, 3);
  assert.equal(s.sent("SELECT").length, 1);
  s.pose("POINT", {}, 6);
  s.pose("POINT", {}, 5);
  s.pose("POINT", { thumbSpread: 0.8 }, 3);
  assert.equal(s.sent("SELECT").length, 2);
});

test("held-open cooldown frames still require a deliberate thumb release", () => {
  const s = setup();
  s.ready();
  s.pose("POINT", {}, 10);
  s.pose("POINT", { thumbSpread: 0.8 }, 3);
  s.pose("POINT", { thumbSpread: 0.8 }, 20);
  assert.equal(s.sent("SELECT").length, 1);
});

for (const competing of ["V_GESTURE", "PINCH", "FIST"] as const) {
  test(`a locked target consumes a short ${competing} observation during confirmation`, () => {
    const s = setup();
    s.ready();
    s.pose("POINT", {}, 10);
    s.pose(competing, {}, 2);
    s.pose("POINT", { thumbSpread: 0.8 }, 3);
    assert.deepEqual(s.sent("SELECT"), [
      { action: "SELECT", payload: { expectedTargetId: "body-mars" } },
    ]);
    for (const action of ["ZOOM", "ROTATE_START", "ROTATE", "BACK"] as const)
      assert.equal(s.sent(action).length, 0);
  });

  test(`an expired ${competing} selection grace cannot revive the old target`, () => {
    const s = setup();
    s.ready();
    s.pose("POINT", {}, 10);
    s.pose(competing, {}, 9);
    s.pose("POINT", { thumbSpread: 0.8 }, 5);
    assert.equal(s.sent("SELECT").length, 0);
  });
}
