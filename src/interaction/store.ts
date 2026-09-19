import { useSyncExternalStore } from "react";
import type { PlanetId } from "../data/planets";
import type { InteractionState } from "./InteractionStateMachine";
export type TrackingStatus =
  | "off"
  | "loading"
  | "seeking"
  | "online"
  | "unavailable";
export interface UIState {
  mode: InteractionState;
  selected: PlanetId | null;
  hover: PlanetId | null;
  tracking: TrackingStatus;
  cameraError: string;
  sound: boolean;
  quality: "HIGH" | "MEDIUM" | "LOW";
  fps: number;
  gesture: string;
  confidence: number;
  help: boolean;
  welcome: boolean;
  heldUniverse: boolean;
  webglError: boolean;
}
let snapshot: UIState = {
  mode: "INTRO",
  selected: null,
  hover: null,
  tracking: "off",
  cameraError: "",
  sound: false,
  quality:
    typeof window !== "undefined" && window.innerWidth < 700 ? "LOW" : "HIGH",
  fps: 60,
  gesture: "NONE",
  confidence: 0,
  help: false,
  welcome: true,
  heldUniverse: false,
  webglError: false,
};
const listeners = new Set<() => void>();
export const store = {
  get: () => snapshot,
  set: (patch: Partial<UIState>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((fn) => fn());
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
export const useSolaris = () =>
  useSyncExternalStore(store.subscribe, store.get);
