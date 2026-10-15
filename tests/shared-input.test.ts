import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  applyInputAction,
  clearRemoteInput,
  currentInputTarget,
  currentRemotePointer,
  inputOwnership,
} from "../src/input/sharedInput";
import { scenePointer, type InputTarget } from "../src/input/scenePointer";
import { interaction } from "../src/interaction/InteractionController";
import { rotation } from "../src/interaction/rotation";
import { particles } from "../src/particles/ParticleEngine";
import { store } from "../src/interaction/store";
import { getPlanetAtlasRotation } from "../src/exploration/planetAtlasState";
import type {
  ControlMessage,
  RemoteAction,
} from "../src/remote/controlProtocol";

const dialogSelector = '[role="dialog"][aria-modal="true"]';

// DOM event/activation contracts only; browser layout and native TV keys are separate QA.
function fixture(t: TestContext) {
  const state = store.get();
  const particleState = {
    rotation: particles.rotation,
    targetRotation: particles.targetRotation,
    targetScale: particles.targetScale,
  };
  const document = {
    activeElement: null as unknown,
    pointedElement: null as ReturnType<typeof button> | null,
    dialog: false,
    controls: [] as ReturnType<typeof button>[],
    elementFromPoint: () => document.pointedElement,
    querySelector(selector: string) {
      if (selector === dialogSelector) return document.dialog ? {} : null;
      const id = /data-gesture-id="([A-Za-z0-9_-]+)"/.exec(selector)?.[1];
      return document.dialog && id
        ? (document.controls.find((entry) => entry.dataset.gestureId === id) ??
            null)
        : null;
    },
    querySelectorAll: () => document.controls,
  };
  function button(id: string) {
    return {
      id,
      dataset: { gestureId: id },
      textContent: id,
      disabled: false,
      hidden: false,
      visible: true,
      ariaDisabled: false,
      clicks: 0,
      focuses: 0,
      matches(selector: string) {
        return selector === ":disabled"
          ? this.disabled
          : selector.includes("button");
      },
      getAttribute(name: string) {
        return name === "aria-disabled" && this.ariaDisabled ? "true" : null;
      },
      closest(selector: string) {
        return selector.startsWith("button") ? this : this.hidden ? {} : null;
      },
      getClientRects() {
        return this.visible ? [{}] : [];
      },
      click() {
        this.clicks++;
      },
      focus() {
        this.focuses++;
        document.activeElement = this;
      },
    };
  }
  const window = new EventTarget();
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
  let time = 1000;
  t.mock.method(performance, "now", () => time);
  const locked = t.mock.method(interaction, "isLocked", () => false);
  const start = t.mock.method(rotation, "start", () => {});
  const move = t.mock.method(rotation, "move", () => {});
  const stop = t.mock.method(rotation, "stop", () => {});
  const scale = t.mock.method(interaction, "scale", () => true);
  const endScale = t.mock.method(interaction, "endScale", () => true);
  const back = t.mock.method(interaction, "return", () => true);
  const select = t.mock.method(interaction, "select", () => true);
  clearRemoteInput();
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    transitioning: false,
    activeStoryId: null,
  });
  const cleanups: (() => void)[] = [];
  t.after(() => {
    clearRemoteInput();
    cleanups.forEach((cleanup) => cleanup());
    store.set(state);
    Object.assign(particles, particleState);
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    document,
    window,
    button,
    start,
    move,
    stop,
    scale,
    endScale,
    back,
    select,
    locked,
    advance(ms = 16) {
      time += ms;
    },
    register(resolver: (x: number, y: number) => InputTarget | null) {
      cleanups.push(scenePointer.register(resolver));
    },
  };
}

