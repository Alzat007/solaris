import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CameraOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  Link,
  Move,
  MousePointer2,
  Square,
  Unlink,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { RelayClient, type RelayEvent } from "../remote/RelayClient";
import {
  controllerActionStarted,
  handleControllerRelayError,
} from "../remote/controllerRelayErrors";
import {
  validateRelayServiceUrl,
  type RemoteAction,
  type RemotePayload,
  type RemoteViewState,
} from "../remote/controlProtocol";
import { store } from "../interaction/store";
import {
  RemoteGestureSink,
  type RemoteGestureFeedback,
} from "./RemoteGestureSink";
import {
  ControllerCameraSession,
  controllerCameraConstraints,
  CONTROLLER_CAMERA_FPS,
  type ControllerCameraPhase,
} from "./ControllerCameraSession";
import type { ControllerEntry } from "./controllerEntry";
import { controllerPreviewPoint } from "./controllerPreviewGeometry";
import { ControllerTouchRotation } from "./ControllerTouchRotation";
import "./controller.css";

type LinkPhase =
  | "unconfigured"
  | "unpaired"
  | "connecting"
  | "approval"
  | "connected"
  | "closed"
  | "error";
type PadMode = "pointer" | "rotate";
const labels = {
  zh: {
    control: "控制器",
    connect: "连接电视",
    disconnect: "断开连接",
    start: "开启摄像头",
    stopCamera: "关闭摄像头",
    cameraOff: "摄像头未开启",
    cameraLoading: "正在连接摄像头",
    cameraOn: "本机识别中",
    cameraError: "摄像头不可用",
    pointer: "指向",
    rotate: "旋转",
    confirm: "确认",
    back: "返回",
    stop: "停止",
    previous: "上一张图片",
    next: "下一张图片",
    zoomIn: "放大",
    zoomOut: "缩小",
    language: "English",
    target: "当前目标",
    noTarget: "无目标",
    left: "左",
    right: "右",
    up: "上",
    down: "下",
    link: {
      unconfigured: "连接服务未配置",
      unpaired: "未配对",
      connecting: "连接中",
      approval: "等待电视确认",
      connected: "已连接",
      closed: "已断开",
      error: "连接失败",
    },
    gesture: {
      idle: "等待手势",
      ready: "已就绪",
      point: "指向",
      locking: "锁定目标",
      confirm: "已发送确认",
      rotate: "旋转",
      zoom: "缩放",
      back: "返回",
    },
  },
  en: {
    control: "Controller",
    connect: "Connect TV",
    disconnect: "Disconnect",
    start: "Start camera",
    stopCamera: "Stop camera",
    cameraOff: "Camera off",
    cameraLoading: "Connecting camera",
    cameraOn: "Local tracking",
    cameraError: "Camera unavailable",
    pointer: "Pointer",
    rotate: "Rotate",
    confirm: "Confirm",
    back: "Back",
    stop: "Stop",
    previous: "Previous image",
    next: "Next image",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    language: "中文",
    target: "Current target",
    noTarget: "No target",
    left: "Left",
    right: "Right",
    up: "Up",
    down: "Down",
    link: {
      unconfigured: "Relay not configured",
      unpaired: "Not paired",
      connecting: "Connecting",
      approval: "Waiting for TV approval",
      connected: "Connected",
      closed: "Disconnected",
      error: "Connection failed",
    },
    gesture: {
      idle: "Waiting for gesture",
      ready: "Ready",
      point: "Pointer",
      locking: "Locking target",
      confirm: "Confirmation sent",
      rotate: "Rotate",
      zoom: "Zoom",
      back: "Back",
    },
  },
} as const;

