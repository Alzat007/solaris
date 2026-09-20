import { useEffect, useRef, useState } from "react";
import { useSolaris } from "../interaction/store";
import { handTracking } from "./HandTrackingManager";

const bones = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [0, 17],
];

/** Draw the already-running local camera; this component never requests a stream. */
export function CameraPreview() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const available = useRef(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [readingExpanded, setReadingExpanded] = useState(false);
  const s = useSolaris();
  const active = ["loading", "seeking", "online"].includes(s.tracking);
  // Start each reading scene compact; reopening still allows gesture alignment.
  const reading = s.infoVisible || s.help;
  const expanded = reading ? readingExpanded : !collapsed;
  useEffect(() => {
    setReadingExpanded(false);
  }, [s.infoVisible, s.help, s.selected]);
  useEffect(() => {
    if (!active) {
      available.current = false;
      setHasVideo(false);
      return;
    }
    let raf = 0;
    let lastPaint = -Infinity;
    const paint = (now: number) => {
      raf = requestAnimationFrame(paint);
      if (now - lastPaint < 50) return;
      lastPaint = now;
      const video = handTracking.video;
      const ready = Boolean(video && video.srcObject && video.readyState >= 2);
      if (available.current !== ready) {
        available.current = ready;
        setHasVideo(ready);
      }
      const c = canvas.current;
      if (!ready || !expanded || !video || !c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      // Use the input's real aspect ratio so the bones remain aligned.
      const height = Math.round(
        (c.width * video.videoHeight) / video.videoWidth,
      );
      if (height > 0 && c.height !== height) c.height = height;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, c.width, c.height);
      ctx.restore();
      for (const hand of handTracking.frame.hands) {
        const victory = hand.gesture === "V_GESTURE";
        ctx.strokeStyle = victory ? "#c1f5ff" : "#9de5ee";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        for (const bone of bones) {
          const thumbBone = !victory && bone[1] === 1;
          ctx.strokeStyle = thumbBone || victory ? "#c1f5ff" : "#9de5ee";
          ctx.lineWidth = thumbBone ? 2.8 : 2;
          ctx.beginPath();
          bone.forEach((index, step) => {
            const p = hand.landmarks[index];
            const x = (1 - p.x) * c.width;
            const y = p.y * c.height;
            if (step === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        }
        for (let index = 0; index < hand.landmarks.length; index++) {
          const p = hand.landmarks[index];
          const fingertip = index > 0 && index % 4 === 0;
          const victoryTip = victory && (index === 8 || index === 12);
          const selectionTip = !victory && (index === 4 || index === 8);
          const thumbJoint = !victory && index >= 1 && index <= 4;
          ctx.fillStyle =
            victoryTip || selectionTip || thumbJoint
              ? "#b4f5ff"
              : fingertip
                ? "#eafaff"
                : "#b6dce6";
          ctx.beginPath();
          ctx.arc(
            (1 - p.x) * c.width,
            p.y * c.height,
            fingertip
              ? victoryTip || selectionTip
                ? 5.5
                : 4.5
              : thumbJoint
                ? 3
                : 1.8,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          if (fingertip) {
            ctx.strokeStyle =
              victoryTip || selectionTip ? "#e8ffff" : "#80d7ea";
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        }
      }
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [active, expanded]);
  if (!active) return null;
  return (
    <section
      className="camera-preview"
      hidden={!hasVideo}
      data-expanded={expanded}
      data-reading={reading}
      data-gesture={s.gesture}
      aria-label="本机摄像头镜像预览"
    >
      <button
        className="camera-preview-toggle"
        data-gesture-id="camera-preview-toggle"
        data-gesture-label={expanded ? "收起摄像头预览" : "展开摄像头预览"}
        onClick={() => {
          if (reading) setReadingExpanded((value) => !value);
          else setCollapsed((value) => !value);
        }}
        aria-label={expanded ? "收起摄像头预览" : "展开摄像头预览"}
        aria-expanded={expanded}
        aria-controls="local-camera-preview"
        title={
          !expanded
            ? "点击展开手部骨架，检查整只手是否在画面内"
            : "亮点与亮线突出大拇指和食指：食指保持指向，拇指先收后张；识别 ✌ 时突出食指和中指。画面仅在本机处理"
        }
      >
        <span>
          {expanded ? "镜像预览" : "查看手部骨架"}{" "}
          <i>{expanded ? "仅本机" : "已收起"}</i>
        </span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <canvas
        ref={canvas}
        id="local-camera-preview"
        width={320}
        height={240}
        hidden={!expanded}
        aria-label="镜像摄像头画面与手部骨架"
      />
    </section>
  );
}
