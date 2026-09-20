import { useEffect, useRef, type CSSProperties } from "react";
import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "./gestureFeedback";
import { gestureTargets } from "./gestureTargets";

/** The target ring stays on the locked celestial body as the fingertip bends. */
export function IndexTargetFeedback() {
  const s = useSolaris();
  const f = useGestureFeedback();
  const anchor = useRef<HTMLDivElement>(null);
  const target = f.lockedTarget ?? f.hoverTarget;
  const current = useRef(target);
  const shownLabel = useRef("");
  const visible =
    Boolean(target) &&
    [
      "POINT_HOVER",
      "TARGET_LOCKING",
      "TARGET_LOCKED",
      "INDEX_PRESSING",
    ].includes(f.indexPhase) &&
    s.tracking === "online" &&
    !s.transitioning &&
    !f.locked &&
    f.readiness === "READY" &&
    f.zoomMode === "IDLE" &&
    !["PINCH_DRAG", "FIST_BACK", "COLLAPSE", "REBIRTH"].includes(f.action);
  useEffect(() => {
    current.current = target;
    if (target) shownLabel.current = target.label;
  }, [target]);
  useEffect(() => {
    const element = anchor.current;
    const parent = element?.parentElement;
    if (!visible || !element || !parent) return;
    let raf = 0;
    const position = () => {
      const point = current.current
        ? gestureTargets.getTargetScreen(current.current)
        : null;
      if (
        point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.radius)
      ) {
        const bounds = parent.getBoundingClientRect();
        const diameter = Math.max(30, point.radius * 2);
        element.style.transform = `translate3d(${point.x - bounds.left}px, ${point.y - bounds.top}px, 0)`;
        element.style.setProperty("--target-diameter", `${diameter}px`);
        element.style.visibility = "visible";
      } else element.style.visibility = "hidden";
      raf = requestAnimationFrame(position);
    };
    position();
    return () => cancelAnimationFrame(raf);
  }, [visible]);
  const locked = Boolean(f.lockedTarget);
  const label =
    f.indexPhase === "INDEX_TRIGGERED"
      ? "已确认"
      : f.indexNeedsRelease
        ? "伸直食指"
        : f.indexPhase === "INDEX_PRESSING"
          ? "弯到底确认"
          : locked
            ? "食指弯到底"
            : "保持指向";
  const style = {
    "--target-lock-progress": Math.max(0, Math.min(1, f.targetLockProgress)),
    "--index-press-progress": Math.max(0, Math.min(1, f.indexPressProgress)),
  } as CSSProperties;
  return (
    <div ref={anchor} className="index-target-anchor" aria-hidden="true">
      <div
        className="index-target-feedback"
        data-visible={visible}
        data-locked={locked}
        data-index-phase={f.indexPhase}
        style={style}
      >
        <div className="index-target-ring">
          <svg viewBox="0 0 100 100">
            <circle className="index-target-orbit" cx="50" cy="50" r="48" />
            <circle
              className="index-target-progress"
              cx="50"
              cy="50"
              r="48"
              pathLength="1"
            />
          </svg>
          {f.lastAction === "INDEX_PRESS" && f.pulseId > 0 && (
            <i className="index-target-pulse" key={f.pulseId} />
          )}
        </div>
        <span className="index-target-label">
          {target?.label ?? shownLabel.current}
          <small>{label}</small>
        </span>
      </div>
    </div>
  );
}
