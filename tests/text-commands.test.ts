import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { planets } from "../src/data/planets";
import { InteractionController } from "../src/interaction/InteractionController";
import { InteractionStateMachine } from "../src/interaction/InteractionStateMachine";
import { store } from "../src/interaction/store";
import {
  executeTextCommand,
  parseTextCommand,
  resolveTextCommand,
  type SceneCommand,
} from "../src/interaction/textCommands";
import { particles } from "../src/particles/ParticleEngine";

function setup(t: TestContext) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  const controller = new InteractionController();
  controller.ready();
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    hover: null,
    transitioning: false,
    infoVisible: false,
    heldUniverse: false,
    sound: false,
    webglError: false,
  });
  Object.assign(particles, {
    sunInterior: 0,
    collapse: 0,
    focus: 0,
    explosion: 0,
    targetScale: 1,
    dragging: false,
    rotationVelocity: 0,
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => {
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
    t.mock.timers.reset();
  });
  return controller;
}
function timeline(controller: InteractionController) {
  return (controller as unknown as { transition: gsap.core.Timeline })
    .transition;
}
function finish(controller: InteractionController) {
  timeline(controller).progress(1);
  gsap.ticker.sleep();
}
function focusEarth(controller: InteractionController) {
  assert.equal(controller.select("earth"), true);
  finish(controller);
}
const earthCommand: SceneCommand = { type: "select", planetId: "earth" };
const returnCommand: SceneCommand = { type: "return" };

test("the whitelist accepts all eight Chinese and English planet names and explicit commands", () => {
  for (const planet of planets) {
    const expected = { type: "select", planetId: planet.id };
    for (const text of [
      planet.chineseName,
      planet.name.toLowerCase(),
      `  ${planet.name}  `,
      `去${planet.chineseName}`,
      `前往 ${planet.chineseName}`,
      `带我去${planet.chineseName}`,
      `go to ${planet.name}`,
      `take me to ${planet.name.toLowerCase()}`,
      `SHOW   ME   ${planet.name}`,
    ])
      assert.deepEqual(parseTextCommand(text), expected, text);
  }
  assert.deepEqual(parseTextCommand("返回太阳系"), returnCommand);
  assert.deepEqual(parseTextCommand(" BACK TO SOLAR SYSTEM "), returnCommand);
});

test("empty, negative, ambiguous, question, unknown, multiline and overlong input is rejected", () => {
  for (const text of [
    "",
    "   ",
    "太阳",
    "moon",
    "pluto",
    "不要去火星",
    "别前往地球",
    "don't go to earth",
    "do not show me mars",
    "地球和火星",
    "go to earth and mars",
    "地球是什么",
    "前往土星好吗",
    "earth?",
    "show me the earth",
    "go to earth please",
    "go to earth\n",
    "前往\u2028地球",
    "前往\u2029地球",
    "earth\u0000",
    " ".repeat(119) + "地球",
  ])
    assert.equal(parseTextCommand(text), null, text);
  assert.deepEqual(parseTextCommand(" ".repeat(118) + "地球"), earthCommand);
});

test("invalid input leaves the real controller and scene unchanged", (t) => {
  const controller = setup(t);
  const select = t.mock.method(controller, "select");
  const back = t.mock.method(controller, "return");
  const before = store.get();
  for (const text of ["", "不要去火星", "地球和火星", "土星有多少卫星"])
    assert.equal(
      executeTextCommand(text, controller, store.get()).status,
      "invalid",
    );
  assert.equal(select.mock.calls.length, 0);
  assert.equal(back.mock.calls.length, 0);
  assert.equal(store.get(), before);
  assert.equal(controller.machine.state, "SOLAR_SYSTEM");
});

test("a real selection starts an animation and completes only after its timeline finishes", (t) => {
  const controller = setup(t);
  const result = executeTextCommand("带我去地球", controller, store.get());
  assert.equal(result.status, "started");
  assert.deepEqual(result.command, earthCommand);
  assert.equal(store.get().mode, "PLANET_TRANSITION");
  assert.equal(store.get().selected, "earth");
  assert.equal(
    resolveTextCommand(earthCommand, controller, store.get()).status,
    "started",
  );
  timeline(controller).progress(0.99);
  assert.equal(
    resolveTextCommand(earthCommand, controller, store.get()).status,
    "started",
  );
  finish(controller);
  assert.equal(
    resolveTextCommand(earthCommand, controller, store.get()).status,
    "completed",
  );
  assert.equal(store.get().mode, "PLANET_OVERVIEW");
  assert.equal(store.get().infoVisible, false);
  t.mock.timers.tick(400);
  assert.equal(store.get().infoVisible, true);
});

