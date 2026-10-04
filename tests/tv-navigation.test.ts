import test from "node:test";
import assert from "node:assert/strict";
import {
  findNextFocusIndex,
  installTvNavigation,
  isTvMode,
  type FocusRect,
} from "../src/platform/tvNavigation";

const grid: FocusRect[] = [
  { left: 0, top: 0, width: 80, height: 40 },
  { left: 100, top: 0, width: 80, height: 40 },
  { left: 0, top: 60, width: 80, height: 40 },
  { left: 100, top: 60, width: 80, height: 40 },
];

test("TV mode requires an explicit tv=1 query parameter", () => {
  assert.equal(isTvMode("?tv=1&lang=en"), true);
  assert.equal(isTvMode("tv=1"), true);
  for (const value of ["", "?tv", "?tv=0", "?tv=true", "?notv=1"])
    assert.equal(isTvMode(value), false);
});

test("D-pad spatial navigation selects adjacent controls in a grid", () => {
  assert.equal(findNextFocusIndex(grid, 0, "right"), 1);
  assert.equal(findNextFocusIndex(grid, 0, "down"), 2);
  assert.equal(findNextFocusIndex(grid, 3, "left"), 2);
  assert.equal(findNextFocusIndex(grid, 3, "up"), 1);
});

test("D-pad edges do not wrap to an unrelated control", () => {
  assert.equal(findNextFocusIndex(grid, 0, "left"), 0);
  assert.equal(findNextFocusIndex(grid, 0, "up"), 0);
  assert.equal(findNextFocusIndex(grid, 3, "right"), 3);
  assert.equal(findNextFocusIndex(grid, 3, "down"), 3);
});

test("missing focus starts at the first available control", () => {
  assert.equal(findNextFocusIndex([], -1, "right"), -1);
  assert.equal(findNextFocusIndex(grid, -1, "down"), 0);
  assert.equal(findNextFocusIndex(grid, 10, "left"), 0);
});

test("navigation favours aligned controls and breaks ties by document order", () => {
  const items = [
    grid[0],
    { left: 100, top: 80, width: 80, height: 40 },
    { left: 200, top: 0, width: 80, height: 40 },
    { left: 200, top: 0, width: 80, height: 40 },
  ];
  assert.equal(findNextFocusIndex(items, 0, "right"), 2);
});

