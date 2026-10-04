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
import { assets, destinations } from "../exploration/content";
import { bodyTransforms, facingRotation } from "../exploration/sceneState";

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
  private resourceAbort: AbortController | null = null;
  private bodySnapshot: {
    id: PlanetId;
    x: number;
    y: number;
    z: number;
  } | null = null;
  private directoryInfoVisible = false;
  private directoryOrigin: InteractionState = "PLANET_FOCUS";
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
      !this.machine.can("BROWSE")
    )
      return false;
    this.directoryOrigin = this.machine.state;
    this.machine.send("BROWSE");
    this.cancelInfo();
    rotation.stop();
    this.directoryInfoVisible = store.get().infoVisible;
    store.set({
      mode: this.machine.state,
      infoVisible: false,
      explorationCityId: null,
      destinationId: null,
      activeStoryId: null,
      explorationError: "",
    });
    return true;
  }
  openStory(id: string | null) {
    if (this.machine.state !== "LOCATION_VIEW") return false;
    const destination = destinations.find(
      (entry) => entry.id === store.get().destinationId,
    );
    if (id !== null && !destination?.storyIds.includes(id)) return false;
    store.set({ activeStoryId: id });
    return true;
  }
  async enterDestination(id: string, load: ResourceLoader = preloadLocation) {
    const destination = destinations.find((entry) => entry.id === id);
    if (
      !destination ||
      destination.status !== "ready" ||
      destination.bodyId !== store.get().selected ||
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
      locationResourcesReady: false,
    });
    try {
      const resources = destination.assetIds.map((assetId) =>
        assets.find((asset) => asset.id === assetId),
      );
      if (
        resources.some(
          (asset) => !asset || asset.review.status !== "source-checked",
        )
      )
        throw new Error("Unreviewed resource");
      await load(
        resources.map((asset) => asset!.path),
        this.resourceAbort.signal,
      );
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
      if (body && destination.position) {
        const pose = facingRotation(
          destination.position.latitude,
          destination.position.longitude,
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
          duration: reduced ? 0.05 : 3.6,
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
      this.machine.state !== "LOCATION_TRANSITION" ||
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
  ready() {
    if (this.machine.send("READY")) this.sync();
  }
  selectBody(id: CelestialId) {
    return id === "sun" ? this.enterSun() : this.select(id);
  }
  select(id: PlanetId) {
    if (!planets.some((planet) => planet.id === id) || !this.begin("SELECT"))
      return false;
    store.set({ selected: id, welcome: false, help: false });
    const first = !this.visited.has(id);
    this.visited.add(id);
    particles.assembly = first ? 1 : 0.55;
    particles.setState("ASSEMBLE");
    audio.play("whoosh");
    this.transition = gsap
      .timeline({
        onComplete: () => {
          this.finish();
          this.infoTimer = setTimeout(() => {
            this.infoTimer = null;
            if (
              !this.isLocked() &&
              store.get().selected === id &&
              ["PLANET_FOCUS", "INFO", "UNIVERSE_SCALE"].includes(
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
      !["PLANET_FOCUS", "INFO"].includes(this.machine.state) ||
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
    if (this.machine.state === "LOCATION_VIEW" && store.get().activeStoryId) {
      store.set({ activeStoryId: null });
      return true;
    }
    if (["LOCATION_TRANSITION", "LOCATION_VIEW"].includes(this.machine.state)) {
      this.restoreLocation();
      return true;
    }
    if (this.machine.state === "EXPLORATION_DIRECTORY") {
      if (store.get().explorationCityId) {
        store.set({ explorationCityId: null });
        return true;
      }
      this.machine.send("EXIT_DIRECTORY");
      if (this.directoryOrigin === "INFO") this.machine.send("INFO");
      this.bodySnapshot = null;
      store.set({
        mode: this.machine.state,
        infoVisible: this.directoryInfoVisible,
        explorationError: "",
      });
      return true;
    }
    if (!this.begin("RETURN")) return false;
    store.set({ selected: null });
    particles.targetScale = 1;
    particles.setState("ASSEMBLE");
    this.transition = gsap
      .timeline({ onComplete: () => this.finish() })
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
      !["PLANET_FOCUS", "INFO"].includes(this.machine.state)
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
