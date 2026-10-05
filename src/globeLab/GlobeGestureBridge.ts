import type { TrackingInputSink } from "../gesture/HandTrackingManager";
import type { HandFeatures, HandFrame } from "../gesture/GestureTypes";
import {
  HoldStateMachine,
  PinchStateMachine,
} from "../gesture/GestureStateMachine";
import { VRotationZoom } from "../gesture/VRotationZoom";
import { gestureConfig as config } from "../gesture/gestureConfig";

export interface GlobeGestureActions {
  beginDrag(x: number, y: number): void;
  dragTo(x: number, y: number): void;
  endDrag(): void;
  zoom(amount: number, x: number, y: number): void;
  cancelFlight(): void;
  pointerHover?(x: number, y: number): void;
  activateAt?(x: number, y: number): void;
  isNavigationBlocked?(): boolean;
}

const key = (hand: HandFeatures) => hand.id ?? hand.handedness ?? null;
const point = (hand: HandFeatures) => ({
  x: Math.max(0, Math.min(1, hand.pointer.x)),
  y: Math.max(0, Math.min(1, hand.pointer.y)),
});
const valid = (hand: HandFeatures) =>
  (hand.trackingConfidence ?? hand.confidence) >= config.MIN_CONFIDENCE &&
  hand.confidence >= config.MIN_CONFIDENCE &&
  Number.isFinite(hand.pointer.x) &&
  Number.isFinite(hand.pointer.y);
const released = (hand: HandFeatures) =>
  !["PINCH", "V_GESTURE", "FIST"].includes(hand.gesture) &&
  hand.pinchDistance > config.PINCH_RELEASE_THRESHOLD;

/** Recognition stays shared; only this owner may turn a frame into globe actions. */
export class GlobeGestureBridge implements TrackingInputSink {
  private ownerId: string | null = null;
  private action: "idle" | "pinch" | "zoom" | "fist" = "idle";
  private pinch = new PinchStateMachine();
  private fist = new HoldStateMachine();
  private dial = new VRotationZoom();
  private readyAt = 0;
  private cooldownUntil = 0;
  private lastTime: number | null = null;
  private mustRelease = true;
  private dragging = false;
  private pinchOrigin = { x: 0, y: 0 };
  private pinchConfirmed = false;
  private pinchMoved = false;
  private zoomMissing = false;
  private navigationBlocked = false;

  constructor(private readonly actions: GlobeGestureActions) {}

  private stopDrag() {
    if (this.dragging) this.actions.endDrag();
    this.dragging = false;
  }

  private releaseOwner() {
    this.stopDrag();
    this.pinch.reset(true);
    this.fist.reset();
    this.dial.cancel();
    this.ownerId = null;
    this.action = "idle";
    this.mustRelease = true;
    this.zoomMissing = false;
    this.pinchConfirmed = this.pinchMoved = false;
  }

  reset() {
    this.releaseOwner();
    this.lastTime = null;
    this.readyAt = this.cooldownUntil = 0;
  }

