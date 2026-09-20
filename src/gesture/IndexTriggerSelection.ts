import { gestureConfig as config } from "./gestureConfig";
import type { GestureTarget } from "./gestureFeedback";
import type { HandFeatures } from "./GestureTypes";

export type IndexSelectionState =
  | "POINT_IDLE"
  | "POINT_HOVER"
  | "TARGET_LOCKING"
  | "TARGET_LOCKED"
  | "INDEX_PRESSING"
  | "INDEX_TRIGGERED"
  | "WAIT_RELEASE";

export interface IndexSelectionUpdate {
  owned: boolean;
  triggered?: GestureTarget;
}

const sameTarget = (a: GestureTarget | null, b: GestureTarget | null) =>
  a !== null && b !== null && a.kind === b.kind && a.id === b.id;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Point captures a target before finger flexion can move the cursor away.
 * Scene eligibility and continuous hand identity belong to the controller. */
export class IndexTriggerSelection {
  state: IndexSelectionState = "POINT_IDLE";
  lockedTarget: GestureTarget | null = null;
  hoverTarget: GestureTarget | null = null;
  lockProgress = 0;
  pressProgress = 0;
  needsRelease = false;

  private candidate: GestureTarget | null = null;
  private lockStarted: number | null = null;
  private graceStarted: number | null = null;
  private releaseStarted: number | null = null;
  private lastTime: number | null = null;
  private lastAngle: number | null = null;

  get owned() {
    return (
      this.state === "TARGET_LOCKED" ||
      this.state === "INDEX_PRESSING" ||
      this.state === "INDEX_TRIGGERED"
    );
  }

  /** Cancellation never silently clears an existing press/re-entry latch. */
  cancel(requireRelease = false) {
    if (requireRelease) this.releaseStarted = null;
    this.needsRelease ||= requireRelease;
    this.state = this.needsRelease ? "WAIT_RELEASE" : "POINT_IDLE";
    this.lockedTarget = this.hoverTarget = this.candidate = null;
    this.lockProgress = this.pressProgress = 0;
    this.lockStarted = this.graceStarted = this.lastAngle = null;
    if (!this.needsRelease) this.releaseStarted = null;
  }

  reset() {
    this.needsRelease = false;
    this.cancel();
    this.lastTime = this.releaseStarted = null;
  }

  private observeRelease(angle: number, time: number) {
    if (!this.needsRelease) {
      this.releaseStarted = null;
      return;
    }
    if (angle <= config.INDEX_RELEASE_THRESHOLD_DEG) {
      this.releaseStarted = null;
      return;
    }
    this.releaseStarted ??= time;
    if (time - this.releaseStarted < config.INDEX_RELEASE_HOLD) return;
    this.needsRelease = false;
    this.releaseStarted = null;
    if (this.state === "WAIT_RELEASE") this.state = "POINT_IDLE";
  }

