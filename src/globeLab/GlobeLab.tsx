import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Cartesian3,
  Color,
  Ion,
  PerspectiveFrustum,
  SceneTransforms,
  Viewer,
} from "cesium";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CircleX,
  Focus,
  Globe2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  SkipForward,
  View,
} from "lucide-react";
import {
  HandTrackingManager,
  handTracking,
} from "../gesture/HandTrackingManager";
import type { EarthViewHandoff } from "../scene/earthViewHandoff";
import type { WorldCameraPose } from "./cameraPose";
import { isBackKey } from "../platform/tvNavigation";
import { useSolaris } from "../interaction/store";
import {
  immersiveSites,
  type ImmersiveHotspot,
} from "../exploration/immersiveCatalog";
import { GlobeGestureBridge } from "./GlobeGestureBridge";
import {
  earthProviderConfig,
  loadEarthProvider,
  type EarthProviderBundle,
} from "./earthProvider";
import { GlobeHotspots } from "./GlobeHotspots";
import { GlobeStoryPanel } from "./GlobeStoryPanel";
import {
  GlobeCameraActions,
  type GlobeCameraStatus,
} from "./GlobeCameraActions";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./globeLab.css";

Ion.defaultAccessToken = "";
const beijingHotspots = immersiveSites.find(
  (site) => site.id === "beijing",
)!.hotspots;

export interface GlobeLabProps {
  embedded?: boolean;
  initialView?: EarthViewHandoff;
  onReady?: (ready: boolean) => void;
  onBack?: () => void;
  onPoseChange?: (pose: WorldCameraPose) => void;
}