test("lock is checked before repeated-target detection and a second command cannot replace the flight", (t) => {
  const controller = setup(t);
  executeTextCommand("地球", controller, store.get());
  const before = store.get();
  const originalTimeline = timeline(controller);
  for (const text of ["地球", "火星", "返回太阳系"])
    assert.equal(
      executeTextCommand(text, controller, store.get()).status,
      "busy",
    );
  assert.equal(store.get(), before);
  assert.equal(timeline(controller), originalTimeline);
  assert.equal(
    resolveTextCommand(earthCommand, controller, store.get()).status,
    "started",
  );
});

test("a repeated stable planet does not replay animation or hide existing information", (t) => {
  const controller = setup(t);
  focusEarth(controller);
  t.mock.timers.tick(400);
  particles.targetScale = 1.4;
  const select = t.mock.method(controller, "select");
  const before = store.get();
  const originalTimeline = timeline(controller);
  assert.equal(
    executeTextCommand("go to earth", controller, store.get()).status,
    "already_done",
  );
  assert.equal(select.mock.calls.length, 0);
  assert.equal(store.get(), before);
  assert.equal(timeline(controller), originalTimeline);
  assert.equal(particles.targetScale, 1.4);
});

test("selecting another planet works from a stable focus", (t) => {
  const controller = setup(t);
  focusEarth(controller);
  assert.equal(
    executeTextCommand("前往火星", controller, store.get()).status,
    "started",
  );
  assert.equal(store.get().selected, "mars");
  finish(controller);
  assert.equal(
    resolveTextCommand(
      { type: "select", planetId: "mars" },
      controller,
      store.get(),
    ).status,
    "completed",
  );
});

test("return starts from focus, waits through the return animation, and is then idempotent", (t) => {
  const controller = setup(t);
  assert.equal(
    executeTextCommand("返回太阳系", controller, store.get()).status,
    "already_done",
  );
  focusEarth(controller);
  const result = executeTextCommand(
    "back to solar system",
    controller,
    store.get(),
  );
  assert.equal(result.status, "started");
  assert.deepEqual(result.command, returnCommand);
  assert.equal(store.get().selected, null);
  assert.equal(
    resolveTextCommand(returnCommand, controller, store.get()).status,
    "started",
  );
  timeline(controller).progress(0.99);
  assert.equal(
    resolveTextCommand(returnCommand, controller, store.get()).status,
    "started",
  );
  finish(controller);
  assert.equal(
    resolveTextCommand(returnCommand, controller, store.get()).status,
    "completed",
  );
  const back = t.mock.method(controller, "return");
  assert.equal(
    executeTextCommand("返回太阳系", controller, store.get()).status,
    "already_done",
  );
  assert.equal(back.mock.calls.length, 0);
});

for (const phase of ["intro", "sun entry", "collapse", "rebirth"] as const) {
  test(`${phase} rejects text navigation while its real animation is locked`, (t) => {
    const controller = setup(t);
    if (phase === "intro") {
      controller.machine = new InteractionStateMachine();
      store.set({ mode: "INTRO" });
    } else if (phase === "sun entry") {
      controller.enterSun();
    } else {
      controller.collapse();
      if (phase === "rebirth") {
        finish(controller);
        controller.rebirth();
      }
    }
    const before = store.get();
    assert.equal(
      executeTextCommand("地球", controller, store.get()).status,
      "busy",
    );
    assert.equal(
      executeTextCommand("返回太阳系", controller, store.get()).status,
      "busy",
    );
    assert.equal(store.get(), before);
  });
}

