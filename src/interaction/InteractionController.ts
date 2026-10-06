import { gsap } from "gsap";
import {
  InteractionStateMachine,
  type InteractionEvent,
  type InteractionState,
} from "./InteractionStateMachine";
import { store } from "./store";
import { rotation } from "./rotation";
import { particles } from "../particles/ParticleEngine";
import { planets, type PlanetId } from "../data/planets";
import { audio } from "../audio/AudioManager";
import { gestureConfig as config } from "../gesture/gestureConfig";
import type { CelestialId } from "../gesture/gestureFeedback";
import { gestureTargets } from "../gesture/gestureTargets";
import { getPlanetAnnotation, getPlanetStory } from "../exploration/planetAtlasCatalog";
import {
  getPlanetAtlasRotation,
  isPlanetAtlasVisible,
  setPlanetAutoRotate,
} from "../exploration/planetAtlasState";
import { usesLightEarth } from "../exploration/earthAtlasState";
import { assets } from "../exploration/content";
import {
  getImmersiveSite,
  validateImmersiveCatalog,
} from "../exploration/immersiveCatalog";
import {
  bodyTransforms,
  facingRotation,
  getSiteResourcePaths,
  pickerModes,
} from "../exploration/sceneState";

export type ResourceLoader = (
  paths: string[],
  signal?: AbortSignal,
) => Promise<void>;
const preloadLocation: ResourceLoader = (paths, signal) =>
  Promise.all(
    paths.map(
      (path) =>
        new Promise<void>((resolve, reject) => {
          const image = new Image();
          const cleanup = () => {
            clearTimeout(timer);
            image.onload = image.onerror = null;
            signal?.removeEventListener("abort", abort);
          };
          const fail = (reason: string) => {
            cleanup();
            image.src = "";
            reject(new Error(reason));
          };
          const abort = () => fail("Resource cancelled");
          const timer = setTimeout(() => fail("Resource timeout"), 10000);
          image.onload = () => {
            cleanup();
            resolve();
          };
          image.onerror = () => fail("Resource unavailable");
          signal?.addEventListener("abort", abort, { once: true });
          if (signal?.aborted) {
            abort();
            return;
          }
          image.src = new URL(path.replace(/^\//, ""), document.baseURI).href;
        }),
    ),
  ).then(() => undefined);

export class InteractionController {
  machine = new InteractionStateMachine();
  private transition: gsap.core.Timeline | null = null;
  private infoTimer: ReturnType<typeof setTimeout> | null = null;
  private visited = new Set<PlanetId>();
  private locationEpoch = 0;
  private planetEpoch = 0;
  private resourceAbort: AbortController | null = null;
  private bodySnapshot: {
    id: PlanetId;
    x: number;
    y: number;
    z: number;
  } | null = null;
  private directoryInfoVisible = false;
  private directoryOrigin: InteractionState = "PLANET_OVERVIEW";
  private planetOrigin: {
    mode: InteractionState;
    selected: PlanetId | null;
    infoVisible: boolean;
    focus: number;
    assembly: number;
    sunInterior: number;
    collapse: number;
    explosion: number;
    burst: number;
    targetScale: number;
    bodyRotation?: { x: number; y: number; z: number };
  } | null = null;
  private snapshotPlanet() {
    const origin = store.get();
    this.planetOrigin = {
      mode: this.machine.state,
      selected: origin.selected,
      infoVisible: origin.infoVisible,
      focus: particles.focus,
      assembly: particles.assembly,
      sunInterior: particles.sunInterior,
      collapse: particles.collapse,
      explosion: particles.explosion,
      burst: particles.burst,
      targetScale: particles.targetScale,
      ...(origin.selected &&
      isPlanetAtlasVisible(origin) &&
      bodyTransforms.get(origin.selected)
        ? {
            bodyRotation: {
              x: bodyTransforms.get(origin.selected)!.rotation.x,
              y: bodyTransforms.get(origin.selected)!.rotation.y,
              z: bodyTransforms.get(origin.selected)!.rotation.z,
            },
          }
        : {}),
    };
  }
  private restoreLocation() {
    this.locationEpoch++;
    this.resourceAbort?.abort();
    this.resourceAbort = null;
    this.transition?.kill();
    particles.locationApproach = 0;
    if (this.bodySnapshot) {
      const body = bodyTransforms.get(this.bodySnapshot.id);
      body?.rotation.set(
        this.bodySnapshot.x,
        this.bodySnapshot.y,
        this.bodySnapshot.z,
      );
    }
    this.machine.send("LOCATION_CANCEL");
    store.set({
      destinationId: null,
      activeStoryId: null,
      activeHotspotId: null,
      mode: this.machine.state,
      transitioning: false,
      locationResourcesReady: false,
    });
  }
  browse() {
    if (
      this.isLocked() ||
      store.get().webglError ||
      !store.get().selected ||
      !this.machine.can(
        store.get().selected === "earth" ? "BROWSE_EARTH" : "BROWSE",
      )
    )
      return false;
    this.directoryOrigin = this.machine.state;
    this.machine.send(
      store.get().selected === "earth" ? "BROWSE_EARTH" : "BROWSE",
    );
    this.cancelInfo();
    rotation.stop();
    this.directoryInfoVisible = store.get().infoVisible;
    store.set({
      mode: this.machine.state,
      infoVisible: false,
      explorationCityId: null,
      explorationContinentId: null,
      explorationCountryId: null,
      activeHotspotId: null,
      destinationId: null,
      activeStoryId: null,
      explorationError: "",
    });
    return true;
  }
  chooseContinent(id: string) {
    if (
      id !== "asia" ||
      store.get().selected !== "earth" ||
      this.isLocked() ||
      !this.machine.send("PICK_CONTINENT")
    )
      return false;
    store.set({ mode: this.machine.state, explorationContinentId: id });
    return true;
  }
  chooseCountry(id: string) {
    if (
      id !== "cn" ||
      store.get().explorationContinentId !== "asia" ||
      this.isLocked() ||
      !this.machine.send("PICK_COUNTRY")
    )
      return false;
    store.set({ mode: this.machine.state, explorationCountryId: id });
    return true;
  }
  chooseCity(id: string, load: ResourceLoader = preloadLocation) {
    if (id !== "city-beijing" || store.get().explorationCountryId !== "cn")
      return Promise.resolve(false);
    return this.enterDestination("beijing", load);
  }
  openHotspot(id: string) {
    if (
      this.isLocked() ||
      store.get().webglError ||
      this.machine.state !== "LOCATION_OVERVIEW"
    )
      return false;
    const site = getImmersiveSite(store.get().destinationId ?? "");
    if (
      !site?.hotspots.some((hotspot) => hotspot.id === id) ||
      !this.machine.send("OPEN_HOTSPOT")
    )
      return false;
    gestureTargets.set(null);
    store.set({ mode: this.machine.state, activeHotspotId: id });
    return true;
  }
  openCityStory(id: string) {
    if (store.get().selected !== "earth") return false;
    return this.openPlanetStory(id);
  }
  openPlanetStory(id: string) {
    const bodyId = store.get().selected;
    if (
      !bodyId ||
      (bodyId === "earth" && !usesLightEarth()) ||
      store.get().webglError ||
      this.isLocked() ||
      !getPlanetAnnotation(bodyId, id) ||
      !getPlanetStory(bodyId, id) ||
      !this.machine.send("OPEN_HOTSPOT")
    )
      return false;
    this.cancelInfo();
    getPlanetAtlasRotation(bodyId).discardPending();
    rotation.stop();
    particles.targetRotation = particles.rotation;
    particles.targetScale = particles.scale;
    particles.targetAnchor.copy(particles.anchor);
    gestureTargets.set(null);
    store.set({
      mode: this.machine.state,
      activeStoryId: id,
      activeHotspotId: null,
      infoVisible: false,
      help: false,
    });
    setPlanetAutoRotate(bodyId, false);
    return true;
  }
  async enterDestination(id: string, load: ResourceLoader = preloadLocation) {
    const destination = getImmersiveSite(id);
    if (
      !destination ||
      destination.bodyId !== store.get().selected ||
      (destination.bodyId === "earth" &&
        (this.machine.state !== "EARTH_CITY_PICKER" ||
          store.get().explorationContinentId !== "asia" ||
          store.get().explorationCountryId !== "cn")) ||
      (destination.bodyId !== "earth" &&
        this.machine.state !== "PLANET_REGION_PICKER") ||
      store.get().webglError ||
      this.isLocked() ||
      !this.machine.send("ENTER_LOCATION")
    )
      return false;
    const body = bodyTransforms.get(destination.bodyId);
    this.bodySnapshot = body
      ? {
          id: destination.bodyId,
          x: body.rotation.x,
          y: body.rotation.y,
          z: body.rotation.z,
        }
      : null;
    const epoch = ++this.locationEpoch;
    this.resourceAbort = new AbortController();
    gestureTargets.set(null);
    store.set({
      mode: this.machine.state,
      transitioning: true,
      destinationId: id,
      explorationCityId: destination.cityId ?? null,
      explorationError: "",
      activeStoryId: null,
      activeHotspotId: null,
      locationResourcesReady: false,
    });
    try {
      if (validateImmersiveCatalog([destination]).length)
        throw new Error("Invalid local content");
      const base = assets.find((asset) => asset.id === destination.baseAssetId);
      if (
        (destination.baseAssetId &&
          (!base || base.review.status !== "source-checked")) ||
        destination.hotspots.some(
          (hotspot) =>
            hotspot.image &&
            (!hotspot.image.sourceUrl.startsWith("https://") ||
              !hotspot.image.license ||
              !hotspot.image.licenseUrl.startsWith("https://") ||
              !/^exploration\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(
                hotspot.image.path,
              )),
        )
      )
        throw new Error("Unreviewed resource");
      await load(getSiteResourcePaths(destination), this.resourceAbort.signal);
      if (epoch !== this.locationEpoch) return false;
      if (store.get().webglError) throw new Error("Scene unavailable");
      this.resourceAbort = null;
      store.set({ locationResourcesReady: true });
      const reduced =
        typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.transition = gsap.timeline({
        onComplete: () => {
          if (epoch !== this.locationEpoch) return;
          if (store.get().webglError) {
            this.restoreLocation();
            store.set({
              explorationError:
                "场景不可用，已取消接近。 / Scene unavailable; approach cancelled.",
            });
            return;
          }
          this.machine.send("LOCATION_READY");
          store.set({ mode: this.machine.state, transitioning: false });
        },
      });
      if (body) {
        const pose = facingRotation(
          destination.center.latitude,
          destination.center.longitude,
        );
        this.transition.to(
          body.rotation,
          {
            ...pose,
            z: 0,
            duration: reduced ? 0.05 : 1.4,
            ease: "power2.inOut",
          },
          0,
        );
      }
      this.transition.to(
        particles,
        {
          locationApproach: 1,
          duration: reduced ? 0.05 : 6.4,
          ease: "power2.inOut",
        },
        0,
      );
      return true;
    } catch {
      if (epoch !== this.locationEpoch) return false;
      this.restoreLocation();
      store.set({
        explorationError:
          "地点资源未能加载，未进入。可以重试或返回。 / Location resources unavailable; retry or go back.",
      });
      return false;
    }
  }
  skipLocationTransition() {
    if (
      this.machine.state !== "DESCENT_TRANSITION" ||
      !store.get().locationResourcesReady ||
      !this.transition
    )
      return false;
    if (store.get().webglError) {
      this.restoreLocation();
      store.set({
        explorationError:
          "场景不可用，已取消接近。 / Scene unavailable; approach cancelled.",
      });
      return false;
    }
    this.transition.progress(1);
    return true;
  }
  private cancelInfo() {
    if (this.infoTimer !== null) clearTimeout(this.infoTimer);
    this.infoTimer = null;
  }
  private sync() {
    store.set({
      mode: this.machine.state,
      transitioning: this.machine.locked && this.machine.state !== "INTRO",
    });
  }
  private begin(event: InteractionEvent) {
    if (this.isLocked() || !this.machine.send(event)) return false;
    this.cancelInfo();
    this.transition?.kill();
    rotation.stop();
    gestureTargets.set(null);
    particles.targetAnchor.set(0, 0, 0);
    store.set({
      mode: this.machine.state,
      transitioning: true,
      infoVisible: false,
      hover: null,
      heldUniverse: false,
    });
    return true;
  }
  private finish(event: InteractionEvent = "TRANSITION_END") {
    particles.setState("REST");
    this.machine.send(event);
    this.sync();
  }
  isLocked() {
    return this.machine.locked || store.get().transitioning;
  }
  canCancelPlanetTransition() {
    return (
      this.machine.state === "PLANET_TRANSITION" ||
      (this.machine.state === "TRANSITION" && !!this.planetOrigin?.selected)
    );
  }
  ready() {
    if (this.machine.send("READY")) this.sync();
  }
  enterBodyExplore() {
    if (
      store.get().selected !== "earth" ||
      store.get().webglError ||
      this.isLocked() ||
      !this.machine.send("ENTER_BODY_EXPLORE")
    )
      return false;
    this.cancelInfo();
    rotation.stop();
    gestureTargets.set(null);
    store.set({
      mode: this.machine.state,
      infoVisible: false,
      hover: null,
      heldUniverse: false,
    });
    return true;
  }
  selectBody(id: CelestialId) {
    return id === "sun" ? this.enterSun() : this.select(id);
  }
  select(id: PlanetId) {
    if (
      !planets.some((planet) => planet.id === id) ||
      this.isLocked() ||
      !this.machine.can("SELECT")
    )
      return false;
    this.snapshotPlanet();
    if (!this.begin("SELECT")) return false;
    const epoch = ++this.planetEpoch;
    store.set({ selected: id, welcome: false, help: false });
    const first = !this.visited.has(id);
    this.visited.add(id);
    particles.assembly = first ? 1 : 0.55;
    particles.setState("ASSEMBLE");
    audio.play("whoosh");
    this.transition = gsap
      .timeline({
        onComplete: () => {
          if (epoch !== this.planetEpoch) return;
          this.finish();
          this.infoTimer = setTimeout(() => {
            this.infoTimer = null;
            if (
              epoch === this.planetEpoch &&
              !this.isLocked() &&
              store.get().selected === id &&
              ["PLANET_OVERVIEW", "INFO", "UNIVERSE_SCALE"].includes(
                this.machine.state,
              )
            )
              store.set({ infoVisible: true });
          }, config.INFO_REVEAL_DELAY);
        },
      })
      .to(particles, {
        focus: 1,
        sunInterior: 0,
        collapse: 0,
        assembly: 0,
        duration: first ? 1.35 : 1.05,
        ease: "power3.inOut",
      });
    return true;
  }
  next(direction: number) {
    if (
      this.isLocked() ||
      !["PLANET_OVERVIEW", "INFO"].includes(this.machine.state) ||
      !store.get().selected ||
      !direction
    )
      return false;
    const step = direction > 0 ? 1 : -1;
    const index = planets.findIndex(
      (planet) => planet.id === store.get().selected,
    );
    const selected = this.select(
      planets[(index + step + planets.length) % planets.length].id,
    );
    if (selected) particles.switchDirection = step;
    return selected;
  }
  return() {
    if (store.get().help) {
      store.set({ help: false });
      return true;
    }
    if (this.canCancelPlanetTransition() && this.planetOrigin) {
      this.planetEpoch++;
      this.transition?.kill();
      this.cancelInfo();
      rotation.stop();
      const origin = this.planetOrigin;
      this.machine.send("TRANSITION_CANCEL");
      Object.assign(particles, {
        focus: origin.focus,
        assembly: origin.assembly,
        sunInterior: origin.sunInterior,
        collapse: origin.collapse,
        explosion: origin.explosion,
        burst: origin.burst,
        targetScale: origin.targetScale,
      });
      particles.setState("REST");
      if (origin.bodyRotation && origin.selected) {
        getPlanetAtlasRotation(origin.selected).discardPending();
        const { x, y, z } = origin.bodyRotation;
        bodyTransforms.get(origin.selected)?.rotation.set(x, y, z);
      }
      store.set({
        mode: origin.mode,
        selected: origin.selected,
        infoVisible: origin.infoVisible,
        transitioning: false,
      });
      return true;
    }
    if (this.machine.state === "INFO_PANEL_OPEN") {
      this.machine.send("CLOSE_HOTSPOT");
      store.set({
        mode: this.machine.state,
        activeHotspotId: null,
        activeStoryId: null,
      });
      return true;
    }
    if (
      ["DESCENT_TRANSITION", "LOCATION_OVERVIEW"].includes(this.machine.state)
    ) {
      this.restoreLocation();
      return true;
    }
    if (pickerModes.includes(this.machine.state)) {
      const from = this.machine.state;
      this.machine.send("RETURN");
      const toPlanet = this.machine.state === "PLANET_OVERVIEW";
      if (toPlanet && this.directoryOrigin === "INFO")
        this.machine.send("INFO");
      if (toPlanet) this.bodySnapshot = null;
      store.set({
        mode: this.machine.state,
        infoVisible: toPlanet && this.directoryInfoVisible,
        explorationCityId: null,
        ...(from === "EARTH_CITY_PICKER" ? { explorationCountryId: null } : {}),
        ...(from === "EARTH_COUNTRY_PICKER"
          ? { explorationContinentId: null, explorationCountryId: null }
          : {}),
        explorationError: "",
      });
      return true;
    }
    if (this.isLocked() || !this.machine.can("RETURN")) return false;
    this.snapshotPlanet();
    if (!this.begin("RETURN")) return false;
    const epoch = ++this.planetEpoch;
    store.set({ selected: null });
    particles.targetScale = 1;
    particles.setState("ASSEMBLE");
    this.transition = gsap
      .timeline({
        onComplete: () => {
          if (epoch === this.planetEpoch) this.finish();
        },
      })
      .to(particles, {
        focus: 0,
        sunInterior: 0,
        collapse: 0,
        explosion: 0,
        burst: 0,
        assembly: 0,
        duration: 1.3,
        ease: "power3.inOut",
      });
    audio.play("whoosh");
    return true;
  }
  // Point only updates render-side targets; it never changes navigation state.
  point() {
    return !this.isLocked();
  }
  info() {
    if (
      this.isLocked() ||
      !["PLANET_OVERVIEW", "INFO"].includes(this.machine.state)
    )
      return false;
    this.cancelInfo();
    store.set({ infoVisible: !store.get().infoVisible });
    return true;
  }
  collapse() {
    if (!this.begin("COLLAPSE")) return false;
    store.set({ selected: null, welcome: false, help: false });
    particles.targetScale = 1;
    particles.setState("COLLAPSE");
    this.transition = gsap
      .timeline({
        onComplete: () => {
          this.machine.send("TRANSITION_END");
          this.sync();
        },
      })
      .to(particles, {
        collapse: 1,
        focus: 0,
        sunInterior: 0,
        explosion: 0,
        burst: 0,
        duration: 2.4,
        ease: "power2.inOut",
      });
    audio.play("collapse");
    return true;
  }
  rebirth() {
    if (!this.begin("OPEN")) return false;
    store.set({ selected: null });
    particles.setState("EXPLODE");
    particles.explosion = 0.001;
    particles.burst = 1;
    audio.play("bang");
    this.transition = gsap
      .timeline({ onComplete: () => this.finish("BANG_END") })
      .to(particles, { collapse: 0, duration: 0.35, ease: "power3.out" }, 0)
      .to(particles, { explosion: 1, duration: 3.8, ease: "none" }, 0)
      .to(particles, { burst: 0, duration: 2.6, ease: "power2.out" }, 0.1)
      .set(particles, { explosion: 0 }, 3.8);
    return true;
  }
  enterSun() {
    if (!this.begin("ENTER_SUN")) return false;
    store.set({ selected: null, welcome: false, help: false });
    particles.targetScale = 1;
    particles.setState("REST");
    audio.play("whoosh");
    this.transition = gsap
      .timeline({ onComplete: () => this.finish() })
      .to(particles, {
        sunInterior: 1,
        focus: 0,
        collapse: 0,
        explosion: 0,
        assembly: 0,
        burst: 0,
        duration: 1.8,
        ease: "power2.inOut",
      });
    return true;
  }
  space() {
    return this.machine.state === "COLLAPSE" ? this.rebirth() : this.collapse();
  }
  scale(value: number, held = false) {
    if (this.isLocked() || !Number.isFinite(value)) return false;
    if (this.machine.state !== "UNIVERSE_SCALE" && !this.machine.send("SCALE"))
      return false;
    particles.targetScale = Math.max(
      config.ZOOM_MIN,
      Math.min(config.ZOOM_MAX, value),
    );
    particles.zoomIntensity = 1;
    store.set({ mode: this.machine.state, heldUniverse: held });
    const state = store.get();
    if (state.selected && isPlanetAtlasVisible(state))
      setPlanetAutoRotate(state.selected, false);
    return true;
  }
  endScale() {
    if (this.isLocked() || !this.machine.send("SCALE_END")) return false;
    store.set({ heldUniverse: false });
    particles.targetAnchor.set(0, 0, 0);
    this.sync();
    return true;
  }
  online() {
    particles.burst = 0.7;
    gsap.to(particles, { burst: 0, duration: 1.9 });
    audio.play("online");
  }
}
export const interaction = new InteractionController();
