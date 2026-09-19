import { particles } from "../particles/ParticleEngine";
import { store } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import { GestureStabilizer } from "./GestureRecognizer";
import type { HandFrame } from "./GestureTypes";
import type { PlanetId } from "../data/planets";
class GestureController {
  stabilizer = new GestureStabilizer();
  private lastSwipe = 0;
  private hover: PlanetId | null = null;
  private hoverTime = 0;
  private pinchReady = false;
  private pinchSelected = false;
  private samples: { x: number; y: number; t: number }[] = [];
  private two: {
    distance: number;
    scale: number;
    start: number;
    last: number;
    time: number;
    closing: number;
    held: boolean;
  } | null = null;
  private lastSeen = 0;
  private seen = false;
  update({ hands, time }: HandFrame) {
    if (!hands.length) {
      if (time - this.lastSeen > 180) {
        particles.active = false;
        this.stabilizer.reset();
        this.samples = [];
        this.two = null;
        this.hover = null;
        this.hoverTime = 0;
        this.pinchReady = false;
        this.pinchSelected = false;
        if (store.get().tracking === "online")
          store.set({
            tracking: "seeking",
            gesture: "NONE",
            confidence: 0,
            hover: null,
          });
        interaction.endScale();
      }
      return;
    }
    this.lastSeen = time;
    if (store.get().tracking !== "online") {
      store.set({ tracking: "online" });
      if (!this.seen) {
        interaction.online();
        this.seen = true;
      }
    }
    const hand = hands[0];
    if (hand.gesture !== "PINCH") {
      this.pinchReady = false;
      this.pinchSelected = false;
    } else if (hand.confidence < 0.5) {
      // Disarm the pending selection and its hold together so confidence
      // recovery can re-arm it. Keep pinchSelected until the hand releases.
      this.pinchReady = false;
      this.stabilizer.reset();
    }
    particles.active = true;
    particles.interactionTime = time;
    const pointer =
      hand.gesture === "POINT" || hand.gesture === "PINCH"
        ? hand.pointer
        : hand.center;
    particles.handNDC.set(pointer.x * 2 - 1, 1 - pointer.y * 2);
    particles.handDirection.set(...hand.palmDirection).normalize();
    particles.handOpenness = hand.openness;
    particles.pinchStrength = hand.pinchStrength;
    if (hand.gesture === "POINT" && store.get().hover) {
      this.hover = store.get().hover;
      this.hoverTime = time;
    } else if (
      hand.gesture !== "POINT" &&
      hand.gesture !== "PINCH" &&
      store.get().hover
    )
      store.set({ hover: null });
    store.set({ gesture: hand.gesture, confidence: hand.confidence });
    const mode = store.get().mode;
    if (["INTRO", "PLANET_TRANSITION", "BIG_BANG"].includes(mode)) {
      this.stabilizer.reset();
      this.two = null;
      this.pinchReady = false;
      return;
    }
    if (mode === "COLLAPSE") {
      // Either open hand can release the singularity, even if another hand enters view.
      const open = hands.find((h) => h.gesture === "OPEN_PALM");
      if (
        this.stabilizer.update(
          open ? "OPEN_PALM" : "NONE",
          time,
          open?.confidence ?? 1,
        ) === "OPEN_PALM"
      )
        interaction.bang();
      this.two = null;
      return;
    }
    if (hands.length === 2 && hands.some((h) => h.gesture === "FIST")) {
      this.pinchReady = false;
      const fist = hands.find((h) => h.gesture === "FIST")!;
      if (this.stabilizer.update("FIST", time, fist.confidence) === "FIST")
        interaction.collapse();
      return;
    }
    if (hands.length === 2) {
      this.pinchReady = false;
      const other = hands[1];
      const d = Math.hypot(
        hand.center.x - other.center.x,
        hand.center.y - other.center.y,
      );
      if (!this.two)
        this.two = {
          distance: d,
          scale: particles.targetScale,
          start: time,
          last: d,
          time,
          closing: 0,
          held: false,
        };
      const two = this.two;
      const elapsed = (time - two.time) / 1000;
      const velocity = (d - two.last) / Math.max(elapsed, 0.01);
      if (velocity < -0.015 && velocity > -0.75) two.closing += elapsed;
      else if (velocity > 0.05)
        two.closing = Math.max(0, two.closing - elapsed * 2);
      const canHold =
        !store.get().selected &&
        hand.gesture === "OPEN_PALM" &&
        other.gesture === "OPEN_PALM" &&
        hand.palmFacing &&
        other.palmFacing;
      if (canHold && two.closing > 0.65 && d < two.distance * 0.72)
        two.held = true;
      if (two.held) {
        interaction.scale(
          Math.max(0.14, (0.32 * d) / Math.max(two.distance, 0.1)),
          true,
        );
        particles.handNDC.set(
          hand.center.x + other.center.x - 1,
          1 - (hand.center.y + other.center.y),
        );
        particles.targetAnchor
          .copy(particles.handPosition3D)
          .multiplyScalar(0.5);
        if (velocity > 0.65 && d > two.last + 0.025) {
          two.held = false;
          interaction.online();
          interaction.scale(1);
          particles.targetAnchor.set(0, 0, 0);
          this.two = null;
        }
      } else if (time - two.start > 180)
        interaction.scale((two.scale * d) / Math.max(two.distance, 0.08));
      two.last = d;
      two.time = time;
      store.set({ gesture: "TWO_HAND_SCALE" });
      this.stabilizer.reset();
      return;
    }
    if (this.two) {
      this.two = null;
      interaction.endScale();
    }
    if (!["COLLAPSE", "BIG_BANG", "PLANET_TRANSITION"].includes(mode)) {
      particles.setState(
        hand.pinchStrength > 0.65
          ? "ATTRACT"
          : Math.hypot(hand.velocity.x, hand.velocity.y) > 0.6
            ? "VORTEX"
            : "REPEL",
      );
    }
    this.samples.push({ x: hand.center.x, y: hand.center.y, t: time });
    this.samples = this.samples.filter((s) => time - s.t < 190);
    const first = this.samples[0];
    const dx = hand.center.x - first.x,
      dy = hand.center.y - first.y;
    const swipeCandidate =
      Math.abs(dx) > 0.1 && Math.abs(dx) > Math.abs(dy) * 1.8;
    if (
      (mode === "PLANET_FOCUS" || mode === "INFO") &&
      this.samples.length >= 3 &&
      swipeCandidate &&
      Math.abs(hand.velocity.x) > 0.65 &&
      time - this.lastSwipe > 900
    ) {
      interaction.next(dx > 0 ? 1 : -1);
      this.lastSwipe = time;
      this.stabilizer.reset();
      this.samples = [];
      store.set({ gesture: dx > 0 ? "SWIPE_RIGHT" : "SWIPE_LEFT" });
      return;
    }
    let gesture = hand.gesture;
    if (
      gesture === "OPEN_PALM" &&
      (swipeCandidate ||
        Math.hypot(hand.velocity.x, hand.velocity.y) > 0.22 ||
        time - this.lastSwipe < 550)
    )
      gesture = "NONE";
    const event = this.stabilizer.update(gesture, time, hand.confidence);
    if (event === "PINCH") this.pinchReady = true;
    // A stable pinch stays armed while moving onto a target, but selects only
    // once until released. The current hit also supports pinching directly.
    if (this.pinchReady && !this.pinchSelected && hand.confidence > 0.5) {
      const target =
        store.get().hover ?? (time - this.hoverTime < 500 ? this.hover : null);
      if (target && interaction.machine.can("SELECT")) {
        this.pinchSelected = true;
        interaction.select(target);
      }
    }
    if (!event) return;
    if (event === "POINT") interaction.point();
    else if (event === "PINCH") {
      if (interaction.machine.state !== "PLANET_TRANSITION")
        particles.setState("ATTRACT");
    } else if (event === "FIST") interaction.collapse();
    else if (event === "OPEN_PALM") {
      interaction.open();
      particles.setState(store.get().mode === "BIG_BANG" ? "EXPLODE" : "REPEL");
    } else if (event === "V_SIGN") interaction.info();
  }
  reset() {
    this.stabilizer.reset();
    this.two = null;
    this.samples = [];
    this.seen = false;
    this.lastSeen = 0;
    this.lastSwipe = 0;
    this.hover = null;
    this.hoverTime = 0;
    this.pinchReady = false;
    this.pinchSelected = false;
    store.set({ hover: null });
    particles.active = false;
    particles.pinchStrength = 0;
    particles.handVelocity.set(0, 0, 0);
    if (
      !["COLLAPSE", "BIG_BANG", "PLANET_TRANSITION"].includes(store.get().mode)
    )
      particles.setState("REST");
  }
}
export const gestures = new GestureController();