  update({ hands, time }: HandFrame) {
    if (!Number.isFinite(time)) {
      this.reset();
      return;
    }
    if (
      this.lastTime !== null &&
      (time < this.lastTime || time - this.lastTime > config.FRAME_GAP_RESET)
    ) {
      this.reset();
    }
    const dt = this.lastTime === null ? 0 : (time - this.lastTime) / 1000;
    this.lastTime = time;
    const blocked = this.actions.isNavigationBlocked?.() ?? false;
    if (blocked !== this.navigationBlocked) {
      this.releaseOwner();
      this.readyAt = time + config.HAND_REENTRY_DELAY;
      this.navigationBlocked = blocked;
    }
    let hand = this.ownerId
      ? hands.find((entry) => key(entry) === this.ownerId && valid(entry))
      : undefined;
    if (this.ownerId && !hand) {
      this.stopDrag();
      if (this.action === "zoom") {
        const result = this.dial.update(null, time, 1);
        this.zoomMissing = true;
        if (result.owned && !result.ended) return;
      }
      this.releaseOwner();
      return;
    }
    if (!hand) {
      hand = hands.find((entry) => key(entry) !== null && valid(entry));
      if (!hand) return;
      this.ownerId = key(hand);
      this.readyAt = time + config.HAND_REENTRY_DELAY;
      this.mustRelease = true;
    }
    if (this.mustRelease) {
      if (released(hand)) {
        this.mustRelease = false;
        this.pinch.reset();
      }
      return;
    }
    if (time < this.readyAt || time < this.cooldownUntil) return;
    const target = point(hand);
    if (blocked) {
      if (hand.gesture === "FIST") {
        this.action = "fist";
        if (this.fist.update(true, time, config.FIST_HOLD_TIME)) {
          this.actions.cancelFlight();
          this.cooldownUntil = time + config.BACK_COOLDOWN;
        }
      } else {
        this.fist.reset();
        this.action = "idle";
      }
      return;
    }
    this.actions.pointerHover?.(target.x, target.y);

    if (this.action === "zoom" || hand.gesture === "V_GESTURE") {
      if (this.action !== "zoom") {
        this.stopDrag();
        this.pinch.reset(true);
        this.pinchConfirmed = this.pinchMoved = false;
        this.fist.reset();
      }
      const resumed = this.zoomMissing;
      const result = this.dial.update(hand, time, 1);
      this.zoomMissing = false;
      this.action = "zoom";
      if (result.ended || !result.owned) {
        this.dial.cancel();
        this.action = "idle";
        this.mustRelease = true;
      } else if (
        !resumed &&
        !result.started &&
        dt > 0 &&
        this.dial.speed !== 0
      ) {
        // The dial's old scale clamp is irrelevant to a geographic camera.
        this.actions.zoom(this.dial.speed * dt, target.x, target.y);
      }
      return;
    }

    if (this.action === "pinch" || hand.gesture === "PINCH") {
      this.fist.reset();
      const phase = this.pinch.update(
        hand.pinchDistance,
        hand.confidence,
        time,
        true,
        hand.gesture === "PINCH",
      );
      this.action = "pinch";
      if (this.pinch.justStarted) {
        this.pinchOrigin = target;
        this.pinchConfirmed = this.pinchMoved = false;
      }
      if (
        Math.hypot(
          target.x - this.pinchOrigin.x,
          target.y - this.pinchOrigin.y,
        ) >= config.DRAG_START_DISTANCE
      ) {
        this.pinchMoved = true;
      }
      if (this.pinch.justReleased || this.pinch.needsRelease) {
        const activate =
          this.pinch.justReleased &&
          !this.pinch.needsRelease &&
          this.pinchConfirmed &&
          !this.pinchMoved &&
          !this.dragging &&
          released(hand) &&
          time - this.pinch.startedAt <= config.POINTER_TAP_MAX_TIME;
        const origin = this.pinchOrigin;
        this.stopDrag();
        this.action = "idle";
        this.mustRelease = this.pinch.needsRelease;
        this.pinchConfirmed = this.pinchMoved = false;
        if (activate && this.actions.activateAt) {
          // Lock the original hit target and consume the confirming release.
          this.reset();
          this.actions.activateAt(origin.x, origin.y);
        }
        return;
      }
      if (phase === "IDLE" || phase === "PINCH_RELEASE") {
        this.pinchConfirmed = this.pinchMoved = false;
        this.action = "idle";
        return;
      }
      if (phase === "PINCH_HOLD") {
        this.pinchConfirmed = true;
        if (
          !this.dragging &&
          Math.hypot(
            target.x - this.pinchOrigin.x,
            target.y - this.pinchOrigin.y,
          ) >= config.DRAG_START_DISTANCE
        ) {
          this.dragging = true;
          this.actions.beginDrag(target.x, target.y);
        } else if (this.dragging) {
          this.actions.dragTo(target.x, target.y);
        }
      }
      return;
    }

    if (hand.gesture === "FIST") {
      this.action = "fist";
      if (this.fist.update(true, time, config.FIST_HOLD_TIME)) {
        this.actions.cancelFlight();
        this.cooldownUntil = time + config.BACK_COOLDOWN;
      }
      return;
    }
    this.fist.reset();
    this.action = "idle";
  }
}
