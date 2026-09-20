import { particles } from "../particles/ParticleEngine";
import { store } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import { rotation } from "../interaction/rotation";
import { gestureConfig as config } from "./gestureConfig";
import {
  gestureFeedback,
  type GestureAction,
  type GestureTarget,
} from "./gestureFeedback";
import { gestureTargets } from "./gestureTargets";
import { HoldStateMachine, PinchStateMachine } from "./GestureStateMachine";
import { SolarEffectGesture, SwipeTracker } from "./GestureMotion";
import type { HandFeatures, HandFrame } from "./GestureTypes";

const overview = (mode: string) =>
  mode === "SOLAR_SYSTEM" || mode === "POINTER";
const focused = (mode: string) => mode === "PLANET_FOCUS" || mode === "INFO";

/** Arbitration only. Geometry, pinch lifecycle, effects, targets and rendering
 * live in separate modules. One winning action owns each detection frame. */
export class GestureController {
  private pinches = new Map<string, PinchStateMachine>();
  private fist = new HoldStateMachine();
  private swipe = new SwipeTracker();
  private special = new SolarEffectGesture();
  private visible = false;
  private handSignature = "";
  private readyAt = 0;
  private lastFrame = 0;
  private cooldownUntil = 0;
  private triggeredUntil = 0;
  private pointTarget: GestureTarget | null = null;
  private pointAt = 0;
  private captured: GestureTarget | null = null;
  private pinchContext: "select" | "blank" | "drag" | "consumed" | null = null;
  private pinchOriginX = 0;
  private pinchOriginY = 0;
  private dragLastX = 0;
  private dragLastTime = 0;
  private zoomDistance = 0;
  private zoomScale = 1;
  private fistId = "";
  private fistNeedsRelease = false;
  private pairedReleaseAt = -Infinity;

