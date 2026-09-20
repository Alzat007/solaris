import { useSyncExternalStore } from "react";

export type CameraStage =
  | "idle"
  | "camera"
  | "model"
  | "running"
  | "switching"
  | "failed";
export interface CameraDiagnostics {
  stage: CameraStage;
  backend: "GPU" | "CPU" | null;
  compatibility: boolean;
  frames: number;
  rawHands: number;
  validHands: number;
  emptyForMs: number;
  frozen: boolean;
  inferenceMs: number;
}
const initial: CameraDiagnostics = {
  stage: "idle",
  backend: null,
  compatibility: false,
  frames: 0,
  rawHands: 0,
  validHands: 0,
  emptyForMs: 0,
  frozen: false,
  inferenceMs: 0,
};
let snapshot = { ...initial };
const listeners = new Set<() => void>();
export const cameraDiagnostics = {
  get: () => snapshot,
  set: (patch: Partial<CameraDiagnostics>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  },
  reset: () => {
    snapshot = { ...initial };
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
export const useCameraDiagnostics = () =>
  useSyncExternalStore(cameraDiagnostics.subscribe, cameraDiagnostics.get);
