import { useEffect, useRef, useState } from "react";
import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "./gestureFeedback";

const completionKey = "solarisThumbOpenTutorialCompleted";
function isCompleted() {
  try {
    return localStorage.getItem(completionKey) === "true";
  } catch {
    return false;
  }
}

/** Only a successful thumb opening completes this lesson; mouse selection cannot. */
export function GestureTutorial() {
  const s = useSolaris();
  const f = useGestureFeedback();
  const [complete, setComplete] = useState(isCompleted);
  const [started, setStarted] = useState(false);
  const lastActionAt = useRef(f.actionAt);
  useEffect(() => {
    const newAction = f.actionAt !== lastActionAt.current;
    lastActionAt.current = f.actionAt;
    if (complete) return;
    if (f.handCount > 0) setStarted(true);
    if (newAction && f.lastAction === "THUMB_OPEN") {
      setComplete(true);
      try {
        localStorage.setItem(completionKey, "true");
      } catch {
        // The lesson still completes for this session without browser storage.
      }
    }
  }, [complete, f.actionAt, f.handCount, f.lastAction]);
  if (
    complete ||
    !started ||
    s.tracking !== "online" ||
    s.help ||
    s.transitioning ||
    f.locked ||
    f.readiness !== "READY" ||
    f.zoomMode !== "IDLE" ||
    s.gesture === "V_GESTURE" ||
    ["PINCH_DRAG", "FIST_BACK", "COLLAPSE", "REBIRTH"].includes(f.action) ||
    s.mode === "SUN_INTERIOR" ||
    s.mode === "COLLAPSE" ||
    f.presence === "NO_HAND"
  )
    return null;
  const ready = Boolean(f.lockedTarget);
  const releasing = f.thumbNeedsRelease || f.selectionPhase === "WAIT_RELEASE";
  const title = releasing
    ? "先收回大拇指"
    : ready
      ? f.lockedTarget?.kind === "body"
        ? "张开大拇指进入"
        : "张开大拇指确认"
      : "收拢拇指，食指指向星球";
  const detail = releasing
    ? "食指保持指向，准备下一次选择"
    : ready
      ? "食指保持指向，不要弯曲"
      : "保持食指伸直，等星球圆环填满";
  return (
    <div className="gesture-tutorial" role="status" aria-live="polite">
      <span className="tutorial-symbol" aria-hidden="true">
        {ready ? "⊙" : "☝"}
      </span>
      <span>
        {title}
        <small>{detail}</small>
      </span>
      <i aria-hidden="true">{ready ? "02" : "01"} / 02</i>
    </div>
  );
}
