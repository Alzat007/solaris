import type { Gesture, HandFeatures, Landmark } from "./GestureTypes";
import { gestureConfig } from "./gestureConfig";
import { recognizerConfig as config } from "./recognizerConfig";

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const distance = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angle = (a: Landmark, b: Landmark, c: Landmark) => {
  const ux = a.x - b.x,
    uy = a.y - b.y,
    uz = a.z - b.z;
  const vx = c.x - b.x,
    vy = c.y - b.y,
    vz = c.z - b.z;
  const cosine =
    (ux * vx + uy * vy + uz * vz) /
    (Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
};
const smoothPosition = (
  x: number,
  y: number,
  previous: { x: number; y: number } | undefined,
  alpha: number,
) => {
  if (!previous) return { x, y };
  const dx = x - previous.x,
    dy = y - previous.y;
  // A radial dead zone avoids idle tremor without introducing diagonal bias.
  if (Math.hypot(dx, dy) <= gestureConfig.CURSOR_DEAD_ZONE)
    return { x: previous.x, y: previous.y };
  return { x: previous.x + dx * alpha, y: previous.y + dy * alpha };
};

/** Extracts geometry only. Confirmation timing, drag, cooldown and re-entry are
 * owned by GestureStateMachine. Scratch landmarks never escape into a frame. */
export class GestureRecognizer {
  private previous: HandFeatures | null = null;
  private time = 0;
  private pinched = false;
  private extended = [false, false, false, false];
  private scores = new Float64Array(4);
  private corrected: Landmark[] = Array.from({ length: 21 }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));
  reset() {
    this.previous = null;
    this.time = 0;
    this.pinched = false;
    this.extended.fill(false);
  }
  analyze(
    points: Landmark[],
    world: Landmark[] | undefined,
    time: number,
    aspect = 4 / 3,
  ): HandFeatures {
    if (time - this.time > gestureConfig.FRAME_GAP_RESET || time < this.time)
      this.reset();
    const p = this.corrected;
    for (let i = 0; i < 21; i++) {
      p[i].x = points[i].x * aspect;
      p[i].y = points[i].y;
      p[i].z = points[i].z * aspect;
    }
    const w = world?.length === 21 ? world : p;
    const palmX =
      (points[0].x + points[5].x + points[9].x + points[13].x + points[17].x) /
      5;
    const palmY =
      (points[0].y + points[5].y + points[9].y + points[13].y + points[17].y) /
      5;
    const width = Math.max(distance(p[5], p[17]), config.MIN_PALM_WIDTH);
    const dt = Math.max(
      config.MIN_FRAME_SECONDS,
      Math.min(config.MAX_FRAME_SECONDS, (time - this.time) / 1000),
    );
    const alpha = 1 - Math.exp(-dt / gestureConfig.CURSOR_SMOOTHING_TIME);
    const prev = this.previous;
    const center = smoothPosition(1 - palmX, palmY, prev?.center, alpha);
    const pointer = smoothPosition(
      1 - points[8].x,
      points[8].y,
      prev?.pointer,
      alpha,
    );
    const pinchPoint = smoothPosition(
      1 - (points[4].x + points[8].x) / 2,
      (points[4].y + points[8].y) / 2,
      prev?.pinchPoint,
      alpha,
    );
    const va = 1 - Math.exp(-dt / config.VELOCITY_SMOOTHING_TIME);
    const velocity = prev
      ? {
          x:
            prev.velocity.x +
            ((center.x - prev.center.x) / dt - prev.velocity.x) * va,
          y:
            prev.velocity.y +
            ((center.y - prev.center.y) / dt - prev.velocity.y) * va,
        }
      : { x: 0, y: 0 };
    const scores = this.scores;
    for (let i = 0; i < 4; i++) {
      const base = 5 + i * 4;
      const a = angle(w[base], w[base + 1], w[base + 3]);
      const boneLength =
        distance(w[base], w[base + 1]) +
        distance(w[base + 1], w[base + 2]) +
        distance(w[base + 2], w[base + 3]);
      // Natural, slightly bent fingers still have almost full-chain reach.
      const reach =
        distance(w[base], w[base + 3]) / Math.max(boneLength, 0.001);
      const ratio =
        distance(w[base + 3], w[0]) /
        Math.max(distance(w[base + 1], w[0]), 0.001);
      if (
        (a > config.FINGER_EXTEND_ANGLE ||
          reach > config.FINGER_EXTEND_REACH) &&
        ratio > config.FINGER_EXTEND_WRIST_RATIO
      )
        this.extended[i] = true;
      else if (
        a < config.FINGER_FOLD_ANGLE ||
        ratio < config.FINGER_FOLD_WRIST_RATIO
      )
        this.extended[i] = false;
      scores[i] = clamp(
        (a - config.FINGER_SCORE_MIN_ANGLE) / config.FINGER_SCORE_ANGLE_RANGE,
      );
    }
    const [index, middle, ring, pinky] = this.extended;
    const openness = (scores[0] + scores[1] + scores[2] + scores[3]) / 4;
    const pinchDistance = distance(p[4], p[8]) / width;
    if (
      this.pinched
        ? pinchDistance > gestureConfig.PINCH_RELEASE_THRESHOLD
        : pinchDistance < gestureConfig.PINCH_START_THRESHOLD
    )
      this.pinched = !this.pinched;
    const tipToPalm =
      Math.hypot(
        p[8].x - palmX * aspect,
        p[8].y - palmY,
        p[8].z - (p[0].z + p[9].z) / 2,
      ) / width;
    const thumbLength =
      distance(w[1], w[2]) + distance(w[2], w[3]) + distance(w[3], w[4]);
    const thumb =
      angle(w[2], w[3], w[4]) > config.THUMB_EXTEND_ANGLE &&
      distance(w[1], w[4]) / Math.max(thumbLength, 0.001) >
        config.THUMB_EXTEND_REACH &&
      distance(w[4], w[0]) / Math.max(distance(w[3], w[0]), 0.001) >
        config.THUMB_EXTEND_WRIST_RATIO;
    let gesture: Gesture = "NONE";
    let confidence = 0.6;
    if (
      !index &&
      !middle &&
      !ring &&
      !pinky &&
      tipToPalm < config.FIST_TIP_TO_PALM
    ) {
      gesture = "FIST";
      confidence = 1 - openness;
    } else if (
      this.pinched &&
      (tipToPalm > config.PINCH_TIP_TO_PALM || middle || ring)
    ) {
      gesture = "PINCH";
      confidence = clamp(1 - pinchDistance);
    } else if (index && middle && ring && pinky) {
      gesture = "OPEN_PALM";
      confidence = openness;
    } else if (index && !middle && !ring && !pinky) {
      gesture = "POINT";
      confidence = (scores[0] + 3 - scores[1] - scores[2] - scores[3]) / 4;
    }
    // V signs and three-finger poses intentionally stay NONE: neither is a
    // command in V2, but their independently measured fingers remain debuggable.
    const ax = w[5].x - w[0].x,
      ay = w[5].y - w[0].y,
      az = w[5].z - w[0].z;
    const bx = w[17].x - w[0].x,
      by = w[17].y - w[0].y,
      bz = w[17].z - w[0].z;
    const cx = ay * bz - az * by,
      cy = az * bx - ax * bz,
      cz = ax * by - ay * bx;
    const result: HandFeatures = {
      center,
      pointer,
      pinchPoint,
      velocity,
      fingerState: { thumb, index, middle, ring, pinky },
      scale: width,
      openness,
      pinchDistance,
      pinchStrength: clamp(
        1 -
          (pinchDistance - config.PINCH_STRENGTH_START) /
            config.PINCH_STRENGTH_RANGE,
      ),
      gesture,
      confidence: clamp(confidence),
      // MediaPipe supplies a fresh landmark array per detection. Keep its owned
      // snapshot; never expose the corrected scratch buffer reused next frame.
      landmarks: points,
      palmDirection: [cx, cy, cz],
      palmFacing:
        Math.abs(cz) / (Math.hypot(cx, cy, cz) || 1) >
        config.PALM_FACING_NORMAL,
    };
    this.previous = result;
    this.time = time;
    return result;
  }
}