test("shared input rejects malformed action payloads before taking ownership or touching the scene", (t) => {
  const context = fixture(t);
  const invalid: [RemoteAction, unknown][] = [
    ["POINTER", { x: -0.1, y: 0.5 }],
    ["POINTER", { x: 0.5, y: 1.1 }],
    ["POINTER", { x: NaN, y: 0.5 }],
    ["POINTER", { x: 0.5 }],
    ["POINTER", { x: 0.5, y: 0.5, landmarks: [] }],
    ["ROTATE", { dx: 1.1, dy: 0 }],
    ["ROTATE", { dx: 0, dy: Infinity }],
    ["ROTATE", { dx: 0 }],
    ["ZOOM", { delta: -1.1 }],
    ["ZOOM", { delta: 0, absoluteCamera: [] }],
    ["FOCUS", { direction: "diagonal" }],
    ["SELECT", { expectedTargetId: 'button"][onclick]' }],
    ["SELECT", { expectedTargetId: "nav-moon", rawVideo: [] }],
    ["STOP", {}],
    ["BACK", null],
    ["ROTATE_START", { dx: 0 }],
    ["ROTATE_END", {}],
    ["NEXT_IMAGE", { index: 2 }],
  ];
  const stopped = context.stop.mock.callCount();
  for (const [action, payload] of invalid) {
    assert.equal(
      applyInputAction(action, payload as ControlMessage["payload"]),
      false,
      action,
    );
    assert.equal(inputOwnership.owner, null);
  }
  assert.equal(context.start.mock.callCount(), 0);
  assert.equal(context.move.mock.callCount(), 0);
  assert.equal(context.scale.mock.callCount(), 0);
  assert.equal(context.stop.mock.callCount(), stopped);
  assert.equal(context.select.mock.callCount(), 0);
});

test("non-scene modes deny rotation and zoom instead of bypassing the interaction state", (t) => {
  const context = fixture(t);
  for (const mode of [
    "INTRO",
    "EARTH_CONTINENT_PICKER",
    "EARTH_CITY_PICKER",
    "PLANET_REGION_PICKER",
    "DESCENT_TRANSITION",
    "LOCATION_OVERVIEW",
    "INFO_PANEL_OPEN",
  ] as const) {
    store.set({ mode });
    assert.equal(applyInputAction("ROTATE_START", undefined), false, mode);
    assert.equal(applyInputAction("ROTATE", { dx: 0.2, dy: 0.1 }), false, mode);
    assert.equal(applyInputAction("ZOOM", { delta: 0.1 }), false, mode);
  }
  assert.equal(context.start.mock.callCount(), 0);
  assert.equal(context.move.mock.callCount(), 0);
  assert.equal(context.scale.mock.callCount(), 0);
});

test("transition, interaction lock and modal dialog each block already-started movement", (t) => {
  const context = fixture(t);
  for (const reason of ["transition", "lock", "dialog"] as const) {
    store.set({ mode: "SOLAR_SYSTEM", transitioning: false });
    context.document.dialog = false;
    context.locked.mock.mockImplementation(() => false);
    assert.equal(applyInputAction("ROTATE_START", undefined), true);
    const stopped = context.stop.mock.callCount();
    if (reason === "transition") store.set({ transitioning: true });
    if (reason === "lock") context.locked.mock.mockImplementation(() => true);
    if (reason === "dialog") context.document.dialog = true;
    assert.equal(
      applyInputAction("ROTATE", { dx: 0.2, dy: 0.1 }),
      false,
      reason,
    );
    assert.equal(applyInputAction("ZOOM", { delta: 0.1 }), false, reason);
    assert.equal(applyInputAction("ROTATE_START", undefined), false, reason);
    assert.ok(context.stop.mock.callCount() > stopped, reason);
  }
  assert.equal(context.move.mock.callCount(), 0);
  assert.equal(context.scale.mock.callCount(), 0);
});

test("accepted atlas rotation delegates yaw and pitch to the existing controllers and pauses auto rotation", (t) => {
  const context = fixture(t);
  store.set({ mode: "PLANET_OVERVIEW", selected: "moon" });
  const pitch = t.mock.method(
    getPlanetAtlasRotation("moon"),
    "dragPitch",
    () => {},
  );
  assert.equal(applyInputAction("ROTATE", { dx: 0.25, dy: -0.5 }), false);
  assert.equal(applyInputAction("ROTATE_START", undefined), true);
  assert.equal(inputOwnership.owner, "remote");
  assert.equal(store.get().planetAutoRotate.moon, false);
  context.advance(20);
  assert.equal(applyInputAction("ROTATE", { dx: 0.25, dy: -0.5 }), true);
  assert.deepEqual(context.move.mock.calls[0].arguments, [0.1, 0.02]);
  assert.deepEqual(pitch.mock.calls[0].arguments, [-0.2]);
  assert.equal(context.start.mock.callCount(), 1);
  assert.equal(context.select.mock.callCount(), 0);
});

