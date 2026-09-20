import { gestureConfig as config } from "./gestureConfig";
import type { HandFeatures } from "./GestureTypes";

export type VRotationZoomState =
  | "IDLE"
  | "V_DETECTED"
  | "ZOOM_DIAL_ARMED"
  | "ZOOM_DIAL_ACTIVE"
  | "ZOOM_DIAL_RELEASE";

export interface VRotationZoomUpdate {
  owned: boolean;
  started?: boolean;
  ended?: boolean;
  scale?: number;
}

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const clampScale = (scale: number) =>
  Math.max(config.V_ZOOM_MIN, Math.min(config.V_ZOOM_MAX, scale));

/** A held V is a rate-control dial. Only the mirrored MCP palm-axis angle is
 * consumed here; fingertip positions, hand translation and image size are not.
 * The caller owns scene locks and continuous hand identity. */
export class VRotationZoom {
  state: VRotationZoomState = "IDLE";
  progress = 0;
  baseAngle: number | null = null;
  currentAngle: number | null = null;
  /** Smoothed relative angle in degrees. The angle fields themselves are radians. */
  delta = 0;
  speed = 0;
  direction: "IN" | "OUT" | "NONE" = "NONE";

  private detectedAt: number | null = null;
  private lastTime: number | null = null;
  private missingAt: number | null = null;
  private lastAngle: number | null = null;
  private handednessOffset = 0;

  get active() {
    return this.state === "ZOOM_DIAL_ACTIVE";
  }

  get owned() {
    return this.state !== "IDLE";
  }

  cancel() {
    const wasOwned = this.owned;
    this.state = "IDLE";
    this.progress = 0;
    this.baseAngle = this.currentAngle = null;
    this.delta = this.speed = 0;
    this.direction = "NONE";
    this.detectedAt = this.lastTime = this.missingAt = this.lastAngle = null;
    this.handednessOffset = 0;
    return wasOwned;
  }

  private release(): VRotationZoomUpdate {
    this.state = "ZOOM_DIAL_RELEASE";
    this.speed = 0;
    this.direction = "NONE";
    this.progress = 0;
    this.missingAt = null;
    // Consume the release frame: a closing fist or opening palm must not also
    // become Back/Swipe in the same update that ends the dial.
    return { owned: true, ended: true };
  }

  private measureAngle(angle: number) {
    const canonical = wrap(angle + this.handednessOffset);
    if (this.lastAngle === null || this.currentAngle === null)
      this.currentAngle = canonical;
    else this.currentAngle += wrap(canonical - this.lastAngle);
    this.lastAngle = canonical;
  }

  update(
    hand: HandFeatures | null,
    time: number,
    currentScale: number,
  ): VRotationZoomUpdate {
    if (this.state === "ZOOM_DIAL_RELEASE") this.cancel();

    // A clock discontinuity must never integrate an unseen interval or count
    // it towards the initial hold. Require a fresh candidate on the next call.
    if (
      !Number.isFinite(time) ||
      (this.lastTime !== null &&
        (time < this.lastTime || time - this.lastTime > config.FRAME_GAP_RESET))
    ) {
      if (this.owned) return this.release();
      this.cancel();
      return { owned: false };
    }
    const dt = this.lastTime === null ? 0 : (time - this.lastTime) / 1000;
    this.lastTime = time;
    // A returning valid frame cannot revive a clutch whose grace already
    // expired between callbacks; its next update must start a new candidate.
    if (
      this.missingAt !== null &&
      time - this.missingAt >= config.V_GESTURE_RELEASE_GRACE
    )
      return this.release();
    const valid =
      hand !== null &&
      hand.gesture === "V_GESTURE" &&
      (hand.vConfidence ?? 0) >= config.V_GESTURE_MIN_CONFIDENCE &&
      (hand.trackingConfidence ?? hand.confidence) >= config.MIN_CONFIDENCE &&
      hand.palmRollValid === true &&
      Number.isFinite(hand.palmRoll);

    if (!valid) {
      this.speed = 0;
      this.direction = "NONE";
      if (this.state === "V_DETECTED") {
        this.cancel();
        return { owned: true };
      }
      if (!this.owned) return { owned: false };
      this.missingAt ??= time;
      if (time - this.missingAt >= config.V_GESTURE_RELEASE_GRACE)
        return this.release();
      return { owned: true };
    }

    if (this.state === "IDLE") {
      this.state = "V_DETECTED";
      this.detectedAt = time;
      // Reversing the left palm axis adds a constant, not a sign flip. Freeze
      // it for this clutch so a transient handedness label change cannot jump.
      this.handednessOffset = hand.handedness === "Left" ? Math.PI : 0;
    }
    const resumed = this.missingAt !== null;
    this.missingAt = null;
    this.measureAngle(hand.palmRoll!);

    if (this.state === "V_DETECTED") {
      this.progress = Math.min(
        1,
        (time - this.detectedAt!) / config.V_GESTURE_HOLD_TIME,
      );
      if (this.progress < 1) return { owned: true };
      this.baseAngle = this.currentAngle;
      this.delta = this.speed = 0;
      this.direction = "NONE";
      this.state = "ZOOM_DIAL_ARMED";
      return { owned: true, started: true, scale: clampScale(currentScale) };
    }

    // ARMED lasts for one observable update before the rate control activates.
    if (this.state === "ZOOM_DIAL_ARMED") this.state = "ZOOM_DIAL_ACTIVE";
    const rawDelta = ((this.currentAngle! - this.baseAngle!) * 180) / Math.PI;
    this.delta +=
      (rawDelta - this.delta) * (1 - Math.exp(-dt / config.V_ZOOM_SMOOTHING));

    // Returning to neutral stops immediately even if the visual angle filter
    // still trails the wrist. Invalid input has the same immediate stop above.
    if (Math.abs(rawDelta) <= config.V_ZOOM_DEADZONE_DEG) this.speed = 0;
    else {
      const normalized = Math.max(
        0,
        Math.min(
          1,
          (Math.abs(this.delta) - config.V_ZOOM_DEADZONE_DEG) /
            (config.V_ZOOM_MAX_ANGLE_DEG - config.V_ZOOM_DEADZONE_DEG),
        ),
      );
      this.speed =
        Math.sign(this.delta) *
        normalized *
        normalized *
        config.V_ZOOM_MAX_SPEED;
    }
    this.direction = this.speed > 0 ? "IN" : this.speed < 0 ? "OUT" : "NONE";
    return {
      owned: true,
      // The first recovered sample updates the dial but never replays scale
      // movement for the interval in which no reliable V was observed.
      scale: clampScale(currentScale + this.speed * (resumed ? 0 : dt)),
    };
  }
}
