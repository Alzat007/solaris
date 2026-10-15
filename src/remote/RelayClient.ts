import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  REMOTE_ACTIONS,
  hasOnlyKeys,
  isConnectionToken,
  isRecord,
  isSessionId,
  validateActionPayload,
  validateControlMessage,
  validateRelayServiceUrl,
  validateRemoteViewState,
  type ControlMessage,
  type RemoteAction,
  type RemotePayload,
  type RemoteViewState,
} from "./controlProtocol";
export type RelayEvent =
  | {
      type: "pair-code";
      sessionId: string;
      claimToken: string;
      expiresAt: number;
    }
  | { type: "pair-request"; requestId: string }
  | { type: "waiting-approval"; sessionId: string }
  | { type: "connected"; sessionId: string }
  | { type: "action"; message: ControlMessage }
  | { type: "state"; state: RemoteViewState }
  | { type: "acknowledged"; sequence: number }
  | { type: "error"; code: string }
  | { type: "closed"; reason: string };
export type RelayClientOptions = {
  role: "tv" | "controller";
  serviceUrl: string;
  onEvent: (event: RelayEvent) => void;
};
const CONTINUOUS_SEND_INTERVAL_MS = 100;
const CONTINUOUS_ACK_GAP_MS = 70;
const CONTINUOUS_ERROR_BACKOFF_MS = 150;
export class RelayClient {
  private readonly options: RelayClientOptions;
  private readonly service: URL;
  private socket: WebSocket | null = null;
  private sessionId = "";
  private sequence = 0;
  private receivedSequence = 0;
  private connected = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastAlive = 0;
  private generation = 0;
  private terminal = true;
  private readonly lastSent = new Map<string, number>();
  private continuousInFlight: number | null = null;
  private continuousReadyAt = 0;
  constructor(options: RelayClientOptions) {
    this.options = options;
    this.service = validateRelayServiceUrl(options.serviceUrl);
  }
  async createSession(): Promise<void> {
    if (this.options.role !== "tv")
      throw new Error("Only the television can create a session.");
    this.disconnect();
    const generation = ++this.generation;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 7000);
    try {
      const response = await fetch(new URL("/v1/sessions", this.service), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: abort.signal,
      });
      if (!response.ok) throw new Error("Session creation failed.");
      const data: unknown = await response.json();
      if (
        !isRecord(data) ||
        !hasOnlyKeys(data, [
          "sessionId",
          "tvToken",
          "claimToken",
          "expiresAt",
        ]) ||
        !isSessionId(data.sessionId) ||
        !isConnectionToken(data.tvToken) ||
        !isConnectionToken(data.claimToken) ||
        !Number.isSafeInteger(data.expiresAt)
      )
        throw new Error("Invalid session response.");
      if (generation !== this.generation) return;
      this.sessionId = data.sessionId;
      await this.connect({
        type: "auth",
        role: "tv",
        sessionId: data.sessionId,
        token: data.tvToken,
      });
      if (generation !== this.generation) return;
      this.options.onEvent({
        type: "pair-code",
        sessionId: data.sessionId,
        claimToken: data.claimToken,
        expiresAt: data.expiresAt as number,
      });
    } catch {
      if (generation === this.generation) {
        this.options.onEvent({ type: "error", code: "session-unavailable" });
        this.finish("session-unavailable");
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  async pair(sessionId: string, claimToken: string): Promise<void> {
    if (
      this.options.role !== "controller" ||
      !isSessionId(sessionId) ||
      !isConnectionToken(claimToken)
    )
      throw new Error("Invalid pairing credentials.");
    this.disconnect();
    const generation = this.generation;
    this.sessionId = sessionId;
    try {
      await this.connect({
        type: "auth",
        role: "controller",
        sessionId,
        token: claimToken,
      });
    } catch {
      if (generation === this.generation) {
        this.options.onEvent({ type: "error", code: "connection-unavailable" });
        this.finish("connection-unavailable");
      }
    }
  }
  private connect(auth: Record<string, string>): Promise<void> {
    this.terminal = false;
    this.sequence = 0;
    this.receivedSequence = 0;
    this.connected = false;
    this.lastSent.clear();
    this.continuousInFlight = null;
    this.continuousReadyAt = 0;
    const address = new URL("/v1/ws", this.service);
    address.protocol = "wss:";
    const socket = new WebSocket(address);
    this.socket = socket;
    this.lastAlive = Date.now();
    return new Promise((resolve, reject) => {
      let authenticated = false;
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout."));
        if (socket === this.socket) this.finish("connection-timeout");
      }, 6000);
      socket.onopen = () => {
        if (socket === this.socket) socket.send(JSON.stringify(auth));
      };
      socket.onmessage = (event) => {
        if (socket !== this.socket || typeof event.data !== "string") return;
        if (
          new TextEncoder().encode(event.data).byteLength > MAX_MESSAGE_BYTES
        ) {
          this.finish("invalid-server-message");
          return;
        }
        let data: unknown;
        try {
          data = JSON.parse(event.data);
        } catch {
          this.finish("invalid-server-message");
          return;
        }
        if (!isRecord(data) || typeof data.type !== "string") {
          this.finish("invalid-server-message");
          return;
        }
        if (data.type === "authenticated") {
          if (!hasOnlyKeys(data, ["type"])) {
            this.finish("invalid-server-message");
            return;
          }
          authenticated = true;
          clearTimeout(timeout);
          this.startHeartbeat();
          resolve();
          return;
        }
        if (!authenticated) {
          if (data.type === "error")
            this.options.onEvent({
              type: "error",
              code:
                typeof data.code === "string"
                  ? data.code
                  : "authorization-failed",
            });
          return;
        }
        this.receive(data);
      };
      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Secure connection failed."));
        if (socket === this.socket) this.finish("network-error");
      };
      socket.onclose = () => {
        clearTimeout(timeout);
        if (!authenticated) reject(new Error("Connection closed."));
        if (socket === this.socket) this.finish("connection-lost");
      };
    });
  }
  private receive(data: Record<string, unknown>) {
    this.lastAlive = Date.now();
    switch (data.type) {
      case "heartbeat":
        if (!hasOnlyKeys(data, ["type"])) this.finish("invalid-server-message");
        return;
      case "pair-request":
        if (
          isSessionId(data.requestId) &&
          hasOnlyKeys(data, ["type", "requestId"])
        )
          this.options.onEvent({
            type: "pair-request",
            requestId: data.requestId,
          });
        else this.finish("invalid-server-message");
        return;
      case "waiting-approval":
        if (
          data.sessionId === this.sessionId &&
          hasOnlyKeys(data, ["type", "sessionId"])
        )
          this.options.onEvent({
            type: "waiting-approval",
            sessionId: this.sessionId,
          });
        else this.finish("invalid-server-message");
        return;
      case "connected":
        if (
          data.sessionId === this.sessionId &&
          hasOnlyKeys(data, ["type", "sessionId"])
        ) {
          this.connected = true;
          this.options.onEvent({
            type: "connected",
            sessionId: this.sessionId,
          });
        } else this.finish("invalid-server-message");
        return;
      case "action": {
        if (
          this.options.role !== "tv" ||
          !hasOnlyKeys(data, ["type", "message"])
        ) {
          this.finish("invalid-server-message");
          return;
        }
        const result = validateControlMessage(data.message, {
          sessionId: this.sessionId,
          lastSequence: this.receivedSequence,
        });
        if (result.ok) {
          this.receivedSequence = result.value.sequence;
          this.options.onEvent({ type: "action", message: result.value });
        } else this.options.onEvent({ type: "error", code: result.code });
        return;
      }
      case "state": {
        const result = validateRemoteViewState(data.state);
        if (result.ok && hasOnlyKeys(data, ["type", "state"]))
          this.options.onEvent({ type: "state", state: result.value });
        else this.finish("invalid-server-message");
        return;
      }
      case "acknowledged":
        if (
          this.options.role === "controller" &&
          Number.isSafeInteger(data.sequence) &&
          (data.sequence as number) > 0 &&
          (data.sequence as number) <= this.sequence &&
          hasOnlyKeys(data, ["type", "sequence"])
        ) {
          if (data.sequence === this.continuousInFlight) {
            this.continuousInFlight = null;
            this.continuousReadyAt = Date.now() + CONTINUOUS_ACK_GAP_MS;
          }
          this.options.onEvent({
            type: "acknowledged",
            sequence: data.sequence as number,
          });
        } else this.finish("invalid-server-message");
        return;
      case "error":
        if (
          typeof data.code === "string" &&
          /^[a-z-]{1,64}$/.test(data.code) &&
          hasOnlyKeys(data, ["type", "code"])
        ) {
          if (
            ["rate-limited", "expired-message", "stale-sequence"].includes(
              data.code,
            )
          ) {
            this.continuousInFlight = null;
            this.continuousReadyAt = Date.now() + CONTINUOUS_ERROR_BACKOFF_MS;
          }
          this.options.onEvent({ type: "error", code: data.code });
        } else this.finish("invalid-server-message");
        return;
      case "closed":
        this.finish(
          typeof data.reason === "string" && /^[a-z-]{1,64}$/.test(data.reason)
            ? data.reason
            : "session-ended",
        );
        return;
      default:
        this.finish("invalid-server-message");
    }
  }
  private startHeartbeat() {
    this.lastAlive = Date.now();
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastAlive > 6000) {
        this.finish("connection-timeout");
        return;
      }
      this.write({ type: "heartbeat" });
    }, 1000);
  }
  private write(data: unknown): boolean {
    if (
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      this.terminal
    )
      return false;
    const text = JSON.stringify(data);
    if (new TextEncoder().encode(text).byteLength > MAX_MESSAGE_BYTES)
      return false;
    this.socket.send(text);
    return true;
  }
  confirm(requestId: string, approved: boolean): boolean {
    return (
      this.options.role === "tv" &&
      isSessionId(requestId) &&
      this.write({ type: "confirm", requestId, approved })
    );
  }
  revoke(): void {
    this.write({ type: "revoke" });
    this.finish("revoked");
  }
  sendAction(action: RemoteAction, payload?: RemotePayload): boolean {
    if (
      this.options.role !== "controller" ||
      !this.connected ||
      !(REMOTE_ACTIONS as readonly unknown[]).includes(action) ||
      !validateActionPayload(action, payload)
    )
      return false;
    const now = Date.now();
    const continuous = ["POINTER", "ROTATE", "ZOOM"].includes(action);
    // An ACK proves the previous packet reached the relay before another is sent.
    if (
      continuous &&
      (this.continuousInFlight !== null || now < this.continuousReadyAt)
    )
      return false;
    const key = continuous ? "continuous" : action;
    const interval = continuous
      ? CONTINUOUS_SEND_INTERVAL_MS
      : action === "STOP" || action === "BACK" || action === "ROTATE_END"
        ? 0
        : 180;
    const last = this.lastSent.get(key);
    if (last !== undefined && now - last < interval) return false;
    const message: ControlMessage = {
      version: PROTOCOL_VERSION,
      sessionId: this.sessionId,
      sequence: this.sequence + 1,
      timestamp: now,
      action,
      ...(payload ? { payload } : {}),
    };
    if (!this.write({ type: "control", message })) return false;
    this.sequence = message.sequence;
    if (continuous) this.continuousInFlight = message.sequence;
    this.lastSent.set(key, now);
    return true;
  }
  publishState(state: RemoteViewState): boolean {
    return (
      this.options.role === "tv" &&
      this.connected &&
      validateRemoteViewState(state).ok &&
      this.write({ type: "state", state })
    );
  }
  disconnect(): void {
    ++this.generation;
    this.write({ type: "revoke" });
    this.finish("disconnected");
  }
  private finish(reason: string) {
    if (this.terminal) return;
    this.terminal = true;
    this.connected = false;
    this.sessionId = "";
    this.lastSent.clear();
    this.continuousInFlight = null;
    this.continuousReadyAt = 0;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState !== WebSocket.CLOSED)
      socket.close(1000, "session-ended");
    this.options.onEvent({ type: "closed", reason });
  }
}
