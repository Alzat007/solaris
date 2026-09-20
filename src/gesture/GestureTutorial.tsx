import { useEffect, useRef, useState } from "react";
import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "./gestureFeedback";

const completionKey = "solarisIndexTriggerTutorialCompleted";
function isCompleted() {
  try {
    return localStorage.getItem(completionKey) === "true";
  } catch {
    return false;
  }
}

/** Only a successful index press completes this lesson; mouse selection cannot. */
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
    if (newAction && f.lastAction === "INDEX_PRESS") {
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
  const releasing = f.indexNeedsRelease || f.indexPhase === "WAIT_RELEASE";
  const title = releasing
    ? "重新伸直食指"
    : ready
      ? f.lockedTarget?.kind === "body"
        ? "轻弯食指进入"
        : "轻弯食指确认"
      : "指向星球";
  const detail = releasing
    ? "伸直后，可继续选择"
    : ready
      ? "保持手掌稳定，弯一下食指"
      : "食指伸直，等星球圆环填满";
  return (
    <div className="gesture-tutorial" role="status" aria-live="polite">
      <span className="tutorial-symbol" aria-hidden="true">
        {ready ? "⌁" : "☝"}
      </span>
      <span>
        {title}
        <small>{detail}</small>
      </span>
      <i aria-hidden="true">{ready ? "02" : "01"} / 02</i>
    </div>
  );
}
