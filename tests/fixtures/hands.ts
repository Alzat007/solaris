import type { Gesture, Landmark } from "../../src/gesture/GestureTypes";

/** Synthetic anatomical landmarks in metres, with MediaPipe's 21-point order.
 * Fingers use three independent bone lengths, with flexion towards the camera.
 * These test classification geometry, not the camera model's detection quality.
 */
export function handFixture(
  gesture: Extract<
    Gesture,
    | "OPEN_PALM"
    | "POINT"
    | "PINCH"
    | "FIST"
    | "V_SIGN"
    | "V_GESTURE"
    | "THREE"
    | "FIVE_PINCH"
  >,
  {
    relaxed = false,
    noise = 0,
    frame = 0,
    rotation = 0,
    mirror = false,
    foldedPinch = false,
    compactPinch = false,
    flexion = relaxed ? 35 : 0,
    softPinky = flexion,
    yaw = 0,
    pitch = 0,
    depthNoise = noise,
    gripSpread = 0,
    gripDirection = "forward",
    gripDepth = 0.045,
    thumbPose = "open",
  }: {
    relaxed?: boolean;
    noise?: number;
    frame?: number;
    rotation?: number;
    mirror?: boolean;
    foldedPinch?: boolean;
    compactPinch?: boolean;
    flexion?: number;
    softPinky?: number;
    yaw?: number;
    pitch?: number;
    depthNoise?: number;
    gripSpread?: number;
    /** Changes finger flexion relative to the palm, not the whole hand pose. */
    gripDirection?: "forward" | "camera";
    gripDepth?: number;
    thumbPose?: "open" | "tucked" | "index-contact";
  } = {},
) {
  const world: Landmark[] = Array.from({ length: 21 }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));
  world[0] = { x: 0, y: 0.08, z: 0 };
  const thumb = [
    { x: -0.035, y: 0.055, z: 0 },
    { x: -0.06, y: 0.03, z: 0 },
    { x: -0.078, y: 0.006, z: 0 },
    { x: -0.09, y: -0.016, z: 0 },
  ];
  thumb.forEach((p, i) => (world[i + 1] = p));
  const bases = [
    { x: -0.03, y: 0, z: 0 },
    { x: -0.01, y: -0.01, z: 0 },
    { x: 0.012, y: -0.007, z: 0 },
    { x: 0.032, y: 0.002, z: 0 },
  ];
  bases.forEach((base, finger) => {
    const start = 5 + finger * 4;
    world[start] = base;
    const extended =
      gesture === "OPEN_PALM" ||
      gesture === "FIVE_PINCH" ||
      (gesture === "PINCH" && (!foldedPinch || finger === 0)) ||
      (gesture === "POINT" && finger === 0) ||
      (gesture === "THREE" && finger < 3) ||
      ((gesture === "V_SIGN" || gesture === "V_GESTURE") && finger < 2);
    // A relaxed palm has 35° PIP and 10° DIP flexion, without curling its tips.
    const bend = finger === 3 ? softPinky : flexion;
    const bends = extended
      ? bend > 0
        ? [0, bend, bend + 10]
        : [0, 0, 0]
      : [25, 110, 180];
    // This family has a slightly longer little finger, allowing the 55 mm
    // camera-facing target to be reached without stretching its bone chain.
    const pinkyScale =
      gesture === "FIVE_PINCH" && gripDirection === "camera" ? 0.9 : 0.78;
    const fingerScale = [0.95, 1.08, 1, pinkyScale][finger];
    [0.035, 0.022, 0.018].forEach((length, joint) => {
      const a = (bends[joint] * Math.PI) / 180;
      const prev = world[start + joint];
      world[start + joint + 1] = {
        x: prev.x,
        y: prev.y - length * fingerScale * Math.cos(a),
        z: prev.z - length * fingerScale * Math.sin(a),
      };
    });
  });
  if (thumbPose === "tucked") {
    world[2] = { x: -0.04, y: 0.04, z: -0.01 };
    world[3] = { x: -0.02, y: 0.03, z: -0.025 };
    world[4] = { x: -0.001, y: 0.018, z: -0.03 };
  } else if (thumbPose === "index-contact") {
    world[4] = { ...world[8], x: world[8].x - 0.003 };
  }
  if (gesture === "PINCH") {
    // Index bends toward the opposing thumb; other fingers remain visibly open.
    world[6] = { x: -0.038, y: -0.032, z: -0.008 };
    world[7] = { x: -0.053, y: -0.037, z: -0.022 };
    world[8] = { x: -0.064, y: -0.026, z: -0.03 };
    world[3] = { x: -0.073, y: -0.004, z: -0.026 };
    world[4] = { x: -0.067, y: -0.025, z: -0.03 };
  }
  if (gesture === "PINCH" && compactPinch) {
    world[6] = { x: -0.03, y: -0.025, z: -0.005 };
    world[7] = { x: -0.04, y: -0.02, z: -0.02 };
    world[8] = { x: -0.045, y: -0.005, z: -0.03 };
    world[3] = { x: -0.067, y: 0.015, z: -0.02 };
    world[4] = { x: -0.047, y: -0.005, z: -0.03 };
  }
  if (gesture === "FIST") {
    // A fist's thumb commonly overlaps the folded index, also satisfying pinch distance.
    world[4] = { ...world[8], x: world[8].x - 0.006 };
  }
  if (gesture === "FIVE_PINCH") {
    const spread = Math.max(0, Math.min(1, gripSpread));
    const center =
      gripDirection === "camera"
        ? { x: -0.001, y: 0.005, z: -gripDepth }
        : { x: -0.001, y: -0.038, z: -0.022 };
    // Curl all five independent chains toward a shared point, then reopen to
    // their original tips. Preserve each chain's total length in the closed
    // pose instead of collapsing the fingertip directly onto its own knuckle.
    for (let finger = 0; finger < 5; finger++) {
      const baseIndex = finger === 0 ? 1 : 1 + finger * 4;
      const base = world[baseIndex];
      const tip = {
        x: center.x + Math.cos(finger * 1.8) * 0.0025,
        y: center.y + Math.sin(finger * 1.8) * 0.0025,
        z: center.z + Math.sin(finger * 2.1) * 0.0015,
      };
      const chainLength = [0, 1, 2].reduce((sum, joint) => {
        const a = world[baseIndex + joint],
          b = world[baseIndex + joint + 1];
        return sum + Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      }, 0);
      // In a camera-facing bunch, knuckles remain in the palm plane while
      // fingertips gather above it. Bow the chains towards their knuckle side,
      // so PIP can be farther from the wrist than the gathered tips: a real
      // curl is not a rigid rotation of the old forward-reaching fixture.
      const dy = tip.y - base.y;
      const dz = tip.z - base.z;
      const perpendicularLength = Math.hypot(dy, dz) || 1;
      const bowY = gripDirection === "camera" ? dz / perpendicularLength : 0;
      const bowZ = gripDirection === "camera" ? -dy / perpendicularLength : 1;
      const pointAt = (t: number, amplitude: number) => ({
        x: base.x + (tip.x - base.x) * t,
        y:
          base.y +
          (tip.y - base.y) * t +
          Math.sin(t * Math.PI) * amplitude * bowY,
        z:
          base.z +
          (tip.z - base.z) * t +
          Math.sin(t * Math.PI) * amplitude * bowZ,
      });
      let lo = 0,
        hi = 0.08;
      for (let i = 0; i < 24; i++) {
        const amplitude = (lo + hi) / 2;
        const chain = [
          base,
          pointAt(0.46, amplitude),
          pointAt(0.75, amplitude),
          tip,
        ];
        let length = 0;
        for (let j = 0; j < 3; j++)
          length += Math.hypot(
            chain[j].x - chain[j + 1].x,
            chain[j].y - chain[j + 1].y,
            chain[j].z - chain[j + 1].z,
          );
        if (length > chainLength) hi = amplitude;
        else lo = amplitude;
      }
      [0.46, 0.75, 1].forEach((t, joint) => {
        const index = baseIndex + joint + 1,
          open = world[index];
        const closed = pointAt(t, (lo + hi) / 2);
        world[index] = {
          x: closed.x + (open.x - closed.x) * spread,
          y: closed.y + (open.y - closed.y) * spread,
          z: closed.z + (open.z - closed.z) * spread,
        };
      });
    }
  }
  const transformed = world.map((point, i) => {
    // Rigid out-of-plane rotations preserve anatomy while foreshortening the
    // camera view. Independent depth jitter models a noisier laptop sensor.
    const yp = point.y * Math.cos(pitch) - point.z * Math.sin(pitch);
    const zp = point.y * Math.sin(pitch) + point.z * Math.cos(pitch);
    const p = {
      x: point.x * Math.cos(yaw) + zp * Math.sin(yaw),
      y: yp,
      z: -point.x * Math.sin(yaw) + zp * Math.cos(yaw),
    };
    return {
      x:
        (mirror ? -1 : 1) *
          (p.x * Math.cos(rotation) - p.y * Math.sin(rotation)) +
        noise * Math.sin(i * 1.7 + frame),
      y:
        p.x * Math.sin(rotation) +
        p.y * Math.cos(rotation) +
        noise * Math.sin(i * 2.1 + frame * 1.3),
      z: p.z + depthNoise * Math.sin(i * 2.9 + frame * 0.7),
    };
  });
  return {
    world: transformed,
    points: transformed.map((p) => ({
      x: 0.5 + (p.x * 3) / (4 / 3),
      y: 0.4 + p.y * 3,
      z: (p.z * 3) / (4 / 3),
    })),
  };
}
