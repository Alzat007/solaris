import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type ServerOptions } from "node:https";
import { WebSocket, WebSocketServer } from "ws";
import {
  MAX_MESSAGE_BYTES,
  hasOnlyKeys,
  isConnectionToken,
  isRecord,
  isSessionId,
  validateControlMessage,
  validateRemoteViewState,
  type RemoteAction,
} from "../../../src/remote/controlProtocol.js";
const randomId = () => randomBytes(24).toString("base64url");
const randomToken = () => randomBytes(32).toString("base64url");
const equalToken = (a: unknown, b: string) =>
  isConnectionToken(a) &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
type Bucket = { start: number; count: number };
type Connection = {
  socket: WebSocket;
  session?: Session;
  role?: "tv" | "controller";
  authenticated: boolean;
  alive: number;
  messages: Bucket;
  authTimeout: ReturnType<typeof setTimeout>;
};
type Session = {
  id: string;
  tvToken: string;
  claimToken: string | null;
  claimExpires: number;
  expires: number;
  requestId?: string;
  approvalExpires?: number;
  tv?: Connection;
  controller?: Connection;
  confirmed: boolean;
  lastSequence: number;
  continuousAt: number;
  discrete: Bucket;
  actionAt: Map<RemoteAction, number>;
};
const rejectionCodes = [
  "authorization-failed",
  "session-expired",
  "invalid-message",
  "invalid-json",
  "rate-limited",
  "invalid-confirmation",
  "invalid-state",
  "not-authorized",
  "invalid-session",
  "stale-sequence",
  "expired-message",
  "invalid-action",
  "message-too-large",
] as const;
export const RELAY_DIAGNOSTIC_CODES = {
  "tls-error": ["tls-handshake-failed"],
  "upgrade-rejected": [
    "path-rejected",
    "origin-rejected",
    "connection-limit",
    "rate-limited",
  ],
  authentication: [
    "authenticated",
    "authentication-timeout",
    ...rejectionCodes,
  ],
  "waiting-approval": ["waiting-approval"],
  confirmation: ["confirmed", "pairing-rejected"],
  "message-rejected": rejectionCodes,
  "session-expired": ["session-expired"],
  "session-closed": [
    "revoked",
    "pairing-rejected",
    "peer-disconnected",
    "heartbeat-timeout",
    "service-stopped",
  ],
  "connection-error": ["websocket-error"],
  "connection-closed": [
    "normal-close",
    "going-away",
    "abnormal-close",
    "policy-close",
    "message-too-large",
    "internal-close",
    "other-close",
  ],
} as const;
export type RelayDiagnostic = {
  [Event in keyof typeof RELAY_DIAGNOSTIC_CODES]: {
    event: Event;
    code: (typeof RELAY_DIAGNOSTIC_CODES)[Event][number];
    role?: "tv" | "controller";
  };
}[keyof typeof RELAY_DIAGNOSTIC_CODES];
type SessionCloseReason =
  | (typeof RELAY_DIAGNOSTIC_CODES)["session-closed"][number]
  | "session-expired";
const rejectionCode = (code: string): (typeof rejectionCodes)[number] =>
  rejectionCodes.find((allowed) => allowed === code) ?? "invalid-message";
