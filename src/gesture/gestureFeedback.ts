import { useSyncExternalStore } from "react";
import type { PlanetId } from "../data/planets";
export type CelestialId = PlanetId | "sun";
export type GestureTarget =
  | { kind: "body"; id: CelestialId; label: string }
  | { kind: "ui"; id: string; label: string };
export type PinchPhase =
  | "IDLE"
  | "PINCH_START"
  | "PINCH_HOLD"
  | "PINCH_RELEASE";
export type GesturePresence =
  | "NO_HAND"
  | "HAND_VISIBLE"
  | "TARGET_HOVER"
  | "GESTURE_ARMED"
  | "GESTURE_TRIGGERED";
export type GestureAction =
  | "NONE"
  | "POINT"
  | "THUMB_OPEN"
  | "PINCH_DRAG"
  | "V_ZOOM"
  | "FIST_BACK"
  | "SWIPE"
  | "COLLAPSE"
  | "REBIRTH";
export type SelectionPhase =
  | "POINT_IDLE"
  | "POINT_HOVER"
  | "TARGET_LOCKING"
  | "TARGET_LOCKED"
  | "THUMB_OPENING"
  | "THUMB_TRIGGERED"
  | "WAIT_RELEASE";
export interface GestureFeedbackState {
  selectionPhase: SelectionPhase;
  thumbSpread: number | null;
  thumbReach: number;
  thumbGeometryValid: boolean;
  indexAngle: number | null;
  indexAngularVelocity: number;
  indexState: "EXTENDED" | "BENT" | "BETWEEN";
  pointConfidence: number;
  hoverTarget: GestureTarget | null;
  lockedTarget: GestureTarget | null;
  targetLockProgress: number;
  thumbOpenProgress: number;
  thumbNeedsRelease: boolean;
  presence: GesturePresence;
  readiness: "RECONNECTING" | "READY";
  action: GestureAction;
  pinchPhase: PinchPhase;
  pinchProgress: number;
  needsRelease: boolean;
  fistProgress: number;
  zoomProgress: number;
  zoomMode:
    | "IDLE"
    | "V_DETECTED"
    | "ZOOM_DIAL_ARMED"
    | "ZOOM_DIAL_ACTIVE"
    | "ZOOM_DIAL_RELEASE";
  zoomBaseAngle: number | null;
  zoomCurrentAngle: number | null;
  zoomDelta: number;
  zoomSpeed: number;
  zoomDirection: "IN" | "OUT" | "NONE";
  vConfidence: number;
  zoomScale: number;
  zoomActive: boolean;
  specialProgress: number;
  specialStage: "IDLE" | "READY" | "APPROACH" | "HOLD" | "PAUSED";
  handCount: number;
  confidence: number;
  trackingConfidence: number;
  handedness: string;
  pinchDistance: number;
  palmX: number;
  palmY: number;
  fingers: string;
  target: GestureTarget | null;
  locked: boolean;
  cooldownMs: number;
  lastAction: GestureAction;
  actionAt: number;
  pulseId: number;
  swipeDirection: -1 | 0 | 1;
  updatedAt: number;
}
const initial: GestureFeedbackState = {
  selectionPhase: "POINT_IDLE",
  thumbSpread: null,
  thumbReach: 0,
  thumbGeometryValid: false,
  indexAngle: null,
  indexAngularVelocity: 0,
  indexState: "BETWEEN",
  pointConfidence: 0,
  hoverTarget: null,
  lockedTarget: null,
  targetLockProgress: 0,
  thumbOpenProgress: 0,
  thumbNeedsRelease: false,
  presence: "NO_HAND",
  readiness: "RECONNECTING",
  action: "NONE",
  pinchPhase: "IDLE",
  pinchProgress: 0,
  needsRelease: false,
  fistProgress: 0,
  zoomProgress: 0,
  zoomMode: "IDLE",
  zoomBaseAngle: null,
  zoomCurrentAngle: null,
  zoomDelta: 0,
  zoomSpeed: 0,
  zoomDirection: "NONE",
  vConfidence: 0,
  zoomScale: 1,
  zoomActive: false,
  specialProgress: 0,
  specialStage: "IDLE",
  handCount: 0,
  confidence: 0,
  trackingConfidence: 0,
  handedness: "—",
  pinchDistance: 1,
  palmX: 0.5,
  palmY: 0.5,
  fingers: "—",
  target: null,
  locked: false,
  cooldownMs: 0,
  lastAction: "NONE",
  actionAt: 0,
  pulseId: 0,
  swipeDirection: 0,
  updatedAt: 0,
};
let snapshot = initial;
const listeners = new Set<() => void>();
export const gestureFeedback = {
  get: () => snapshot,
  set(patch: Partial<GestureFeedbackState>) {
    if (
      !Object.keys(patch).some(
        (key) =>
          snapshot[key as keyof GestureFeedbackState] !==
          patch[key as keyof GestureFeedbackState],
      )
    )
      return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  },
  reset() {
    snapshot = { ...initial };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
export const useGestureFeedback = () =>
  useSyncExternalStore(gestureFeedback.subscribe, gestureFeedback.get);
