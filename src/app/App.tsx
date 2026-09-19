import { Component, Suspense, useEffect, type ReactNode } from "react";
import { SolarScene } from "../scene/SolarScene";
import { HUD } from "../ui/HUD";
import { DebugHands } from "../ui/DebugHands";
import { store, useSolaris } from "../interaction/store";
import { handTracking } from "../gesture/HandTrackingManager";
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
      {new URLSearchParams(location.search).get("debug") === "true" && (
        <DebugHands />
      )}
      {webglError && (
        <div className="render-error" role="alert">
          <p className="eyebrow">为宇宙，再留一点空间</p>
          <h1>暂时无法呈现宇宙</h1>
          <p>请开启浏览器硬件加速，或使用支持 WebGL 2 的浏览器打开 SOLARIS。</p>
          <button onClick={() => location.reload()}>重新尝试 ↗</button>
        </div>
      )}
    </main>
  );
}