test("zoom uses the existing scale contract and propagates refusal rather than setting camera data", (t) => {
  const context = fixture(t);
  particles.targetScale = 1.5;
  assert.equal(applyInputAction("ZOOM", { delta: 0.2 }), true);
  assert.deepEqual(context.scale.mock.calls[0].arguments, [1.7]);
  context.scale.mock.mockImplementation(() => false);
  assert.equal(applyInputAction("ZOOM", { delta: -0.2 }), false);
  assert.deepEqual(context.scale.mock.calls[1].arguments, [1.3]);
  assert.equal(particles.targetScale, 1.5);
  assert.equal(context.select.mock.callCount(), 0);
});

test("SELECT must match the original focus target and activate it exactly once through its existing control", (t) => {
  const context = fixture(t);
  const target = context.button("annotation-tycho");
  context.document.activeElement = target;
  assert.equal(
    applyInputAction("SELECT", { expectedTargetId: "annotation-apollo" }),
    false,
  );
  assert.equal(target.clicks, 0);
  assert.equal(
    applyInputAction("SELECT", { expectedTargetId: target.id }),
    true,
  );
  assert.equal(target.clicks, 1);
  assert.equal(context.select.mock.callCount(), 0);
  assert.equal(context.back.mock.callCount(), 0);
});

test("disabled, inert, aria-disabled, off-layout and invalid-ID controls cannot be remotely activated", (t) => {
  const context = fixture(t);
  for (const flag of [
    "disabled",
    "hidden",
    "ariaDisabled",
    "visible",
  ] as const) {
    const target = context.button("story-gallery-next");
    target[flag] = flag !== "visible";
    context.document.activeElement = target;
    assert.equal(
      applyInputAction("SELECT", { expectedTargetId: target.id }),
      false,
      flag,
    );
    assert.equal(target.clicks, 0);
  }
  const invalid = context.button("not a stable ID");
  context.document.activeElement = invalid;
  assert.equal(applyInputAction("SELECT", undefined), false);
  assert.equal(invalid.clicks, 0);
});

test("POINTER focuses existing UI without clicking or issuing a parallel planet selection", (t) => {
  const context = fixture(t);
  const target = context.button("nav-moon");
  context.document.controls.push(target);
  context.document.pointedElement = target;
  assert.equal(applyInputAction("POINTER", { x: 0.25, y: 0.75 }), true);
  assert.equal(context.document.activeElement, target);
  assert.equal(target.focuses, 1);
  assert.equal(target.clicks, 0);
  assert.equal(currentInputTarget()?.id, target.id);
  assert.equal(context.select.mock.callCount(), 0);
});

test("scene picking receives normalized coordinates and SELECT calls only its registered activation", (t) => {
  const context = fixture(t);
  const coordinates: [number, number][] = [];
  let activated = 0;
  context.register((x, y) => {
    coordinates.push([x, y]);
    return {
      id: "moon",
      label: "Moon",
      kind: "body",
      activate: () => (++activated, true),
    };
  });
  assert.equal(applyInputAction("POINTER", { x: 0.4, y: 0.6 }), true);
  assert.equal(activated, 0);
  assert.equal(applyInputAction("SELECT", { expectedTargetId: "moon" }), true);
  assert.equal(activated, 1);
  assert.deepEqual(coordinates, [
    [0.4, 0.6],
    [0.4, 0.6],
  ]);
  assert.equal(context.select.mock.callCount(), 0);
  context.document.dialog = true;
  assert.equal(currentInputTarget(), null);
  assert.equal(applyInputAction("SELECT", { expectedTargetId: "moon" }), false);
  assert.equal(activated, 1);
  assert.equal(coordinates.length, 2);
});

