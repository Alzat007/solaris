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
  | "PINCH_SELECT"
  | "PINCH_DRAG"
  | "TWO_HAND_ZOOM"
  | "FIST_BACK"
  | "SWIPE"
  | "COLLAPSE"
  | "REBIRTH";
export interface GestureFeedbackState {
  presence: GesturePresence;
  readiness: "RECONNECTING" | "READY";
  action: GestureAction;
  pinchPhase: PinchPhase;
  pinchProgress: number;
  needsRelease: boolean;
  fistProgress: number;
  specialProgress: number;
  handCount: number;
  confidence: number;
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
  presence: "NO_HAND",
  readiness: "RECONNECTING",
  action: "NONE",
  pinchPhase: "IDLE",
  pinchProgress: 0,
  needsRelease: false,
  fistProgress: 0,
  specialProgress: 0,
  handCount: 0,
  confidence: 0,
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
