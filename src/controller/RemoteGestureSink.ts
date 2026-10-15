import type { TrackingInputSink } from "../gesture/HandTrackingManager";
import type { HandFeatures, HandFrame } from "../gesture/GestureTypes";
import type { GestureTarget } from "../gesture/gestureFeedback";
import { gestureConfig as config } from "../gesture/gestureConfig";
import {
  HoldStateMachine,
  PinchStateMachine,
} from "../gesture/GestureStateMachine";
import { ThumbOpenSelection } from "../gesture/ThumbOpenSelection";
import { VRotationZoom } from "../gesture/VRotationZoom";
import type {
  RemoteAction,
  RemotePayload,
  RemoteViewState,
} from "../remote/controlProtocol";

export type RemoteGestureStatus =
  | "idle"
  | "ready"
  | "point"
  | "locking"
  | "confirm"
  | "rotate"
  | "zoom"
  | "back";
export interface RemoteGestureFeedback {
  status: RemoteGestureStatus;
  progress: number;
  pointer: { x: number; y: number } | null;
}
export interface RemoteGestureCallbacks {
  send(action: RemoteAction, payload?: RemotePayload): boolean;
  feedback?(feedback: RemoteGestureFeedback): void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const AIM_RELEASE_DISTANCE = 0.025;
const REAIM_STABILITY_DISTANCE = 0.008;
const identity = (hand: HandFeatures) => hand.id ?? hand.handedness ?? null;
const valid = (hand: HandFeatures) =>
  !!identity(hand) &&
  Number.isFinite(hand.pointer.x) &&
  Number.isFinite(hand.pointer.y) &&
  Number.isFinite(hand.trackingConfidence ?? hand.confidence) &&
  (hand.trackingConfidence ?? hand.confidence) >= config.MIN_CONFIDENCE;
const released = (hand: HandFeatures) =>
  !["PINCH", "V_GESTURE", "FIST"].includes(hand.gesture) &&
  hand.pinchDistance > config.PINCH_RELEASE_THRESHOLD &&
  (hand.gesture !== "POINT" ||
    (hand.thumbGeometryValid === true &&
      (hand.thumbSpread ?? Infinity) <= config.THUMB_CLOSED_THRESHOLD));

interface PendingMotion {
  delta: number;
  since: number | null;
}
const clearMotion = (motion: PendingMotion) => {
  motion.delta = 0;
  motion.since = null;
};
const accumulateMotion = (
  motion: PendingMotion,
  delta: number,
  time: number,
  maximum: number,
) => {
  // Retain short throttle gaps, never replay a long network backlog.
  if (motion.since !== null && time - motion.since > config.FRAME_GAP_RESET)
    clearMotion(motion);
  if (Math.abs(delta) > 1e-7 && motion.since === null) motion.since = time;
  motion.delta = clamp(motion.delta + delta, -maximum, maximum);
  return motion.delta;
};

/** Camera geometry remains local. Only bounded intent reaches the television. */
export class RemoteGestureSink implements TrackingInputSink {
  private selection = new ThumbOpenSelection();
  private pinch = new PinchStateMachine();
  private dial = new VRotationZoom();
  private fist = new HoldStateMachine();
  private view: RemoteViewState | null = null;
  private connected = false;
  private owner: string | null = null;
  private mustRelease = true;
  private readyAt = 0;
  private cooldownUntil = 0;
  private lastTime: number | null = null;
  private dragging = false;
  private pinchOrigin: { x: number; y: number } | null = null;
  private lastPoint: { x: number; y: number } | null = null;
  private pinchConsumed = false;
  private missingZoom = false;
  private fistNeedsRelease = false;
  private thumbBackNeedsRelease = false;
  private lastRotationAt = -Infinity;
  private frozenPointer: { x: number; y: number } | null = null;
  private reaiming = false;
  private reaimAnchor: { x: number; y: number; time: number } | null = null;
  private pendingRotation: PendingMotion = { delta: 0, since: null };
  private pendingZoom: PendingMotion = { delta: 0, since: null };

  constructor(private readonly callbacks: RemoteGestureCallbacks) {}