test("gallery actions click the actual modal controls once and do not bypass their picture/story association", (t) => {
  const context = fixture(t);
  context.document.dialog = true;
  store.set({ mode: "INFO_PANEL_OPEN" });
  const next = context.button("story-gallery-next");
  const previous = context.button("story-gallery-prev");
  context.document.controls.push(next, previous);
  assert.equal(applyInputAction("NEXT_IMAGE", undefined), true);
  assert.equal(applyInputAction("PREVIOUS_IMAGE", undefined), true);
  assert.equal(next.clicks, 1);
  assert.equal(previous.clicks, 1);
  assert.equal(context.select.mock.callCount(), 0);
  assert.equal(context.back.mock.callCount(), 0);
  assert.equal(context.scale.mock.callCount(), 0);
});

test("gallery actions cannot activate absent, disabled or background-only buttons", (t) => {
  const context = fixture(t);
  const next = context.button("story-gallery-next");
  context.document.controls.push(next);
  assert.equal(applyInputAction("NEXT_IMAGE", undefined), false);
  context.document.dialog = true;
  next.disabled = true;
  assert.equal(applyInputAction("NEXT_IMAGE", undefined), false);
  next.disabled = false;
  next.hidden = true;
  assert.equal(applyInputAction("NEXT_IMAGE", undefined), false);
  assert.equal(applyInputAction("PREVIOUS_IMAGE", undefined), false);
  assert.equal(next.clicks, 0);
});

test("a stale ROTATE_END cannot release another source, but the active source ends exactly once", (t) => {
  const context = fixture(t);
  assert.equal(applyInputAction("ROTATE_START", undefined, "tv"), true);
  const stopped = context.stop.mock.callCount();
  assert.equal(applyInputAction("ROTATE_END", undefined, "remote"), true);
  assert.equal(inputOwnership.owner, "tv");
  assert.equal(context.stop.mock.callCount(), stopped);
  assert.equal(applyInputAction("ROTATE", { dx: 0.1, dy: 0 }, "tv"), true);
  assert.equal(applyInputAction("ROTATE_END", undefined, "tv"), true);
  assert.equal(inputOwnership.owner, null);
  assert.equal(context.stop.mock.callCount(), stopped + 1);
  assert.equal(applyInputAction("ROTATE", { dx: 0.1, dy: 0 }, "tv"), false);
});

test("STOP releases all source motion and freezes the existing particle rotation target", (t) => {
  const context = fixture(t);
  assert.equal(applyInputAction("ROTATE_START", undefined, "tv"), true);
  particles.rotation = 0.7;
  particles.targetRotation = 1.2;
  const ended = context.endScale.mock.callCount();
  assert.equal(applyInputAction("STOP", undefined, "remote"), true);
  assert.equal(inputOwnership.owner, null);
  assert.equal(particles.targetRotation, 0.7);
  assert.equal(context.endScale.mock.callCount(), ended + 1);
  assert.equal(context.back.mock.callCount(), 0);
  assert.equal(applyInputAction("ROTATE", { dx: 0.2, dy: 0 }, "tv"), false);
});

test("BACK releases active input and uses interaction.return only when the existing UI does not consume it", (t) => {
  const context = fixture(t);
  assert.equal(applyInputAction("ROTATE_START", undefined, "remote"), true);
  let events = 0;
  context.window.addEventListener("solaris-back", () => events++);
  assert.equal(applyInputAction("BACK", undefined, "tv"), true);
  assert.equal(inputOwnership.owner, null);
  assert.equal(events, 1);
  assert.equal(context.back.mock.callCount(), 1);
  context.window.addEventListener("solaris-back", (event) =>
    event.preventDefault(),
  );
  assert.equal(applyInputAction("ROTATE_START", undefined, "tv"), true);
  assert.equal(applyInputAction("BACK", undefined, "remote"), true);
  assert.equal(inputOwnership.owner, null);
  assert.equal(events, 2);
  assert.equal(context.back.mock.callCount(), 1);
});

