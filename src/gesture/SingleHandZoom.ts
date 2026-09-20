import { gestureConfig as config } from "./gestureConfig";
import type { HandFeatures } from "./GestureTypes";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** A five-fingertip clutch owns the whole open/close cycle. Palm translation
 * and camera distance never participate in scale. Ordinary pinches/fists cannot
 * start it, or inherit a pending action when uncertain geometry ends it. */
export class SingleHandZoom {
  active = false;
  progress = 0;
  aperture = 0;
  needsRelease = false;
  private startedAt: number | null = null;
  private lastValidAt = 0;
  private lastTime = 0;
  private openAt: number | null = null;
  private filtered = 0;

  get owned() {
    return this.active || this.startedAt !== null;
  }

  cancel(requireRelease = this.owned || this.needsRelease) {
    const wasActive = this.active;
    this.active = false;
    this.progress = 0;
    this.startedAt = this.openAt = null;
    this.lastTime = this.lastValidAt = 0;
    this.needsRelease = requireRelease;
    return wasActive;
  }

  /** Release is input evidence even while an animation owns the scene. It
   * clears the safety latch without accumulating any zoom confirmation time. */
  observeRelease(hand: HandFeatures) {
    const released =
      (hand.gesture === "OPEN_PALM" || hand.gesture === "POINT") &&
      hand.confidence >= config.MIN_CONFIDENCE &&
      (hand.trackingConfidence ?? hand.confidence) >= config.MIN_CONFIDENCE &&
      hand.pinchDistance > config.PINCH_RELEASE_THRESHOLD;
    if (released) this.needsRelease = false;
    return released;
  }

  update(hand: HandFeatures, time: number) {
    if (this.needsRelease) {
      const released = this.observeRelease(hand);
      return { owned: !released, ended: false };
    }
    const valid =
      Number.isFinite(hand.gripAperture) &&
      (hand.gripConfidence ?? 0) >= config.ONE_HAND_ZOOM_MIN_CONFIDENCE &&
      (hand.gesture === "FIVE_PINCH" ||
        hand.gesture === "OPEN_PALM" ||
        hand.gesture === "NONE");
    const starting = valid && hand.gesture === "FIVE_PINCH";
    if (!this.owned && !starting) return { owned: false, ended: false };

    // Once five tips have been captured, their reliable opening is the same
    // gesture. Requiring a static closed pose here discarded natural cycles.
    if (!valid) {
      this.openAt = null;
      if (!this.active) {
        this.cancel(true);
        return { owned: true, ended: false };
      }
      if (time - this.lastValidAt > config.ONE_HAND_ZOOM_POSE_GRACE_TIME) {
        this.cancel(true);
        return { owned: true, ended: true };
      }
      this.lastTime = time;
      return { owned: true, ended: false };
    }

    const raw = clamp(
      ((hand.gripAperture ?? 0) - config.ONE_HAND_ZOOM_CLOSED_APERTURE) /
        (config.ONE_HAND_ZOOM_OPEN_APERTURE -
          config.ONE_HAND_ZOOM_CLOSED_APERTURE),
    );
    if (this.startedAt === null) {
      this.startedAt = time;
      this.filtered = raw;
      this.lastTime = time;
    }
    const dt = Math.max(0, Math.min(0.1, (time - this.lastTime) / 1000));
    this.filtered +=
      (raw - this.filtered) *
      (1 - Math.exp(-dt / config.ONE_HAND_ZOOM_SMOOTHING_TIME));
    this.aperture = this.filtered;
    this.lastTime = this.lastValidAt = time;
    this.progress = clamp(
      (time - this.startedAt) / config.ONE_HAND_ZOOM_HOLD_TIME,
    );
    if (!this.active && this.progress < 1) return { owned: true, ended: false };
    const started = !this.active;
    this.active = true;
    const scale =
      config.ZOOM_MIN + this.filtered * (config.ZOOM_MAX - config.ZOOM_MIN);
    if (
      hand.gesture === "OPEN_PALM" &&
      raw >= config.ONE_HAND_ZOOM_RELEASE_APERTURE
    ) {
      this.openAt ??= time;
      if (time - this.openAt >= config.ONE_HAND_ZOOM_RELEASE_HOLD_TIME) {
        this.cancel(false);
        return { owned: true, ended: true, scale };
      }
    } else this.openAt = null;
    return { owned: true, ended: false, started, scale };
  }
}