  setContext(connected: boolean, view: RemoteViewState | null) {
    const boundary =
      this.connected !== connected ||
      this.view?.mode !== view?.mode ||
      this.view?.selected !== view?.selected ||
      (this.view?.available.join(",") ?? "") !==
        (view?.available.join(",") ?? "");
    if (boundary) this.reset();
    this.connected = connected;
    this.view = view;
  }

  private allowed(action: RemoteAction) {
    return this.connected && !!this.view?.available.includes(action);
  }

  private send(action: RemoteAction, payload?: RemotePayload) {
    return this.allowed(action) && this.callbacks.send(action, payload);
  }

  private report(
    status: RemoteGestureStatus,
    progress = 0,
    hand?: HandFeatures,
    lockedPointer?: { x: number; y: number },
  ) {
    const pointer = lockedPointer ?? hand?.pointer;
    this.callbacks.feedback?.({
      status,
      progress: clamp(progress, 0, 1),
      pointer: pointer
        ? { x: clamp(pointer.x, 0, 1), y: clamp(pointer.y, 0, 1) }
        : null,
    });
  }

  private endDrag() {
    if (this.dragging) this.send("ROTATE_END");
    this.dragging = false;
    this.lastPoint = this.pinchOrigin = null;
    clearMotion(this.pendingRotation);
  }

  reset() {
    this.endDrag();
    if (this.dial.owned) this.send("STOP");
    this.selection.reset();
    this.selection.cancel(true);
    this.pinch.reset(true);
    this.dial.cancel();
    clearMotion(this.pendingZoom);
    this.fist.reset();
    this.owner = null;
    this.mustRelease = true;
    this.fistNeedsRelease = false;
    this.thumbBackNeedsRelease = false;
    this.lastRotationAt = -Infinity;
    this.frozenPointer = null;
    this.reaiming = false;
    this.reaimAnchor = null;
    this.pinchConsumed = this.missingZoom = false;
    this.readyAt = this.cooldownUntil = 0;
    this.lastTime = null;
    this.report("idle");
  }

  private updateSelection(hand: HandFeatures, time: number) {
    const closedPoint =
      hand.gesture === "POINT" &&
      hand.thumbGeometryValid === true &&
      (hand.thumbSpread ?? Infinity) <= config.THUMB_CLOSED_THRESHOLD;
    // A closed-thumb departure is navigation, not an indefinitely held click.
    // Opening the thumb still retains the original confirmation grace.
    if (
      closedPoint &&
      this.frozenPointer &&
      (this.selection.owned || this.selection.lockProgress > 0) &&
      Math.hypot(
        hand.pointer.x - this.frozenPointer.x,
        hand.pointer.y - this.frozenPointer.y,
      ) > AIM_RELEASE_DISTANCE
    ) {
      this.selection.cancel();
      this.reaiming = true;
      this.reaimAnchor = null;
      this.frozenPointer = null;
    }
    if (this.reaiming) {
      if (!closedPoint) this.reaimAnchor = null;
      else if (
        !this.reaimAnchor ||
        Math.hypot(
          hand.pointer.x - this.reaimAnchor.x,
          hand.pointer.y - this.reaimAnchor.y,
        ) > REAIM_STABILITY_DISTANCE
      )
        this.reaimAnchor = { ...hand.pointer, time };
      // Do not recapture a stale TV target while moving or before live aim was sent.
      if (
        this.reaimAnchor &&
        time - this.reaimAnchor.time >= config.TARGET_LOCK_TIME &&
        this.frozenPointer &&
        Math.hypot(
          hand.pointer.x - this.frozenPointer.x,
          hand.pointer.y - this.frozenPointer.y,
        ) <= REAIM_STABILITY_DISTANCE
      ) {
        this.reaiming = false;
        this.reaimAnchor = null;
      } else {
        this.selection.update(hand, null, time, false);
        return false;
      }
    }
    const focus = this.view?.focusTarget;
    const target = focus?.source === "focus" ? null : focus;
    const selectionTarget: GestureTarget | null = target
      ? { kind: "ui", id: target.id, label: target.label ?? target.id }
      : null;
    const selected = this.selection.update(
      hand,
      selectionTarget,
      time,
      this.allowed("SELECT"),
    );
    if (!this.selection.needsRelease) this.thumbBackNeedsRelease = false;
    if (selected.triggered) {
      this.thumbBackNeedsRelease = true;
      const sent =
        target?.id === selected.triggered.id &&
        this.send("SELECT", { expectedTargetId: selected.triggered.id });
      if (sent) this.cooldownUntil = time + config.SELECT_COOLDOWN;
      this.report(sent ? "confirm" : "ready", sent ? 1 : 0, hand);
      return true;
    }
    if (selected.owned || this.selection.lockProgress > 0) {
      this.fist.reset();
      if (this.frozenPointer && hand.gesture === "POINT")
        this.send("POINTER", this.frozenPointer);
      this.report(
        "locking",
        Math.max(this.selection.lockProgress, this.selection.pressProgress),
        hand,
        this.frozenPointer ?? undefined,
      );
      return true;
    }
    return false;
  }

