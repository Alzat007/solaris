import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { gsap } from "gsap";
import { InteractionController } from "../src/interaction/InteractionController";
import { InteractionStateMachine } from "../src/interaction/InteractionStateMachine";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { getImmersiveSite } from "../src/exploration/immersiveCatalog";
import { descentPhase, localAtlasPoint } from "../src/exploration/sceneState";
import { placeHotspotLabels } from "../src/exploration/hotspotLayout";

function setup(t: TestContext) {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
  const c = new InteractionController();
  c.ready();
  store.set({
    mode: "SOLAR_SYSTEM",
    selected: null,
    transitioning: false,
    infoVisible: false,
    help: false,
    webglError: false,
    destinationId: null,
    activeHotspotId: null,
    explorationCountryId: null,
    explorationContinentId: null,
    explorationCityId: null,
    explorationError: "",
    locationResourcesReady: false,
  });
  Object.assign(particles, {
    focus: 0,
    assembly: 0,
    sunInterior: 0,
    locationApproach: 0,
  });
  t.after(() => {
    gsap.globalTimeline.clear();
    gsap.ticker.sleep();
  });
  return c;
}
function timeline(c: InteractionController) {
  const animation = (c as unknown as { transition: gsap.core.Timeline })
    .transition;
  assert.ok(animation);
  animation.pause();
  return animation;
}
function finish(c: InteractionController) {
  timeline(c).progress(1);
  gsap.ticker.sleep();
}