const connectionCloseCode = (
  code: number,
): (typeof RELAY_DIAGNOSTIC_CODES)["connection-closed"][number] => {
  switch (code) {
    case 1000:
      return "normal-close";
    case 1001:
      return "going-away";
    case 1006:
      return "abnormal-close";
    case 1008:
      return "policy-close";
    case 1009:
      return "message-too-large";
    case 1011:
      return "internal-close";
    default:
      return "other-close";
  }
};
export type RelayServerOptions = {
  tls: ServerOptions;
  allowedOrigins: string[];
  pairingTtlMs?: number;
  sessionTtlMs?: number;
  approvalTtlMs?: number;
  heartbeatTimeoutMs?: number;
  onDiagnostic?: (diagnostic: RelayDiagnostic) => void | Promise<void>;
};
export function createRelayServer(options: RelayServerOptions) {
  const allowedOrigins = new Set(
    options.allowedOrigins.map((origin) => {
      const url = new URL(origin);
      if (
        url.protocol !== "https:" ||
        url.origin !== origin ||
        url.username ||
        url.password
      )
        throw new Error("Allowed origins must be exact HTTPS origins.");
      return origin;
    }),
  );
  if (!allowedOrigins.size)
    throw new Error("An explicit HTTPS origin allowlist is required.");
  if (!options.tls.key || !options.tls.cert)
    throw new Error("TLS certificate and key are required.");
  // Diagnostics contain only fixed categories; callback failures never affect control.
  const diagnose = (diagnostic: RelayDiagnostic) => {
    try {
      const pending = options.onDiagnostic?.(diagnostic);
      if (pending) void Promise.resolve(pending).catch(() => {});
    } catch {}
  };
  const sessions = new Map<string, Session>();
  const connections = new Set<Connection>();
  const createLimits = new Map<string, Bucket>();
  const connectionLimits = new Map<string, Bucket>();
  const pairingTtl = options.pairingTtlMs ?? 120000,
    sessionTtl = options.sessionTtlMs ?? 1800000;
  const approvalTtl = options.approvalTtlMs ?? 30000,
    heartbeatTimeout = options.heartbeatTimeoutMs ?? 6000;
  const sessionExpired = (session: Session, now: number) =>
    now >= session.expires ||
    (!session.confirmed &&
      (now >= session.claimExpires ||
        (session.controller && now >= (session.approvalExpires ?? 0))));
  const rateAllowed = (
    bucket: Bucket,
    count: number,
    window: number,
    now = Date.now(),
  ) => {
    if (now - bucket.start >= window) {
      bucket.start = now;
      bucket.count = 0;
    }
    return ++bucket.count <= count;
  };
  const allowedIp = (map: Map<string, Bucket>, ip: string, limit: number) => {
    if (!map.has(ip)) {
      if (map.size >= 4096) return false;
      map.set(ip, { start: Date.now(), count: 0 });
    }
    return rateAllowed(map.get(ip)!, limit, 60000);
  };
  const send = (connection: Connection | undefined, data: unknown) => {
    if (connection?.socket.readyState === WebSocket.OPEN)
      connection.socket.send(JSON.stringify(data));
  };
  const deny = (connection: Connection, code: string, terminate = false) => {
    const detail = {
      code: rejectionCode(code),
      ...(connection.role ? { role: connection.role } : {}),
    };
    diagnose(
      connection.authenticated
        ? { event: "message-rejected", ...detail }
        : { event: "authentication", ...detail },
    );
    send(connection, { type: "error", code });
    if (terminate) connection.socket.close(1008, "request-rejected");
  };
  const endSession = (session: Session, reason: SessionCloseReason) => {
    if (!sessions.delete(session.id)) return;
    if (reason === "session-expired")
      diagnose({ event: "session-expired", code: reason });
    else diagnose({ event: "session-closed", code: reason });
    session.tvToken = "";
    session.claimToken = null;
    session.confirmed = false;
    for (const connection of [session.tv, session.controller]) {
      if (!connection) continue;
      connection.session = undefined;
      send(connection, { type: "closed", reason });
      connection.socket.close(1000, "session-ended");
    }
  };
  const server = createServer(
    { ...options.tls, minVersion: "TLSv1.2" },
    (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      const origin = request.headers.origin;
      if (request.url === "/health" && request.method === "GET") {
        response.end('{"ok":true}');
        return;
      }
      if (!origin || !allowedOrigins.has(origin)) {
        response.writeHead(403);
        response.end('{"error":"origin-rejected"}');
        return;
      }
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      if (request.url !== "/v1/sessions") {
        response.writeHead(404);
        response.end('{"error":"not-found"}');
        return;
      }
      if (request.method === "OPTIONS") {
        const requestedHeaders = String(
          request.headers["access-control-request-headers"] ?? "",
        )
          .toLowerCase()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (requestedHeaders.some((header) => header !== "content-type")) {
          response.writeHead(403);
          response.end('{"error":"headers-rejected"}');
          return;
        }
        response.setHeader("Access-Control-Allow-Methods", "POST");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.writeHead(204);
        response.end();
        return;
      }
      if (
        request.method !== "POST" ||
        !String(request.headers["content-type"] ?? "").startsWith(
          "application/json",
        )
      ) {
        response.writeHead(405);
        response.end('{"error":"invalid-request"}');
        return;
      }
      const ip = request.socket.remoteAddress ?? "unknown";
      if (!allowedIp(createLimits, ip, 10) || sessions.size >= 1000) {
        response.writeHead(429);
        response.end('{"error":"rate-limited"}');
        return;
      }
      let length = 0;
      const chunks: Buffer[] = [];
      let oversized = false;
      request.on("data", (chunk: Buffer) => {
        if (oversized) return;
        length += chunk.length;
        if (length > 32) {
          oversized = true;
          response.writeHead(413);
          response.end('{"error":"message-too-large"}');
          request.destroy();
        } else chunks.push(chunk);
      });
      request.on("end", () => {
        if (oversized) return;
        let body: unknown;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          response.writeHead(400);
          response.end('{"error":"invalid-request"}');
          return;
        }
        if (!isRecord(body) || Object.keys(body).length) {
          response.writeHead(400);
          response.end('{"error":"invalid-request"}');
          return;
        }
        const now = Date.now();
        const session: Session = {
          id: randomId(),
          tvToken: randomToken(),
          claimToken: randomToken(),
          claimExpires: now + pairingTtl,
          expires: now + sessionTtl,
          confirmed: false,
          lastSequence: 0,
          continuousAt: 0,
          discrete: { start: now, count: 0 },
          actionAt: new Map(),
        };
        sessions.set(session.id, session);
        response.writeHead(201);
        response.end(
          JSON.stringify({
            sessionId: session.id,
            tvToken: session.tvToken,
            claimToken: session.claimToken,
            expiresAt: session.claimExpires,
          }),
        );
      });
      request.setTimeout(5000, () => request.destroy());
    },
  );
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
    perMessageDeflate: false,
  });
  server.on("tlsClientError", () =>
    diagnose({ event: "tls-error", code: "tls-handshake-failed" }),
  );
  server.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    let code:
      | (typeof RELAY_DIAGNOSTIC_CODES)["upgrade-rejected"][number]
      | undefined;
    if (request.url !== "/v1/ws") code = "path-rejected";
    else if (!origin || !allowedOrigins.has(origin)) code = "origin-rejected";
    else if (connections.size >= 1024) code = "connection-limit";
    else if (
      !allowedIp(
        connectionLimits,
        request.socket.remoteAddress ?? "unknown",
        30,
      )
    )
      code = "rate-limited";
    if (code) {
      diagnose({ event: "upgrade-rejected", code });
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit("connection", ws, request),
    );
  });
  wss.on("connection", (socket) => {
    const connection: Connection = {
      socket,
      authenticated: false,
      alive: Date.now(),
      messages: { start: Date.now(), count: 0 },
      authTimeout: setTimeout(() => {
        diagnose({ event: "authentication", code: "authentication-timeout" });
        socket.close(1008, "authentication-timeout");
      }, 5000),
    };
    connections.add(connection);
    socket.on("error", () =>
      diagnose({
        event: "connection-error",
        code: "websocket-error",
        ...(connection.role ? { role: connection.role } : {}),
      }),
    );
    socket.on("message", (buffer, binary) => {
      if (binary) {
        deny(connection, "invalid-message", true);
        return;
      }
      if (!rateAllowed(connection.messages, 50, 1000)) {
        deny(connection, "rate-limited", true);
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(buffer.toString());
      } catch {
        deny(connection, "invalid-json", true);
        return;
      }
      if (!isRecord(data) || typeof data.type !== "string") {
        deny(connection, "invalid-message", true);
        return;
      }
      if (!connection.authenticated) {
        if (
          data.type !== "auth" ||
          !hasOnlyKeys(data, ["type", "role", "sessionId", "token"]) ||
          !isSessionId(data.sessionId)
        ) {
          deny(connection, "authorization-failed", true);
          return;
        }
        const session = sessions.get(data.sessionId);
        const now = Date.now();
        if (!session || sessionExpired(session, now)) {
          if (session) endSession(session, "session-expired");
          deny(connection, "session-expired", true);
          return;
        }
        if (
          data.role === "tv" &&
          equalToken(data.token, session.tvToken) &&
          !session.tv
        ) {
          session.tvToken = "";
          session.tv = connection;
          connection.role = "tv";
        } else if (
          data.role === "controller" &&
          session.tv &&
          !session.controller &&
          session.claimToken &&
          equalToken(data.token, session.claimToken)
        ) {
          session.claimToken = null;
          session.controller = connection;
          connection.role = "controller";
          session.requestId = randomId();
          session.approvalExpires = now + approvalTtl;
        } else {
          deny(connection, "authorization-failed", true);
          return;
        }
        connection.session = session;
        connection.authenticated = true;
        connection.alive = now;
        clearTimeout(connection.authTimeout);
        diagnose({
          event: "authentication",
          code: "authenticated",
          role: connection.role,
        });
        send(connection, { type: "authenticated" });
        if (connection.role === "controller") {
          diagnose({
            event: "waiting-approval",
            code: "waiting-approval",
            role: "controller",
          });
          send(connection, { type: "waiting-approval", sessionId: session.id });
          send(session.tv, {
            type: "pair-request",
            requestId: session.requestId,
          });
        }
        return;
      }
      const session = connection.session;
      if (!session || !sessions.has(session.id)) {
        deny(connection, "session-expired", true);
        return;
      }
      const now = Date.now();
      if (sessionExpired(session, now)) {
        endSession(session, "session-expired");
        return;
      }
      connection.alive = now;
      switch (data.type) {
        case "heartbeat":
          if (!hasOnlyKeys(data, ["type"]))
            deny(connection, "invalid-message", true);
          else send(connection, { type: "heartbeat" });
          return;
        case "revoke":
          if (!hasOnlyKeys(data, ["type"]))
            deny(connection, "invalid-message", true);
          else endSession(session, "revoked");
          return;
        case "confirm":
          if (
            connection.role !== "tv" ||
            !hasOnlyKeys(data, ["type", "requestId", "approved"]) ||
            data.requestId !== session.requestId ||
            typeof data.approved !== "boolean" ||
            session.confirmed ||
            !session.controller ||
            Date.now() >= (session.approvalExpires ?? 0)
          ) {
            deny(connection, "invalid-confirmation");
            return;
          }
          if (!data.approved) {
            diagnose({
              event: "confirmation",
              code: "pairing-rejected",
              role: "tv",
            });
            endSession(session, "pairing-rejected");
            return;
          }
          session.confirmed = true;
          diagnose({ event: "confirmation", code: "confirmed", role: "tv" });
          send(session.tv, { type: "connected", sessionId: session.id });
          send(session.controller, {
            type: "connected",
            sessionId: session.id,
          });
          return;
        case "state": {
          const state = validateRemoteViewState(data.state);
          if (
            connection.role !== "tv" ||
            !session.confirmed ||
            !hasOnlyKeys(data, ["type", "state"]) ||
            !state.ok
          ) {
            deny(connection, "invalid-state");
            return;
          }
          send(session.controller, { type: "state", state: state.value });
          return;
        }
        case "control": {
          if (
            connection.role !== "controller" ||
            !session.confirmed ||
            !hasOnlyKeys(data, ["type", "message"])
          ) {
            deny(connection, "not-authorized");
            return;
          }
          const result = validateControlMessage(data.message, {
            sessionId: session.id,
            lastSequence: session.lastSequence,
          });
          if (!result.ok) {
            deny(connection, result.code);
            return;
          }
          const message = result.value;
          const now = Date.now();
          session.lastSequence = message.sequence;
          const continuous = ["ROTATE", "POINTER", "ZOOM"].includes(
            message.action,
          );
          const priority = ["STOP", "BACK", "ROTATE_END"].includes(
            message.action,
          );
          if (continuous && now - session.continuousAt < 66) {
            deny(connection, "rate-limited");
            return;
          }
          if (
            !continuous &&
            !priority &&
            (!rateAllowed(session.discrete, 6, 1000, now) ||
              now - (session.actionAt.get(message.action) ?? 0) < 150)
          ) {
            deny(connection, "rate-limited");
            return;
          }
          if (continuous) session.continuousAt = now;
          session.actionAt.set(message.action, now);
          send(session.tv, { type: "action", message });
          send(connection, {
            type: "acknowledged",
            sequence: message.sequence,
          });
          return;
        }
        default:
          deny(connection, "invalid-message", true);
      }
    });
    socket.on("close", (code) => {
      diagnose({
        event: "connection-closed",
        code: connectionCloseCode(code),
        ...(connection.role ? { role: connection.role } : {}),
      });
      clearTimeout(connection.authTimeout);
      connections.delete(connection);
      if (connection.session)
        endSession(connection.session, "peer-disconnected");
    });
  });
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const session of sessions.values()) {
      if (sessionExpired(session, now)) endSession(session, "session-expired");
    }
    for (const connection of connections)
      if (
        connection.authenticated &&
        now - connection.alive > heartbeatTimeout
      ) {
        if (connection.session)
          endSession(connection.session, "heartbeat-timeout");
        else connection.socket.close(1000, "heartbeat-timeout");
      }
    for (const map of [createLimits, connectionLimits])
      for (const [ip, bucket] of map)
        if (now - bucket.start > 120000) map.delete(ip);
  }, 250);
  cleanup.unref();
  return {
    server,
    async close() {
      clearInterval(cleanup);
      for (const session of sessions.values())
        endSession(session, "service-stopped");
      for (const connection of connections) {
        clearTimeout(connection.authTimeout);
        connection.socket.terminate();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
    activeSessionCount: () => sessions.size,
  };
}
