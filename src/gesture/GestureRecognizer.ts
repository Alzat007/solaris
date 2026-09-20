import type { Gesture, HandFeatures, Landmark } from "./GestureTypes";
import { gestureConfig } from "./gestureConfig";
import { recognizerConfig as config } from "./recognizerConfig";

const tipIndices = [4, 8, 12, 16, 20] as const;
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
  private wristRatios = new Float64Array(4);
  private curlAngles = new Float64Array(4);
  private previousIndexAngle: number | null = null;
  private indexAngularVelocity = 0;
  private indexState: NonNullable<HandFeatures["indexState"]> = "BETWEEN";
  private previousRawPointer: { x: number; y: number } | null = null;
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
    this.previousIndexAngle = null;
    this.indexAngularVelocity = 0;
    this.indexState = "BETWEEN";
    this.previousRawPointer = null;
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
    const rawPointer = { x: 1 - points[8].x, y: points[8].y };
    const rawPointerSpeed = this.previousRawPointer
      ? Math.hypot(
          rawPointer.x - this.previousRawPointer.x,
          rawPointer.y - this.previousRawPointer.y,
        ) / dt
      : 0;
    const pointerSpeedMix = clamp(
      (rawPointerSpeed - config.POINTER_SLOW_SPEED_SCREEN) /
        (config.POINTER_FAST_SPEED_SCREEN - config.POINTER_SLOW_SPEED_SCREEN),
    );
    const pointerResponse =
      config.POINTER_SLOW_SMOOTHING_TIME +
      pointerSpeedMix *
        (config.POINTER_FAST_SMOOTHING_TIME -
          config.POINTER_SLOW_SMOOTHING_TIME);
    const pointer = smoothPosition(
      rawPointer.x,
      rawPointer.y,
      prev?.pointer,
      1 - Math.exp(-dt / pointerResponse),
    );
    this.previousRawPointer = rawPointer;
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
    const previousPointerVelocity = prev?.pointerVelocity ?? { x: 0, y: 0 };
    const pointerVelocity = prev
      ? {
          x:
            previousPointerVelocity.x +
            ((pointer.x - prev.pointer.x) / dt - previousPointerVelocity.x) *
              va,
          y:
            previousPointerVelocity.y +
            ((pointer.y - prev.pointer.y) / dt - previousPointerVelocity.y) *
              va,
        }
      : { x: 0, y: 0 };
    // Selection measures the actual PIP hinge, not the fingertip or the
    // existing full-finger curl score. World geometry is preferred; corrected
    // screen geometry is a fallback only when world landmarks are absent.
    const indexProximalLength = distance(w[5], w[6]);
    const indexMiddleLength = distance(w[6], w[7]);
    const indexAngleValid =
      Number.isFinite(indexProximalLength) &&
      Number.isFinite(indexMiddleLength) &&
      indexProximalLength > config.INDEX_ANGLE_MIN_BONE_LENGTH &&
      indexMiddleLength > config.INDEX_ANGLE_MIN_BONE_LENGTH;
    const indexAngle = indexAngleValid ? angle(w[5], w[6], w[7]) : 0;
    if (indexAngleValid) {
      const actualDt = (time - this.time) / 1000;
      if (this.previousIndexAngle !== null && actualDt > 0) {
        const angularAlpha =
          1 -
          Math.exp(-actualDt / config.INDEX_ANGULAR_VELOCITY_SMOOTHING_TIME);
        this.indexAngularVelocity +=
          ((indexAngle - this.previousIndexAngle) / actualDt -
            this.indexAngularVelocity) *
          angularAlpha;
      } else this.indexAngularVelocity = 0;
      if (indexAngle < gestureConfig.INDEX_PRESS_THRESHOLD_DEG)
        this.indexState = "BENT";
      else if (indexAngle > gestureConfig.INDEX_RELEASE_THRESHOLD_DEG)
        this.indexState = "EXTENDED";
      this.previousIndexAngle = indexAngle;
    } else {
      this.previousIndexAngle = null;
      this.indexAngularVelocity = 0;
      this.indexState = "BETWEEN";
    }
    const scores = this.scores;
    for (let i = 0; i < 4; i++) {
      const base = 5 + i * 4;
      const a = angle(w[base], w[base + 1], w[base + 3]);
      this.curlAngles[i] = a;
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
      this.wristRatios[i] = ratio;
      if (
        ((a > config.FINGER_EXTEND_ANGLE ||
          reach > config.FINGER_EXTEND_REACH) &&
          ratio > config.FINGER_EXTEND_WRIST_RATIO) ||
        (reach > config.FINGER_RELAXED_REACH &&
          a > config.FINGER_RELAXED_ANGLE &&
          ratio > config.FINGER_RELAXED_WRIST_RATIO)
      )
        this.extended[i] = true;
      else if (
        (a < config.FINGER_FOLD_ANGLE && reach < config.FINGER_RELAXED_REACH) ||
        ratio < config.FINGER_FOLD_WRIST_RATIO
      )
        this.extended[i] = false;
      // PIP angle alone describes flexion, not confidence. A comfortably bent
      // finger can retain most of its chain reach and remain well beyond the
      // wrist. The two geometric measures must agree; a straight curled-back
      // segment cannot inflate this score.
      const reachScore = clamp(
        (reach - config.FINGER_SCORE_REACH_START) /
          config.FINGER_SCORE_REACH_RANGE,
      );
      const radialScore = clamp(
        (ratio - config.FINGER_SCORE_WRIST_START) /
          config.FINGER_SCORE_WRIST_RANGE,
      );
      scores[i] = Math.sqrt(reachScore * radialScore);
    }
    const [index, middle, ring, pinky] = this.extended;
    const openness = (scores[0] + scores[1] + scores[2] + scores[3]) / 4;
    // World-space ratios retain their meaning when a palm turns sideways;
    // camera-space z is an estimate and must not set a separate contact scale.
    const geometryWidth = Math.max(distance(w[5], w[17]), 0.001);
    const pinchDistance = distance(w[4], w[8]) / geometryWidth;
    if (
      this.pinched
        ? pinchDistance > gestureConfig.PINCH_RELEASE_THRESHOLD
        : pinchDistance < gestureConfig.PINCH_START_THRESHOLD
    )
      this.pinched = !this.pinched;
    const tipToPalm =
      Math.hypot(
        w[8].x - (w[0].x + w[5].x + w[9].x + w[13].x + w[17].x) / 5,
        w[8].y - (w[0].y + w[5].y + w[9].y + w[13].y + w[17].y) / 5,
        w[8].z - (w[0].z + w[5].z + w[9].z + w[13].z + w[17].z) / 5,
      ) / geometryWidth;
    const thumbLength =
      distance(w[1], w[2]) + distance(w[2], w[3]) + distance(w[3], w[4]);
    const thumb =
      angle(w[2], w[3], w[4]) > config.THUMB_EXTEND_ANGLE &&
      distance(w[1], w[4]) / Math.max(thumbLength, 0.001) >
        config.THUMB_EXTEND_REACH &&
      distance(w[4], w[0]) / Math.max(distance(w[3], w[0]), 0.001) >
        config.THUMB_EXTEND_WRIST_RATIO;
    // In a fist the index rests over the palm. In a compact pinch it moves
    // toward the thumb side, even when all other fingers remain folded.
    // Measure opposition in the palm's own 3D coordinates, not screen x/y.
    const thumbSide =
      -(
        (w[8].x - w[5].x) * (w[17].x - w[5].x) +
        (w[8].y - w[5].y) * (w[17].y - w[5].y) +
        (w[8].z - w[5].z) * (w[17].z - w[5].z)
      ) /
      (geometryWidth * geometryWidth);
    const opposedPinch =
      this.pinched &&
      thumbSide > config.PINCH_OPPOSITION_MIN &&
      distance(w[8], w[5]) / geometryWidth > config.PINCH_INDEX_REACH_MIN;
    let openCount = 0;
    for (let i = 0; i < 4; i++)
      if (scores[i] >= config.OPEN_FINGER_STRONG_SCORE) openCount++;
    const openEvidence = Math.min(...scores);
    const otherFingerScore = Math.max(scores[1], scores[2], scores[3]);
    const indexDominance = scores[0] - otherFingerScore;
    const pointing =
      indexAngleValid &&
      scores[0] >= config.POINT_INDEX_MIN_SCORE &&
      otherFingerScore <= config.POINT_OTHER_MAX_SCORE &&
      indexDominance >= config.POINT_DOMINANCE_MIN_SCORE;
    const pointConfidence = pointing
      ? clamp(
          scores[0] * 0.7 +
            clamp(indexDominance / config.POINT_DOMINANCE_SCORE_RANGE) * 0.3,
        )
      : 0;
    // A victory sign tolerates comfortable flexion and a free thumb. Separate
    // extended/folded evidence prevents a true bent-index pinch from claiming
    // this pose, even when its middle finger happens to remain raised.
    const vExtended = Math.min(scores[0], scores[1]);
    const vFolded = Math.max(scores[2], scores[3]);
    const victory =
      vExtended >= config.V_EXTENDED_MIN_SCORE &&
      vFolded <= config.V_FOLDED_MAX_SCORE;
    const vConfidence = victory ? clamp((vExtended + 1 - vFolded) / 2) : 0;
    // Five fingertips must gather outside the palm, not curl back into a fist.
    // RMS aperture uses every fingertip and a 3D palm scale: camera distance,
    // translation and hand roll cannot masquerade as opening the hand.
    let tipX = 0,
      tipY = 0,
      tipZ = 0;
    for (const i of tipIndices) {
      tipX += w[i].x;
      tipY += w[i].y;
      tipZ += w[i].z;
    }
    tipX /= 5;
    tipY /= 5;
    tipZ /= 5;
    let squaredSpread = 0,
      maxRadius = 0;
    for (const i of tipIndices) {
      const squared =
        (w[i].x - tipX) ** 2 + (w[i].y - tipY) ** 2 + (w[i].z - tipZ) ** 2;
      squaredSpread += squared;
      maxRadius = Math.max(maxRadius, Math.sqrt(squared) / geometryWidth);
    }
    const gripAperture = Math.sqrt(squaredSpread / 5) / geometryWidth;
    const mcpX = (w[5].x + w[9].x + w[13].x + w[17].x) / 4;
    const mcpY = (w[5].y + w[9].y + w[13].y + w[17].y) / 4;
    const mcpZ = (w[5].z + w[9].z + w[13].z + w[17].z) / 4;
    const forwardLength =
      Math.hypot(mcpX - w[0].x, mcpY - w[0].y, mcpZ - w[0].z) || 1;
    const tipForward =
      ((tipX - mcpX) * (mcpX - w[0].x) +
        (tipY - mcpY) * (mcpY - w[0].y) +
        (tipZ - mcpZ) * (mcpZ - w[0].z)) /
      (forwardLength * geometryWidth);
    const gripPalmDistance =
      Math.hypot(
        tipX - (w[0].x + mcpX * 4) / 5,
        tipY - (w[0].y + mcpY * 4) / 5,
        tipZ - (w[0].z + mcpZ * 4) / 5,
      ) / geometryWidth;
    let participating = 0;
    let leastWristRatio = Infinity;
    for (const ratio of this.wristRatios) {
      if (ratio >= config.GRIP_FINGER_WRIST_STRONG) participating++;
      leastWristRatio = Math.min(leastWristRatio, ratio);
    }
    const longitudinalGrip =
      tipForward >= config.GRIP_CENTER_FORWARD_MIN &&
      gripPalmDistance >= config.GRIP_CENTER_TO_PALM_MIN &&
      leastWristRatio >= config.GRIP_FINGER_WRIST_MIN &&
      participating >= config.GRIP_FINGER_COUNT;
    // Curl towards the camera is not a rigid rotation of a forward-reaching
    // grip: its tips can be closer to the wrist than its PIP joints. Use the
    // palm's own plane, preserving mirror/rotation/scale invariance, instead
    // of requiring longitudinal reach and wrist ratios for every grip.
    const ax = w[5].x - w[0].x,
      ay = w[5].y - w[0].y,
      az = w[5].z - w[0].z;
    const bx = w[17].x - w[0].x,
      by = w[17].y - w[0].y,
      bz = w[17].z - w[0].z;
    const cx = ay * bz - az * by,
      cy = az * bx - ax * bz,
      cz = ax * by - ay * bx;
    const normalLength = Math.hypot(cx, cy, cz) || 1;
    const normalDenominator = normalLength * geometryWidth;
    const centerNormal =
      ((tipX - mcpX) * cx + (tipY - mcpY) * cy + (tipZ - mcpZ) * cz) /
      normalDenominator;
    const normalSide = Math.sign(centerNormal);
    let leastTipNormal = Infinity;
    for (const i of tipIndices) {
      const tipNormal =
        ((w[i].x - mcpX) * cx + (w[i].y - mcpY) * cy + (w[i].z - mcpZ) * cz) /
        normalDenominator;
      leastTipNormal = Math.min(leastTipNormal, tipNormal * normalSide);
    }
    const normalGrip =
      gripPalmDistance >= config.GRIP_NORMAL_PALM_DISTANCE_MIN &&
      tipForward >= config.GRIP_NORMAL_FORWARD_MIN &&
      leastTipNormal >= config.GRIP_EACH_TIP_NORMAL_MIN &&
      Math.hypot(Math.max(0, tipForward), centerNormal) >=
        config.GRIP_NORMAL_REACH_MIN;
    let meanCurl = 0;
    for (const curl of this.curlAngles) meanCurl += curl / 4;
    const gripOutsidePalm = longitudinalGrip || normalGrip;
    const fivePinch =
      gripOutsidePalm &&
      gripAperture <= config.FIVE_PINCH_APERTURE_MAX &&
      maxRadius <= config.FIVE_PINCH_RADIUS_MAX;
    let gesture: Gesture = "NONE";
    let confidence = 0.6;
    if (victory) {
      // Incidental thumb contact while holding V must not select a planet.
      gesture = "V_GESTURE";
      confidence = vConfidence;
    } else if (fivePinch) {
      gesture = "FIVE_PINCH";
      confidence = clamp(
        0.75 + (1 - gripAperture / config.FIVE_PINCH_APERTURE_MAX) * 0.25,
      );
    } else if (opposedPinch) {
      gesture = "PINCH";
      confidence = clamp(1 - pinchDistance);
    } else if (
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
    } else if (pointing) {
      // Index dominance permits the other fingers to rest half-bent. V and
      // actual thumb/index contact above retain their own gesture priority.
      gesture = "POINT";
      confidence = pointConfidence;
    } else if (
      (index && middle && ring && pinky) ||
      // One softer finger is common on a laptop camera. It must still have
      // outward reach; V / THREE have truly folded fingers and fail this gate.
      (openCount >= 3 && openEvidence >= config.OPEN_FINGER_MIN_SCORE)
    ) {
      gesture = "OPEN_PALM";
      confidence = openness;
    }
    // Intermediate aperture is useful only after a deliberately armed grip.
    // Ordinary two-finger contact cannot claim this channel while the other
    // fingertips remain spread; unsupported signs and fists never claim it.
    const spreadTogether =
      pinchDistance >= gripAperture * config.GRIP_THUMB_INDEX_SPREAD_MIN;
    const intermediateGrip =
      spreadTogether &&
      (longitudinalGrip ||
        (normalGrip &&
          tipForward >= config.GRIP_UNFOLD_FORWARD_MIN &&
          meanCurl >= config.GRIP_NORMAL_CURL_MEAN_MIN));
    if (
      !fivePinch &&
      (gesture === "PINCH" || gesture === "FIST") &&
      intermediateGrip
    ) {
      // A slowly opening bunch can still look curled or retain thumb/index
      // hysteresis. All five tips must participate above the palm, their
      // spread must stay proportional, and collective curl must be shallower
      // than a folded fist. Spread tips must also move beyond the MCP row:
      // deeply flexed MCPs can give a fist a deceptively large PIP curl angle.
      // An ordinary two-finger contact also fails the proportional-spread gate.
      gesture = "NONE";
    }
    const gripConfidence = fivePinch
      ? confidence
      : gesture === "OPEN_PALM"
        ? Math.max(confidence, intermediateGrip ? 0.8 : 0)
        : gesture === "NONE" && intermediateGrip
          ? 0.8
          : 0;
    // Screen mirroring negates x, while y still grows downwards: positive
    // changes are visually clockwise for either hand. The opposite hand's
    // axis differs by roughly PI, which the dial's per-gesture baseline removes.
    // Never multiply by handedness here; that would reverse left-hand motion.
    const rollX = -(p[17].x - p[5].x);
    const rollY = p[17].y - p[5].y;
    const rollProjection = Math.hypot(rollX, rollY);
    const screenAX = p[5].x - p[0].x,
      screenAY = p[5].y - p[0].y,
      screenAZ = p[5].z - p[0].z;
    const screenBX = p[17].x - p[0].x,
      screenBY = p[17].y - p[0].y,
      screenBZ = p[17].z - p[0].z;
    const screenNX = screenAY * screenBZ - screenAZ * screenBY,
      screenNY = screenAZ * screenBX - screenAX * screenBZ,
      screenNZ = screenAX * screenBY - screenAY * screenBX;
    const screenNormalLength = Math.hypot(screenNX, screenNY, screenNZ);
    const palmRollValid =
      Number.isFinite(rollProjection) &&
      rollProjection >= config.PALM_ROLL_MIN_SCREEN &&
      rollProjection / width >= config.PALM_ROLL_MIN_PROJECTION &&
      Math.abs(screenNZ) / Math.max(screenNormalLength, 1e-8) >=
        config.PALM_ROLL_MIN_FACING;
    const result: HandFeatures = {
      center,
      pointer,
      pointerVelocity,
      indexAngle,
      indexAngleValid,
      indexAngularVelocity: this.indexAngularVelocity,
      indexState: this.indexState,
      pointConfidence: gesture === "POINT" ? pointConfidence : 0,
      pinchPoint,
      velocity,
      fingerState: { thumb, index, middle, ring, pinky },
      scale: width,
      openness,
      pinchDistance,
      gripAperture,
      gripConfidence,
      vConfidence,
      palmRoll: Math.atan2(rollY, rollX),
      palmRollValid,
      pinchStrength: clamp(
        1 -
          (pinchDistance - config.PINCH_STRENGTH_START) /
            config.PINCH_STRENGTH_RANGE,
      ),
      gesture,
      confidence: clamp(confidence),
      trackingConfidence: 1,
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
