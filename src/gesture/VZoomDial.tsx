import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSolaris } from "../interaction/store";
import { particles } from "../particles/ParticleEngine";
import { useGestureFeedback } from "./gestureFeedback";
import { gestureConfig } from "./gestureConfig";

const completionKey = "solarisVZoomTutorialCompleted";
function tutorialCompleted() {
  try {
    return localStorage.getItem(completionKey) === "true";
  } catch {
    return false;
  }
}

/** A palm-following dial; its rotation follows the same mirrored angle as zoom. */
export function VZoomDial() {
  const s = useSolaris();
  const f = useGestureFeedback();
  const element = useRef<HTMLDivElement>(null);
  const last = useRef(f);
  const armedScale = useRef<number | null>(null);
  const [completed, setCompleted] = useState(tutorialCompleted);
  const available =
    s.tracking === "online" &&
    !s.transitioning &&
    !s.help &&
    !f.locked &&
    f.readiness === "READY";
  const visible =
    available && f.zoomMode !== "IDLE" && f.zoomMode !== "ZOOM_DIAL_RELEASE";
  const displayed = visible ? f : last.current;

  useEffect(() => {
    if (visible) last.current = f;
  }, [f, visible]);

  useEffect(() => {
    if (f.zoomMode === "IDLE" || f.zoomMode === "ZOOM_DIAL_RELEASE") {
      armedScale.current = null;
      return;
    }
    if (f.zoomMode === "V_DETECTED" || f.zoomMode === "ZOOM_DIAL_ARMED") {
      armedScale.current = f.zoomScale;
      return;
    }
    // Brief detection loss hides feedback, but retains the active clutch's
    // baseline so several small, successful turns still finish the tutorial.
    if (!available || f.zoomMode !== "ZOOM_DIAL_ACTIVE") return;
    if (armedScale.current === null) armedScale.current = f.zoomScale;
    if (
      !completed &&
      Math.abs(f.zoomSpeed) > 0.0001 &&
      Math.abs(f.zoomScale - armedScale.current) > 0.012
    ) {
      setCompleted(true);
      try {
        localStorage.setItem(completionKey, "true");
      } catch {
        // This session still completes the hint when browser storage is disabled.
      }
    }
  }, [available, completed, f.zoomMode, f.zoomScale, f.zoomSpeed]);

  useEffect(() => {
    const dial = element.current;
    const parent = dial?.parentElement;
    if (!visible || !dial || !parent) return;
    let width = parent.clientWidth;
    let height = parent.clientHeight;
    const resize = new ResizeObserver(() => {
      width = parent.clientWidth;
      height = parent.clientHeight;
    });
    resize.observe(parent);
    let raf = 0;
    const position = () => {
      const margin = Math.min(115, width / 2);
      const x = Math.max(
        margin,
        Math.min(width - margin, (particles.handNDC.x + 1) * width * 0.5),
      );
      const y = Math.max(
        170,
        Math.min(height - 150, (1 - particles.handNDC.y) * height * 0.5),
      );
      dial.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(position);
    };
    position();
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
    };
  }, [visible]);

  const turning =
    displayed.zoomDirection !== "NONE" &&
    Math.abs(displayed.zoomSpeed) > 0.0001;
  const label =
    displayed.zoomMode === "V_DETECTED"
      ? "保持 ✌"
      : turning
        ? displayed.zoomDirection === "IN"
          ? "向右放大"
          : "向左缩小"
        : "旋转缩放";
  const style = {
    "--dial-angle": `${Math.abs(displayed.zoomDelta) < gestureConfig.V_ZOOM_DEADZONE_DEG ? 0 : displayed.zoomDelta}deg`,
    "--dial-progress": displayed.zoomProgress,
  } as CSSProperties;

  return (
    <div ref={element} className="v-zoom-dial-anchor" aria-hidden={!visible}>
      <div
        className="v-zoom-dial"
        data-visible={visible}
        data-turning={turning}
        data-direction={turning ? displayed.zoomDirection : "NONE"}
        data-preparing={displayed.zoomMode === "V_DETECTED"}
        style={style}
      >
        <div className="v-zoom-dial-face">
          <svg
            className="v-zoom-dial-scale"
            viewBox="0 0 112 112"
            aria-hidden="true"
          >
            <circle className="v-zoom-dial-orbit" cx="56" cy="56" r="43" />
            <g className="v-zoom-dial-ticks">
              {Array.from({ length: 36 }, (_, index) => (
                <line
                  key={index}
                  x1="56"
                  y1={index % 3 === 0 ? 5 : 8}
                  x2="56"
                  y2="13"
                  transform={`rotate(${index * 10} 56 56)`}
                  className={index % 3 === 0 ? "major" : undefined}
                />
              ))}
            </g>
            <path
              className="v-zoom-dial-glow dial-out"
              d="M 23 30 A 42 42 0 0 0 23 82"
            />
            <path
              className="v-zoom-dial-glow dial-in"
              d="M 89 30 A 42 42 0 0 1 89 82"
            />
            <path className="v-zoom-dial-zero" d="M 53 18 L 56 22 L 59 18" />
            {displayed.zoomMode === "V_DETECTED" && (
              <circle
                className="v-zoom-dial-hold"
                cx="56"
                cy="56"
                r="43"
                pathLength="1"
              />
            )}
          </svg>
          <span className="v-zoom-dial-minus">−</span>
          <span className="v-zoom-dial-plus">+</span>
          <div className="v-zoom-dial-value">
            <small>ZOOM</small>
            <span>
              {Math.round(displayed.zoomScale * 100)}
              <i>%</i>
            </span>
          </div>
        </div>
        <span className="v-zoom-dial-label">{label}</span>
        {visible && !completed && (
          <span className="v-zoom-tutorial">
            <span>↶ ✌ ↷</span>旋转手腕缩放
          </span>
        )}
      </div>
    </div>
  );
}