export function ControllerApp({ entry }: { entry: ControllerEntry }) {
  const [language, setLanguage] = useState<"zh" | "en">(entry.language);
  const [linkPhase, setLinkPhase] = useState<LinkPhase>(
    entry.serviceUrl ? "unpaired" : "unconfigured",
  );
  const [view, setView] = useState<RemoteViewState | null>(null);
  const [cameraPhase, setCameraPhase] = useState<ControllerCameraPhase>("off");
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });
  const [feedback, setFeedback] = useState<RemoteGestureFeedback>({
    status: "idle",
    progress: 0,
    pointer: null,
  });
  const [padMode, setPadMode] = useState<PadMode>("pointer");
  const [padPoint, setPadPoint] = useState({ x: 0.5, y: 0.5 });
  const client = useRef<RelayClient | null>(null);
  const pairing = useRef(entry.pairing);
  const connected = useRef(false);
  const errorRecovery = useRef({ stopPending: false });
  const currentView = useRef<RemoteViewState | null>(null);
  const videoHost = useRef<HTMLDivElement>(null);
  const videoSizeCleanup = useRef<(() => void) | null>(null);
  const touch = useRef<{
    id: number;
    x: number;
    y: number;
    rotation: ControllerTouchRotation | null;
  } | null>(null);
  const text = labels[language];
  const sink = useMemo(
    () =>
      new RemoteGestureSink({
        send: (action, payload) => {
          controllerActionStarted(errorRecovery.current, action);
          return client.current?.sendAction(action, payload) ?? false;
        },
        feedback: setFeedback,
      }),
    [],
  );
  const camera = useMemo(
    () =>
      new ControllerCameraSession(
        async () => {
          const { HandTrackingManager } = await import(
            "../gesture/HandTrackingManager"
          );
          return new HandTrackingManager(
            {
              requestStream: () => {
                if (!navigator.mediaDevices?.getUserMedia)
                  throw new Error("Camera unavailable.");
                return navigator.mediaDevices.getUserMedia(
                  controllerCameraConstraints(),
                );
              },
              frameIntervalMs: 1000 / CONTROLLER_CAMERA_FPS,
            },
            { update: () => {}, reset: () => {} },
          );
        },
        sink,
        {
          phase: setCameraPhase,
          video: (video) => {
            videoSizeCleanup.current?.();
            videoSizeCleanup.current = null;
            videoHost.current?.replaceChildren();
            if (video && videoHost.current) {
              const updateSize = () =>
                setVideoSize({
                  width: video.videoWidth,
                  height: video.videoHeight,
                });
              updateSize();
              video.addEventListener("resize", updateSize);
              videoSizeCleanup.current = () =>
                video.removeEventListener("resize", updateSize);
              video.setAttribute("aria-hidden", "true");
              videoHost.current.append(video);
            }
          },
        },
      ),
    [sink],
  );

  const syncContext = () =>
    sink.setContext(connected.current && !touch.current, currentView.current);
  const clearConnection = () => {
    camera.stop();
    sink.setContext(false, null);
    connected.current = false;
    currentView.current = null;
    touch.current = null;
    setView(null);
  };
  const onRelayEvent = (event: RelayEvent) => {
    if (event.type === "connected") {
      connected.current = true;
      errorRecovery.current.stopPending = false;
      setLinkPhase("connected");
      syncContext();
    } else if (event.type === "waiting-approval") setLinkPhase("approval");
    else if (event.type === "state") {
      const previous = currentView.current;
      const boundary =
        previous?.mode !== event.state.mode ||
        previous?.selected !== event.state.selected ||
        (previous?.available.join(",") ?? "") !==
          event.state.available.join(",");
      if (boundary && touch.current) {
        touch.current = null;
        client.current?.sendAction("ROTATE_END");
        client.current?.sendAction("STOP");
      }
      currentView.current = event.state;
      setView(event.state);
      syncContext();
    } else if (event.type === "error") {
      handleControllerRelayError(
        event.code,
        connected.current,
        {
          stopContinuousInput: () => {
            touch.current = null;
            sink.reset();
            syncContext();
          },
          sendStop: () => {
            client.current?.sendAction("STOP");
          },
          disconnect: () => {
            client.current?.disconnect();
            clearConnection();
            setLinkPhase("error");
          },
        },
        errorRecovery.current,
      );
    } else if (event.type === "closed") {
      clearConnection();
      setLinkPhase("closed");
    }
  };

  useEffect(() => {
    const stop = () => {
      client.current?.sendAction("STOP");
      camera.stop();
      client.current?.disconnect();
      clearConnection();
      pairing.current = null;
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    const unsubscribe = store.subscribe(() => {
      if (camera.phase === "on" && store.get().tracking === "unavailable")
        camera.stop(true);
    });
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", stop);
      unsubscribe();
      stop();
    };
  }, [camera, sink]);

  const allowed = (action: RemoteAction) =>
    linkPhase === "connected" &&
    (action === "STOP" || !!view?.available.includes(action));
  const send = (action: RemoteAction, payload?: RemotePayload) => {
    if (
      !connected.current ||
      (action !== "STOP" && !currentView.current?.available.includes(action))
    )
      return false;
    controllerActionStarted(errorRecovery.current, action);
    return client.current?.sendAction(action, payload) ?? false;
  };
  const discrete = (action: RemoteAction, payload?: RemotePayload) => {
    sink.reset();
    send(action, payload);
  };
  const confirm = () => {
    const target = currentView.current?.focusTarget;
    if (target) discrete("SELECT", { expectedTargetId: target.id });
  };
  const connect = async () => {
    const claim = pairing.current;
    if (
      !claim ||
      !entry.serviceUrl ||
      ["connecting", "approval", "connected"].includes(linkPhase)
    )
      return;
    pairing.current = null;
    setLinkPhase("connecting");
    try {
      validateRelayServiceUrl(entry.serviceUrl);
      const next = new RelayClient({
        role: "controller",
        serviceUrl: entry.serviceUrl,
        onEvent: onRelayEvent,
      });
      client.current = next;
      await next.pair(claim.sessionId, claim.claimToken);
    } catch {
      clearConnection();
      setLinkPhase("error");
    }
  };
  const disconnect = () => {
    send("STOP");
    camera.stop();
    client.current?.disconnect();
    clearConnection();
    setLinkPhase("closed");
  };
  const finishTouch = () => {
    if (touch.current) {
      if (padMode === "rotate") {
        send("ROTATE_END");
        send("STOP");
      }
    }
    touch.current = null;
    syncContext();
  };
  const padPosition = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    };
  };
  const startTouch = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      !allowed(padMode === "rotate" ? "ROTATE_START" : "POINTER")
    )
      return;
    const point = padPosition(event);
    touch.current = {
      id: event.pointerId,
      ...point,
      rotation: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    syncContext();
    setPadPoint(point);
    if (padMode === "rotate")
      touch.current.rotation = new ControllerTouchRotation(
        point,
        performance.now(),
        send,
      );
    else send("POINTER", point);
  };
  const moveTouch = (event: PointerEvent<HTMLDivElement>) => {
    const previous = touch.current;
    if (!previous || previous.id !== event.pointerId) return;
    const point = padPosition(event);
    setPadPoint(point);
    if (padMode === "rotate") {
      previous.rotation?.move(point, performance.now());
    } else send("POINTER", point);
    previous.x = point.x;
    previous.y = point.y;
  };
  const cameraLabel =
    cameraPhase === "on"
      ? text.cameraOn
      : cameraPhase === "loading"
        ? text.cameraLoading
        : cameraPhase === "error"
          ? text.cameraError
          : text.cameraOff;
  const previewPointer = feedback.pointer
    ? controllerPreviewPoint(
        feedback.pointer,
        videoSize.width,
        videoSize.height,
      )
    : null;

  return (
    <main className="controller-shell">
      <header className="controller-header">
        <div>
          <strong>SOLARIS</strong>
          <span>{text.control}</span>
        </div>
        <button
          type="button"
          className="controller-icon"
          aria-label={text.language}
          title={text.language}
          onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
        >
          <Globe size={20} />
          <small>{language === "zh" ? "EN" : "中"}</small>
        </button>
      </header>
      <div className="controller-content">
        <section className="controller-connection" aria-label={text.connect}>
          <div
            className={`controller-status ${linkPhase === "connected" ? "connected" : ""}`}
            role="status"
          >
            <span />
            {text.link[linkPhase]}
          </div>
          <button
            type="button"
            className="controller-command"
            disabled={
              !pairing.current ||
              !entry.serviceUrl ||
              ["connecting", "approval", "connected"].includes(linkPhase)
            }
            onClick={() => void connect()}
          >
            <Link size={18} />
            {text.connect}
          </button>
          {linkPhase === "connected" && (
            <button
              type="button"
              className="controller-icon"
              aria-label={text.disconnect}
              title={text.disconnect}
              onClick={disconnect}
            >
              <Unlink size={19} />
            </button>
          )}
        </section>
        <section className="controller-camera" aria-label={cameraLabel}>
          <div className="controller-video-stage">
            <div ref={videoHost} className="controller-video" />
            {cameraPhase !== "on" && (
              <CameraOff size={34} className="controller-camera-placeholder" />
            )}
            {cameraPhase === "on" && previewPointer && (
              <span
                className="controller-reticle"
                style={{
                  left: `${previewPointer.x * 100}%`,
                  top: `${previewPointer.y * 100}%`,
                }}
              />
            )}
            <div className="controller-camera-status" role="status">
              {cameraLabel}
            </div>
            {cameraPhase === "on" && (
              <div className="controller-gesture-status">
                {text.gesture[feedback.status]}
                <progress value={feedback.progress} max={1} />
              </div>
            )}
          </div>
          <button
            type="button"
            className="controller-command controller-camera-toggle"
            disabled={linkPhase !== "connected" || cameraPhase === "loading"}
            onClick={() => {
              if (cameraPhase === "on") {
                send("STOP");
                camera.stop();
              } else void camera.start();
            }}
          >
            {cameraPhase === "on" ? (
              <CameraOff size={19} />
            ) : (
              <Camera size={19} />
            )}
            {cameraPhase === "on" ? text.stopCamera : text.start}
          </button>
        </section>
        <section className="controller-touch">
          <div className="controller-touch-header">
            <div
              className="controller-mode"
              role="group"
              aria-label={text.control}
            >
              <button
                type="button"
                aria-pressed={padMode === "pointer"}
                onClick={() => {
                  finishTouch();
                  setPadMode("pointer");
                }}
              >
                <MousePointer2 size={17} />
                {text.pointer}
              </button>
              <button
                type="button"
                aria-pressed={padMode === "rotate"}
                onClick={() => {
                  finishTouch();
                  setPadMode("rotate");
                }}
              >
                <Move size={17} />
                {text.rotate}
              </button>
            </div>
            <span className="controller-target">
              <small>{text.target}</small>
              <strong>{view?.focusTarget?.label ?? text.noTarget}</strong>
            </span>
          </div>
          <div
            className={`controller-touchpad ${padMode}`}
            role="application"
            aria-label={padMode === "pointer" ? text.pointer : text.rotate}
            aria-disabled={
              !allowed(padMode === "pointer" ? "POINTER" : "ROTATE_START")
            }
            onPointerDown={startTouch}
            onPointerMove={moveTouch}
            onPointerUp={finishTouch}
            onPointerCancel={finishTouch}
            onLostPointerCapture={finishTouch}
          >
            <span
              className="controller-pad-dot"
              style={{
                left: `${padPoint.x * 100}%`,
                top: `${padPoint.y * 100}%`,
              }}
            />
            <span className="controller-pad-center">
              {padMode === "pointer" ? (
                <MousePointer2 size={23} />
              ) : (
                <Move size={23} />
              )}
            </span>
          </div>
          <div className="controller-tools">
            <button
              type="button"
              className="controller-icon"
              disabled={!allowed("ZOOM")}
              aria-label={text.zoomOut}
              title={text.zoomOut}
              onClick={() => discrete("ZOOM", { delta: -0.08 })}
            >
              <ZoomOut size={23} />
            </button>
            <button
              type="button"
              className="controller-icon"
              disabled={!allowed("PREVIOUS_IMAGE")}
              aria-label={text.previous}
              title={text.previous}
              onClick={() => discrete("PREVIOUS_IMAGE")}
            >
              <ChevronLeft size={25} />
            </button>
            <button
              type="button"
              className="controller-confirm"
              disabled={!allowed("SELECT") || !view?.focusTarget}
              aria-label={text.confirm}
              title={text.confirm}
              onClick={confirm}
            >
              <Check size={26} />
            </button>
            <button
              type="button"
              className="controller-icon"
              disabled={!allowed("NEXT_IMAGE")}
              aria-label={text.next}
              title={text.next}
              onClick={() => discrete("NEXT_IMAGE")}
            >
              <ChevronRight size={25} />
            </button>
            <button
              type="button"
              className="controller-icon"
              disabled={!allowed("ZOOM")}
              aria-label={text.zoomIn}
              title={text.zoomIn}
              onClick={() => discrete("ZOOM", { delta: 0.08 })}
            >
              <ZoomIn size={23} />
            </button>
          </div>
          <div
            className="controller-focus-pad"
            role="group"
            aria-label={text.pointer}
          >
            {(
              [
                ["up", ArrowUp, text.up],
                ["left", ArrowLeft, text.left],
                ["right", ArrowRight, text.right],
                ["down", ArrowDown, text.down],
              ] as const
            ).map(([direction, Icon, label]) => (
              <button
                key={direction}
                type="button"
                className={`controller-icon ${direction}`}
                disabled={!allowed("FOCUS")}
                aria-label={label}
                title={label}
                onClick={() => discrete("FOCUS", { direction })}
              >
                <Icon size={21} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <footer className="controller-footer">
        <button
          type="button"
          className="controller-command"
          disabled={!allowed("BACK")}
          onClick={() => discrete("BACK")}
        >
          <ArrowLeft size={20} />
          {text.back}
        </button>
        <button
          type="button"
          className="controller-stop"
          disabled={linkPhase !== "connected"}
          onClick={() => {
            finishTouch();
            sink.reset();
            send("STOP");
            camera.stop();
          }}
        >
          <Square size={18} fill="currentColor" />
          {text.stop}
        </button>
      </footer>
    </main>
  );
}
