import type { RemoteAction } from "./controlProtocol";

export interface ControllerRelayErrorEffects {
  stopContinuousInput(): void;
  sendStop(): void;
  disconnect(): void;
}

export interface ControllerRelayErrorState {
  stopPending: boolean;
}

export function controllerActionStarted(
  recovery: ControllerRelayErrorState,
  action: RemoteAction,
) {
  if (action !== "STOP" && action !== "ROTATE_END")
    recovery.stopPending = false;
}

const recoverableActionErrors = new Set([
  "rate-limited",
  "expired-message",
  "stale-sequence",
]);

export function handleControllerRelayError(
  code: string,
  connected: boolean,
  effects: ControllerRelayErrorEffects,
  recovery: ControllerRelayErrorState,
): "recovered" | "disconnected" {
  if (connected && recoverableActionErrors.has(code)) {
    const sendStop = !recovery.stopPending;
    recovery.stopPending = true;
    effects.stopContinuousInput();
    if (sendStop) effects.sendStop();
    return "recovered";
  }
  effects.disconnect();
  return "disconnected";
}
