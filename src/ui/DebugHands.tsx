import { useEffect, useRef } from "react";
import { handTracking } from "../gesture/HandTrackingManager";
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
  return (
    <canvas
      ref={canvas}
      width={320}
      height={240}
      aria-label="摄像头与手部骨架调试预览"
    />
  );
}
