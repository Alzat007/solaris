import { useEffect, useRef, useState } from "react";
import {
  Smartphone,
  RotateCw,
  X,
  Link2Off,
  Check,
  Pause,
  Minus,
  Plus,
} from "lucide-react";
import QRCode from "qrcode";
import { store, useSolaris } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import {
  isPlanetAtlasVisible,
  setPlanetAutoRotate,
} from "../exploration/planetAtlasState";
import { RelayClient, type RelayEvent } from "../remote/RelayClient";
import {
  type RemoteViewState,
  type RemoteAction,
} from "../remote/controlProtocol";
import { readRemoteConfig } from "../remote/config";
import {
  applyInputAction,
  clearRemoteInput,
  currentInputTargetSnapshot,
  inputOwnership,
} from "../input/sharedInput";
import { registerInputBack } from "../input/backHandlers";
import { isTvMode } from "./tvNavigation";
import { RemotePointerCursor } from "./RemotePointerCursor";
import "./tvRemote.css";

export function TvRemoteControls() {
  const state = useSolaris();
  const zh = state.language === "zh";
  const text = (cn: string, en: string) => (zh ? cn : en);
  const [rotationMode, setRotationMode] = useState(false);
  const [panel, setPanel] = useState(false);
  const [status, setStatus] = useState("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [expires, setExpires] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const client = useRef<RelayClient | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const connected = useRef(false);
  const qrGeneration = useRef(0);
  const publishedState = useRef("");
  const tv = isTvMode(location.search);
  function closePanel() {
    setPanel(false);
    setRequestId(null);
    requestAnimationFrame(() => opener.current?.focus());
  }
  function disconnect() {
    qrGeneration.current++;
    clearRemoteInput();
    const old = client.current;
    client.current = null;
    old?.disconnect();
    connected.current = false;
    setQr("");
    setExpires(0);
    setRequestId(null);
    setStatus("idle");
  }
  function event(event: RelayEvent) {
    if (event.type === "pair-code") {
      const config = readRemoteConfig();
      if (!config) {
        disconnect();
        setStatus("config");
        return;
      }
      const url = new URL(config.phoneUrl);
      url.hash = new URLSearchParams({
        session: event.sessionId,
        claim: event.claimToken,
      }).toString();
      const generation = ++qrGeneration.current;
      void QRCode.toDataURL(url.href, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
      })
        .then((image) => {
          if (qrGeneration.current === generation) setQr(image);
        })
        .catch(() => {
          if (qrGeneration.current === generation) setStatus("error");
        });
      setExpires(event.expiresAt);
      setStatus("pairing");
    } else if (event.type === "pair-request") {
      setQr("");
      setExpires(0);
      qrGeneration.current++;
      setRequestId(event.requestId);
      setPanel(true);
      setStatus("approval");
    } else if (event.type === "connected") {
      connected.current = true;
      publishedState.current = "";
      setStatus("connected");
      setQr("");
      setExpires(0);
      qrGeneration.current++;
      closePanel();
    } else if (event.type === "action") {
      if (!connected.current || panelRef.current) return;
      applyInputAction(event.message.action, event.message.payload);
    } else if (event.type === "closed") {
      connected.current = false;
      clearRemoteInput();
      setStatus("disconnected");
      setQr("");
      setExpires(0);
      setRequestId(null);
      qrGeneration.current++;
    } else if (event.type === "error") {
      clearRemoteInput();
      setStatus("error");
    }
  }
  async function connect() {
    disconnect();
    const config = readRemoteConfig();
    if (!config) {
      setStatus("config");
      return;
    }
    setStatus("connecting");
    const next = new RelayClient({
      role: "tv",
      serviceUrl: config.relayUrl,
      onEvent: (value) => {
        if (client.current === next) event(value);
      },
    });
    client.current = next;
    await next.createSession();
  }
  useEffect(() => {
    if (!tv) return;
    const local = (event: Event) => {
      if (event.isTrusted) inputOwnership.preempt(performance.now());
    };
    const pointerDown = (event: PointerEvent) => {
      if (!event.isTrusted) return;
      inputOwnership.preempt(performance.now());
      inputOwnership.hold("local", performance.now());
    };
    const pointerUp = (event: PointerEvent) => {
      if (event.isTrusted) inputOwnership.release("local");
    };
    const pause = () => {
      disconnect();
      setRotationMode(false);
      closePanel();
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const nativeInput = () => inputOwnership.preempt(performance.now());
    const blur = () => clearRemoteInput();
    document.addEventListener("keydown", local, true);
    document.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("pointerup", pointerUp, true);
    window.addEventListener("pointercancel", pointerUp, true);
    window.addEventListener("solaris-platform-pause", pause);
    window.addEventListener("blur", blur);
    window.addEventListener("solaris-native-input", nativeInput);
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => {
      inputOwnership.checkTimeout(performance.now());
      if (!connected.current || !client.current) return;
      const current = store.get();
      const modal = !!document.querySelector(
        '[role="dialog"][aria-modal="true"]',
      );
      const actions: RemoteAction[] = [
        "STOP",
        "BACK",
        "POINTER",
        "FOCUS",
        "SELECT",
      ];
      if (modal && current.activeStoryId)
        actions.push("NEXT_IMAGE", "PREVIOUS_IMAGE");
      else if (!modal && !interaction.isLocked() && !current.transitioning)
        actions.push("ROTATE_START", "ROTATE", "ROTATE_END", "ZOOM");
      const { target, source } = currentInputTargetSnapshot();
      const view: RemoteViewState = {
        mode: current.mode,
        ...(current.selected ? { selected: current.selected } : {}),
        available: actions,
        focusTarget: target
          ? { id: target.id, label: target.label, kind: target.kind, source }
          : null,
      };
      const serialized = JSON.stringify(view);
      if (
        serialized !== publishedState.current &&
        client.current.publishState(view)
      )
        publishedState.current = serialized;
    }, 80);
    return () => {
      clearInterval(timer);
      disconnect();
      document.removeEventListener("keydown", local, true);
      document.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("pointerup", pointerUp, true);
      window.removeEventListener("pointercancel", pointerUp, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("solaris-platform-pause", pause);
      window.removeEventListener("solaris-native-input", nativeInput);
      window.removeEventListener("blur", blur);
    };
  }, [tv]);
  useEffect(() => {
    if (!panel) return;
    setRotationMode(false);
    clearRemoteInput();
    const focus = requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    const dispose = registerInputBack(() => {
      disconnect();
      closePanel();
      return true;
    }, 100);
    return () => {
      cancelAnimationFrame(focus);
      dispose();
    };
  }, [panel]);
  useEffect(() => {
    if (!expires) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) {
        disconnect();
        setStatus("expired");
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expires]);
  useEffect(() => {
    if (!tv || !rotationMode) return;
    const pressed = new Set<string>();
    let frame = 0,
      previous = performance.now();
    const disposeBack = registerInputBack(() => {
      setRotationMode(false);
      clearRemoteInput();
      return true;
    }, 50);
    const tick = (time: number) => {
      const step = Math.min(0.05, Math.max(0, (time - previous) / 1000));
      previous = time;
      if (pressed.size)
        applyInputAction(
          "ROTATE",
          {
            dx:
              ((pressed.has("ArrowRight") ? 1 : 0) -
                (pressed.has("ArrowLeft") ? 1 : 0)) *
              step,
            dy:
              ((pressed.has("ArrowDown") ? 1 : 0) -
                (pressed.has("ArrowUp") ? 1 : 0)) *
              step,
          },
          "tv",
        );
      frame = requestAnimationFrame(tick);
    };
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === "keydown") {
          if (!pressed.size) applyInputAction("ROTATE_START", undefined, "tv");
          pressed.add(event.key);
        } else {
          pressed.delete(event.key);
          if (!pressed.size) applyInputAction("ROTATE_END", undefined, "tv");
        }
      } else if (
        ["Enter", "Escape", "GoBack", "BrowserBack"].includes(event.key)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === "keydown" && !event.repeat) {
          setRotationMode(false);
          clearRemoteInput();
        }
      } else if (
        ["+", "-", "PageUp", "PageDown"].includes(event.key) &&
        event.type === "keydown"
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        applyInputAction(
          "ZOOM",
          { delta: ["+", "PageUp"].includes(event.key) ? 0.08 : -0.08 },
          "tv",
        );
      }
    };
    const stop = () => {
      pressed.clear();
      setRotationMode(false);
      clearRemoteInput();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    window.addEventListener("blur", stop);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      disposeBack();
      clearRemoteInput();
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", key, true);
      window.removeEventListener("blur", stop);
    };
  }, [tv, rotationMode]);
  if (!tv) return null;
  const story = state.mode === "INFO_PANEL_OPEN";
  const statusText =
    (
      {
        connected: text("手机已连接", "Phone connected"),
        pairing: text("等待扫码", "Scan to pair"),
        approval: text("等待电视确认", "TV approval required"),
        connecting: text("正在连接", "Connecting"),
        disconnected: text(
          "连接已结束，请重新配对",
          "Disconnected; pair again",
        ),
        expired: text("二维码已过期，请重新配对", "QR expired; pair again"),
        error: text("安全连接失败，请重试", "Secure connection failed; retry"),
        config: text(
          "未配置 HTTPS 配对服务和手机页面",
          "HTTPS relay and phone page are not configured",
        ),
      } as Record<string, string>
    )[status] ?? text("手机手势控制", "Phone gesture control");
  return (
    <>
      <RemotePointerCursor active={status === "connected" && !panel} />
      {!story && (
        <div className="tv-input-tools">
          <button
            ref={opener}
            type="button"
            data-gesture-id="tv-mobile-connect"
            title={statusText}
            aria-label={statusText}
            onClick={() => {
              setPanel(true);
              if (!connected.current) void connect();
            }}
          >
            <Smartphone size={20} />
            <span>
              {connected.current
                ? text("手机已连接", "Phone connected")
                : text("连接手机", "Connect phone")}
            </span>
          </button>
          <button
            type="button"
            data-gesture-id="tv-rotate-mode"
            aria-pressed={rotationMode}
            title={text("遥控旋转模式", "Remote rotation mode")}
            aria-label={text("遥控旋转模式", "Remote rotation mode")}
            disabled={
              !state.selected ||
              !isPlanetAtlasVisible(state) ||
              state.transitioning
            }
            onClick={() => {
              if (state.selected) setPlanetAutoRotate(state.selected, false);
              setRotationMode((value) => !value);
              clearRemoteInput();
            }}
          >
            <RotateCw size={20} />
          </button>
          {rotationMode && (
            <>
              <button
                title={text("缩小", "Zoom out")}
                aria-label={text("缩小", "Zoom out")}
                onClick={() => applyInputAction("ZOOM", { delta: -0.08 }, "tv")}
              >
                <Minus size={20} />
              </button>
              <button
                title={text("放大", "Zoom in")}
                aria-label={text("放大", "Zoom in")}
                onClick={() => applyInputAction("ZOOM", { delta: 0.08 }, "tv")}
              >
                <Plus size={20} />
              </button>
              <button
                title={text("停止旋转", "Stop rotation")}
                aria-label={text("停止旋转", "Stop rotation")}
                onClick={() => {
                  setRotationMode(false);
                  clearRemoteInput();
                }}
              >
                <Pause size={20} />
              </button>
            </>
          )}
        </div>
      )}
      {panel && (
        <div className="tv-connection-backdrop">
          <div
            className="tv-connection-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={text("手机手势配对", "Phone gesture pairing")}
          >
            <button
              className="tv-connection-close"
              aria-label={text("关闭", "Close")}
              onClick={() => {
                if (!connected.current) disconnect();
                closePanel();
              }}
            >
              <X size={24} />
            </button>
            <h2>{text("手机手势控制", "Phone gesture control")}</h2>
            <p role="status">{statusText}</p>
            {qr && (
              <>
                <img
                  className="tv-pair-code"
                  src={qr}
                  alt={text("临时配对二维码", "Temporary pairing QR code")}
                />
                <p>
                  {text("二维码有效时间", "QR expires in")} {seconds}s
                </p>
              </>
            )}
            {requestId && (
              <div className="tv-pair-actions">
                <button
                  onClick={() => {
                    if (client.current?.confirm(requestId, true))
                      setRequestId(null);
                  }}
                >
                  <Check size={20} />
                  {text("允许这部手机", "Allow this phone")}
                </button>
                <button
                  onClick={() => {
                    client.current?.confirm(requestId, false);
                    disconnect();
                  }}
                >
                  <X size={20} />
                  {text("拒绝", "Decline")}
                </button>
              </div>
            )}
            {connected.current ? (
              <button
                onClick={() => {
                  disconnect();
                  closePanel();
                }}
              >
                <Link2Off size={20} />
                {text("断开手机", "Disconnect phone")}
              </button>
            ) : (
              !requestId && (
                <button onClick={() => void connect()}>
                  {text("重新配对", "Pair again")}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