test("Earth cannot bypass continent and country selection, then reaches a local view before a hotspot card", async (t) => {
  const c = setup(t);
  assert.equal(c.chooseCountry("cn"), false);
  assert.equal(await c.chooseCity("city-beijing", async () => {}), false);
  c.select("earth");
  finish(c);
  c.browse();
  assert.equal(store.get().mode, "EARTH_CONTINENT_PICKER");
  assert.equal(c.chooseContinent("europe"), false);
  assert.equal(await c.enterDestination("beijing", async () => {}), false);
  assert.equal(c.chooseContinent("asia"), true);
  assert.equal(store.get().mode, "EARTH_COUNTRY_PICKER");
  assert.equal(c.chooseCountry("us"), false);
  assert.equal(c.chooseCountry("cn"), true);
  assert.equal(store.get().mode, "EARTH_CITY_PICKER");
  assert.equal(await c.chooseCity("city-paris", async () => {}), false);
  assert.equal(await c.chooseCity("city-beijing", async () => {}), true);
  assert.equal(store.get().mode, "DESCENT_TRANSITION");
  assert.equal(c.openHotspot("beijing-tiananmen"), false);
  finish(c);
  assert.equal(store.get().mode, "LOCATION_OVERVIEW");
  assert.equal(store.get().activeHotspotId, null);
  assert.equal(c.openHotspot("not-a-hotspot"), false);
  for (const id of [
    "beijing-tiananmen",
    "beijing-great-wall",
    "beijing-birds-nest",
  ]) {
    assert.equal(c.openHotspot(id), true);
    assert.equal(store.get().mode, "INFO_PANEL_OPEN");
    assert.equal(c.openHotspot(id), false);
    assert.equal(c.return(), true);
    assert.equal(store.get().mode, "LOCATION_OVERVIEW");
  }
});
test("Mars region selection shares descent and hotspot states but cannot open Earth content", async (t) => {
  const c = setup(t);
  c.select("mars");
  finish(c);
  c.browse();
  assert.equal(store.get().mode, "PLANET_REGION_PICKER");
  assert.equal(c.chooseContinent("asia"), false);
  assert.equal(await c.enterDestination("beijing", async () => {}), false);
  assert.equal(
    await c.enterDestination("mars-olympus-mons", async () => {}),
    true,
  );
  finish(c);
  assert.equal(c.openHotspot("beijing-tiananmen"), false);
  assert.equal(c.openHotspot("olympus-summit-caldera"), true);
  c.return();
  c.return();
  assert.equal(store.get().mode, "PLANET_REGION_PICKER");
});
test("canceling a planet selection restores its previous stable state and ignores stale completion", (t) => {
  const c = setup(t);
  c.select("earth");
  finish(c);
  store.set({ infoVisible: true });
  c.select("mars");
  const pending = timeline(c);
  const complete = pending.eventCallback("onComplete");
  pending.progress(0.4);
  assert.equal(c.return(), true);
  const stable = store.get();
  assert.equal(stable.mode, "PLANET_OVERVIEW");
  assert.equal(stable.selected, "earth");
  assert.equal(stable.infoVisible, true);
  complete?.();
  assert.equal(store.get(), stable);
});
test("canceling a return to the solar system restores the focused planet and ignores stale completion", (t) => {
  const c = setup(t);
  c.select("earth");
  finish(c);
  store.set({ infoVisible: true });
  particles.targetScale = 1.4;
  assert.equal(c.return(), true);
  const pending = timeline(c);
  const complete = pending.eventCallback("onComplete");
  pending.progress(0.5);
  assert.equal(c.return(), true);
  assert.equal(store.get().mode, "PLANET_OVERVIEW");
  assert.equal(store.get().selected, "earth");
  assert.equal(store.get().infoVisible, true);
  assert.equal(particles.focus, 1);
  assert.equal(particles.targetScale, 1.4);
  const stable = store.get();
  complete?.();
  assert.equal(store.get(), stable);
});
test("the machine restores the exact descent origin and explicitly opens/closes a card", () => {
  const m = new InteractionStateMachine();
  m.send("READY");
  m.send("SELECT");
  m.send("TRANSITION_END");
  m.send("BROWSE_EARTH");
  m.send("PICK_CONTINENT");
  m.send("PICK_COUNTRY");
  m.send("ENTER_LOCATION");
  assert.equal(m.locked, true);
  m.send("LOCATION_CANCEL");
  assert.equal(m.state, "EARTH_CITY_PICKER");
  m.send("ENTER_LOCATION");
  m.send("LOCATION_READY");
  m.send("OPEN_HOTSPOT");
  assert.equal(m.state, "INFO_PANEL_OPEN");
  m.send("CLOSE_HOTSPOT");
  assert.equal(m.state, "LOCATION_OVERVIEW");
  m.send("LOCATION_CANCEL");
  assert.equal(m.state, "EARTH_CITY_PICKER");
});
test("descent phases are bounded, cover the scale handoff and end in a clear local view", () => {
  assert.deepEqual(descentPhase(-1), descentPhase(0));
  assert.deepEqual(descentPhase(2), descentPhase(1));
  assert.equal(descentPhase(0).localVisible, false);
  assert.equal(descentPhase(1).localVisible, true);
  assert.equal(descentPhase(1).cloudOpacity, 0);
  assert.ok(descentPhase(0.56).cloudOpacity > 0.95);
  assert.equal(descentPhase(1).local, 1);
});
test("geographic atlas coordinates retain cardinal directions and different planetary scales", () => {
  const earth = getImmersiveSite("beijing")!,
    mars = getImmersiveSite("mars-olympus-mons")!;
  const origin = localAtlasPoint(
    earth,
    earth.center.latitude,
    earth.center.longitude,
  );
  assert.ok(Math.abs(origin.x) < 1e-10);
  assert.ok(Math.abs(origin.z) < 1e-10);
  assert.ok(
    localAtlasPoint(earth, earth.center.latitude + 1, earth.center.longitude)
      .z < 0,
  );
  assert.ok(
    localAtlasPoint(earth, earth.center.latitude, earth.center.longitude + 1)
      .x > 0,
  );
  const e = localAtlasPoint(
    { ...earth, spanKm: 100 },
    1 + earth.center.latitude,
    earth.center.longitude,
  );
  const m = localAtlasPoint(
    { ...mars, spanKm: 100 },
    1 + mars.center.latitude,
    mars.center.longitude,
  );
  assert.ok(Math.abs(e.z) > Math.abs(m.z));
});
test("nearby geographic hotspot labels separate without moving their anchors", () => {
  const anchors = [
    { x: 160, y: 290, width: 90, height: 42 },
    { x: 160, y: 275, width: 140, height: 42 },
    { x: 5, y: 220, width: 170, height: 42 },
  ];
  const snapshot = structuredClone(anchors);
  const labels = placeHotspotLabels(anchors, { width: 320, height: 568 });
  assert.deepEqual(anchors, snapshot);
  for (let i = 0; i < labels.length; i++) {
    assert.ok(labels[i].x >= labels[i].width / 2);
    assert.ok(labels[i].x + labels[i].width / 2 <= 320);
    for (const other of labels.slice(i + 1))
      assert.ok(
        Math.abs(labels[i].x - other.x) >=
          (labels[i].width + other.width) / 2 ||
          Math.abs(labels[i].y - other.y) >=
            (labels[i].height + other.height) / 2,
      );
  }
});
test("three labels near the top cannot oscillate into the same occupied slot", () => {
  const anchors = [129, 139, 149].map((y) => ({
    x: 160,
    y,
    width: 150,
    height: 42,
  }));
  for (const height of [390, 568, 844]) {
    const labels = placeHotspotLabels(anchors, { width: 320, height });
    for (let i = 0; i < labels.length; i++) {
      assert.ok(labels[i].y - 21 >= 106);
      assert.ok(labels[i].y + 21 <= height - 90);
      for (const other of labels.slice(i + 1))
        assert.ok(Math.abs(labels[i].y - other.y) >= 54);
    }
  }
});
