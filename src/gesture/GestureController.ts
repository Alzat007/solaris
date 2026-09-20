import { particles } from "../particles/ParticleEngine";
import { store } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import { GestureStabilizer } from "./GestureRecognizer";
import type { HandFeatures, HandFrame } from "./GestureTypes";
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
    started: number;
    last: number;
    samples: {
      distance: number;
      time: number;
      left: HandFeatures["center"];
      right: HandFeatures["center"];
    }[];
    scale: { distance: number; value: number; started: number } | null;
    closeSince: number | null;
    collapsed: boolean;
    mustSeparate: boolean;
    scaleReleased: number;
  } | null = null;
  private lastTwoAction = -Infinity;
  private clearTwo() {
    if (this.two?.scale) interaction.endScale();
    this.two = null;
  }
  /** A pair is tracked by distance, independent of detector hand ordering.
   * Re-acquisition creates a fresh baseline; missing frames never add speed.
   */
  private updateTwo(hands: HandFeatures[], time: number) {
    const [left, right] = [...hands].sort((a, b) => a.center.x - b.center.x);
    if (hands.some((hand) => hand.confidence < 0.6)) {
      this.clearTwo();
      return true;
    }
    if (this.two && time - this.two.last > 130) this.clearTwo();
    const distance = Math.hypot(
      left.center.x - right.center.x,
      left.center.y - right.center.y,
    );
    if (!this.two)
      this.two = {
        started: time,
        last: time,
        samples: [],
        scale: null,
        closeSince: null,
        collapsed: false,
        mustSeparate: false,
        scaleReleased: -Infinity,
      };
    const two = this.two;
    two.last = time;
    const closeThreshold = Math.max(
      0.09,
      Math.min(0.22, (left.scale + right.scale) * 0.45),
    );
    const bothPinched = hands.every((hand) => hand.gesture === "PINCH");
    const anyPinched = hands.some((hand) => hand.gesture === "PINCH");
    const mode = store.get().mode;
    if (bothPinched) {
      two.closeSince = null;
      two.samples = [];
      // Releasing a small zoom must not turn into a collapse. Separate the
      // hands before arming that distinct action again.
      two.mustSeparate = true;
      if (mode !== "SUN_INTERIOR" && mode !== "COLLAPSE") {
        if (!two.scale)
          two.scale = { distance, value: particles.targetScale, started: time };
        if (time - two.scale.started >= 100)
          interaction.scale(
            (two.scale.value * distance) / Math.max(two.scale.distance, 0.08),
          );
        store.set({ gesture: "TWO_HAND_SCALE" });
      }
      return true;
    }
    if (two.scale) {
      interaction.endScale();
      two.scale = null;
      two.scaleReleased = time;
    }
    if (distance > closeThreshold * 1.4) {
      two.collapsed = false;
      two.mustSeparate = false;
    }
    if (anyPinched || time - two.scaleReleased < 300) {
      two.samples = [];
      two.closeSince = null;
      return true;
    }
    two.samples.push({
      distance,
      time,
      left: { ...left.center },
      right: { ...right.center },
    });
    two.samples = two.samples.filter((sample) => time - sample.time <= 320);
    const axis = {
      x: right.center.x - left.center.x,
      y: right.center.y - left.center.y,
    };
    const quicklyOpened =
      two.samples.length >= 3 &&
      two.samples.some((first) => {
        const duration = (time - first.time) / 1000;
        const opening = distance - first.distance;
        const leftTravel =
          ((first.left.x - left.center.x) * axis.x +
            (first.left.y - left.center.y) * axis.y) /
          Math.max(distance, 0.01);
        const rightTravel =
          ((right.center.x - first.right.x) * axis.x +
            (right.center.y - first.right.y) * axis.y) /
          Math.max(distance, 0.01);
        return (
          duration >= 0.1 &&
          opening >= 0.14 &&
          opening / duration >= 0.85 &&
          leftTravel >= 0.035 &&
          rightTravel >= 0.035 &&
          first.distance <= Math.max(0.32, closeThreshold * 1.8)
        );
      });
    if (
      mode !== "SUN_INTERIOR" &&
      time - this.lastTwoAction >= 650 &&
      hands.every((hand) => hand.gesture === "OPEN_PALM") &&
      distance >= 0.3 &&
      quicklyOpened
    ) {
      this.lastTwoAction = time;
      two.samples = [];
      two.closeSince = null;
      interaction.enterSun();
      store.set({ gesture: "TWO_HAND_EXPAND" });
      return true;
    }
    const symbolic = hands.some(
      (hand) => hand.gesture === "V_SIGN" || hand.gesture === "THREE",
    );
    if (distance <= closeThreshold && !two.mustSeparate && !symbolic) {
      if (two.closeSince === null) two.closeSince = time;
      store.set({ gesture: "TWO_HAND_COLLAPSE" });
      if (
        mode !== "COLLAPSE" &&
        !two.collapsed &&
        time - two.started >= 350 &&
        time - two.closeSince >= 250
      ) {
        two.collapsed = true;
        // Keep distance samples through collapse so the next quick opening
        // can enter the Sun, without having to remove and show the hands again.
        interaction.collapse();
      }
      return true;
    }
    two.closeSince = null;
    return false;
  }
  private lastSeen = 0;
  private seen = false;
  update({ hands, time }: HandFrame) {
    if (!hands.length) {
      this.clearTwo();
      this.samples = [];
      if (time - this.lastSeen > 180) {
        particles.active = false;
        this.stabilizer.reset();
        this.samples = [];
        this.clearTwo();
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
    if (time - this.lastSeen > 180) this.clearTwo();
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
      this.clearTwo();
      this.pinchReady = false;
      return;
    }
    if (hands.length === 2) {
      this.pinchReady = false;
      // A pinch used with two hands is consumed until the remaining hand
      // releases, so removing one hand cannot unexpectedly select a planet.
      if (hands.some((h) => h.gesture === "PINCH")) this.pinchSelected = true;
      this.samples = [];
      if (this.updateTwo(hands, time)) {
        this.stabilizer.reset();
        return;
      }
      // A stationary symbolic gesture can still work with a second idle hand
      // in view, but never competes with a deliberate paired movement.
      const symbol = hands.find(
        (h) => h.gesture === "V_SIGN" || h.gesture === "THREE",
      );
      const event = this.stabilizer.update(
        symbol?.gesture ?? "NONE",
        time,
        symbol?.confidence ?? 1,
      );
      if (event === "V_SIGN") interaction.return();
      else if (
        event === "THREE" &&
        mode !== "SUN_INTERIOR" &&
        mode !== "COLLAPSE"
      )
        interaction.info();
      return;
    }
    this.clearTwo();
    if (mode === "SUN_INTERIOR" || mode === "COLLAPSE") {
      const event = this.stabilizer.update(hand.gesture, time, hand.confidence);
      if (event === "V_SIGN") interaction.return();
      this.samples = [];
      return;
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
      (gesture === "V_SIGN" || gesture === "THREE") &&
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
    } else if (event === "THREE") interaction.info();
    else if (event === "V_SIGN") interaction.return();
  }
  reset() {
    this.stabilizer.reset();
    this.clearTwo();
    this.lastTwoAction = -Infinity;
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
      !["COLLAPSE", "BIG_BANG", "PLANET_TRANSITION", "SUN_INTERIOR"].includes(
        store.get().mode,
      )
    )
      particles.setState("REST");
  }
}
export const gestures = new GestureController();
