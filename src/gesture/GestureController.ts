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
import { ThumbOpenSelection } from "./ThumbOpenSelection";
import { VRotationZoom } from "./VRotationZoom";
import { settleDialScale } from "./dialScale";
import type { HandFeatures, HandFrame } from "./GestureTypes";

const overview = (mode: string) =>
  mode === "SOLAR_SYSTEM" || mode === "POINTER";
const focused = (mode: string) => mode === "PLANET_FOCUS" || mode === "INFO";
const canDial = (mode: string) =>
  overview(mode) ||
  focused(mode) ||
  mode === "SUN_FOCUS" ||
  mode === "UNIVERSE_SCALE";

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
  private selection = new ThumbOpenSelection();
  private selectionHandId = "";
  // An opened confirmation must close its thumb before Back. Mere re-entry only
  // requires release for selection; it must not disable a fresh fist forever.
  private thumbBackNeedsRelease = false;
  private pinchContext: "blank" | "drag" | "consumed" | null = null;
  private pinchOriginX = 0;
  private pinchOriginY = 0;
  private dragLastX = 0;
  private dragLastTime = 0;
  private zoom = new VRotationZoom();
  private zoomHandId = "";
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
  private stopMotion(preserveDial = false) {
    rotation.end();
    if (!preserveDial) {
      if (this.zoom.speed !== 0) this.settleDial();
      if (this.zoom.cancel()) interaction.endScale();
      this.zoomHandId = "";
    }
    this.pinchContext = null;
    this.fist.reset();
    this.swipe.reset();
    this.special.reset();
    particles.collapseCharge = 0;
  }
  private enterReentry(time: number) {
    this.stopMotion();
    rotation.stop();
    this.pinches.clear();
    this.selection.cancel(true);
    this.selectionHandId = "";
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
    if (applied) this.trigger("THUMB_OPEN", time, config.SELECT_COOLDOWN);
    return applied;
  }
  private settleDial() {
    particles.targetScale = settleDialScale(
      particles.targetScale,
      particles.scale,
    );
  }
  private updateSelectionMachine(
    hand: HandFeatures | null,
    target: GestureTarget | null,
    time: number,
    enabled = true,
  ) {
    const result = this.selection.update(hand, target, time, enabled);
    if (!this.selection.needsRelease) this.thumbBackNeedsRelease = false;
    else if (result.triggered) this.thumbBackNeedsRelease = true;
    return result;
  }
  private selectionFeedback(hand?: HandFeatures) {
    return {
      selectionPhase: this.selection.state,
      thumbSpread: hand?.thumbGeometryValid ? (hand.thumbSpread ?? null) : null,
      thumbReach: hand?.thumbReach ?? 0,
      thumbGeometryValid: hand?.thumbGeometryValid ?? false,
      indexAngle: hand?.indexAngleValid ? (hand.indexAngle ?? null) : null,
      indexAngularVelocity: hand?.indexAngularVelocity ?? 0,
      indexState: hand?.indexState ?? ("BETWEEN" as const),
      pointConfidence: hand?.pointConfidence ?? 0,
      hoverTarget: this.selection.hoverTarget,
      lockedTarget: this.selection.lockedTarget,
      targetLockProgress: this.selection.lockProgress,
      thumbOpenProgress: this.selection.pressProgress,
      thumbNeedsRelease: this.selection.needsRelease,
    };
  }
  private zoomFeedback(hand?: HandFeatures) {
    return {
      zoomProgress: this.zoom.progress,
      zoomMode: this.zoom.state,
      zoomBaseAngle: this.zoom.baseAngle,
      zoomCurrentAngle: this.zoom.currentAngle,
      zoomDelta: this.zoom.delta,
      zoomSpeed: this.zoom.speed,
      zoomDirection: this.zoom.direction,
      zoomScale: particles.targetScale,
      zoomActive: this.zoom.active,
      vConfidence: hand?.vConfidence ?? 0,
    };
  }
  update({ hands, time }: HandFrame) {
    if (!hands.length) {
      // A short detection miss freezes the dial immediately, but must not
      // discard its calibrated angle. The identity tracker retains only a
      // recent V hand for the same grace window; other gestures still reset.
      const previousSpeed = this.zoom.speed;
      const missing =
        this.zoom.owned && !interaction.isLocked() && canDial(store.get().mode)
          ? this.zoom.update(null, time, particles.targetScale)
          : null;
      if (missing && previousSpeed !== 0 && this.zoom.speed === 0)
        this.settleDial();
      const preserveDial = !!missing?.owned;
      if (missing?.ended) interaction.endScale();
      this.stopMotion(preserveDial);
      rotation.stop();
      if (!preserveDial || missing?.ended) {
        this.visible = false;
        this.handSignature = "";
      }
      this.pinches.clear();
      this.updateSelectionMachine(null, null, time, false);
      this.selectionHandId = "";
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
        action: preserveDial ? "V_ZOOM" : "NONE",
        handCount: 0,
        confidence: 0,
        trackingConfidence: 0,
        target: null,
        pinchPhase: "IDLE",
        pinchProgress: 0,
        fistProgress: 0,
        ...this.zoomFeedback(),
        ...this.selectionFeedback(),
        specialProgress: 0,
        specialStage: "IDLE",
        needsRelease: false,
        locked: interaction.isLocked(),
        cooldownMs: Math.max(0, this.cooldownUntil - time),
        updatedAt: time,
      });
      this.lastFrame = time;
      return;
    }
    // Keep the captured dial hand primary even if detection order changes or
    // a second hand enters. An active dial owns arbitration until release.
    const selectionOwner = this.selection.owned
      ? hands.find(
          (hand, index) => this.id(hand, index) === this.selectionHandId,
        )
      : undefined;
    const owner = this.zoom.owned
      ? hands.find((hand, index) => this.id(hand, index) === this.zoomHandId)
      : (selectionOwner ?? hands.find((hand) => hand.gesture === "V_GESTURE"));
    const first = owner ?? hands[0],
      second = hands.find((hand) => hand !== first);
    const firstId = this.id(first, 0),
      secondId = second ? this.id(second, 1) : "";
    const signature = second ? [firstId, secondId].sort().join("|") : firstId;
    // The captured hand may disappear while another remains visible. Let the
    // dial pause for its grace window without lending ownership to that hand.
    const continuingDial = this.zoom.owned || !!selectionOwner;
    const reappeared =
      !this.visible ||
      (!continuingDial && signature !== this.handSignature) ||
      time - this.lastFrame > config.FRAME_GAP_RESET;
    if (reappeared) this.enterReentry(time);
    this.visible = true;
    this.handSignature = signature;
    this.lastFrame = time;
    const confidence = second
      ? Math.min(first.confidence, second.confidence)
      : first.confidence;
    // Uncertain finger poses pause their action; they are not lost camera hands.
    const trackingConfidence = Math.min(
      first.trackingConfidence ?? first.confidence,
      second ? (second.trackingConfidence ?? second.confidence) : 1,
    );
    const confidenceReady = trackingConfidence >= config.MIN_CONFIDENCE;
    if (!confidenceReady) this.enterReentry(time);
    const pointer =
      first.gesture === "POINT" ||
      first.gesture === "PINCH" ||
      this.selection.owned
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
    const currentTarget = gestureTargets.get();
    const selectableTarget =
      currentTarget &&
      (currentTarget.kind === "ui" || overview(mode) || focused(mode))
        ? currentTarget
        : null;
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
        this.zoom.progress > 0 ||
        this.selection.lockProgress > 0 ||
        specialProgress > 0;
      const target =
        this.pinchContext === "drag" || this.zoom.owned || action === "V_ZOOM"
          ? null
          : (this.selection.lockedTarget ?? this.selection.hoverTarget);
      const fingers = first.fingerState;
      particles.collapseCharge =
        overview(mode) && !locked ? specialProgress : 0;
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
        ...this.zoomFeedback(first),
        ...this.selectionFeedback(first),
        specialProgress,
        specialStage: this.special.stage,
        needsRelease:
          p0.needsRelease ||
          !!p1?.needsRelease ||
          this.fistNeedsRelease ||
          this.selection.needsRelease,
        handCount: hands.length,
        confidence,
        trackingConfidence,
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
      this.updateSelectionMachine(first, null, time, false);
      // Re-entry resets hold progress until ready, then permits a fresh 600ms
      // fist. A fist held through a scene transition still needs a release.
      if (locked && (first.gesture === "FIST" || second?.gesture === "FIST"))
        this.fistNeedsRelease = true;
      report();
      return;
    }

    const updateDial = (hand: HandFeatures | null) => {
      const previousSpeed = this.zoom.speed;
      const zoom = this.zoom.update(hand, time, particles.targetScale);
      if (!zoom.owned) return false;
      this.pinchContext = "consumed";
      this.updateSelectionMachine(first, null, time, false);
      p0.reset(true);
      p1?.reset(true);
      this.fist.reset();
      this.swipe.reset();
      this.special.reset();
      rotation.stop();
      if (zoom.scale !== undefined) interaction.scale(zoom.scale);
      if (previousSpeed !== 0 && this.zoom.speed === 0) this.settleDial();
      if (zoom.ended) interaction.endScale();
      if (zoom.started) {
        gestureFeedback.set({ lastAction: "V_ZOOM", actionAt: time });
        particles.gesturePulse = 1;
      }
      action = "V_ZOOM";
      pinchProgress = 0;
      report();
      return true;
    };

    // Already-owned dial outranks every gesture, including a newly appearing
    // second hand. Outside supported scenes the scene/animation lock wins.
    if (this.zoom.owned) {
      if (canDial(mode)) {
        if (updateDial(owner ?? null)) return;
      } else {
        if (this.zoom.speed !== 0) this.settleDial();
        if (this.zoom.cancel()) interaction.endScale();
        this.zoomHandId = "";
      }
    }

    // Priority 1: the optional two-open-palm collapse / rebirth effect.
    if (
      second &&
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
        this.updateSelectionMachine(first, null, time, false);
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
    } else {
      this.special.reset();
      particles.collapseCharge = 0;
    }

    const updateSelection = () => {
      const result = this.updateSelectionMachine(first, selectableTarget, time);
      if (this.selection.state !== "POINT_IDLE") this.selectionHandId = firstId;
      if (!result.owned && !result.triggered) return false;
      this.pinchContext = "consumed";
      p0.reset(true);
      p1?.reset(true);
      this.fist.reset();
      this.swipe.reset();
      rotation.stop();
      pinchProgress = 0;
      action =
        this.selection.state === "THUMB_OPENING" || result.triggered
          ? "THUMB_OPEN"
          : "POINT";
      if (result.triggered) {
        this.fistNeedsRelease = true;
        if (this.select(result.triggered, time))
          store.set({ gesture: "THUMB_OPEN" });
      }
      report();
      return true;
    };

    // A locked aim is a clutch: opening the thumb cannot transfer
    // the captured target or arm V zoom/swipe/fist at the same time.
    const wasSelectionOwned = this.selection.owned;
    if (wasSelectionOwned && updateSelection()) return;

    // Priority 2: V detection starts the exclusive rotation clutch. Five-tip
    // clustering remains diagnostic geometry and never starts a zoom.
    if (canDial(mode) && first.gesture === "V_GESTURE") {
      this.zoomHandId = firstId;
      if (updateDial(first)) return;
      this.swipe.reset();
      this.fist.reset();
      p0.reset(true);
      p1?.reset(true);
      report();
      return;
    }

    if (!wasSelectionOwned && !second) {
      if (updateSelection()) return;
    } else if (!wasSelectionOwned) {
      this.updateSelectionMachine(first, null, time, false);
    }

    // Two-hand pinches no longer zoom. Consume them so neither hand inherits a
    // click after the other disappears; open palms still own cosmic effects.
    if (second && p1) {
      this.pinchContext = "consumed";
      this.updateSelectionMachine(first, null, time, false);
      this.swipe.reset();
      if (
        first.gesture === "PINCH" ||
        second.gesture === "PINCH" ||
        first.gesture === "FIVE_PINCH" ||
        second.gesture === "FIVE_PINCH"
      ) {
        this.pairedReleaseAt = time;
        p0.reset(true);
        p1.reset(true);
        this.fist.reset();
        report();
        return;
      }
    }

    // Pinch remains a blank-space drag only. It can never select a body or
    // HUD button, and a hold beginning over a target is consumed until release.
    if (!second) {
      if (p0.justReleased || first.gesture !== "PINCH") {
        if (this.pinchContext === "drag") rotation.end();
        this.pinchContext = null;
      }
      if (p0.justStarted) {
        this.pinchContext = currentTarget ? "consumed" : "blank";
        this.pinchOriginX = this.dragLastX = first.pointer.x;
        this.pinchOriginY = first.pointer.y;
        this.dragLastTime = time;
      }
      if (p0.phase === "PINCH_START" || p0.phase === "PINCH_HOLD") {
        this.updateSelectionMachine(first, null, time, false);
        this.fist.reset();
        this.swipe.reset();
        if (
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
        }
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
    if (
      fistHand &&
      fistHand.confidence >= config.MIN_CONFIDENCE &&
      canBack &&
      !this.fistNeedsRelease &&
      !this.thumbBackNeedsRelease
    ) {
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
    if (
      !second &&
      focused(mode) &&
      first.gesture === "OPEN_PALM" &&
      first.confidence >= config.MIN_CONFIDENCE
    ) {
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
    this.zoom.cancel();
    rotation.stop();
    this.pinches.clear();
    this.visible = false;
    this.handSignature = "";
    this.readyAt = 0;
    this.lastFrame = 0;
    this.cooldownUntil = this.triggeredUntil = 0;
    this.selection.reset();
    this.selectionHandId = "";
    this.thumbBackNeedsRelease = false;
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
