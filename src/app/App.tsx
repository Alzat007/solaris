import { Component, Suspense, useEffect, type ReactNode } from "react";
import { SolarScene } from "../scene/SolarScene";
import { HUD } from "../ui/HUD";
import { GestureDebug } from "../gesture/GestureDebug";
import { store, useSolaris } from "../interaction/store";
import { handTracking } from "../gesture/HandTrackingManager";
import { interaction } from "../interaction/InteractionController";
import { installTvNavigation, isTvMode } from "../platform/tvNavigation";
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
export function App() {
  const { webglError } = useSolaris();
  useEffect(() => () => handTracking.stop(), []);
  useEffect(() => {
    if (!webglError) return;
    if (["LOCATION_TRANSITION", "LOCATION_VIEW"].includes(store.get().mode)) {
      interaction.openStory(null);
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
    if (!isTvMode(location.search)) return;
    document.body.classList.add("tv-mode");
    const dispose = installTvNavigation(
      document.querySelector<HTMLElement>(".solaris-app")!,
      () => interaction.return(),
    );
    return () => {
      dispose();
      document.body.classList.remove("tv-mode");
    };
  }, []);
  return (
    <main className="solaris-app">
      <SceneBoundary>
        <Suspense
          fallback={
            <div className="loading-universe">
              <i />
              <span>正在汇聚星尘</span>
            </div>
          }
        >
          <SolarScene />
        </Suspense>
      </SceneBoundary>
      <div className="film-grain" />
      <HUD />
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
