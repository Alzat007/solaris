import { GestureRecognizer } from "./GestureRecognizer";
import { gestureConfig } from "./gestureConfig";
import { recognizerConfig as config } from "./recognizerConfig";
import type { HandFeatures, Landmark } from "./GestureTypes";

type Handedness = NonNullable<HandFeatures["handedness"]>;
type DetectionResult = {
  landmarks: Landmark[][];
  worldLandmarks?: Landmark[][];
  handedness?: { categoryName: string; score: number }[][];
};
type Track = {
  id: string;
  order: number;
  handedness: Handedness;
  x: number;
  y: number;
  vx: number;
  vy: number;
  time: number;
  recognizer: GestureRecognizer;
};
type Detection = {
  x: number;
  y: number;
  handedness: Handedness;
  confidence: number;
};
const validPoints = (points: Landmark[] | undefined) => {
  if (!points || points.length !== 21) return false;
  for (let i = 0; i < 21; i++) {
    const p = points[i];
    if (
      !p ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      !Number.isFinite(p.z)
    )
      return false;
  }
  return true;
};

/** Matches the model's unordered detections using handedness and predicted
 * two-dimensional position. Lost/ambiguous observations discard identity so a
 * newly appearing hand cannot inherit another hand's drag or velocity. */
export class HandIdentityTracker {
  private tracks: Track[] = [];
  private serial = 0;
  private lastTime = -Infinity;
  private costs = new Float64Array(4);
  private detections: Detection[] = Array.from({ length: 2 }, () => ({
    x: 0,
    y: 0,
    handedness: "Unknown",
    confidence: 0,
  }));

  reset() {
    for (const track of this.tracks) track.recognizer.reset();
    this.tracks.length = 0;
    this.lastTime = -Infinity;
  }

  update(
    result: DetectionResult,
    time: number,
    aspect = 4 / 3,
  ): HandFeatures[] {
    const count = result.landmarks.length;
    if (
      count === 0 ||
      count > 2 ||
      !Number.isFinite(time) ||
      !Number.isFinite(aspect) ||
      aspect <= 0
    ) {
      this.reset();
      return [];
    }
    if (
      time - this.lastTime > gestureConfig.FRAME_GAP_RESET ||
      time <= this.lastTime
    )
      this.reset();
    for (let i = 0; i < count; i++) {
      const points = result.landmarks[i];
      const world = result.worldLandmarks?.[i];
      const category = result.handedness?.[i]?.[0];
      // MediaPipe enforces detection/presence confidence in its options. Its
      // returned handedness score is additionally required for safe identity.
      if (
        !validPoints(points) ||
        (world && !validPoints(world)) ||
        (category &&
          (!Number.isFinite(category.score) ||
            category.score < gestureConfig.MIN_CONFIDENCE)) ||
        Math.hypot(
          (points[5].x - points[17].x) * aspect,
          points[5].y - points[17].y,
          (points[5].z - points[17].z) * aspect,
        ) < config.MIN_PALM_WIDTH
      ) {
        this.reset();
        return [];
      }
      const detection = this.detections[i];
      detection.x =
        (points[0].x +
          points[5].x +
          points[9].x +
          points[13].x +
          points[17].x) /
        5;
      detection.y =
        (points[0].y +
          points[5].y +
          points[9].y +
          points[13].y +
          points[17].y) /
        5;
      detection.handedness =
        category?.categoryName === "Left"
          ? "Left"
          : category?.categoryName === "Right"
            ? "Right"
            : "Unknown";
      detection.confidence = category?.score ?? 1;
    }
    const oldCount = this.tracks.length;
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < oldCount; j++) {
        const d = this.detections[i],
          t = this.tracks[j];
        const dt = Math.min((time - t.time) / 1000, config.MAX_FRAME_SECONDS);
        const step = Math.hypot(d.x - t.x, d.y - t.y);
        const contradicts =
          d.handedness !== "Unknown" &&
          t.handedness !== "Unknown" &&
          d.handedness !== t.handedness;
        this.costs[i * 2 + j] =
          contradicts || step > config.IDENTITY_MAX_STEP_SCREEN
            ? Infinity
            : Math.hypot(d.x - t.x - t.vx * dt, d.y - t.y - t.vy * dt) +
              (d.handedness === t.handedness
                ? 0
                : config.IDENTITY_UNKNOWN_PENALTY);
      }
    }
    // Enumerate at most nine assignments, including a new track (-1). This
    // handles a removed hand without resetting the other continuous hand.
    let match0 = -1,
      match1 = -1,
      best = Infinity;
    for (let a = -1; a < oldCount; a++) {
      for (let b = -1; b < (count === 2 ? oldCount : 0); b++) {
        if (a >= 0 && a === b) continue;
        const cost =
          (a < 0 ? config.IDENTITY_MAX_STEP_SCREEN : this.costs[a]) +
          (count === 2
            ? b < 0
              ? config.IDENTITY_MAX_STEP_SCREEN
              : this.costs[2 + b]
            : 0);
        if (cost < best) {
          best = cost;
          match0 = a;
          match1 = b;
        }
      }
    }
    if (count === 2 && oldCount === 2) {
      const straight = this.costs[0] + this.costs[3];
      const crossed = this.costs[1] + this.costs[2];
      // At a truly ambiguous crossing, preserving a guess is less safe than a
      // brief re-entry lock. Known left/right hands do not hit this branch.
      if (
        Number.isFinite(straight) &&
        Number.isFinite(crossed) &&
        Math.abs(straight - crossed) < config.IDENTITY_AMBIGUITY_SCREEN
      )
        match0 = match1 = -1;
    }
    const nextTracks: Track[] = [];
    const hands: HandFeatures[] = [];
    for (let i = 0; i < count; i++) {
      const match = i === 0 ? match0 : match1;
      const detection = this.detections[i];
      const track: Track =
        match >= 0
          ? this.tracks[match]
          : {
              id: `hand-${++this.serial}`,
              order: this.serial,
              handedness: detection.handedness,
              x: detection.x,
              y: detection.y,
              vx: 0,
              vy: 0,
              time,
              recognizer: new GestureRecognizer(),
            };
      const hand = track.recognizer.analyze(
        result.landmarks[i],
        result.worldLandmarks?.[i],
        time,
        aspect,
      );
      hand.id = track.id;
      hand.handedness = detection.handedness;
      hand.confidence = Math.min(hand.confidence, detection.confidence);
      if (hand.confidence < gestureConfig.MIN_CONFIDENCE) {
        this.reset();
        return [];
      }
      if (match >= 0) {
        const dt = Math.max(
          (time - track.time) / 1000,
          config.MIN_FRAME_SECONDS,
        );
        track.vx = (detection.x - track.x) / dt;
        track.vy = (detection.y - track.y) / dt;
      }
      track.x = detection.x;
      track.y = detection.y;
      track.time = time;
      if (detection.handedness !== "Unknown")
        track.handedness = detection.handedness;
      nextTracks.push(track);
      hands.push(hand);
    }
    this.tracks = nextTracks;
    this.lastTime = time;
    // Stable order also keeps the debug pointer attached to the same hand when
    // MediaPipe reverses its result order. Identity remains primary for V2.
    if (hands.length === 2 && nextTracks[0].order > nextTracks[1].order)
      hands.reverse();
    return hands;
  }
}
