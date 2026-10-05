import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SolarScene } from "../scene/SolarScene";
import { HUD } from "../ui/HUD";
import { GestureDebug } from "../gesture/GestureDebug";
import { store, useSolaris } from "../interaction/store";
import { handTracking } from "../gesture/HandTrackingManager";
import { interaction } from "../interaction/InteractionController";
import {
  installTvNavigation,
  isTvMode,
  isBackKey,
} from "../platform/tvNavigation";
import { earthViewHandoff } from "../scene/earthViewHandoff";
const EarthExplorer = lazy(() =>
  import("../globeLab/embeddedEarth")
    .then((module) => module.loadEmbeddedEarth())
    .then((module) => ({ default: module.GlobeLab })),
);
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error) {
    console.error("SOLARIS scene:", error);
    store.set({ webglError: true });
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}
class EarthBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="earth-loading earth-load-error" role="alert">
        <p>地球探索模块未能加载</p>
        <button onClick={() => interaction.return()}>返回太阳系</button>
        <button onClick={() => location.reload()}>重新加载</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  const { webglError, mode } = useSolaris();
  const exploringEarth = mode === "BODY_EXPLORE";
  const [earthReady, setEarthReady] = useState(false);
  useEffect(() => {
    if (!exploringEarth) setEarthReady(false);
  }, [exploringEarth]);
  useEffect(() => {
    if (!exploringEarth || earthReady) return;
    const back = (event: Event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      interaction.return();
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isBackKey(event)) return;
      if (event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else back(event);
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("solaris-back", back);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("solaris-back", back);
    };
  }, [exploringEarth, earthReady]);
  useEffect(() => () => handTracking.stop(), []);
  useEffect(() => {
    if (!webglError) return;
    if (store.get().mode === "INFO_PANEL_OPEN") interaction.return();
    if (
      ["DESCENT_TRANSITION", "LOCATION_OVERVIEW"].includes(store.get().mode)
    ) {
      interaction.return();
    }
    const timer = setTimeout(
      () =>
        document
          .querySelector<HTMLButtonElement>(".render-error button")
          ?.focus(),
      0,
    );
    return () => clearTimeout(timer);
  }, [webglError]);
  useEffect(() => {
    if (!isTvMode(location.search) || exploringEarth) return;
    document.body.classList.add("tv-mode");
    const dispose = installTvNavigation(
      document.querySelector<HTMLElement>(".solaris-app")!,
      () => interaction.return(),
    );
    return () => {
      dispose();
      document.body.classList.remove("tv-mode");
    };
  }, [exploringEarth]);
  return (
    <main className="solaris-app">
      <div
        className="solar-stage"
        style={{
          visibility: exploringEarth && earthReady ? "hidden" : "visible",
          pointerEvents: exploringEarth ? "none" : "auto",
        }}
        aria-hidden={exploringEarth}
      >
        <SceneBoundary>
          <Suspense
            fallback={
              <div className="loading-universe">
                <i />
                <span>正在汇聚星尘</span>
              </div>
            }
          >
            <SolarScene paused={exploringEarth} />
          </Suspense>
        </SceneBoundary>
      </div>
      {exploringEarth && (
        <div className="earth-stage">
          <EarthBoundary>
            <Suspense
              fallback={
                <div className="earth-loading" role="status">
                  正在连接地球探索
                </div>
              }
            >
              <EarthExplorer
                embedded
                initialView={earthViewHandoff.get() ?? undefined}
                onReady={setEarthReady}
                onPoseChange={earthViewHandoff.updatePose}
                onBack={() => interaction.return()}
              />
            </Suspense>
          </EarthBoundary>
        </div>
      )}
      <div className="film-grain" />
      {!exploringEarth && <HUD />}
      {(new URLSearchParams(location.search).get("debugGesture") === "true" ||
        new URLSearchParams(location.search).get("debug") === "true") && (
        <GestureDebug />
      )}
      {webglError && (
        <div
          className="render-error"
          role="dialog"
          aria-modal="true"
          aria-label="场景恢复"
        >
          <p className="eyebrow">为宇宙，再留一点空间</p>
          <h1>暂时无法呈现宇宙</h1>
          <p>请开启浏览器硬件加速，或使用支持 WebGL 2 的浏览器打开 SOLARIS。</p>
          <button onClick={() => location.reload()}>重新尝试 ↗</button>
        </div>
      )}
    </main>
  );
}