  private id(hand: HandFeatures, index: number) {
    return hand.id ?? hand.handedness ?? String(index);
  }
  private pinch(id: string) {
    let machine = this.pinches.get(id);
    if (!machine) {
      machine = new PinchStateMachine();
      this.pinches.set(id, machine);
    }
    return machine;
  }
  private stopMotion() {
    rotation.end();
    if (this.zoomDistance) interaction.endScale();
    this.zoomDistance = 0;
    this.captured = null;
    this.pinchContext = null;
    this.fist.reset();
    this.swipe.reset();
    this.special.reset();
  }
  private enterReentry(time: number) {
    this.stopMotion();
    rotation.stop();
    this.pinches.clear();
    this.pointTarget = null;
    this.readyAt = time + config.HAND_REENTRY_DELAY;
  }
  private trigger(
    action: GestureAction,
    time: number,
    cooldown: number,
    direction: -1 | 0 | 1 = 0,
  ) {
    this.cooldownUntil = time + cooldown;
    this.triggeredUntil = time + config.TRIGGER_FEEDBACK_TIME;
    particles.gesturePulse = 1;
    gestureFeedback.set({
      lastAction: action,
      actionAt: time,
      pulseId: gestureFeedback.get().pulseId + 1,
      swipeDirection: direction,
    });
  }
  private select(target: GestureTarget, time: number) {
    const applied =
      target.kind === "body"
        ? interaction.selectBody(target.id)
        : gestureTargets.activateUI(target.id);
    if (applied) this.trigger("PINCH_SELECT", time, config.SELECT_COOLDOWN);
    return applied;
  }
  update({ hands, time }: HandFrame) {
    if (!hands.length) {
      this.stopMotion();
      rotation.stop();
      this.visible = false;
      this.handSignature = "";
      this.pinches.clear();
      this.pointTarget = null;
      particles.cursorVisible = false;
      particles.active = false;
      gestureTargets.set(null);
      if (store.get().tracking === "online")
        store.set({
          tracking: "seeking",
          gesture: "NONE",
          confidence: 0,
          hover: null,
        });
      gestureFeedback.set({
        presence: "NO_HAND",
        readiness: "RECONNECTING",
        action: "NONE",
        handCount: 0,
        target: null,
        pinchPhase: "IDLE",
        pinchProgress: 0,
        fistProgress: 0,
        specialProgress: 0,
        needsRelease: false,
        locked: interaction.isLocked(),
        cooldownMs: Math.max(0, this.cooldownUntil - time),
        updatedAt: time,
      });
      this.lastFrame = time;
      return;
    }
    const first = hands[0],
      second = hands[1];
    const firstId = this.id(first, 0),
      secondId = second ? this.id(second, 1) : "";
    const signature = second ? [firstId, secondId].sort().join("|") : firstId;
    const reappeared =
      !this.visible ||
      signature !== this.handSignature ||
      time - this.lastFrame > config.FRAME_GAP_RESET;
    if (reappeared) this.enterReentry(time);
    this.visible = true;
    this.handSignature = signature;
    this.lastFrame = time;
    const confidence = second
      ? Math.min(first.confidence, second.confidence)
      : first.confidence;
    const confidenceReady =
      confidence >=
      (second ? config.TWO_HAND_MIN_CONFIDENCE : config.MIN_CONFIDENCE);
    if (!confidenceReady) this.enterReentry(time);
    const pointer =
      first.gesture === "POINT" || first.gesture === "PINCH"
        ? first.pointer
        : first.center;
    particles.handTargetNDC.set(pointer.x * 2 - 1, 1 - pointer.y * 2);
    if (reappeared) particles.handNDC.copy(particles.handTargetNDC);
    particles.cursorVisible = true;
    particles.active = true;
    particles.interactionTime = time;
    particles.handDirection.set(...first.palmDirection).normalize();
    particles.handOpenness = first.openness;
    particles.pinchStrength = first.pinchStrength;
    const snapshot = store.get();
    if (snapshot.tracking !== "online" || snapshot.gesture !== first.gesture)
      store.set({
        tracking: "online",
        gesture: first.gesture,
        confidence: first.confidence,
      });
    const mode = store.get().mode;
    const locked = interaction.isLocked();
    const ready = confidenceReady && time >= this.readyAt;
    const cooldownMs = Math.max(0, this.cooldownUntil - time);
    const enabled = ready && !locked && cooldownMs === 0;
    const p0 = this.pinch(firstId);
    const p1 = second ? this.pinch(secondId) : null;
    p0.update(
      first.pinchDistance,
      first.confidence,
      time,
      enabled,
      first.gesture === "PINCH",
    );
    if (second && p1)
      p1.update(
        second.pinchDistance,
        second.confidence,
        time,
        enabled,
        second.gesture === "PINCH",
      );
    const currentTarget =
      first.gesture === "POINT" || first.gesture === "PINCH"
        ? gestureTargets.get()
        : null;
    if (first.gesture === "POINT") {
      this.pointTarget = currentTarget;
      this.pointAt = time;
    }
    if (first.gesture !== "FIST" && (!second || second.gesture !== "FIST"))
      this.fistNeedsRelease = false;
    let action: GestureAction = first.gesture === "POINT" ? "POINT" : "NONE";
    let specialProgress = 0;
    let pinchProgress = Math.max(p0.progress, p1?.progress ?? 0);

    const report = () => {
      const armed =
        p0.phase === "PINCH_START" ||
        p1?.phase === "PINCH_START" ||
        this.fist.progress > 0 ||
        specialProgress > 0;
      const target =
        this.pinchContext === "drag" || this.zoomDistance
          ? null
          : currentTarget;
      const fingers = first.fingerState;
      gestureFeedback.set({
        presence:
          time < this.triggeredUntil
            ? "GESTURE_TRIGGERED"
            : armed
              ? "GESTURE_ARMED"
              : target
                ? "TARGET_HOVER"
                : "HAND_VISIBLE",
        readiness: ready ? "READY" : "RECONNECTING",
        action,
        pinchPhase: p0.phase,
        pinchProgress,
        fistProgress: this.fist.progress,
        specialProgress,
        needsRelease:
          p0.needsRelease || !!p1?.needsRelease || this.fistNeedsRelease,
        handCount: hands.length,
        confidence,
        handedness: first.handedness ?? firstId,
        pinchDistance: first.pinchDistance,
        palmX: first.center.x,
        palmY: first.center.y,
        fingers: fingers
          ? `拇${+fingers.thumb} 食${+fingers.index} 中${+fingers.middle} 无${+fingers.ring} 小${+fingers.pinky}`
          : "—",
        target,
        locked: interaction.isLocked(),
        cooldownMs: Math.max(0, this.cooldownUntil - time),
        updatedAt: time,
      });
    };
    if (!enabled) {
      this.stopMotion();
      rotation.stop();
      if (locked || !ready) this.pointTarget = null;
      if (first.gesture === "FIST" || second?.gesture === "FIST")
        this.fistNeedsRelease = true;
      report();
      return;
    }

    // Priority 1: the optional two-open-palm collapse / rebirth effect.
    if (
      second &&
      first.gesture === "OPEN_PALM" &&
      second.gesture === "OPEN_PALM" &&
      (overview(mode) || mode === "COLLAPSE") &&
      time - this.pairedReleaseAt >= config.SELECT_COOLDOWN
    ) {
      const event = this.special.update(
        first,
        second,
        mode === "COLLAPSE" ? "collapse" : "overview",
        time,
      );
      specialProgress = this.special.progress;
      if (event || specialProgress > 0) {
        action = mode === "COLLAPSE" ? "REBIRTH" : "COLLAPSE";
        this.fist.reset();
        this.swipe.reset();
        if (
          event &&
          (event === "COLLAPSE"
            ? interaction.collapse()
            : interaction.rebirth())
        )
          this.trigger(event, time, config.SPECIAL_COOLDOWN);
        report();
        return;
      }
    } else this.special.reset();

    // Priority 2: a zoom owns both pinches; neither may later turn into a click.
    if (second && p1) {
      this.pinchContext = "consumed";
      this.captured = null;
      this.swipe.reset();
      if (
        p0.phase === "PINCH_HOLD" &&
        p1.phase === "PINCH_HOLD" &&
        (overview(mode) || focused(mode) || mode === "UNIVERSE_SCALE")
      ) {
        const a = first.pinchPoint ?? first.pointer,
          b = second.pinchPoint ?? second.pointer;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (!this.zoomDistance) {
          this.zoomDistance = Math.max(distance, config.ZOOM_MIN_DISTANCE);
          this.zoomScale = particles.targetScale;
          rotation.stop();
        }
        interaction.scale((this.zoomScale * distance) / this.zoomDistance);
        particles.zoomIntensity = 1;
        action = "TWO_HAND_ZOOM";
        this.fist.reset();
        report();
        return;
      }
      if (this.zoomDistance) {
        interaction.endScale();
        this.zoomDistance = 0;
        this.pairedReleaseAt = time;
      }
      if (
        p0.phase === "PINCH_START" ||
        p1.phase === "PINCH_START" ||
        p0.phase === "PINCH_HOLD" ||
        p1.phase === "PINCH_HOLD"
      ) {
        this.fist.reset();
        action = "TWO_HAND_ZOOM";
        report();
        return;
      }
    }

    // Priorities 3/4: a pinch captures exactly one target OR empty space.
    // Crossing a body while holding an empty-space pinch can only drag.
    if (!second) {
      if (p0.justReleased || first.gesture !== "PINCH") {
        if (this.pinchContext === "drag") rotation.end();
        this.pinchContext = null;
        this.captured = null;
      }
      if (p0.justStarted) {
        this.captured =
          currentTarget ??
          (time - this.pointAt <= config.TARGET_GRACE_TIME
            ? this.pointTarget
            : null);
        this.pinchContext = this.captured ? "select" : "blank";
        this.pinchOriginX = this.dragLastX = first.pointer.x;
        this.pinchOriginY = first.pointer.y;
        this.dragLastTime = time;
      }
      if (p0.phase === "PINCH_START" || p0.phase === "PINCH_HOLD") {
        this.fist.reset();
        this.swipe.reset();
        if (p0.justHeld && this.pinchContext === "select") {
          if (
            this.captured &&
            (this.captured.kind === "ui" || overview(mode) || focused(mode))
          )
            this.select(this.captured, time);
          this.pinchContext = "consumed";
          action = "PINCH_SELECT";
        } else if (
          p0.phase === "PINCH_HOLD" &&
          overview(mode) &&
          (this.pinchContext === "blank" || this.pinchContext === "drag")
        ) {
          if (
            this.pinchContext === "blank" &&
            Math.hypot(
              first.pointer.x - this.pinchOriginX,
              first.pointer.y - this.pinchOriginY,
            ) >= config.DRAG_START_DISTANCE
          ) {
            this.pinchContext = "drag";
            rotation.start();
            this.dragLastX = first.pointer.x;
            this.dragLastTime = time;
            gestureFeedback.set({ lastAction: "PINCH_DRAG", actionAt: time });
          }
          if (this.pinchContext === "drag") {
            rotation.move(
              first.pointer.x - this.dragLastX,
              (time - this.dragLastTime) / 1000,
            );
            this.dragLastX = first.pointer.x;
            this.dragLastTime = time;
            action = "PINCH_DRAG";
          }
        } else action = "PINCH_SELECT";
        report();
        return;
      }
    }

    // Priority 5: a deliberate 600 ms fist returns, with cancellable progress.
    const fistHand =
      first.gesture === "FIST"
        ? first
        : second?.gesture === "FIST"
          ? second
          : null;
    const canBack = !overview(mode) && mode !== "UNIVERSE_SCALE";
    if (fistHand && canBack && !this.fistNeedsRelease) {
      const id = fistHand.id ?? fistHand.handedness ?? "fist";
      if (id !== this.fistId) {
        this.fist.reset();
        this.fistId = id;
      }
      action = "FIST_BACK";
      this.swipe.reset();
      if (
        this.fist.update(true, time, config.FIST_HOLD_TIME) &&
        interaction.return()
      ) {
        this.fistNeedsRelease = true;
        this.trigger("FIST_BACK", time, config.BACK_COOLDOWN);
      }
      report();
      return;
    }
    this.fist.reset();

    // Priority 6: only an open-hand flick in an already focused planet view.
    // POINT movement, pinches, fists and overview movement never switch worlds.
    if (!second && focused(mode) && first.gesture === "OPEN_PALM") {
      const direction = this.swipe.update(first, time);
      if (direction && interaction.next(direction < 0 ? 1 : -1)) {
        action = "SWIPE";
        this.trigger("SWIPE", time, config.SWIPE_COOLDOWN, direction);
      }
    } else this.swipe.reset();
    report();
  }
  reset() {
    this.stopMotion();
    rotation.stop();
    this.pinches.clear();
    this.visible = false;
    this.handSignature = "";
    this.readyAt = 0;
    this.lastFrame = 0;
    this.cooldownUntil = this.triggeredUntil = 0;
    this.pointTarget = null;
    this.pointAt = 0;
    this.fistId = "";
    this.fistNeedsRelease = false;
    this.pairedReleaseAt = -Infinity;
    particles.cursorVisible = particles.active = false;
    particles.pinchStrength = 0;
    particles.handVelocity.set(0, 0, 0);
    gestureTargets.set(null);
    gestureFeedback.reset();
    if (store.get().hover) store.set({ hover: null });
  }
}
export const gestures = new GestureController();