export function GlobeLab(props: GlobeLabProps = {}) {
  const callbacks = useRef(props);
  callbacks.current = props;
  const container = useRef<HTMLDivElement>(null);
  const actions = useRef<GlobeCameraActions | null>(null);
  const manager = useRef<HandTrackingManager | null>(null);
  const gestureBridge = useRef<GlobeGestureBridge | null>(null);
  const pointerActive = useRef(false);
  const flightFocus = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  const readyRef = useRef(false);
  const storyRef = useRef<ImmersiveHotspot | null>(null);
  const focusedRef = useRef<string | null>(null);
  const [story, setStory] = useState<ImmersiveHotspot | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [globeViewer, setGlobeViewer] = useState<Viewer | null>(null);
  const [provider, setProvider] = useState<EarthProviderBundle | null>(null);
  const [dataError, setDataError] = useState("");
  const [status, setStatus] = useState<GlobeCameraStatus | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [viewMode, setViewMode] = useState(false);
  const viewModeRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const tracking = useSolaris();
  useEffect(() => {
    if (props.embedded)
      setCameraOn(["online", "seeking", "loading"].includes(tracking.tracking));
  }, [props.embedded, tracking.tracking]);

  function focusHotspot(id: string | null) {
    focusedRef.current = id;
    setFocusedId(id);
  }

  function openStory(hotspot: ImmersiveHotspot) {
    const controls = actions.current;
    if (!controls?.enabled || storyRef.current) return;
    controls.flight.takeover();
    controls.endDrag();
    controls.enabled = false;
    storyRef.current = hotspot;
    gestureBridge.current?.reset();
    focusHotspot(hotspot.id);
    setStory(hotspot);
    setStatus(controls.status());
  }

  function closeStory() {
    if (!storyRef.current) return false;
    const id = storyRef.current.id;
    storyRef.current = null;
    setStory(null);
    gestureBridge.current?.reset();
    if (actions.current) actions.current.enabled = readyRef.current;
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-hotspot-id="${id}"]`)
        ?.focus();
    });
    return true;
  }

  function cancelFlight() {
    gestureBridge.current?.reset();
    const controls = actions.current;
    if (!controls?.cancelFlight()) return false;
    restoreFocus.current = true;
    setStatus(controls.status());
    return true;
  }

  useEffect(() => {
    if (status?.mode !== "MANUAL" || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (flightFocus.current?.isConnected) flightFocus.current.focus();
  }, [status?.mode]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let failed = false;
    let viewer: Viewer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let cleanupInputs = () => {};
    let cleanupContext = () => {};
    let cleanupResources = () => {};
    let releaseInputSink = () => {};
    const loading = new AbortController();
    setStatus(null);
    readyRef.current = false;
    callbacks.current.onReady?.(false);
    setError("");
    setDataError("");
    setProvider(null);
    storyRef.current = null;
    setStory(null);

    const start = async () => {
      try {
        const config = earthProviderConfig(location.search, {
          VITE_CESIUM_ION_READ_TOKEN: import.meta.env
            .VITE_CESIUM_ION_READ_TOKEN,
        });
        const bundle = await Promise.race([
          loadEarthProvider(
            config,
            import.meta.env.BASE_URL,
            undefined,
            loading.signal,
          ),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => {
              loading.abort();
              reject(
                new Error(
                  "地图资源加载超时；未连接成功，请重试或检查资源权限与网络。",
                ),
              );
            }, 30_000);
          }),
        ]);
        if (timeout) clearTimeout(timeout);
        if (disposed) return;
        viewer = new Viewer(element, {
          baseLayer: false,
          baseLayerPicker: false,
          terrainProvider: bundle.terrain,
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          skyBox: props.embedded ? false : undefined,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
          contextOptions: {
            webgl: { preserveDrawingBuffer: config.mode === "local" },
          },
        });
        viewer.imageryLayers.addImageryProvider(bundle.imagery);
        if (props.embedded)
          viewer.scene.backgroundColor = Color.fromCssColorString("#020204");
        viewer.scene.globe.maximumScreenSpaceError = 3;
        viewer.resolutionScale = Math.min(1, 1.5 / window.devicePixelRatio);
        setProvider(bundle);
        setGlobeViewer(viewer);
        const controls = new GlobeCameraActions(viewer, {
          minimumHeight: bundle.minimumHeight,
          terrain: bundle.mode === "ion",
          initialPose: props.initialView?.pose,
        });
        const matchFrustum = () => {
          if (
            !props.initialView ||
            !viewer ||
            !(viewer.camera.frustum instanceof PerspectiveFrustum)
          )
            return;
          const aspect = viewer.canvas.clientWidth / viewer.canvas.clientHeight;
          const fov =
            aspect > 1
              ? 2 *
                Math.atan(Math.tan(props.initialView.verticalFov / 2) * aspect)
              : props.initialView.verticalFov;
          if (Math.abs((viewer.camera.frustum.fov ?? 0) - fov) > 1e-8) {
            viewer.camera.frustum.fov = fov;
            viewer.scene.requestRender();
          }
        };
        matchFrustum();
        controls.enabled = false;
        actions.current = controls;
        const bridge = new GlobeGestureBridge({
          beginDrag: (x, y) => controls.beginDrag(x, y),
          dragTo: (x, y) => controls.dragTo(x, y),
          endDrag: () => controls.endDrag(),
          zoom: (amount, x, y) => controls.zoom(amount, x, y),
          cancelFlight: () => {
            if (!closeStory() && !cancelFlight()) callbacks.current.onBack?.();
          },
          isNavigationBlocked: () => !!storyRef.current || !controls.enabled,
          pointerHover: (x, y) => {
            const button = document
              .elementFromPoint(x * window.innerWidth, y * window.innerHeight)
              ?.closest<HTMLElement>("[data-hotspot-id]");
            focusHotspot(button?.dataset.hotspotId ?? null);
          },
          activateAt: (x, y) => {
            const button = document
              .elementFromPoint(x * window.innerWidth, y * window.innerHeight)
              ?.closest<HTMLElement>("[data-hotspot-id]");
            const hotspot = beijingHotspots.find(
              (entry) => entry.id === button?.dataset.hotspotId,
            );
            if (hotspot) openStory(hotspot);
          },
        });
        gestureBridge.current = bridge;
        const inputSink = {
          update: (frame) =>
            pointerActive.current ? bridge.reset() : bridge.update(frame),
          reset: () => bridge.reset(),
        } satisfies ConstructorParameters<typeof HandTrackingManager>[1];
        if (props.embedded) {
          manager.current = handTracking;
          releaseInputSink = handTracking.useInputSink(inputSink);
        } else {
          manager.current = new HandTrackingManager({}, inputSink);
        }
        let frameCount = 0;
        let readyFrame = false;
        viewer.scene.postRender.addEventListener(() => {
          matchFrustum();
          frameCount++;
          if (viewer?.scene.globe.tilesLoaded) readyFrame = true;
        });
        const publish = () => {
          if (disposed || failed || !readyFrame) return;
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          controls.enabled = !storyRef.current;
          readyRef.current = true;
          callbacks.current.onReady?.(true);
          controls.enforceTerrainClearance();
          callbacks.current.onPoseChange?.(controls.capture());
          setStatus(controls.status());
        };
        timeout = setTimeout(() => {
          failed = true;
          readyRef.current = false;
          callbacks.current.onReady?.(false);
          controls.enabled = false;
          setStatus(null);
          setError("地球首帧未能完成加载");
        }, 30_000);
        const resourceFailed = () => {
          if (!disposed)
            setDataError(
              "地图瓦片加载异常：当前清晰度/覆盖未通过；请检查网络、权限与配额后重试。",
            );
        };
        const removeImageryError =
          bundle.imagery.errorEvent.addEventListener(resourceFailed);
        const removeTerrainError =
          bundle.terrain.errorEvent.addEventListener(resourceFailed);
        cleanupResources = () => {
          removeImageryError();
          removeTerrainError();
        };
        viewer.scene.renderError.addEventListener(() => {
          failed = true;
          readyRef.current = false;
          callbacks.current.onReady?.(false);
          controls.flight.takeover();
          controls.enabled = false;
          if (!props.embedded) manager.current?.stop();
          setCameraOn(false);
          setStatus(null);
          setError("地球渲染失败");
        });
        timer = setInterval(publish, 150);
        publish();
        viewer.scene.requestRender();

        const canvas = viewer.canvas;
        let activePointer: number | null = null;
        const point = (event: PointerEvent | WheelEvent) => {
          const box = canvas.getBoundingClientRect();
          return {
            x: (event.clientX - box.left) / box.width,
            y: (event.clientY - box.top) / box.height,
          };
        };
        const down = (event: PointerEvent) => {
          if (event.button !== 0 || activePointer !== null || storyRef.current)
            return;
          const p = point(event);
          bridge.reset();
          controls.endDrag();
          pointerActive.current = true;
          activePointer = event.pointerId;
          canvas.setPointerCapture(event.pointerId);
          controls.beginDrag(p.x, p.y);
        };
        const move = (event: PointerEvent) => {
          if (event.pointerId !== activePointer) return;
          const p = point(event);
          controls.dragTo(p.x, p.y);
        };
        const up = (event: PointerEvent) => {
          if (event.pointerId !== activePointer) return;
          controls.endDrag();
          activePointer = null;
          pointerActive.current = false;
          if (canvas.hasPointerCapture(event.pointerId))
            canvas.releasePointerCapture(event.pointerId);
        };
        const wheel = (event: WheelEvent) => {
          event.preventDefault();
          if (storyRef.current) return;
          const p = point(event);
          bridge.reset();
          controls.endDrag();
          controls.zoom(-event.deltaY * 0.001, p.x, p.y);
        };
        const blur = () => {
          controls.endDrag();
          activePointer = null;
          pointerActive.current = false;
          bridge.reset();
        };
        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", up);
        canvas.addEventListener("lostpointercapture", blur);
        canvas.addEventListener("wheel", wheel, { passive: false });
        window.addEventListener("blur", blur);
        cleanupInputs = () => {
          canvas.removeEventListener("pointerdown", down);
          canvas.removeEventListener("pointermove", move);
          canvas.removeEventListener("pointerup", up);
          canvas.removeEventListener("pointercancel", up);
          canvas.removeEventListener("lostpointercapture", blur);
          canvas.removeEventListener("wheel", wheel);
          window.removeEventListener("blur", blur);
        };
        const lost = (event: Event) => {
          event.preventDefault();
          failed = true;
          readyRef.current = false;
          callbacks.current.onReady?.(false);
          controls.flight.takeover();
          controls.enabled = false;
          if (!props.embedded) manager.current?.stop();
          setCameraOn(false);
          setStatus(null);
          setError("图形上下文已丢失");
        };
        canvas.addEventListener("webglcontextlost", lost);
        cleanupContext = () =>
          canvas.removeEventListener("webglcontextlost", lost);
        if (new URLSearchParams(location.search).get("qa") === "1") {
          Object.assign(window, {
            __SOLARIS_GLOBE_LAB: {
              status: () => ({
                ...controls.status(),
                frameCount,
                minimumHeight: controls.minimumHeight,
                provider: bundle.mode,
                storyId: storyRef.current?.id ?? null,
                focusedId: focusedRef.current,
                initialView: props.initialView,
                frustum:
                  viewer!.camera.frustum instanceof PerspectiveFrustum
                    ? {
                        fov: viewer!.camera.frustum.fovy,
                        aspect: viewer!.camera.frustum.aspectRatio,
                      }
                    : null,
              }),
              capture: () => controls.capture(),
              pick: (x: number, y: number) => {
                const value = controls.pick(x, y);
                return value ? [value.x, value.y, value.z] : null;
              },
              project: (point: [number, number, number]) => {
                const screen = SceneTransforms.worldToWindowCoordinates(
                  viewer!.scene,
                  new Cartesian3(...point),
                );
                return screen
                  ? {
                      x: screen.x / canvas.clientWidth,
                      y: screen.y / canvas.clientHeight,
                    }
                  : null;
              },
              gestureFrame: (
                frame: Parameters<GlobeGestureBridge["update"]>[0],
              ) =>
                pointerActive.current ? bridge.reset() : bridge.update(frame),
            },
          });
        }
      } catch (reason) {
        if (timeout) clearTimeout(timeout);
        if (disposed) return;
        actions.current = null;
        callbacks.current.onReady?.(false);
        setError(reason instanceof Error ? reason.message : "地球视图未能启动");
      }
    };
    void start();
    return () => {
      disposed = true;
      loading.abort();
      if (timeout) clearTimeout(timeout);
      if (timer) clearInterval(timer);
      cleanupInputs();
      cleanupContext();
      cleanupResources();
      if (actions.current && viewer && !viewer.isDestroyed())
        callbacks.current.onPoseChange?.(actions.current.capture());
      releaseInputSink();
      if (!props.embedded) manager.current?.stop();
      manager.current = null;
      gestureBridge.current = null;
      pointerActive.current = false;
      actions.current?.flight.takeover();
      actions.current = null;
      readyRef.current = false;
      callbacks.current.onReady?.(false);
      setGlobeViewer(null);
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      Reflect.deleteProperty(window, "__SOLARIS_GLOBE_LAB");
    };
  }, [attempt]);

  useEffect(() => {
    const back = () => {
      if (closeStory()) return true;
      if (cancelFlight()) return true;
      if (viewModeRef.current) {
        setViewMode(false);
        return true;
      }
      if (callbacks.current.onBack) {
        callbacks.current.onBack();
        return true;
      }
      return false;
    };
    const nativeBack = (event: Event) => {
      if (event.defaultPrevented) return;
      if (back()) event.preventDefault();
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.repeat && (event.key === "Enter" || isBackKey(event))) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (isBackKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        back();
        return;
      }
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      if (storyRef.current) return;
      if (!viewModeRef.current) {
        if (!event.key.startsWith("Arrow")) return;
        const items = [
          ...document.querySelectorAll<HTMLButtonElement>(
            ".lab-control:not(:disabled),.globe-hotspot-hit:not(:disabled)",
          ),
        ];
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const delta =
          event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        items[(index + delta + items.length) % items.length]?.focus();
        event.preventDefault();
        return;
      }
      const controls = actions.current;
      if (!controls) return;
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "+",
          "=",
          "-",
          "PageUp",
          "PageDown",
        ].includes(event.key)
      ) {
        gestureBridge.current?.reset();
        controls.endDrag();
      }
      switch (event.key) {
        case "ArrowLeft":
          controls.pan(-0.035, 0);
          break;
        case "ArrowRight":
          controls.pan(0.035, 0);
          break;
        case "ArrowUp":
          controls.pan(0, -0.035);
          break;
        case "ArrowDown":
          controls.pan(0, 0.035);
          break;
        case "+":
        case "=":
          controls.zoom(0.12);
          break;
        case "-":
          controls.zoom(-0.12);
          break;
        case "PageUp":
          controls.tilt(0.08);
          break;
        case "PageDown":
          controls.tilt(-0.08);
          break;
        case "Enter":
          setViewMode(false);
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("solaris-back", nativeBack);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("solaris-back", nativeBack);
    };
  }, []);

  const ready = !!status && !error;
  const flying = status?.mode === "AUTO_FLIGHT";
  const command = (run: (controls: GlobeCameraActions) => void) => {
    const controls = actions.current;
    if (!controls || storyRef.current) return;
    gestureBridge.current?.reset();
    controls.endDrag();
    run(controls);
    setStatus(controls.status());
  };
  const camera = async () => {
    if (cameraOn) {
      manager.current?.stop();
      setCameraOn(false);
      return;
    }
    setCameraOn(true);
    await manager.current?.start();
  };
  return (
    <section
      className="globe-lab"
      data-ready={ready}
      data-mode={status?.mode ?? "LOADING"}
      data-input={viewMode ? "view" : "ui"}
      data-provider={provider?.mode ?? "unconnected"}
    >
      <div className="globe-stage" ref={container} />
      <GlobeHotspots
        viewer={globeViewer}
        hotspots={beijingHotspots}
        enabled={ready && !flying}
        activeId={story?.id ?? null}
        focusedId={focusedId}
        onFocus={focusHotspot}
        onActivate={openStory}
        language="zh"
        scaleLimits={
          provider?.mode === "ion"
            ? { showBelow: 140, hideAbove: 200 }
            : { showBelow: 1000, hideAbove: 1300 }
        }
      />
      <header className="lab-bar">
        {props.embedded ? (
          <button
            className="lab-back"
            title="返回太阳系"
            aria-label="返回太阳系"
            onClick={() => callbacks.current.onBack?.()}
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <a
            className="lab-back"
            href={import.meta.env.BASE_URL}
            title="返回太阳系"
            aria-label="返回太阳系"
          >
            <ArrowLeft size={20} />
          </a>
        )}
        <div className="lab-brand">
          <strong>SOLARIS</strong>
          <span>
            {props.embedded ? "地球 · 公开测试版" : "地球探索预览 · 测试版"}
          </span>
        </div>
        <nav className="lab-tools" aria-label="地球导航">
          <button
            className="lab-control lab-destination"
            disabled={!ready || flying}
            onClick={(event) => {
              flightFocus.current = event.currentTarget;
              command((c) => {
                c.flyToBeijing();
              });
            }}
            title="飞向北京"
            aria-label="飞向北京"
          >
            <MapPin size={18} />
            <span>北京</span>
          </button>
          <button
            className="lab-control"
            disabled={!ready}
            onClick={() => command((c) => c.home())}
            title="整球视图"
            aria-label="整球视图"
          >
            <Globe2 size={20} />
          </button>
          <button
            className="lab-control"
            disabled={!ready}
            onClick={() => command((c) => c.zoom(0.12))}
            title="接近"
            aria-label="接近"
          >
            <Plus size={20} />
          </button>
          <button
            className="lab-control"
            disabled={!ready}
            onClick={() => command((c) => c.zoom(-0.12))}
            title="远离"
            aria-label="远离"
          >
            <Minus size={20} />
          </button>
          <button
            className="lab-control"
            disabled={!ready}
            onClick={() => command((c) => c.tilt(0.08))}
            title="倾斜观察"
            aria-label="倾斜观察"
          >
            <View size={20} />
          </button>
          <button
            className="lab-control"
            disabled={!ready}
            aria-pressed={viewMode}
            onClick={() => setViewMode(!viewMode)}
            title={viewMode ? "视角模式" : "界面模式"}
            aria-label="遥控视角模式"
          >
            <Focus size={20} />
          </button>
          <button
            className="lab-control"
            disabled={!ready}
            aria-pressed={cameraOn}
            onClick={() => void camera()}
            title={cameraOn ? "关闭摄像头" : "连接摄像头"}
            aria-label={cameraOn ? "关闭摄像头" : "连接摄像头"}
          >
            {cameraOn ? <CameraOff size={20} /> : <Camera size={20} />}
          </button>
        </nav>
      </header>
      {flying && (
        <div className="lab-flight" role="status">
          <span>飞向北京</span>
          <button
            className="lab-control"
            onClick={cancelFlight}
            title="取消飞行"
            aria-label="取消飞行"
          >
            <CircleX size={20} />
          </button>
          <button
            className="lab-control"
            onClick={() =>
              command((c) => {
                c.skipFlight();
              })
            }
            title="跳过飞行"
            aria-label="跳过飞行"
          >
            <SkipForward size={20} />
          </button>
        </div>
      )}
      {!ready && (
        <section className="lab-loading" role="status">
          <p>{error || "加载地球资源"}</p>
          {error && (
            <button
              className="lab-control lab-retry"
              onClick={() => setAttempt(attempt + 1)}
            >
              <RefreshCw size={18} />
              重试
            </button>
          )}
        </section>
      )}
      {story && (
        <GlobeStoryPanel
          key={story.id}
          hotspot={story}
          language="zh"
          onClose={closeStory}
          restoreFocus={false}
        />
      )}
      {dataError && (
        <div className="lab-data-error" role="alert">
          {dataError}
          <button
            className="lab-control"
            aria-label="重试地图资源"
            title="重试地图资源"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      )}
      <footer className="lab-status">
        <span>
          {status
            ? `${status.latitude.toFixed(2)}° / ${status.longitude.toFixed(2)}° · ${(status.height / 1000).toFixed(0)} km`
            : "地球"}
        </span>
        <span className="lab-coverage">
          {provider?.coverage ?? "真实数据未连接"}
        </span>
        {status?.atBoundary && (
          <span className="lab-boundary">
            {provider?.mode === "ion"
              ? "已达导航安全下限；数据原始分辨率待实测"
              : "本地基础数据观察边界：250 km"}
          </span>
        )}
        {viewMode && <span className="lab-mode">视角模式</span>}
        {cameraOn && (
          <span>
            {tracking.cameraError ||
              (tracking.tracking === "loading"
                ? "识别启动中"
                : tracking.tracking === "unavailable"
                  ? "摄像头不可用"
                  : "手势输入已连接")}
          </span>
        )}
      </footer>
    </section>
  );
}

export function mountGlobeLab() {
  createRoot(document.getElementById("root")!).render(<GlobeLab />);
}
