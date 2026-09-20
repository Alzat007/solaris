import { useEffect, useRef, type CSSProperties } from "react";
import { particles } from "../particles/ParticleEngine";
import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "./gestureFeedback";

/** Read the render-side cursor so its light ring and hit test never drift apart. */
export function GestureCursor() {
  const cursor = useRef<HTMLDivElement>(null);
  const { tracking, mode } = useSolaris();
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
  const fist = f.action === "FIST_BACK";
  const progress = fist ? f.fistProgress : f.specialProgress;
  const special = f.specialStage !== "IDLE";
  const style = {
    "--pinch-progress": f.pinchProgress,
    "--gesture-progress": Math.max(0, Math.min(1, progress)),
  } as CSSProperties;
  return (
    <>
      <div
        ref={cursor}
        className={`gesture-cursor${f.target ? " has-target" : ""}${fist ? " is-returning" : ""}${special ? " is-condensing" : ""}`}
        data-state={f.presence}
        data-readiness={f.readiness}
        data-pinch={f.pinchPhase}
        data-special-stage={f.specialStage}
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
        <span className="gesture-target-name">
          {fist
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
              : f.target?.label}
        </span>
      </div>
      <div
        className={`gesture-space-feedback${f.action === "TWO_HAND_ZOOM" ? " is-zooming" : ""}${f.action === "PINCH_DRAG" ? " is-dragging" : ""}`}
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
