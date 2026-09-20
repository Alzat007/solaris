import test from "node:test";
import assert from "node:assert/strict";
import {
  PointerFallback,
  type PointerSample,
} from "../src/scene/PointerFallback";
function setup() {
  const calls: string[] = [];
  const state = { locked: false, focused: false, size: 1 };
  const fallback = new PointerFallback({
    locked: () => state.locked,
    focused: () => state.focused,
    overview: () => !state.focused,
    width: () => 800,
    pick: () => "sun",
    point: () => {},
    select: (id) => calls.push(`select:${id}`),
    next: (direction) => calls.push(`next:${direction}`),
    currentScale: () => state.size,
    scale: (value) => {
      state.size = value;
      calls.push("scale");
      return true;
    },
    endScale: () => calls.push("scale:end"),
    startDrag: () => calls.push("drag:start"),
    drag: () => calls.push("drag"),
    endDrag: () => calls.push("drag:end"),
  });
  const pointer = (
    x: number,
    at: number,
    id = 1,
    type = "mouse",
    y = 200,
  ): PointerSample => ({
    pointerId: id,
    pointerType: type,
    clientX: x,
    clientY: y,
    timeStamp: at,
  });
  return { calls, state, fallback, pointer };
}
test("mouse click and touch tap both select the Sun through the shared target path", () => {
  for (const type of ["mouse", "touch"]) {
    const { fallback, pointer, calls } = setup();
    fallback.down(pointer(200, 0, 1, type));
    fallback.up(pointer(202, 100, 1, type));
    assert.deepEqual(
      calls.filter((call) => call.startsWith("select")),
      ["select:sun"],
    );
  }
});
test("mouse drag rotates but its release never also selects", () => {
  const { fallback, pointer, calls } = setup();
  fallback.down(pointer(200, 0));
  fallback.move(pointer(230, 50));
  fallback.up(pointer(280, 100));
  assert.ok(calls.includes("drag"));
  assert.equal(
    calls.some((call) => call.startsWith("select")),
    false,
  );
});
test("touch pinch zoom remains consumed after the first finger lifts", () => {
  const { fallback, pointer, calls, state } = setup();
  fallback.down(pointer(200, 0, 1, "touch"));
  fallback.down(pointer(400, 20, 2, "touch"));
  fallback.move(pointer(600, 100, 2, "touch"));
  assert.equal(state.size, 2);
  fallback.up(pointer(600, 150, 2, "touch"));
  fallback.up(pointer(200, 200, 1, "touch"));
  assert.ok(calls.includes("scale:end"));
  assert.equal(
    calls.some((call) => call.startsWith("select")),
    false,
  );
});
test("a focus touch swipe switches once and never starts rotation or selection", () => {
  for (const [to, direction] of [
    [50, 1],
    [550, -1],
  ]) {
    const { fallback, pointer, calls, state } = setup();
    state.focused = true;
    fallback.down(pointer(300, 0, 1, "touch"));
    fallback.up(pointer(to, 200, 1, "touch"));
    assert.ok(calls.includes(`next:${direction}`));
    assert.equal(calls.includes("drag"), false);
    assert.equal(
      calls.some((call) => call.startsWith("select")),
      false,
    );
  }
});
test("overview touch swipe rotates instead of switching planets", () => {
  const { fallback, pointer, calls } = setup();
  fallback.down(pointer(400, 0, 1, "touch"));
  fallback.up(pointer(150, 200, 1, "touch"));
  assert.ok(calls.includes("drag"));
  assert.equal(
    calls.some((call) => call.startsWith("next")),
    false,
  );
});
test("slow or mostly vertical focus drags never become swipes", () => {
  for (const [x, y, duration] of [
    [50, 200, 900],
    [100, 600, 200],
  ]) {
    const { fallback, pointer, calls, state } = setup();
    state.focused = true;
    fallback.down(pointer(300, 0, 1, "touch"));
    fallback.up(pointer(x, duration, 1, "touch", y));
    assert.equal(
      calls.some(
        (call) => call.startsWith("next") || call.startsWith("select"),
      ),
      false,
    );
  }
});
test("animation locks cancel an in-flight pointer sequence without replaying its click", () => {
  const { fallback, pointer, calls, state } = setup();
  fallback.down(pointer(200, 0));
  state.locked = true;
  fallback.move(pointer(201, 50));
  state.locked = false;
  fallback.up(pointer(201, 100));
  assert.equal(
    calls.some((call) => call.startsWith("select")),
    false,
  );
  state.locked = true;
  assert.equal(fallback.down(pointer(200, 200)), false);
});