  update({ hands, time }: HandFrame) {
    if (
      !Number.isFinite(time) ||
      (this.lastTime !== null &&
        (time < this.lastTime || time - this.lastTime > config.FRAME_GAP_RESET))
    ) {
      this.reset();
      return;
    }
    if (this.lastTime === time) return;
    const dt = this.lastTime === null ? 0 : (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (!this.connected || !this.view) {
      this.reset();
      return;
    }
    const reliable = hands.filter(valid);
    let hand = reliable.find((entry) => identity(entry) === this.owner);
    if (this.owner && !hand) {
      this.endDrag();
      clearMotion(this.pendingZoom);
      if (this.dial.owned) {
        if (!this.missingZoom) this.send("STOP");
        const result = this.dial.update(null, time, 1);
        this.missingZoom = true;
        if (result.owned && !result.ended) {
          this.report("zoom");
          return;
        }
      }
      this.reset();
      return;
    }
    if (!hand) {
      hand = reliable[0];
      if (!hand) {
        this.report("idle");
        return;
      }
      this.owner = identity(hand);
      this.readyAt = time + config.HAND_REENTRY_DELAY;
      this.mustRelease = true;
    }
    if (
      !Number.isFinite(hand.confidence) ||
      hand.confidence < config.MIN_CONFIDENCE
    ) {
      const owner = this.owner;
      const readyAt = this.readyAt;
      const cooldownUntil = this.cooldownUntil;
      this.reset();
      // Ambiguous pose stops motion, but is not a lost tracked hand.
      this.owner = owner;
      this.readyAt = readyAt;
      this.cooldownUntil = cooldownUntil;
      this.lastTime = time;
      return;
    }
    if (this.mustRelease) {
      if (released(hand)) {
        this.mustRelease = false;
        this.pinch.reset();
      }
      this.selection.update(hand, null, time, false);
      this.report("idle", 0, hand);
      return;
    }
    if (hand.gesture !== "FIST") this.fistNeedsRelease = false;
    if (time < this.readyAt || time < this.cooldownUntil) {
      this.selection.update(hand, null, time, false);
      this.fist.reset();
      this.report("ready", 0, hand);
      return;
    }
    const point = {
      x: clamp(hand.pointer.x, 0, 1),
      y: clamp(hand.pointer.y, 0, 1),
    };

    // Match the computer clutch: a captured target consumes competing poses
    // until its existing grace expires, rather than becoming rotate/zoom.
    const selectionWasOwned = this.selection.owned;
    if (selectionWasOwned && this.updateSelection(hand, time)) return;

    // An acquired dial consumes every competing gesture, including its release.
    if (this.dial.owned || hand.gesture === "V_GESTURE") {
      this.endDrag();
      this.selection.update(hand, null, time, false);
      this.pinch.reset(true);
      this.fist.reset();
      if (!this.allowed("ZOOM")) {
        this.dial.cancel();
        clearMotion(this.pendingZoom);
        this.mustRelease = true;
        this.report("idle", 0, hand);
        return;
      }
      const resumed = this.missingZoom;
      const result = this.dial.update(hand, time, 1);
      this.missingZoom = false;
      if (result.ended || !result.owned) {
        clearMotion(this.pendingZoom);
        this.send("STOP");
        this.dial.cancel();
        this.mustRelease = true;
      } else if (
        !resumed &&
        !result.started &&
        this.dial.speed !== 0 &&
        dt > 0
      ) {
        const delta = accumulateMotion(
          this.pendingZoom,
          this.dial.speed * dt,
          time,
          0.1,
        );
        if (Math.abs(delta) > 1e-7 && this.send("ZOOM", { delta }))
          clearMotion(this.pendingZoom);
      } else clearMotion(this.pendingZoom);
      this.report("zoom", this.dial.progress, hand);
      return;
    }

    // Two-hand pinches never resurrect the discarded scale gesture.
    if (reliable.length > 1) {
      this.endDrag();
      this.selection.cancel(true);
      this.pinch.reset(true);
      this.fist.reset();
      this.report("idle", 0, hand);
      return;
    }

    if (
      hand.gesture === "PINCH" ||
      this.pinch.phase === "PINCH_START" ||
      this.pinch.phase === "PINCH_HOLD"
    ) {
      this.selection.update(hand, null, time, false);
      this.fist.reset();
      const phase = this.pinch.update(
        hand.pinchDistance,
        hand.confidence,
        time,
        this.allowed("ROTATE_START") && this.allowed("ROTATE"),
        hand.gesture === "PINCH",
      );
      if (this.pinch.justStarted) {
        this.pinchOrigin = this.lastPoint = point;
        // DOM focus remains selectable by D-pad, but is not a live hand target.
        const target = this.view.focusTarget;
        this.pinchConsumed = target?.kind === "ui" && target.source !== "focus";
      }
      if (this.pinch.justHeld) {
        // Finger closure and its filtered tail are not intentional drag travel.
        this.pinchOrigin = this.lastPoint = point;
        clearMotion(this.pendingRotation);
      }
      if (this.pinch.justReleased || hand.gesture !== "PINCH") {
        this.endDrag();
        this.report("ready", 0, hand);
        return;
      }
      if (phase === "PINCH_HOLD" && !this.pinchConsumed && this.pinchOrigin) {
        if (
          !this.dragging &&
          Math.hypot(
            point.x - this.pinchOrigin.x,
            point.y - this.pinchOrigin.y,
          ) >= config.DRAG_START_DISTANCE
        ) {
          this.dragging = this.send("ROTATE_START");
          this.lastPoint = point;
          clearMotion(this.pendingRotation);
          if (this.dragging) this.lastRotationAt = time;
        } else if (this.dragging && this.lastPoint) {
          // Current computer pinch rotation is horizontal; do not invent Y motion.
          const dx = accumulateMotion(
            this.pendingRotation,
            point.x - this.lastPoint.x,
            time,
            0.15,
          );
          if (Math.abs(dx) > 1e-7) {
            let leaseReady = true;
            if (time - this.lastRotationAt >= 250) {
              leaseReady = this.send("ROTATE_START");
              if (leaseReady) this.lastRotationAt = time;
            }
            if (leaseReady && this.send("ROTATE", { dx, dy: 0 })) {
              clearMotion(this.pendingRotation);
              this.lastRotationAt = time;
            }
          }
          this.lastPoint = point;
        }
      }
      this.report(
        this.dragging ? "rotate" : "ready",
        this.pinch.progress,
        hand,
      );
      return;
    }

    if (!selectionWasOwned && this.updateSelection(hand, time)) return;
    if (
      this.allowed("POINTER") &&
      hand.gesture === "POINT" &&
      this.send("POINTER", point)
    ) {
      this.frozenPointer = point;
    }

    if (
      hand.gesture === "FIST" &&
      this.allowed("BACK") &&
      !this.fistNeedsRelease &&
      !this.thumbBackNeedsRelease
    ) {
      if (
        this.fist.update(true, time, config.FIST_HOLD_TIME) &&
        this.send("BACK")
      ) {
        this.fistNeedsRelease = true;
        this.cooldownUntil = time + config.BACK_COOLDOWN;
      }
      this.report("back", this.fist.progress, hand);
      return;
    }
    this.fist.reset();
    this.report(hand.gesture === "POINT" ? "point" : "ready", 0, hand);
  }
}