// This fixture checks event ownership; real browser / native input is separate QA.
function fixture(search = "?tv=1") {
  const document = new EventTarget() as EventTarget & {
    activeElement: unknown;
    defaultView: unknown;
  };
  const window = Object.assign(new EventTarget(), {
    location: { search },
    Event,
    getComputedStyle: () => ({ visibility: "visible" }),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  document.defaultView = window;
  document.activeElement = null;
  const buttons = grid.map((rect) => ({
    tag: "button",
    tabIndex: 0,
    disabled: false,
    hidden: false,
    isContentEditable: false,
    clicks: 0,
    expanded: false,
    selectedIndex: 0,
    options: [
      { disabled: false, hidden: false, parentElement: null },
      { disabled: false, hidden: false, parentElement: null },
      { disabled: false, hidden: false, parentElement: null },
    ] as { disabled: boolean; hidden: boolean; parentElement: { matches: (selector: string) => boolean } | null }[],
    events: [] as string[],
    attributes: new Map<string, string>(),
    closedDetails: null as { parentElement: null; querySelector: () => { contains: (element: unknown) => boolean } } | null,
    getBoundingClientRect: () => rect,
    getAttribute(name: string) { return this.attributes.get(name) ?? null; },
    setAttribute(name: string, value: string) { this.attributes.set(name, value); },
    removeAttribute(name: string) { this.attributes.delete(name); },
    dispatchEvent(event: Event) { this.events.push(event.type); return true; },
    closest(selector: string) {
      return selector === "details:not([open])" ? this.closedDetails :
        this.hidden ? {} : null;
    },
    matches(selector: string) {
      return selector === ":disabled" ? this.disabled :
        selector.split(", ").includes(this.tag);
    },
    focus() { document.activeElement = this; },
    scrollIntoView() {},
    click() {
      this.clicks++;
      if (this.tag === "summary") this.expanded = !this.expanded;
    },
  }));
  const root = {
    ownerDocument: document,
    querySelector: () => null,
    querySelectorAll: (selector: string) => buttons.filter((button) =>
      selector.split(",").some((part) => part.trim().startsWith(button.tag)),
    ),
  } as unknown as HTMLElement;
  function key(key: string, properties: Record<string, unknown> = {}) {
    const event = Object.assign(new Event("keydown", { cancelable: true }), {
      key, repeat: false, keyCode: 0, isComposing: false,
      altKey: false, ctrlKey: false, metaKey: false, ...properties,
    });
    document.dispatchEvent(event);
    return event;
  }
  return { root, buttons, document, window, key };
}

test("TV installation is opt-in and cleanup restores event ownership", () => {
  const desktop = fixture("");
  const noOp = installTvNavigation(desktop.root, () => {});
  assert.equal(desktop.key("ArrowRight").defaultPrevented, false);
  assert.equal(desktop.document.activeElement, null);
  noOp();
  const tv = fixture();
  const cleanup = installTvNavigation(tv.root, () => {});
  assert.equal(tv.document.activeElement, tv.buttons[0]);
  assert.equal(tv.key("ArrowRight").defaultPrevented, true);
  assert.equal(tv.document.activeElement, tv.buttons[1]);
  cleanup();
  cleanup();
  assert.equal(tv.key("ArrowRight").defaultPrevented, false);
});

test("repeat Enter and Back never repeat application actions", () => {
  const tv = fixture();
  let backs = 0;
  const cleanup = installTvNavigation(tv.root, () => { backs++; });
  tv.key("Enter");
  tv.key("Enter", { repeat: true });
  assert.equal(tv.buttons[0].clicks, 1);
  tv.key("Escape");
  tv.key("Escape", { repeat: true });
  tv.key("Unidentified", { keyCode: 4 });
  assert.equal(backs, 2);
  cleanup();
});

test("D-pad reaches summaries and Enter toggles them exactly once per press", () => {
  const tv = fixture();
  tv.buttons[1].tag = "summary";
  const cleanup = installTvNavigation(tv.root, () => {});
  assert.equal(tv.key("ArrowRight").defaultPrevented, true);
  assert.equal(tv.document.activeElement, tv.buttons[1]);
  assert.equal(tv.key("Enter").defaultPrevented, true);
  assert.equal(tv.buttons[1].expanded, true);
  tv.key("Enter", { repeat: true });
  assert.equal(tv.buttons[1].expanded, true);
  assert.equal(tv.buttons[1].clicks, 1);
  tv.key("Enter");
  assert.equal(tv.buttons[1].expanded, false);
  assert.equal(tv.buttons[1].clicks, 2);
  cleanup();
});

test("text editing, IME and modifier navigation remain browser owned", () => {
  const tv = fixture();
  tv.buttons[0].tag = "input";
  const cleanup = installTvNavigation(tv.root, () => {});
  for (const key of ["ArrowLeft", "ArrowRight", "Enter"])
    assert.equal(tv.key(key).defaultPrevented, false);
  assert.equal(tv.key("ArrowDown", { isComposing: true }).defaultPrevented, false);
  assert.equal(tv.key("ArrowDown", { keyCode: 229 }).defaultPrevented, false);
  assert.equal(tv.key("ArrowDown", { ctrlKey: true }).defaultPrevented, false);
  tv.buttons[0].tag = "textarea";
  assert.equal(tv.key("ArrowDown").defaultPrevented, false);
  cleanup();
});

test("disabled and hidden controls do not receive TV focus", () => {
  const tv = fixture();
  tv.buttons[0].disabled = true;
  tv.buttons[1].hidden = true;
  const cleanup = installTvNavigation(tv.root, () => {});
  assert.equal(tv.document.activeElement, tv.buttons[2]);
  tv.key("ArrowRight");
  assert.equal(tv.document.activeElement, tv.buttons[3]);
  cleanup();
});

test("closed details links with nonzero layout cannot take focus from visible summary", () => {
  const tv = fixture();
  tv.buttons[1].tag = "a";
  tv.buttons[2].tag = "summary";
  const details = {
    parentElement: null,
    querySelector: () => ({ contains: (element: unknown) => element === tv.buttons[2] }),
  };
  tv.buttons[1].closedDetails = details;
  tv.buttons[2].closedDetails = details;
  const cleanup = installTvNavigation(tv.root, () => {});
  tv.key("ArrowDown");
  assert.equal(tv.document.activeElement, tv.buttons[2]);
  tv.key("ArrowUp");
  tv.key("ArrowRight");
  assert.notEqual(tv.document.activeElement, tv.buttons[1]);
  cleanup();
});

test("closed selects navigate, editing changes options once, Enter exits", () => {
  const tv = fixture();
  tv.buttons[0].tag = "select";
  const cleanup = installTvNavigation(tv.root, () => {});
  assert.equal(tv.key("ArrowRight").defaultPrevented, true);
  assert.equal(tv.document.activeElement, tv.buttons[1]);
  tv.key("ArrowLeft");
  tv.key("Enter");
  assert.equal(tv.buttons[0].getAttribute("data-tv-editing"), "true");
  assert.equal(tv.key("ArrowDown").defaultPrevented, true);
  assert.equal(tv.buttons[0].selectedIndex, 1);
  assert.deepEqual(tv.buttons[0].events, ["input", "change"]);
  assert.equal(tv.key("ArrowUp").defaultPrevented, true);
  assert.equal(tv.buttons[0].selectedIndex, 0);
  tv.key("Enter", { repeat: true });
  assert.equal(tv.buttons[0].getAttribute("data-tv-editing"), "true");
  tv.key("Enter");
  assert.equal(tv.buttons[0].getAttribute("data-tv-editing"), null);
  tv.key("ArrowRight");
  assert.equal(tv.document.activeElement, tv.buttons[1]);
  cleanup();
});

test("select editing skips unavailable options, clamps at edges and permits held D-pad", () => {
  const tv = fixture();
  const select = tv.buttons[0];
  select.tag = "select";
  select.options = [
    { disabled: false, hidden: false, parentElement: null },
    { disabled: true, hidden: false, parentElement: null },
    { disabled: false, hidden: false, parentElement: { matches: () => true } },
    { disabled: false, hidden: true, parentElement: null },
    { disabled: false, hidden: false, parentElement: null },
    { disabled: false, hidden: false, parentElement: null },
  ];
  const cleanup = installTvNavigation(tv.root, () => {});
  tv.key("Enter");
  tv.key("ArrowDown");
  assert.equal(select.selectedIndex, 4);
  tv.key("ArrowDown", { repeat: true });
  assert.equal(select.selectedIndex, 5);
  const changes = select.events.length;
  tv.key("ArrowDown");
  assert.equal(select.selectedIndex, 5);
  assert.equal(select.events.length, changes);
  tv.key("ArrowUp");
  tv.key("ArrowUp");
  assert.equal(select.selectedIndex, 0);
  cleanup();
});

test("keyboard and native Back close select editing before returning a scene", () => {
  const tv = fixture();
  tv.buttons[0].tag = "select";
  let backs = 0;
  const cleanup = installTvNavigation(tv.root, () => { backs++; return false; });
  tv.key("Enter");
  tv.key("Escape");
  assert.equal(tv.buttons[0].getAttribute("data-tv-editing"), null);
  assert.equal(backs, 0);
  tv.key("Enter");
  const editingBack = new Event("solaris-back", { cancelable: true });
  tv.window.dispatchEvent(editingBack);
  assert.equal(editingBack.defaultPrevented, true);
  assert.equal(tv.buttons[0].getAttribute("data-tv-editing"), null);
  assert.equal(backs, 0);
  tv.key("Escape");
  assert.equal(backs, 1);
  cleanup();
});

test("native Back acknowledgment is cancelable and has one installed consumer", () => {
  const tv = fixture();
  let oldBacks = 0;
  let newBacks = 0;
  const oldCleanup = installTvNavigation(tv.root, () => { oldBacks++; });
  const newCleanup = installTvNavigation(tv.root, () => { newBacks++; return false; });
  oldCleanup();
  const rootBack = new Event("solaris-back", { cancelable: true });
  tv.window.dispatchEvent(rootBack);
  assert.equal(rootBack.defaultPrevented, false);
  assert.equal(oldBacks, 0);
  assert.equal(newBacks, 1);
  newCleanup();
  const handledCleanup = installTvNavigation(tv.root, () => true);
  const handled = new Event("solaris-back", { cancelable: true });
  tv.window.dispatchEvent(handled);
  assert.equal(handled.defaultPrevented, true);
  handledCleanup();
});
