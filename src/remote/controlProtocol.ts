export const PROTOCOL_VERSION = 1 as const;
export const MAX_MESSAGE_BYTES = 2048;
export const MAX_MESSAGE_AGE_MS = 2000;
export const MAX_CLOCK_AHEAD_MS = 1000;
export const REMOTE_ACTIONS = [
  "SELECT",
  "POINTER",
  "ROTATE_START",
  "ROTATE",
  "ROTATE_END",
  "ZOOM",
  "BACK",
  "NEXT_IMAGE",
  "PREVIOUS_IMAGE",
  "STOP",
  "FOCUS",
] as const;
export type RemoteAction = (typeof REMOTE_ACTIONS)[number];
export type RemoteDirection = "left" | "right" | "up" | "down";
export type RemotePayload = {
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  delta?: number;
  direction?: RemoteDirection;
  expectedTargetId?: string;
};
export type ControlMessage = {
  version: 1;
  sessionId: string;
  sequence: number;
  timestamp: number;
  action: RemoteAction;
  payload?: RemotePayload;
};
export type RemoteViewState = {
  mode: string;
  selected?: string;
  available: RemoteAction[];
  focusTarget?: {
    id: string;
    label?: string;
    kind?: "body" | "ui";
    source?: "pointer" | "focus";
  } | null;
};
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string };
export type ControlValidationContext = {
  sessionId: string;
  lastSequence: number;
  now?: number;
};
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const hasOnlyKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
) => Object.keys(value).every((key) => keys.includes(key));
export const isSessionId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(value);
export const isConnectionToken = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{40,100}$/.test(value);
const numberInRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
export function validateActionPayload(
  action: RemoteAction,
  payload: unknown,
): boolean {
  if (action === "SELECT")
    return (
      payload === undefined ||
      (isRecord(payload) &&
        hasOnlyKeys(payload, ["expectedTargetId"]) &&
        typeof payload.expectedTargetId === "string" &&
        /^[A-Za-z0-9_-]{1,100}$/.test(payload.expectedTargetId))
    );
  if (action === "POINTER")
    return (
      isRecord(payload) &&
      hasOnlyKeys(payload, ["x", "y"]) &&
      numberInRange(payload.x, 0, 1) &&
      numberInRange(payload.y, 0, 1)
    );
  if (action === "ROTATE")
    return (
      isRecord(payload) &&
      hasOnlyKeys(payload, ["dx", "dy"]) &&
      numberInRange(payload.dx, -1, 1) &&
      numberInRange(payload.dy, -1, 1)
    );
  if (action === "ZOOM")
    return (
      isRecord(payload) &&
      hasOnlyKeys(payload, ["delta"]) &&
      numberInRange(payload.delta, -1, 1)
    );
  if (action === "FOCUS")
    return (
      isRecord(payload) &&
      hasOnlyKeys(payload, ["direction"]) &&
      typeof payload.direction === "string" &&
      ["left", "right", "up", "down"].includes(payload.direction)
    );
  return payload === undefined;
}
export function validateControlMessage(
  raw: unknown,
  context: ControlValidationContext,
): ValidationResult<ControlMessage> {
  if (
    !isRecord(raw) ||
    !hasOnlyKeys(raw, [
      "version",
      "sessionId",
      "sequence",
      "timestamp",
      "action",
      "payload",
    ])
  )
    return { ok: false, code: "invalid-message" };
  if (
    raw.version !== PROTOCOL_VERSION ||
    !isSessionId(raw.sessionId) ||
    raw.sessionId !== context.sessionId
  )
    return { ok: false, code: "invalid-session" };
  if (
    !Number.isSafeInteger(raw.sequence) ||
    (raw.sequence as number) <= context.lastSequence ||
    (raw.sequence as number) < 1
  )
    return { ok: false, code: "stale-sequence" };
  const now = context.now ?? Date.now();
  if (
    !Number.isSafeInteger(raw.timestamp) ||
    now - (raw.timestamp as number) > MAX_MESSAGE_AGE_MS ||
    (raw.timestamp as number) - now > MAX_CLOCK_AHEAD_MS
  )
    return { ok: false, code: "expired-message" };
  if (
    !(REMOTE_ACTIONS as readonly unknown[]).includes(raw.action) ||
    !validateActionPayload(raw.action as RemoteAction, raw.payload)
  )
    return { ok: false, code: "invalid-action" };
  return { ok: true, value: raw as ControlMessage };
}
export function parseControlMessage(
  text: string,
  context: ControlValidationContext,
): ValidationResult<ControlMessage> {
  if (new TextEncoder().encode(text).byteLength > MAX_MESSAGE_BYTES)
    return { ok: false, code: "message-too-large" };
  try {
    return validateControlMessage(JSON.parse(text), context);
  } catch {
    return { ok: false, code: "invalid-json" };
  }
}
export function validateRemoteViewState(
  raw: unknown,
): ValidationResult<RemoteViewState> {
  if (
    !isRecord(raw) ||
    !hasOnlyKeys(raw, ["mode", "selected", "available", "focusTarget"]) ||
    typeof raw.mode !== "string" ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(raw.mode)
  )
    return { ok: false, code: "invalid-state" };
  if (
    raw.selected !== undefined &&
    (typeof raw.selected !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(raw.selected))
  )
    return { ok: false, code: "invalid-state" };
  if (
    !Array.isArray(raw.available) ||
    raw.available.length > REMOTE_ACTIONS.length ||
    new Set(raw.available).size !== raw.available.length ||
    raw.available.some(
      (action) => !(REMOTE_ACTIONS as readonly unknown[]).includes(action),
    )
  )
    return { ok: false, code: "invalid-state" };
  if (raw.focusTarget !== undefined && raw.focusTarget !== null) {
    const target = raw.focusTarget;
    if (
      !isRecord(target) ||
      !hasOnlyKeys(target, ["id", "label", "kind", "source"]) ||
      typeof target.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(target.id) ||
      (target.label !== undefined &&
        (typeof target.label !== "string" ||
          target.label.length > 80 ||
          /[\u0000-\u001f\u007f]/.test(target.label))) ||
      (target.kind !== undefined &&
        (typeof target.kind !== "string" ||
          !["body", "ui"].includes(target.kind))) ||
      (target.source !== undefined &&
        target.source !== "pointer" &&
        target.source !== "focus")
    )
      return { ok: false, code: "invalid-state" };
  }
  return { ok: true, value: raw as RemoteViewState };
}
export function validateRelayServiceUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Relay service must be a configured HTTPS origin.");
  return url;
}
export function parsePairingFragment(
  hash: string,
): { sessionId: string; claimToken: string } | null {
  const query = new URLSearchParams(hash.replace(/^#/, ""));
  if (
    Array.from(query.keys()).some(
      (key) => !["session", "claim"].includes(key),
    ) ||
    query.getAll("session").length !== 1 ||
    query.getAll("claim").length !== 1
  )
    return null;
  const sessionId = query.get("session"),
    claimToken = query.get("claim");
  return isSessionId(sessionId) && isConnectionToken(claimToken)
    ? { sessionId, claimToken }
    : null;
}
