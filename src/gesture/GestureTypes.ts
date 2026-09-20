export interface Landmark {
  x: number;
  y: number;
  z: number;
}
export type Gesture =
  | "NONE"
  | "OPEN_PALM"
  | "POINT"
  | "PINCH"
  | "FIVE_PINCH"
  | "FIST"
  | "V_GESTURE"
  /** Legacy fixture/debug name; the recognizer emits V_GESTURE. */
  | "V_SIGN"
  | "THREE"
  | "SWIPE_LEFT"
  | "SWIPE_RIGHT"
  | "TWO_HAND_SCALE"
  | "TWO_HAND_COLLAPSE"
  | "TWO_HAND_EXPAND";
export interface HandFeatures {
  /** Stable for continuous detection; a held V alone tolerates a short empty frame. */
  id?: string;
  handedness?: "Left" | "Right" | "Unknown";
  center: { x: number; y: number };
  pointer: { x: number; y: number };
  /** Mirrored thumb/index midpoint, smoothed independently of the pointing tip. */
  pinchPoint?: { x: number; y: number };
  fingerState?: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
  velocity: { x: number; y: number };
  scale: number;
  openness: number;
  pinchDistance: number;
  pinchStrength: number;
  /** RMS spread of all five fingertips, normalized by 3D palm width. */
  gripAperture?: number;
  /** Five-finger grip evidence, separate from ordinary thumb/index pinching. */
  gripConfidence?: number;
  /** Evidence for index/middle extended with ring/pinky folded; thumb is free. */
  vConfidence?: number;
  /** Mirrored screen-space MCP palm-axis angle in radians; positive is clockwise. */
  palmRoll?: number;
  /** False when the palm axis is too short or too edge-on to measure reliably. */
  palmRollValid?: boolean;
  gesture: Gesture;
  /** Pose evidence, independent of whether the hand is continuously tracked. */
  confidence: number;
  /** Geometry validity (0–1); MediaPipe does not expose per-hand tracking scores. */
  trackingConfidence?: number;
  landmarks: Landmark[];
  palmFacing: boolean;
  palmDirection: [number, number, number];
}
export interface HandFrame {
  hands: HandFeatures[];
  time: number;
}
