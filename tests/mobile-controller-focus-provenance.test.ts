import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { RemoteGestureSink } from "../src/controller/RemoteGestureSink";
import { HandIdentityTracker } from "../src/gesture/HandIdentityTracker";
import {
  applyInputAction,
  clearRemoteInput,
  currentInputTarget,
  currentInputTargetSnapshot,
} from "../src/input/sharedInput";
import { interaction } from "../src/interaction/InteractionController";
import { rotation } from "../src/interaction/rotation";
import { store } from "../src/interaction/store";
import { installTvNavigation } from "../src/platform/tvNavigation";
import {
  validateRemoteViewState,
  type RemoteAction,
  type RemotePayload,
  type RemoteViewState,
} from "../src/remote/controlProtocol";
import { handFixture } from "./fixtures/hands";

type Pose = Parameters<typeof handFixture>[0];
type Geometry = NonNullable<Parameters<typeof handFixture>[1]>;
const frameInterval = 1000 / 15;
let nextClockBase = 1000;

/** DOM focus contracts and existing synthetic anatomy, not camera detection,
 * WebSocket latency, actual screen layout, or native Android key evidence. */
function setup(t: TestContext, legacySource = false) {
  const previousState = store.get();
  let time = nextClockBase;
  nextClockBase += 100000;
  let frame = 0;
  const window = Object.assign(new EventTarget(), {
    location: { search: "?tv=1" },
    getComputedStyle: () => ({ visibility: "visible" }),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  const document = Object.assign(new EventTarget(), {
    activeElement: null as ReturnType<typeof button> | null,
    pointedElement: null as ReturnType<typeof button> | null,
    dialog: false,
    controls: [] as ReturnType<typeof button>[],
    defaultView: window,
    elementFromPoint: () => document.pointedElement,
    querySelector: (selector: string) =>
      selector.includes('[role="dialog"]') && document.dialog ? {} : null,
    querySelectorAll: () => document.controls,
  });
  function button(id: string, left: number) {
    return {
      id,
      dataset: { gestureId: id },
      textContent: id,
      tabIndex: 0,
      clicks: 0,
      matches(selector: string) {
        return selector === ":disabled" ? false : selector.includes("button");
      },
      getAttribute() {
        return null;
      },
      closest(selector: string) {
        return selector.startsWith("button") ? this : null;
      },
      getClientRects() {
        return [{}];
      },
      getBoundingClientRect() {
        return { left, top: 0, width: 100, height: 40 };
      },
      scrollIntoView() {},
      click() {
        this.clicks++;
      },
      focus() {
        document.activeElement = this;
      },
    };
  }
  const first = button("atlas-zoom-in", 0);
  const second = button("atlas-zoom-out", 200);
  document.controls.push(first, second);
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    document,
    window,
    innerWidth: 1000,
    innerHeight: 600,
    CustomEvent: class extends Event {},
  })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  t.mock.method(performance, "now", () => time);
  const start = t.mock.method(rotation, "start", () => {});
  const move = t.mock.method(rotation, "move", () => {});
  t.mock.method(rotation, "stop", () => {});
  t.mock.method(interaction, "endScale", () => true);
  t.mock.method(interaction, "isLocked", () => false);
  clearRemoteInput();
  store.set({
    mode: "PLANET_OVERVIEW",
    selected: "earth",
    transitioning: false,
    activeStoryId: null,
  });
  const tracker = new HandIdentityTracker();
  const calls: {
    action: RemoteAction;
    payload?: RemotePayload;
    accepted: boolean;
  }[] = [];
  const sink = new RemoteGestureSink({
    send(action, payload) {
      const accepted = applyInputAction(action, payload);
      calls.push({ action, payload, accepted });
      return accepted;
    },
  });
  const publish = () => {
    const { target, source } = currentInputTargetSnapshot();
    const view: RemoteViewState = {
      mode: store.get().mode,
      selected: store.get().selected ?? undefined,
      available: ["STOP", "BACK", "POINTER", "FOCUS", "SELECT"],
      focusTarget: target
        ? {
            id: target.id,
            kind: target.kind,
            label: target.label,
            ...(legacySource ? {} : { source }),
          }
        : null,
    };
    if (!document.dialog && !store.get().transitioning)
      view.available.push("ROTATE_START", "ROTATE", "ROTATE_END", "ZOOM");
    assert.equal(validateRemoteViewState(view).ok, true);
    sink.setContext(true, view);
  };
  publish();
  const send = (pose: Pose, geometry: Geometry = {}, dx = 0) => {
    time += frameInterval;
    const fixture = handFixture(pose, {
      yaw: 0.6,
      pitch: -0.3,
      relaxed: true,
      foldedPinch: true,
      ...(pose === "POINT"
        ? {
            indexPipAngle: 165,
            otherFingerFlexion: 55,
            thumbOpening: 0,
          }
        : {}),
      ...geometry,
      frame: frame++,
    });
    for (const point of fixture.points) point.x += dx;
    const hands = tracker.update(
      {
        landmarks: [fixture.points],
        worldLandmarks: [fixture.world],
        handedness: [[{ categoryName: "Right", score: 0.99 }]],
      },
      time,
    );
    assert.equal(hands.length, 1);
    sink.update({ hands, time });
    publish();
    return hands[0];
  };
  const hold = (pose: Pose, duration: number, geometry: Geometry = {}) => {
    for (let elapsed = 0; elapsed < duration; elapsed += frameInterval)
      send(pose, geometry);
  };
  const ready = () => hold("POINT", 500);
  const drag = () => {
    hold("PINCH", 300);
    for (const dx of [0.025, 0.05, 0.075, 0.1, 0.125]) send("PINCH", {}, dx);
  };
  let navigationCleanup: (() => void) | undefined;
  const installNavigation = () => {
    const root = Object.assign(
      {},
      {
        ownerDocument: document,
        querySelector: document.querySelector,
        querySelectorAll: document.querySelectorAll,
      },
    );
    navigationCleanup = installTvNavigation(
      root as unknown as HTMLElement,
      () => false,
    );
    publish();
  };
  const retainUiThenPointBlank = () => {
    ready();
    document.pointedElement = first;
    hold("POINT", 500);
    assert.equal(document.activeElement, first);
    hold("OPEN_PALM", 1000);
    document.pointedElement = null;
    hold("POINT", 200);
    assert.equal(currentInputTargetSnapshot().source, "pointer");
    assert.equal(currentInputTarget(), null);
    assert.equal(document.activeElement, first);
  };
  t.after(() => {
    sink.reset();
    clearRemoteInput();
    navigationCleanup?.();
    tracker.reset();
    store.set(previousState);
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    document,
    first,
    second,
    calls,
    start,
    move,
    publish,
    send,
    hold,
    ready,
    drag,
    installNavigation,
    retainUiThenPointBlank,
    sent: (action: RemoteAction) =>
      calls.filter((call) => call.action === action && call.accepted),
  };
}

test("expired blank pointing keeps D-pad focus but no longer consumes a fresh anatomical pinch", (t) => {
  const s = setup(t);
  s.retainUiThenPointBlank();
  s.hold("OPEN_PALM", 1000);
  const snapshot = currentInputTargetSnapshot();
  assert.equal(snapshot.source, "focus");
  assert.equal(snapshot.target?.id, s.first.id);
  s.drag();
  assert.equal(s.sent("ROTATE_START").length, 1);
  assert.ok(s.sent("ROTATE").length >= 2);
  assert.equal(s.start.mock.callCount(), 1);
  assert.ok(s.move.mock.callCount() >= 2);
  assert.equal(s.sent("SELECT").length, 0);
  assert.equal(s.first.clicks, 0);
  s.send("OPEN_PALM");
  assert.equal(s.sent("ROTATE_END").length, 1);
});

test("an actually pointed UI still consumes a pinch without changing gesture thresholds", (t) => {
  const s = setup(t);
  s.ready();
  s.document.pointedElement = s.first;
  assert.equal(applyInputAction("POINTER", { x: 0.5, y: 0.5 }), true);
  assert.equal(currentInputTargetSnapshot().source, "pointer");
  assert.equal(currentInputTarget()?.id, s.first.id);
  s.publish();
  s.drag();
  assert.equal(s.sent("ROTATE_START").length, 0);
  assert.equal(s.start.mock.callCount(), 0);
  assert.equal(s.move.mock.callCount(), 0);
  assert.equal(s.sent("SELECT").length, 0);
});

test("source-aware state preserves D-pad focus confirmation and touch pointer confirmation", (t) => {
  const s = setup(t);
  s.installNavigation();
  assert.equal(applyInputAction("FOCUS", { direction: "right" }), true);
  const focused = currentInputTargetSnapshot();
  assert.equal(focused.source, "focus");
  assert.equal(focused.target?.id, s.second.id);
  assert.equal(
    applyInputAction("SELECT", { expectedTargetId: s.second.id }),
    true,
  );
  assert.equal(s.second.clicks, 1);
  s.document.pointedElement = s.first;
  assert.equal(applyInputAction("POINTER", { x: 0.5, y: 0.5 }), true);
  const pointed = currentInputTargetSnapshot();
  assert.equal(pointed.source, "pointer");
  assert.equal(pointed.target?.id, s.first.id);
  assert.equal(
    applyInputAction("SELECT", { expectedTargetId: s.first.id }),
    true,
  );
  assert.equal(s.first.clicks, 1);
  assert.equal(s.second.clicks, 1);
});

test("modal scene protection still blocks rotation even when the retained target is focus-source", (t) => {
  const s = setup(t);
  s.retainUiThenPointBlank();
  s.hold("OPEN_PALM", 1000);
  assert.equal(currentInputTargetSnapshot().source, "focus");
  s.document.dialog = true;
  s.publish();
  s.hold("OPEN_PALM", 500);
  s.drag();
  assert.equal(s.sent("ROTATE_START").length, 0);
  assert.equal(s.start.mock.callCount(), 0);
  assert.equal(applyInputAction("ROTATE_START", undefined), false);
  assert.equal(applyInputAction("ROTATE", { dx: 0.1, dy: 0 }), false);
  assert.equal(s.start.mock.callCount(), 0);
  assert.equal(s.move.mock.callCount(), 0);
});

test("changing a pointed lock to another D-pad focus respects selection grace and never confirms the replacement", (t) => {
  const s = setup(t);
  s.installNavigation();
  s.ready();
  s.document.pointedElement = s.first;
  s.hold("POINT", 500);
  assert.equal(currentInputTargetSnapshot().source, "pointer");
  assert.equal(currentInputTarget()?.id, s.first.id);
  assert.equal(applyInputAction("FOCUS", { direction: "right" }), true);
  assert.equal(currentInputTargetSnapshot().source, "focus");
  assert.equal(currentInputTarget()?.id, s.second.id);
  s.publish();
  s.hold("PINCH", 300);
  assert.equal(
    s.sent("ROTATE_START").length,
    0,
    "the original captured target still owns its grace",
  );
  assert.equal(s.sent("SELECT").length, 0);
  s.hold("OPEN_PALM", 600);
  s.drag();
  assert.equal(s.sent("ROTATE_START").length, 1);
  assert.equal(s.sent("SELECT").length, 0);
  assert.equal(s.first.clicks + s.second.clicks, 0);
});

test("legacy TV state without source remains conservative and is not evidence of a fixed installed APK", (t) => {
  const s = setup(t, true);
  s.retainUiThenPointBlank();
  s.hold("OPEN_PALM", 1000);
  assert.equal(currentInputTargetSnapshot().source, "focus");
  s.drag();
  assert.equal(s.sent("ROTATE_START").length, 0);
  assert.equal(s.start.mock.callCount(), 0);
  assert.equal(s.sent("SELECT").length, 0);
});
