import { useEffect, useRef, useState } from "react";
import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "./gestureFeedback";

const completionKey = "solarisGestureTutorialCompleted";
function isCompleted() {
  try {
    return localStorage.getItem(completionKey) === "true";
  } catch {
    return false;
  }
}
const steps = [
  ["指向", "POINT"],
  ["捏合进入", "PINCH TO ENTER"],
  ["左右拨动", "SWIPE TO EXPLORE"],
  ["握拳返回", "MAKE A FIST TO RETURN"],
];

/** Teach one successful interaction at a time, then disappear permanently. */
export function GestureTutorial() {
  const s = useSolaris();
  const f = useGestureFeedback();
  const [complete, setComplete] = useState(isCompleted);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const lastActionAt = useRef(f.actionAt);
  useEffect(() => {
    if (complete) return;
    const newAction = f.actionAt !== lastActionAt.current;
    lastActionAt.current = f.actionAt;
    if (f.handCount > 0 && !started) setStarted(true);
    if (step === 0 && f.target?.kind === "body") setStep(1);
    if (step < 2 && s.selected && !s.transitioning) setStep(2);
    if (step < 3 && s.mode === "SUN_INTERIOR" && !s.transitioning) setStep(3);
    if (newAction && step === 2 && f.lastAction === "SWIPE") setStep(3);
    if (newAction && step >= 2 && f.lastAction === "FIST_BACK") {
      setComplete(true);
      try {
        localStorage.setItem(completionKey, "true");
      } catch {
        /* Storage may be unavailable in private browsing. */
      }
    }
  }, [
    complete,
    f.actionAt,
    f.handCount,
    f.target,
    f.lastAction,
    s.selected,
    s.mode,
    s.transitioning,
    started,
    step,
  ]);
  useEffect(() => {
    if (complete || step !== 2 || s.transitioning || s.tracking !== "online")
      return;
    const timer = window.setTimeout(() => setStep(3), 3000);
    return () => window.clearTimeout(timer);
  }, [complete, step, s.transitioning, s.tracking]);
  if (
    complete ||
    !started ||
    s.tracking !== "online" ||
    s.help ||
    s.transitioning ||
    f.locked ||
    f.zoomMode !== "IDLE" ||
    s.gesture === "V_GESTURE" ||
    f.presence === "NO_HAND"
  )
    return null;
  return (
    <div
      className="gesture-tutorial"
      role="status"
      aria-live="polite"
      key={step}
    >
      <span className="tutorial-symbol" aria-hidden="true">
        {["⊙", "◉", "↔", "◌"][step]}
      </span>
      <span>
        {steps[step][0]}
        <small>{steps[step][1]}</small>
      </span>
      <i aria-hidden="true">{String(step + 1).padStart(2, "0")} / 04</i>
    </div>
  );
}
