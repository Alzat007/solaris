import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { store } from "../interaction/store";
import {
  currentInputTargetSnapshot,
  currentRemotePointer,
} from "../input/sharedInput";

export function RemotePointerCursor({ active }: { active: boolean }) {
  const cursor = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!active || !cursor.current || !label.current) return;
    const element = cursor.current;
    const name = label.current;
    let frame = 0;
    let lastX = -1,
      lastY = -1,
      targetAt = -Infinity;
    const render = (time: number) => {
      const point = currentRemotePointer();
      if (!point || document.hidden || store.get().transitioning) {
        element.style.visibility = "hidden";
        targetAt = -Infinity;
      } else {
        // No extra easing: visual aim and hit testing must stay on the same pixel.
        element.style.transform = `translate3d(${point.x * innerWidth}px, ${point.y * innerHeight}px, 0)`;
        element.style.visibility = "visible";
        element.dataset.side = point.x > 0.5 ? "left" : "right";
        element.dataset.above = String(point.y > 0.72);
        if (point.x !== lastX || point.y !== lastY || time - targetAt >= 80) {
          const { target, source } = currentInputTargetSnapshot();
          const hit = source === "pointer" ? target : null;
          name.textContent = hit?.label ?? "";
          name.hidden = !hit;
          element.classList.toggle("has-target", !!hit);
          element.dataset.targetId = hit?.id ?? "";
          targetAt = time;
          lastX = point.x;
          lastY = point.y;
        }
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      element.style.visibility = "hidden";
    };
  }, [active]);
  if (!active) return null;
  // Escape the header/scene stacking context so the existing story dialog stays usable.
  return createPortal(
    <div className="remote-pointer-layer" aria-hidden="true">
      <div
        ref={cursor}
        className="gesture-cursor remote-pointer-cursor"
        data-input-source="remote"
        style={{ visibility: "hidden" }}
      >
        <div className="gesture-cursor-ring">
          <i />
        </div>
        <span ref={label} className="gesture-target-name" hidden />
      </div>
    </div>,
    document.body,
  );
}
