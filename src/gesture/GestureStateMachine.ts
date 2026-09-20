import { gestureConfig as config } from "./gestureConfig";
import type { PinchPhase } from "./gestureFeedback";

/** One machine per tracked hand. A cancelled/reconnected pinch must release
 * before it can begin again. No click is ever generated on every held frame. */
export class PinchStateMachine {
  phase: PinchPhase = "IDLE";
  progress = 0;
  startedAt = 0;
  needsRelease = false;
  justStarted = false;
  justHeld = false;
  justReleased = false;

  update(
    distance: number,
    confidence: number,
    time: number,
    allowed: boolean,
    pinchPose = true,
  ) {
    this.justStarted = this.justHeld = this.justReleased = false;
    const separated = distance > config.PINCH_RELEASE_THRESHOLD;
    if (separated) {
      this.needsRelease = false;
      this.justReleased =
        this.phase === "PINCH_START" || this.phase === "PINCH_HOLD";
      this.phase = this.justReleased ? "PINCH_RELEASE" : "IDLE";
      this.progress = 0;
      return this.phase;
    }
    if (
      !allowed ||
      confidence < config.MIN_CONFIDENCE ||
      !Number.isFinite(distance) ||
      !pinchPose
    ) {
      const wasActive =
        this.phase === "PINCH_START" || this.phase === "PINCH_HOLD";
      this.reset(
        wasActive ||
          (pinchPose && distance < config.PINCH_START_THRESHOLD) ||
          this.needsRelease,
      );
      this.justReleased = wasActive;
      return this.phase;
    }
    if (this.needsRelease) return this.phase;
    if (this.phase === "PINCH_RELEASE") this.phase = "IDLE";
    if (this.phase === "IDLE" && distance < config.PINCH_START_THRESHOLD) {
      this.startedAt = time;
      this.phase = "PINCH_START";
      this.justStarted = true;
    }
    if (this.phase === "PINCH_START") {
      this.progress = Math.min(
        1,
        Math.max(0, (time - this.startedAt) / config.PINCH_HOLD_TIME),
      );
      if (this.progress >= 1) {
        this.phase = "PINCH_HOLD";
        this.justHeld = true;
      }
    }
    return this.phase;
  }
  reset(requireRelease = false) {
    this.phase = "IDLE";
    this.progress = 0;
    this.startedAt = 0;
    this.needsRelease = requireRelease;
    this.justStarted = this.justHeld = this.justReleased = false;
  }
}

export class HoldStateMachine {
  progress = 0;
  private started: number | null = null;
  private fired = false;
  update(active: boolean, time: number, duration: number) {
    if (!active) {
      this.reset();
      return false;
    }
    if (this.started === null) this.started = time;
    this.progress = Math.min(1, Math.max(0, (time - this.started) / duration));
    if (this.progress === 1 && !this.fired) {
      this.fired = true;
      return true;
    }
    return false;
  }
  reset() {
    this.progress = 0;
    this.started = null;
    this.fired = false;
  }
}
