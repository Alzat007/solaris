import { useEffect, useRef } from "react";
import { handTracking } from "../gesture/HandTrackingManager";
import { gestureLabels, qualityLabels } from "./chinese";
import { useSolaris } from "../interaction/store";
const bones = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [0, 17],
];
export function DebugHands() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useSolaris();
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      const c = canvas.current,
        ctx = c?.getContext("2d");
      if (c && ctx) {
        ctx.clearRect(0, 0, c.width, c.height);
        const video = handTracking.video;
        if (video && video.readyState >= 2) {
          ctx.save();
          ctx.translate(c.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, c.width, c.height);
          ctx.restore();
        }
        for (const hand of handTracking.frame.hands) {
          ctx.strokeStyle = "#bbedc7";
          ctx.lineWidth = 1;
          for (const bone of bones) {
            ctx.beginPath();
            bone.forEach((i, j) => {
              const p = hand.landmarks[i],
                x = (1 - p.x) * c.width,
                y = p.y * c.height;
              if (j === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.stroke();
          }
          hand.landmarks.forEach((p, i) => {
            ctx.fillStyle = "#f1b677";
            ctx.beginPath();
            ctx.arc((1 - p.x) * c.width, p.y * c.height, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "8px monospace";
            ctx.fillText(String(i), (1 - p.x) * c.width + 3, p.y * c.height);
          });
        }
      }
      raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, []);
  const h = handTracking.frame.hands[0];
  return (
    <aside className="debug">
      <canvas ref={canvas} width={320} height={240} />
      <pre>
        手势：{gestureLabels[state.gesture] ?? "等待手势"} · 置信度{" "}
        {Math.round(state.confidence * 100)}%{"\n"}
        {state.fps} 帧/秒 · {qualityLabels[state.quality]}画质
        {"\n"}移动速度：{" "}
        {h ? Math.hypot(h.velocity.x, h.velocity.y).toFixed(2) : "0"}
        {"\n"}捏合距离：{h?.pinchDistance.toFixed(2) || "—"}
      </pre>
    </aside>
  );
}
