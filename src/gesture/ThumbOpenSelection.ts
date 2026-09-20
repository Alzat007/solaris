import { gestureConfig as config } from "./gestureConfig";
import type { GestureTarget } from "./gestureFeedback";
import type { HandFeatures } from "./GestureTypes";

export type ThumbSelectionState =
  | "POINT_IDLE"
  | "POINT_HOVER"
  | "TARGET_LOCKING"
  | "TARGET_LOCKED"
  | "THUMB_OPENING"
  | "THUMB_TRIGGERED"
  | "WAIT_RELEASE";

export interface ThumbSelectionUpdate {
  owned: boolean;
  triggered?: GestureTarget;
}

const sameTarget = (a: GestureTarget | null, b: GestureTarget | null) =>
  a !== null && b !== null && a.kind === b.kind && a.id === b.id;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** A closed-thumb Point captures a target, then opening the thumb confirms it.
 * Finger curl and angular velocity never participate in this selection path.
 * The caller owns scene eligibility, hand identity and re-entry delay. */
export class ThumbOpenSelection {
  state: ThumbSelectionState = "POINT_IDLE";
  lockedTarget: GestureTarget | null = null;
  hoverTarget: GestureTarget | null = null;
  lockProgress = 0;
  pressProgress = 0;
  needsRelease = false;

  private candidate: GestureTarget | null = null;
  private lockStarted: number | null = null;
  private graceStarted: number | null = null;
  private openingStarted: number | null = null;
  private releaseStarted: number | null = null;
  private lastTime: number | null = null;

  get owned() {
    return (
      this.state === "TARGET_LOCKED" ||
      this.state === "THUMB_OPENING" ||
      this.state === "THUMB_TRIGGERED"
    );
  }

  /** A new identity must not inherit another hand's partial release hold. */
  cancel(requireRelease = false) {
    if (requireRelease) this.releaseStarted = null;
    this.needsRelease ||= requireRelease;
    this.state = this.needsRelease ? "WAIT_RELEASE" : "POINT_IDLE";
    this.lockedTarget = this.hoverTarget = this.candidate = null;
    this.lockProgress = this.pressProgress = 0;
    this.lockStarted = this.graceStarted = this.openingStarted = null;
    if (!this.needsRelease) this.releaseStarted = null;
  }

  reset() {
    this.needsRelease = false;
    this.cancel();
    this.lastTime = this.releaseStarted = null;
  }

  private observeRelease(closed: boolean, time: number) {
    if (!this.needsRelease || !closed) {
      this.releaseStarted = null;
      return;
    }
    this.releaseStarted ??= time;
    if (time - this.releaseStarted < config.THUMB_RELEASE_HOLD) return;
    this.needsRelease = false;
    this.releaseStarted = null;
    if (this.state === "WAIT_RELEASE") this.state = "POINT_IDLE";
  }

  update(
    hand: HandFeatures | null,
    target: GestureTarget | null,
    time: number,
    enabled = true,
  ): ThumbSelectionUpdate {
    if (
      !Number.isFinite(time) ||
      (this.lastTime !== null &&
        (time < this.lastTime || time - this.lastTime > config.FRAME_GAP_RESET))
    ) {
      this.cancel(true);
      this.lastTime = Number.isFinite(time) ? time : null;
      return { owned: false };
    }
    const duplicate = this.lastTime !== null && time === this.lastTime;
    this.lastTime = time;
    const tracking = hand?.trackingConfidence ?? hand?.confidence;
    if (
      !hand ||
      hand.thumbGeometryValid !== true ||
      !Number.isFinite(hand.thumbSpread) ||
      !Number.isFinite(hand.thumbReach) ||
      hand.thumbReach! < 0 ||
      !Number.isFinite(tracking) ||
      tracking! < config.MIN_CONFIDENCE ||
      (hand.gesture === "POINT" &&
        (!Number.isFinite(hand.pointConfidence) ||
          hand.pointConfidence! < config.POINT_MIN_CONFIDENCE))
    ) {
      this.cancel(true);
      return { owned: false };
    }
    // Duplicate motion cannot advance a hold. Missing/invalid geometry above
    // and disabled scene frames below still cancel immediately at the same time.
    if (duplicate && enabled) return { owned: this.owned };
    this.hoverTarget = target;
    const closed = hand.thumbSpread! <= config.THUMB_CLOSED_THRESHOLD;
    const point =
      hand.gesture === "POINT" &&
      hand.pointConfidence! >= config.POINT_MIN_CONFIDENCE;

    // Preserve the fired target for one update; subsequent held-open samples
    // can only wait for a deliberate return of the thumb toward the palm.
    if (this.state === "THUMB_TRIGGERED") {
      this.state = "WAIT_RELEASE";
      this.lockedTarget = this.candidate = null;
      this.lockProgress = this.pressProgress = 0;
      this.lockStarted = this.graceStarted = this.openingStarted = null;
    }
    this.observeRelease(closed, time);
    if (!enabled) {
      this.cancel(!closed && (this.owned || point));
      return { owned: false };
    }
    if (this.needsRelease) {
      this.state = "WAIT_RELEASE";
      return { owned: false };
    }

    const velocity = hand.pointerVelocity;
    const stable =
      velocity !== undefined &&
      Number.isFinite(velocity.x) &&
      Number.isFinite(velocity.y) &&
      Math.hypot(velocity.x, velocity.y) <= config.POINT_STABILITY_THRESHOLD;

    if (this.lockedTarget) {
      // A stable closed Point may wait indefinitely. Once it departs or opens,
      // neither re-hovering nor repeatedly opening the thumb renews the grace.
      if (
        !point ||
        !closed ||
        !stable ||
        !sameTarget(target, this.lockedTarget)
      )
        this.graceStarted ??= time;
      if (
        this.graceStarted !== null &&
        time - this.graceStarted >= config.TARGET_LOCK_GRACE
      ) {
        this.cancel(!closed);
        return { owned: false };
      }
      const open =
        point &&
        hand.thumbSpread! >= config.THUMB_OPEN_THRESHOLD &&
        hand.thumbReach! >= config.THUMB_MIN_REACH;
      this.state = point && !closed ? "THUMB_OPENING" : "TARGET_LOCKED";
      if (!open) {
        this.openingStarted = null;
        this.pressProgress = 0;
        return { owned: true };
      }
      this.openingStarted ??= time;
      this.pressProgress = clamp(
        (time - this.openingStarted) / config.THUMB_OPEN_HOLD,
      );
      if (this.pressProgress === 1) {
        this.state = "THUMB_TRIGGERED";
        this.needsRelease = true;
        this.releaseStarted = null;
        return { owned: true, triggered: this.lockedTarget };
      }
      return { owned: true };
    }

    // An already-open Point entering a target must close first; it cannot
    // acquire a lock and turn an old thumb posture into a fresh confirmation.
    if (point && !closed) {
      this.cancel(true);
      return { owned: false };
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
