import { useSolaris } from "../interaction/store";
import { DebugHands } from "../ui/DebugHands";
import { useGestureFeedback } from "./gestureFeedback";

export function GestureDebug() {
  const s = useSolaris();
  const f = useGestureFeedback();
  const appState =
    s.transitioning ||
    s.mode === "INTRO" ||
    s.mode === "BIG_BANG" ||
    s.mode === "PLANET_TRANSITION"
      ? "TRANSITION"
      : s.selected
        ? "PLANET_FOCUS"
        : s.mode === "SOLAR_SYSTEM" ||
            s.mode === "POINTER" ||
            s.mode === "UNIVERSE_SCALE"
          ? "OVERVIEW"
          : s.mode;
  return (
    <aside className="debug" aria-label="手势调试信息">
      <DebugHands />
      <pre>
        {[
          "SOLARIS / GESTURE SYSTEM V2.1",
          `HAND: ${f.handedness} × ${f.handCount}`,
          `Pose Confidence: ${(f.confidence * 100).toFixed(0)}%`,
          `Hand Geometry: ${f.trackingConfidence >= 0.55 ? "VALID" : "WEAK"}`,
          `Current Gesture: ${s.gesture}`,
          `Action: ${f.action}`,
          `Pinch State: ${f.pinchPhase}`,
          `Pinch Distance: ${f.pinchDistance.toFixed(3)}`,
          `Palm Position: ${f.palmX.toFixed(3)}, ${f.palmY.toFixed(3)}`,
          `Finger State: ${f.fingers}`,
          `Gesture State: ${f.presence}`,
          `Readiness: ${f.readiness}`,
          `App State: ${appState} (${s.mode})`,
          `Gesture Lock: ${f.locked || s.transitioning}`,
          `Release Required: ${f.needsRelease}`,
          `Cooldown: ${Math.ceil(f.cooldownMs)} ms`,
          `Target: ${f.target ? `${f.target.kind}/${f.target.id}` : "—"}`,
          `Pinch / Fist / Special: ${f.pinchProgress.toFixed(2)} / ${f.fistProgress.toFixed(2)} / ${f.specialProgress.toFixed(2)}`,
          `Special Stage: ${f.specialStage}`,
          `Last Action: ${f.lastAction}`,
          `FPS: ${s.fps} · Quality: ${s.quality}`,
        ].join("\n")}
      </pre>
    </aside>
  );
}
