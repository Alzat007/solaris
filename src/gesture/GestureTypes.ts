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
  | "FIST"
  | "V_SIGN"
  | "THREE"
  | "SWIPE_LEFT"
  | "SWIPE_RIGHT"
  | "TWO_HAND_SCALE"
  | "TWO_HAND_COLLAPSE"
  | "TWO_HAND_EXPAND";
export interface HandFeatures {
  /** Stable for a continuous detection, replaced after a lost or rejected frame. */
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
  gesture: Gesture;
  confidence: number;
  landmarks: Landmark[];
  palmFacing: boolean;
  palmDirection: [number, number, number];
}
export interface HandFrame {
  hands: HandFeatures[];
  time: number;
}