for (const phase of ["sun interior", "collapsed"] as const) {
  test(`${phase} gives a specific blocked reason for selection and still permits return`, (t) => {
    const controller = setup(t);
    if (phase === "sun interior") controller.enterSun();
    else controller.collapse();
    finish(controller);
    assert.equal(controller.isLocked(), false);
    const before = store.get();
    const result = executeTextCommand("地球", controller, store.get());
    assert.equal(result.status, "blocked");
    assert.match(
      result.message,
      phase === "sun interior" ? /太阳内部/ : /坍缩/,
    );
    assert.equal(store.get(), before);
    assert.equal(
      executeTextCommand("返回太阳系", controller, store.get()).status,
      "started",
    );
    finish(controller);
    assert.equal(
      resolveTextCommand(returnCommand, controller, store.get()).status,
      "completed",
    );
  });
}

test("active zoom blocks both repeat selection and return until zoom ends", (t) => {
  const controller = setup(t);
  focusEarth(controller);
  controller.scale(1.3);
  assert.equal(controller.isLocked(), false);
  const before = store.get();
  for (const text of ["地球", "火星", "返回太阳系"]) {
    const result = executeTextCommand(text, controller, store.get());
    assert.equal(result.status, "blocked");
    assert.match(result.message, /缩放/);
  }
  assert.equal(store.get(), before);
  controller.endScale();
  assert.equal(
    executeTextCommand("地球", controller, store.get()).status,
    "already_done",
  );
});

test("controller rejection never produces a started or completed result", (t) => {
  const controller = setup(t);
  const before = store.get();
  const select = t.mock.method(controller, "select", () => false);
  assert.equal(
    executeTextCommand("地球", controller, store.get()).status,
    "blocked",
  );
  assert.equal(store.get(), before);
  select.mock.restore();
  focusEarth(controller);
  const focused = store.get();
  t.mock.method(controller, "return", () => false);
  assert.equal(
    executeTextCommand("返回太阳系", controller, store.get()).status,
    "blocked",
  );
  assert.equal(store.get(), focused);
});

test("render failure blocks execution and interrupts a pending command even on its target", (t) => {
  const controller = setup(t);
  store.set({ webglError: true });
  const before = store.get();
  assert.equal(
    executeTextCommand("地球", controller, store.get()).status,
    "blocked",
  );
  assert.equal(
    executeTextCommand("返回太阳系", controller, store.get()).status,
    "blocked",
  );
  assert.equal(store.get(), before);
  store.set({ webglError: false });
  executeTextCommand("地球", controller, store.get());
  store.set({ webglError: true });
  assert.equal(
    resolveTextCommand(earthCommand, controller, store.get()).status,
    "interrupted",
  );
  finish(controller);
  assert.equal(
    resolveTextCommand(earthCommand, controller, store.get()).status,
    "interrupted",
  );
  assert.equal(
    executeTextCommand("地球", controller, store.get()).status,
    "blocked",
  );
});

test("a changed target interrupts resolution during its flight and after it settles", (t) => {
  const controller = setup(t);
  executeTextCommand("地球", controller, store.get());
  finish(controller);
  controller.select("mars");
  assert.equal(
    resolveTextCommand(earthCommand, controller, store.get()).status,
    "interrupted",
  );
  finish(controller);
  assert.equal(
    resolveTextCommand(earthCommand, controller, store.get()).status,
    "interrupted",
  );
});

test("a return command does not report completion after navigation moves away from overview", (t) => {
  const controller = setup(t);
  focusEarth(controller);
  executeTextCommand("返回太阳系", controller, store.get());
  finish(controller);
  controller.select("mars");
  assert.equal(
    resolveTextCommand(returnCommand, controller, store.get()).status,
    "interrupted",
  );
  finish(controller);
  assert.equal(
    resolveTextCommand(returnCommand, controller, store.get()).status,
    "interrupted",
  );
});

test("mismatched scene modes cannot report completion and real animation locks take precedence", (t) => {
  const controller = setup(t);
  focusEarth(controller);
  const earthState = store.get();
  controller.select("mars");
  assert.equal(
    executeTextCommand("地球", controller, earthState).status,
    "busy",
  );
  assert.equal(
    resolveTextCommand(earthCommand, controller, earthState).status,
    "interrupted",
  );
  finish(controller);
  const inconsistentState = { ...store.get(), mode: "SOLAR_SYSTEM" as const };
  assert.equal(
    executeTextCommand("地球", controller, inconsistentState).status,
    "blocked",
  );
  assert.equal(
    resolveTextCommand(returnCommand, controller, inconsistentState).status,
    "interrupted",
  );
});
