import { useSolaris } from "../interaction/store";
import { DebugHands } from "../ui/DebugHands";
import { gestureLabels } from "../ui/chinese";
import { useGestureFeedback } from "./gestureFeedback";
import { useCameraDiagnostics } from "./cameraDiagnostics";

export function GestureDebug() {
  const s = useSolaris();
  const f = useGestureFeedback();
  const camera = useCameraDiagnostics();
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
          `Camera: ${camera.stage} · ${camera.backend || "—"}${camera.compatibility ? " · COMPAT" : ""}`,
          `Detection: ${camera.rawHands} raw / ${camera.validHands} valid · ${camera.frames} frames`,
          `Inference: ${camera.inferenceMs.toFixed(1)} ms${camera.frozen ? " · VIDEO FROZEN" : ""}`,
          `HAND: ${f.handedness} × ${f.handCount}`,
          `Pose Evidence Score: ${f.confidence.toFixed(2)}`,
          `Hand Geometry: ${f.trackingConfidence >= 0.55 ? "VALID" : "WEAK"}`,
          `Current Gesture: ${gestureLabels[s.gesture] || "姿势未确定"} (${s.gesture})`,
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
          `Five-Finger Zoom: ${f.zoomActive ? "ACTIVE" : "IDLE"} · Hold ${(f.zoomProgress * 100).toFixed(0)}%`,
          `Zoom Aperture: ${(f.zoomAperture * 100).toFixed(0)}% · Scale ${f.zoomScale.toFixed(2)}×`,
          `Last Action: ${f.lastAction}`,
          `FPS: ${s.fps} · Quality: ${s.quality}`,
        ].join("\n")}
      </pre>
    </aside>
  );
}
