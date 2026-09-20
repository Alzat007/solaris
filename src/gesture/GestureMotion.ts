import { gestureConfig as config } from "./gestureConfig";
import type { HandFeatures } from "./GestureTypes";

/** Fixed-size window: no new arrays while sampling a swipe. */
export class SwipeTracker {
  private x = new Float64Array(16);
  private y = new Float64Array(16);
  private times = new Float64Array(16);
  private cursor = 0;
  private count = 0;
  update(hand: HandFeatures, time: number): -1 | 0 | 1 {
    const index = this.cursor;
    this.x[index] = hand.center.x;
    this.y[index] = hand.center.y;
    this.times[index] = time;
    this.cursor = (index + 1) % 16;
    this.count = Math.min(16, this.count + 1);
    for (let n = 1; n < this.count; n++) {
      const i = (index - n + 16) % 16;
      const elapsed = time - this.times[i];
      if (elapsed > config.SWIPE_WINDOW) break;
      if (elapsed < config.SWIPE_MIN_TIME) continue;
      const dx = hand.center.x - this.x[i];
      const dy = hand.center.y - this.y[i];
      if (
        Math.abs(dx) >= config.SWIPE_DISTANCE &&
        Math.abs(dx) >= Math.abs(dy) * config.SWIPE_AXIS_RATIO &&
        Math.abs(hand.velocity.x) >= config.SWIPE_VELOCITY &&
        Math.abs(dx) / (elapsed / 1000) >= config.SWIPE_VELOCITY
      ) {
        this.reset();
        return dx < 0 ? -1 : 1;
      }
    }
    return 0;
  }
  reset() {
    this.cursor = this.count = 0;
  }
}

/** A deliberate approach, then a brief stable close hold. All travel is
 * relative to the observed starting span so palms need not overlap on camera. */
export class SolarEffectGesture {
  progress = 0;
  stage: "IDLE" | "READY" | "APPROACH" | "HOLD" | "PAUSED" = "IDLE";
  private mode = "";
  private lastTime = 0;
  private lastValidTime = 0;
  private span = 0;
  private startDistance = 0;
  private minDistance = 0;
  private leftStart = 0;
  private rightStart = 0;
  private activeTime = 0;
  private closeTime = 0;
  private approaching = false;
  private fired = false;

