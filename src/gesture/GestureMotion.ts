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

/** Two open palms are a deliberate optional effect, never navigation/zoom. */
export class SolarEffectGesture {
  progress = 0;
  private mode = "";
  private startTime = 0;
  private startDistance = 0;
  private lastDistance = 0;
  private lastTime = 0;
  private minDistance = 0;
  private leftStart = 0;
  private rightStart = 0;
  private approaching = false;
  private fired = false;
  reset() {
    this.mode = "";
    this.progress = 0;
    this.approaching = false;
    this.fired = false;
  }
  update(
    first: HandFeatures,
    second: HandFeatures,
    mode: "overview" | "collapse",
    time: number,
  ): "COLLAPSE" | "REBIRTH" | null {
    if (
      first.gesture !== "OPEN_PALM" ||
      second.gesture !== "OPEN_PALM" ||
      Math.min(first.confidence, second.confidence) <
        config.TWO_HAND_MIN_CONFIDENCE
    ) {
      this.reset();
      return null;
    }
    const left = first.center.x <= second.center.x ? first : second;
    const right = first.center.x <= second.center.x ? second : first;
    const distance = Math.hypot(
      left.center.x - right.center.x,
      left.center.y - right.center.y,
    );
    if (this.mode !== mode || time - this.lastTime > config.FRAME_GAP_RESET) {
      this.seed(mode, distance, left.center.x, right.center.x, time);
      return null;
    }
    const dt = Math.max(
      config.MOTION_MIN_FRAME_SECONDS,
      (time - this.lastTime) / 1000,
    );
    const speed = (distance - this.lastDistance) / dt;
    this.lastDistance = distance;
    this.lastTime = time;
    if (this.fired) return null;
    if (mode === "overview") {
      // Approaching starts from a visibly separated pair, not a pair that
      // simply appeared together. Sudden closures and reversals cancel.
      if (
        this.startDistance <
          config.COLLAPSE_CLOSE_DISTANCE + config.COLLAPSE_MIN_TRAVEL ||
        Math.abs(speed) > config.COLLAPSE_MAX_SPEED ||
        distance > this.minDistance + config.COLLAPSE_REVERSE_TOLERANCE
      ) {
        this.seed(mode, distance, left.center.x, right.center.x, time);
        return null;
      }
      this.minDistance = Math.min(this.minDistance, distance);
      if (!this.approaching && speed < -config.COLLAPSE_APPROACH_MIN_SPEED) {
        this.approaching = true;
        this.startTime = time;
      }
      if (!this.approaching) return null;
      const travel = this.startDistance - distance;
      this.progress = Math.min(
        1,
        (time - this.startTime) / config.COLLAPSE_HOLD_TIME,
        travel / config.COLLAPSE_MIN_TRAVEL,
      );
      if (
        this.progress >= 1 &&
        distance <= config.COLLAPSE_CLOSE_DISTANCE &&
        left.center.x - this.leftStart > config.COLLAPSE_EACH_HAND_TRAVEL &&
        this.rightStart - right.center.x > config.COLLAPSE_EACH_HAND_TRAVEL
      ) {
        this.fired = true;
        return "COLLAPSE";
      }
    } else {
      if (
        this.startDistance >
        config.COLLAPSE_CLOSE_DISTANCE + config.REBIRTH_START_DISTANCE_MARGIN
      ) {
        this.seed(mode, distance, left.center.x, right.center.x, time);
        return null;
      }
      const spread = distance - this.startDistance;
      this.progress = Math.max(
        0,
        Math.min(1, spread / config.REBIRTH_MIN_SPREAD),
      );
      if (
        time - this.startTime >= config.REBIRTH_MIN_TIME &&
        spread >= config.REBIRTH_MIN_SPREAD &&
        distance >= config.REBIRTH_DISTANCE &&
        this.leftStart - left.center.x > config.REBIRTH_EACH_HAND_SPREAD &&
        right.center.x - this.rightStart > config.REBIRTH_EACH_HAND_SPREAD
      ) {
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
    this.startTime = this.lastTime = time;
    this.startDistance = this.lastDistance = this.minDistance = distance;
    this.leftStart = left;
    this.rightStart = right;
    this.progress = 0;
    this.approaching = false;
    this.fired = false;
  }
}