test("disconnect clears the pointer lease so an old remote target cannot be replayed", (t) => {
  const context = fixture(t);
  let resolved = 0;
  context.register(() => {
    resolved++;
    return { id: "moon", label: "Moon", kind: "body", activate: () => true };
  });
  assert.equal(applyInputAction("POINTER", { x: 0.4, y: 0.6 }), true);
  assert.equal(resolved, 1);
  clearRemoteInput();
  assert.equal(inputOwnership.owner, null);
  assert.equal(currentInputTarget(), null);
  assert.equal(applyInputAction("SELECT", { expectedTargetId: "moon" }), false);
  assert.equal(resolved, 1);
});

test("remote cursor exposes accepted hit-test coordinates without selecting anything", (t) => {
  const context = fixture(t);
  const target = context.button("nav-earth");
  context.document.controls.push(target);
  context.document.pointedElement = target;
  assert.equal(currentRemotePointer(), null);
  applyInputAction("POINTER", { x: 0.25, y: 0.75 });
  assert.deepEqual(currentRemotePointer(), { x: 0.25, y: 0.75 });
  const snapshot = currentRemotePointer()!;
  Object.assign(snapshot, { x: 1 });
  assert.deepEqual(currentRemotePointer(), { x: 0.25, y: 0.75 });
  assert.equal(currentInputTarget()?.id, target.id);
  assert.equal(target.clicks, 0);
  assert.equal(context.select.mock.callCount(), 0);
  assert.equal(applyInputAction("POINTER", { x: 4, y: 0.3 }), false);
  assert.deepEqual(currentRemotePointer(), { x: 0.25, y: 0.75 });
});

test("cursor hides on stop, back, selection, rotate, zoom and disconnect without changing selection coordinates", (t) => {
  const context = fixture(t);
  const target = context.button("annotation-tycho");
  context.document.controls.push(target);
  context.document.pointedElement = target;
  for (const [action, payload] of [
    ["STOP", undefined],
    ["BACK", undefined],
    ["SELECT", { expectedTargetId: target.id }],
    ["ROTATE_START", undefined],
    ["ROTATE_END", undefined],
    ["ZOOM", { delta: 0.1 }],
  ] as [RemoteAction, ControlMessage["payload"]][]) {
    applyInputAction("POINTER", { x: 0.2, y: 0.4 });
    assert.ok(currentRemotePointer());
    applyInputAction(action, payload);
    assert.equal(currentRemotePointer(), null, action);
    assert.equal(currentInputTarget()?.id, target.id, action);
  }
  assert.equal(target.clicks, 1);
  applyInputAction("POINTER", { x: 0.2, y: 0.4 });
  clearRemoteInput();
  assert.equal(currentRemotePointer(), null);
});

test("stale or timed-out pointing never leaves a cursor, while fresh input can restore it", (t) => {
  const context = fixture(t);
  applyInputAction("POINTER", { x: 0.4, y: 0.6 });
  context.advance(750);
  assert.equal(currentRemotePointer(), null);
  applyInputAction("POINTER", { x: 0.3, y: 0.2 });
  assert.deepEqual(currentRemotePointer(), { x: 0.3, y: 0.2 });
  context.advance(351);
  inputOwnership.checkTimeout(performance.now());
  assert.equal(currentRemotePointer(), null);
  applyInputAction("SELECT", undefined);
  assert.equal(
    currentRemotePointer(),
    null,
    "SELECT cannot resurrect an old cursor",
  );
});

test("local and TV input hide the remote cursor and rejected remote packets cannot restore it", (t) => {
  const context = fixture(t);
  applyInputAction("POINTER", { x: 0.4, y: 0.6 });
  inputOwnership.preempt(performance.now());
  assert.equal(currentRemotePointer(), null);
  assert.equal(applyInputAction("POINTER", { x: 0.5, y: 0.5 }), false);
  assert.equal(currentRemotePointer(), null);
  context.advance(451);
  applyInputAction("POINTER", { x: 0.4, y: 0.6 }, "tv");
  assert.equal(currentRemotePointer(), null);
  applyInputAction("POINTER", { x: 0.4, y: 0.6 });
  assert.ok(currentRemotePointer());
});