  update(
    hand: HandFeatures | null,
    target: GestureTarget | null,
    time: number,
    enabled = true,
  ): IndexSelectionUpdate {
    const dt = this.lastTime === null ? 0 : (time - this.lastTime) / 1000;
    if (
      !Number.isFinite(time) ||
      (this.lastTime !== null &&
        (time < this.lastTime || time - this.lastTime > config.FRAME_GAP_RESET))
    ) {
      this.releaseStarted = null;
      this.cancel(true);
      this.lastTime = Number.isFinite(time) ? time : null;
      return { owned: false };
    }
    const duplicate = this.lastTime !== null && time === this.lastTime;
    this.lastTime = time;

    const angle = hand?.indexAngle;
    const tracking = hand?.trackingConfidence ?? hand?.confidence;
    if (
      !hand ||
      hand.indexAngleValid !== true ||
      !Number.isFinite(angle) ||
      angle! < 0 ||
      angle! > 180 ||
      !Number.isFinite(hand.indexAngularVelocity) ||
      !Number.isFinite(tracking) ||
      tracking! < config.MIN_CONFIDENCE
    ) {
      this.releaseStarted = null;
      this.cancel(true);
      return { owned: false };
    }
    // A duplicate cannot invent motion, but loss or a scene lock must still
    // cancel immediately even if it arrives with the previous timestamp.
    if (duplicate && enabled) return { owned: this.owned };
    const currentAngle = angle!;
    const previousAngle = this.lastAngle;
    this.lastAngle = currentAngle;
    this.hoverTarget = target;

    // Keep the trigger observable for one update, then only a release is legal.
    if (this.state === "INDEX_TRIGGERED") {
      this.state = "WAIT_RELEASE";
      this.lockedTarget = this.candidate = null;
      this.lockProgress = this.pressProgress = 0;
      this.lockStarted = this.graceStarted = null;
    }
    this.observeRelease(currentAngle, time);
    if (!enabled) {
      this.cancel(
        this.owned && currentAngle <= config.INDEX_RELEASE_THRESHOLD_DEG,
      );
      return { owned: false };
    }
    if (this.needsRelease && !this.owned) {
      this.state = "WAIT_RELEASE";
      return { owned: false };
    }

    const straight = currentAngle > config.INDEX_RELEASE_THRESHOLD_DEG;
    const point =
      hand.gesture === "POINT" &&
      straight &&
      (hand.pointConfidence ?? 0) >= config.INDEX_POINT_MIN_CONFIDENCE;
    const velocity = hand.pointerVelocity;
    const stable =
      velocity !== undefined &&
      Number.isFinite(velocity.x) &&
      Number.isFinite(velocity.y) &&
      Math.hypot(velocity.x, velocity.y) <= config.POINT_STABILITY_THRESHOLD;
    const decreasing =
      previousAngle !== null &&
      dt > 0 &&
      currentAngle < previousAngle &&
      (hand.indexAngularVelocity ?? 0) < -config.INDEX_PRESS_MIN_VELOCITY;

    if (this.lockedTarget) {
      // The first departure starts a fixed deadline. Re-entering the hover or
      // changing pose cannot renew it and hold a stale target indefinitely.
      if (!point || !stable || !sameTarget(target, this.lockedTarget))
        this.graceStarted ??= time;
      if (
        this.graceStarted !== null &&
        time - this.graceStarted >= config.TARGET_LOCK_GRACE
      ) {
        this.cancel(this.state === "INDEX_PRESSING" || !straight);
        return { owned: false };
      }

      const pressPose =
        hand.gesture === "POINT" ||
        hand.gesture === "INDEX_PRESS" ||
        hand.gesture === "NONE" ||
        hand.gesture === "FIST";
      if (!pressPose) return { owned: true };
      this.pressProgress = clamp(
        (config.INDEX_RELEASE_THRESHOLD_DEG - currentAngle) /
          (config.INDEX_RELEASE_THRESHOLD_DEG -
            config.INDEX_PRESS_THRESHOLD_DEG),
      );
      this.state = straight ? "TARGET_LOCKED" : "INDEX_PRESSING";
      if (
        currentAngle < config.INDEX_PRESS_THRESHOLD_DEG &&
        !this.needsRelease
      ) {
        // Latch the first threshold crossing even if it was too slow to fire.
        // Jitter around a held bent finger cannot become a later fresh press.
        this.needsRelease = true;
        this.releaseStarted = null;
        if (
          decreasing &&
          previousAngle !== null &&
          previousAngle >= config.INDEX_PRESS_THRESHOLD_DEG
        ) {
          this.state = "INDEX_TRIGGERED";
          this.pressProgress = 1;
          return { owned: true, triggered: this.lockedTarget };
        }
      }
      return { owned: true };
    }

    if (!point || !target || !stable) {
      this.candidate = null;
      this.lockStarted = null;
      this.lockProgress = this.pressProgress = 0;
      this.state = point && target ? "POINT_HOVER" : "POINT_IDLE";
      return { owned: false };
    }
    if (!sameTarget(this.candidate, target) || this.lockStarted === null) {
      this.candidate = { ...target };
      this.lockStarted = time;
      this.lockProgress = 0;
      this.state = "POINT_HOVER";
      return { owned: false };
    }
    this.lockProgress = clamp(
      (time - this.lockStarted) / config.TARGET_LOCK_TIME,
    );
    this.state = "TARGET_LOCKING";
    if (this.lockProgress === 1) {
      this.lockedTarget = this.candidate;
      this.state = "TARGET_LOCKED";
      this.graceStarted = null;
    }
    return { owned: this.owned };
  }
}
