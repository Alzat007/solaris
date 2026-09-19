import type { Gesture, HandFeatures, Landmark } from "./GestureTypes";
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const distance = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angle = (a: Landmark, b: Landmark, c: Landmark) => {
  const u = [a.x - b.x, a.y - b.y, a.z - b.z],
    v = [c.x - b.x, c.y - b.y, c.z - b.z];
  return (
    (Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          u.reduce((s, x, i) => s + x * v[i], 0) /
            (Math.hypot(...u) * Math.hypot(...v) || 1),
        ),
      ),
    ) *
      180) /
    Math.PI
  );
};
export class GestureRecognizer {
  private previous: HandFeatures | null = null;
  private time = 0;
  private pinched = false;
  private extended = [false, false, false, false];
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
    const p = points.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z * aspect }));
    const w = world?.length === 21 ? world : p;
    const palm = [0, 5, 9, 13, 17].reduce(
      (c, i) => ({ x: c.x + points[i].x / 5, y: c.y + points[i].y / 5 }),
      { x: 0, y: 0 },
    );
    const width = Math.max(distance(p[5], p[17]), 0.015);
    const dt = Math.max(0.01, Math.min(0.1, (time - this.time) / 1000));
    if (time - this.time > 200) this.previous = null;
    const alpha = 1 - Math.exp(-dt / 0.055);
    const center = { x: 1 - palm.x, y: palm.y };
    const prev = this.previous;
    if (prev) {
      center.x = prev.center.x + (center.x - prev.center.x) * alpha;
      center.y = prev.center.y + (center.y - prev.center.y) * alpha;
    }
    const va = 1 - Math.exp(-dt / 0.095);
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
    const scores: number[] = [];
    [5, 9, 13, 17].forEach((base, i) => {
      const a = angle(w[base], w[base + 1], w[base + 3]);
      const boneLength =
        distance(w[base], w[base + 1]) +
        distance(w[base + 1], w[base + 2]) +
        distance(w[base + 2], w[base + 3]);
      // A relaxed finger can have a bent PIP while still reaching almost its
      // full length. Use the entire bone chain so it need not first be rigidly
      // straight to enter the extended state; curled fingers lose this reach.
      const reach =
        distance(w[base], w[base + 3]) / Math.max(boneLength, 0.001);
      const ratio =
        distance(w[base + 3], w[0]) /
        Math.max(distance(w[base + 1], w[0]), 0.001);
      if ((a > 153 || reach > 0.9) && ratio > 1.08) this.extended[i] = true;
      else if (a < 130 || ratio < 0.97) this.extended[i] = false;
      scores.push(clamp((a - 100) / 65));
    });
    const [index, middle, ring, pinky] = this.extended;
    const openness = scores.reduce((a, b) => a + b, 0) / 4;
    const pinchDistance = distance(p[4], p[8]) / width;
    if (this.pinched ? pinchDistance > 0.43 : pinchDistance < 0.28)
      this.pinched = !this.pinched;
    const palmCenter = {
      x: palm.x * aspect,
      y: palm.y,
      z: (p[0].z + p[9].z) / 2,
    };
    const tipToPalm = distance(p[8], palmCenter) / width;
    let gesture: Gesture = "NONE";
    let confidence = 0.6;
    if (!index && !middle && !ring && !pinky && tipToPalm < 0.95) {
      gesture = "FIST";
      confidence = 1 - openness;
    } else if (this.pinched && (tipToPalm > 0.65 || middle || ring)) {
      gesture = "PINCH";
      confidence = clamp(1 - pinchDistance);
    } else if (index && middle && ring && pinky) {
      gesture = "OPEN_PALM";
      confidence = openness;
    } else if (index && !middle && !ring && !pinky) {
      gesture = "POINT";
      confidence = (scores[0] + 3 - scores[1] - scores[2] - scores[3]) / 4;
    } else if (
      index &&
      middle &&
      !ring &&
      !pinky &&
      distance(p[8], p[12]) / width > 0.3
    ) {
      gesture = "V_SIGN";
      confidence = (scores[0] + scores[1] + 2 - scores[2] - scores[3]) / 4;
    }
    const a = { x: w[5].x - w[0].x, y: w[5].y - w[0].y, z: w[5].z - w[0].z },
      b = { x: w[17].x - w[0].x, y: w[17].y - w[0].y, z: w[17].z - w[0].z };
    const cross = {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
    const result: HandFeatures = {
      center,
      pointer: { x: 1 - points[8].x, y: points[8].y },
      velocity,
      scale: width,
      openness,
      pinchDistance,
      pinchStrength: clamp(1 - (pinchDistance - 0.2) / 0.45),
      gesture,
      confidence: clamp(confidence),
      landmarks: points,
      palmDirection: [cross.x, cross.y, cross.z],
      palmFacing:
        Math.abs(cross.z) / (Math.hypot(cross.x, cross.y, cross.z) || 1) > 0.65,
    };
    this.previous = result;
    this.time = time;
    return result;
  }
}
export class GestureStabilizer {
  private candidate: Gesture = "NONE";
  private started = 0;
  private fired: Gesture = "NONE";
  private lastConfident = 0;
  update(gesture: Gesture, time: number, confidence: number): Gesture | null {
    if (confidence < 0.5) {
      // At 20 Hz, a marginal frame is normal. It must not prevent a deliberate
      // hold or re-arm an already fired gesture. A different gesture, clearly
      // unreliable frame, or sustained uncertainty still breaks the hold.
      if (
        confidence < 0.35 ||
        gesture !== this.candidate ||
        time - this.lastConfident > 100
      )
        this.reset();
      return null;
    }
    this.lastConfident = time;
    if (gesture !== this.candidate) {
      this.candidate = gesture;
      this.started = time;
      this.fired = "NONE";
    }
    const hold: Partial<Record<Gesture, number>> = {
      FIST: 250,
      OPEN_PALM: 220,
      PINCH: 70,
      POINT: 100,
      V_SIGN: 300,
    };
    if (
      gesture !== "NONE" &&
      confidence > 0.5 &&
      time - this.started >= (hold[gesture] || 150) &&
      this.fired !== gesture
    ) {
      this.fired = gesture;
      return gesture;
    }
    return null;
  }
  reset() {
    this.candidate = "NONE";
    this.fired = "NONE";
    this.started = 0;
    this.lastConfident = 0;
  }
}