  reset() {
    this.mode = "";
    this.stage = "IDLE";
    this.progress = this.activeTime = this.closeTime = 0;
    this.approaching = this.fired = false;
  }
  private pause(time: number) {
    if (
      !this.mode ||
      time - this.lastValidTime > config.SPECIAL_POSE_GRACE_TIME
    ) {
      this.reset();
      return;
    }
    // Uncertain frames never add confirmation time or execute an action.
    this.lastTime = time;
    this.stage = "PAUSED";
  }
  update(
    first: HandFeatures,
    second: HandFeatures,
    mode: "overview" | "collapse",
    time: number,
  ): "COLLAPSE" | "REBIRTH" | null {
    const uncertain =
      first.gesture === "NONE" ||
      second.gesture === "NONE" ||
      Math.min(first.confidence, second.confidence) <
        config.TWO_HAND_MIN_CONFIDENCE;
    const incompatible = [first, second].some(
      (h) => h.gesture !== "OPEN_PALM" && h.gesture !== "NONE",
    );
    if (incompatible) {
      this.reset();
      return null;
    }
    if (uncertain) {
      this.pause(time);
      return null;
    }
    const left = first.center.x <= second.center.x ? first : second;
    const right = first.center.x <= second.center.x ? second : first;
    const distance = Math.hypot(
      left.center.x - right.center.x,
      left.center.y - right.center.y,
    );
    if (
      this.mode !== mode ||
      time - this.lastValidTime > config.SPECIAL_POSE_GRACE_TIME
    ) {
      this.seed(mode, distance, left.center.x, right.center.x, time);
      return null;
    }
    const elapsed = Math.max(
      0,
      Math.min(config.FRAME_GAP_RESET, time - this.lastTime),
    );
    const dt = Math.max(config.MOTION_MIN_FRAME_SECONDS, elapsed / 1000);
    const step = distance - this.span;
    const observationDt = Math.max(dt, (time - this.lastValidTime) / 1000);
    // Reject impossible frame jumps, not a momentary noisy velocity sample.
    if (
      Math.abs(step) > config.SPECIAL_MAX_FRAME_TRAVEL &&
      Math.abs(step) / observationDt > config.COLLAPSE_MAX_SPEED
    ) {
      this.seed(mode, distance, left.center.x, right.center.x, time);
      return null;
    }
    this.lastTime = this.lastValidTime = time;
    this.span +=
      step * (1 - Math.exp(-dt / config.SPECIAL_DISTANCE_SMOOTHING_TIME));
    if (this.fired) return null;
    if (mode === "overview") {
      if (
        this.startDistance < config.COLLAPSE_START_DISTANCE ||
        this.span > this.minDistance + config.COLLAPSE_REVERSE_TOLERANCE
      ) {
        this.seed(mode, this.span, left.center.x, right.center.x, time);
        return null;
      }
      this.minDistance = Math.min(this.minDistance, this.span);
      const travel = this.startDistance - this.span;
      if (!this.approaching && travel >= config.COLLAPSE_APPROACH_DISTANCE)
        this.approaching = true;
      if (!this.approaching) {
        this.stage = "READY";
        return null;
      }
      this.activeTime += elapsed;
      const closeDistance = Math.max(
        config.COLLAPSE_CLOSE_DISTANCE,
        this.startDistance * config.COLLAPSE_CLOSE_RATIO,
      );
      const bilateral =
        left.center.x - this.leftStart >= config.COLLAPSE_EACH_HAND_TRAVEL &&
        this.rightStart - right.center.x >= config.COLLAPSE_EACH_HAND_TRAVEL;
      const closed =
        travel >= config.COLLAPSE_MIN_TRAVEL &&
        this.span <= closeDistance &&
        bilateral;
      this.closeTime = closed ? this.closeTime + elapsed : 0;
      this.stage = closed ? "HOLD" : "APPROACH";
      this.progress =
        Math.min(1, this.activeTime / config.COLLAPSE_HOLD_TIME) * 0.7 +
        Math.min(1, this.closeTime / config.COLLAPSE_CLOSE_HOLD_TIME) * 0.3;
      if (
        this.activeTime >= config.COLLAPSE_HOLD_TIME &&
        this.closeTime >= config.COLLAPSE_CLOSE_HOLD_TIME
      ) {
        this.progress = 1;
        this.fired = true;
        return "COLLAPSE";
      }
    } else {
      if (this.startDistance > config.REBIRTH_START_DISTANCE) {
        this.seed(mode, this.span, left.center.x, right.center.x, time);
        return null;
      }
      const spread = this.span - this.startDistance;
      this.activeTime += elapsed;
      this.progress = Math.max(
        0,
        Math.min(1, spread / config.REBIRTH_MIN_SPREAD),
      );
      this.stage =
        spread > config.COLLAPSE_APPROACH_DISTANCE ? "APPROACH" : "READY";
      if (
        this.activeTime >= config.REBIRTH_MIN_TIME &&
        spread >= config.REBIRTH_MIN_SPREAD &&
        this.span >= config.REBIRTH_DISTANCE &&
        this.leftStart - left.center.x >= config.REBIRTH_EACH_HAND_SPREAD &&
        right.center.x - this.rightStart >= config.REBIRTH_EACH_HAND_SPREAD
      ) {
        this.progress = 1;
        this.fired = true;
        return "REBIRTH";
      }
    }
    return null;
  }
  private seed(
    mode: string,
    distance: number,
    left: number,
    right: number,
    time: number,
  ) {
    this.mode = mode;
    this.lastTime = this.lastValidTime = time;
    this.span = this.startDistance = this.minDistance = distance;
    this.leftStart = left;
    this.rightStart = right;
    this.progress = this.activeTime = this.closeTime = 0;
    this.approaching = this.fired = false;
    this.stage = "READY";
  }
}
