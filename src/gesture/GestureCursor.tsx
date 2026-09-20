import { useEffect, useRef, type CSSProperties } from "react";
import { particles } from "../particles/ParticleEngine";
import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "./gestureFeedback";

/** Read the render-side cursor so its light ring and hit test never drift apart. */
export function GestureCursor() {
  const cursor = useRef<HTMLDivElement>(null);
  const { tracking, mode, transitioning } = useSolaris();
  const f = useGestureFeedback();
  const online = tracking === "online";
  const visible = online && f.presence !== "NO_HAND";
  useEffect(() => {
    const element = cursor.current;
    const parent = element?.parentElement;
    if (!visible || !element || !parent) return;
    let width = parent.clientWidth;
    let height = parent.clientHeight;
    const resize = new ResizeObserver(() => {
      width = parent.clientWidth;
      height = parent.clientHeight;
    });
    resize.observe(parent);
    let raf = 0;
    const render = () => {
      element.style.transform = `translate3d(${(particles.handNDC.x + 1) * width * 0.5}px, ${(1 - particles.handNDC.y) * height * 0.5}px, 0)`;
      element.style.visibility = particles.cursorVisible ? "visible" : "hidden";
      raf = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
    };
  }, [visible]);
  if (!visible) return null;
  const zooming = f.zoomMode !== "IDLE";
  const fist = !zooming && f.action === "FIST_BACK";
  const indexSelecting =
    !zooming &&
    !fist &&
    !f.locked &&
    !transitioning &&
    f.readiness === "READY" &&
    [
      "POINT_HOVER",
      "TARGET_LOCKING",
      "TARGET_LOCKED",
      "INDEX_PRESSING",
      "INDEX_TRIGGERED",
    ].includes(f.indexPhase);
  const progress = zooming
    ? f.zoomActive
      ? 0
      : f.zoomProgress
    : indexSelecting
      ? f.targetLockProgress
      : fist
        ? f.fistProgress
        : f.specialProgress;
  const special = !zooming && f.specialStage !== "IDLE";
  const targetLabel =
    zooming || f.locked || transitioning || f.readiness !== "READY"
      ? ""
      : fist
        ? "返回"
        : special
          ? f.specialStage === "PAUSED"
            ? "留在镜头内"
            : mode === "COLLAPSE"
              ? f.specialProgress > 0
                ? `展开 ${Math.round(f.specialProgress * 100)}%`
                : "展开 · 重生"
              : f.specialProgress > 0
                ? `凝聚 ${Math.round(f.specialProgress * 100)}%`
                : "双掌合拢"
          : f.indexNeedsRelease
            ? "伸直食指"
            : f.indexPhase === "INDEX_PRESSING"
              ? "轻弯 · 确认"
              : f.lockedTarget
                ? `${f.lockedTarget.label} · 轻弯食指`
                : f.target?.label;
  const style = {
    "--pinch-progress": zooming
      ? 0
      : indexSelecting
        ? f.indexPressProgress
        : f.pinchProgress,
    "--gesture-progress": Math.max(0, Math.min(1, progress)),
  } as CSSProperties;
  return (
    <>
      <div
        ref={cursor}
        className={`gesture-cursor${f.target ? " has-target" : ""}${fist ? " is-returning" : ""}${special ? " is-condensing" : ""}${zooming ? " is-scaling" : ""}`}
        data-state={f.presence}
        data-readiness={f.readiness}
        data-pinch={f.pinchPhase}
        data-index-phase={f.indexPhase}
        data-special-stage={f.specialStage}
        data-zoom-active={f.zoomActive}
        style={style}
        aria-hidden="true"
      >
        <div className="gesture-cursor-ring">
          <i />
        </div>
        {progress > 0 && (
          <svg className="gesture-progress-ring" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="19" pathLength="1" />
          </svg>
        )}
        {f.pulseId > 0 && <i className="gesture-pulse" key={f.pulseId} />}
        <span className="gesture-target-name">{targetLabel}</span>
      </div>
      <div
        className={`gesture-space-feedback${f.zoomActive ? " is-zooming" : ""}${f.action === "PINCH_DRAG" ? " is-dragging" : ""}`}
        aria-hidden="true"
      />
      {f.swipeDirection !== 0 && (
        <span
          className={`gesture-swipe-cue ${f.swipeDirection < 0 ? "to-left" : "to-right"}`}
          key={`swipe-${f.actionAt}`}
          aria-hidden="true"
        >
          {f.swipeDirection < 0 ? "←" : "→"}
        </span>
      )}
    </>
  );
}
