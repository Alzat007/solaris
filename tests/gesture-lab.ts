// Development-only anatomical replay. Never included in the production entry.
import "../src/main";
import { gsap } from "gsap";
import { interaction } from "../src/interaction/InteractionController";
import { handFixture } from "./fixtures/hands";
import { GestureRecognizer } from "../src/gesture/GestureRecognizer";
import { gestures } from "../src/gesture/GestureController";
import { gestureFeedback } from "../src/gesture/gestureFeedback";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import { handTracking } from "../src/gesture/HandTrackingManager";
import type { HandFeatures } from "../src/gesture/GestureTypes";

type Pose = Parameters<typeof handFixture>[0];
let pose: Pose | "NONE" = "NONE";
const recognizers = [new GestureRecognizer(), new GestureRecognizer()];
let target = { x: 0.5, y: 0.5 };
let motion = "";
let started = 0;
let focusUnlockedAt: number | null = null;
let previewVideo: HTMLVideoElement | null = null;
const previewCanvas = document.createElement("canvas");
previewCanvas.width = 640;
previewCanvas.height = 480;
async function togglePreview() {
  if (previewVideo) {
    (previewVideo.srcObject as MediaStream)
      .getTracks()
      .forEach((track) => track.stop());
    previewVideo.pause();
    previewVideo = null;
    handTracking.video = null;
    return;
  }
  previewVideo = document.createElement("video");
  previewVideo.muted = true;
  previewVideo.playsInline = true;
  previewVideo.srcObject = previewCanvas.captureStream(20);
  await previewVideo.play();
  handTracking.video = previewVideo;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
document.getElementById("lab-buttons")!.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button",
  );
  if (!button) return;
  if (button.dataset.preview) {
    void togglePreview();
    return;
  }
  if (button.dataset.slow) {
    gsap.globalTimeline.timeScale(0.25);
    pose = "NONE";
    motion = "";
    interaction.collapse();
    return;
  }
  pose = (button.dataset.pose ?? "NONE") as typeof pose;
  motion = button.dataset.motion ?? "";
  started = performance.now();
  focusUnlockedAt = null;
  if (motion === "focus-grip-fast") interaction.selectBody("earth");
  recognizers.forEach((r) => r.reset());
  if (button.dataset.target) {
    pose = "POINT";
    const which = button.dataset.target;
    if (which === "sun") target = { x: 0.5, y: 0.5 };
    else if (which === "blank") target = { x: 0.78, y: 0.17 };
    else {
      const element =
        which === "help"
          ? (document.querySelector<HTMLElement>('[data-gesture-id="help"]') ??
            document.querySelector<HTMLElement>('[aria-label="操作指南"]'))
          : Array.from(
              document.querySelectorAll<HTMLElement>(".planet-label"),
            ).find((el) => el.textContent?.includes("地球"));
      if (element) {
        const rect = element.getBoundingClientRect();
        target = {
          x: (rect.left + rect.width / 2) / innerWidth,
          y:
            (which === "help" ? rect.top + rect.height / 2 : rect.bottom + 18) /
            innerHeight,
        };
      }
    }
  }
  store.set({ welcome: false });
});
function feature(
  pose: Pose,
  x: number,
  y: number,
  time: number,
  index = 0,
  alignPalm = false,
  gripSpread = 0,
): HandFeatures {
  const { points, world } = handFixture(pose, {
    relaxed: true,
    noise: 0.0003,
    frame: time / 50,
    mirror: index === 1,
    foldedPinch: pose === "PINCH",
    gripSpread,
  });
  const sourceX = alignPalm
    ? [0, 5, 9, 13, 17].reduce((sum, i) => sum + points[i].x / 5, 0)
    : points[8].x;
  const sourceY = alignPalm
    ? [0, 5, 9, 13, 17].reduce((sum, i) => sum + points[i].y / 5, 0)
    : points[8].y;
  const dx = 1 - x - sourceX,
    dy = y - sourceY;
  points.forEach((point) => {
    point.x += dx;
    point.y += dy;
  });
  const hand = recognizers[index].analyze(points, world, time);
  hand.id = index === 0 ? "lab-left" : "lab-right";
  hand.handedness = index === 0 ? "Left" : "Right";
  return hand;
}
const timer = window.setInterval(() => {
  const time = performance.now(),
    elapsed = time - started;
  let hands: HandFeatures[] = [];
  if (motion === "focus-grip-fast") {
    if (interaction.isLocked()) {
      // The user attempts a grip, then releases while the camera is flying.
      hands = [
        feature(
          elapsed > 350 && elapsed < 650 ? "FIVE_PINCH" : "OPEN_PALM",
          0.5,
          0.5,
          time,
          0,
          true,
        ),
      ];
    } else {
      focusUnlockedAt ??= time;
      const spread = clamp((time - focusUnlockedAt - 50) / 250);
      hands = [feature("FIVE_PINCH", 0.5, 0.5, time, 0, true, spread)];
    }
  } else if (motion === "drag") {
    const progress = clamp((elapsed - 900) / 1000);
    hands = [
      feature(
        elapsed < 500 ? "POINT" : elapsed > 2100 ? "OPEN_PALM" : "PINCH",
        0.18 + progress * 0.38,
        0.15,
        time,
      ),
    ];
  } else if (motion.startsWith("swipe")) {
    const direction = motion === "swipe-left" ? -1 : 1;
    hands = [
      feature(
        "OPEN_PALM",
        0.5 + direction * 0.32 * clamp((elapsed - 400) / 220),
        0.5,
        time,
        0,
        true,
      ),
    ];
  } else if (motion.startsWith("five-zoom")) {
    const spread =
      elapsed < 1000
        ? 0
        : motion === "five-zoom-in"
          ? clamp((elapsed - 1000) / 1200)
          : elapsed < 1850
            ? clamp((elapsed - 1000) / 750)
            : 1 - clamp((elapsed - 1850) / 1000);
    hands = [
      feature(
        elapsed < 500 ? "OPEN_PALM" : "FIVE_PINCH",
        0.5,
        0.5,
        time,
        0,
        true,
        spread,
      ),
    ];
  } else if (motion === "reentry") {
    if (elapsed >= 350) hands = [feature("PINCH", target.x, target.y, time)];
  } else if (motion) {
    const progress = clamp(
      (elapsed - 500) / (motion === "expand" ? 450 : 1400),
    );
    const distance = motion.startsWith("join")
      ? 0.6 -
        (motion === "join-noisy" ? 0.27 : 0.42) * progress +
        (motion === "join-noisy" ? Math.sin(elapsed / 65) * 0.008 : 0)
      : motion === "expand"
        ? 0.18 + 0.5 * progress
        : motion === "zoom-in"
          ? 0.35 + 0.35 * progress
          : 0.65 - 0.34 * progress;
    const pairedPose = "OPEN_PALM";
    hands = [
      feature(pairedPose, 0.5 - distance / 2, 0.5, time, 0, true),
      feature(pairedPose, 0.5 + distance / 2, 0.5, time, 1, true),
    ];
  } else if (pose !== "NONE") hands = [feature(pose, target.x, target.y, time)];
  // Emulate a brief uncertain pose with continuous, valid camera landmarks.
  if (motion === "join-noisy" && elapsed > 1100 && elapsed < 1250) {
    hands[0].gesture = "NONE";
    hands[0].confidence = 0.4;
    hands.forEach((hand) => {
      hand.trackingConfidence = 1;
    });
  }
  if (previewVideo) {
    handTracking.frame = { hands, time };
    const ctx = previewCanvas.getContext("2d")!;
    ctx.fillStyle = "#15242c";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#77949b";
    ctx.font = "22px sans-serif";
    ctx.fillText("SYNTHETIC CAMERA / NO RECORDING", 25, 40);
    for (const hand of hands)
      for (const point of hand.landmarks) {
        ctx.beginPath();
        ctx.arc(point.x * 640, point.y * 480, 5, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  gestures.update({ hands, time });
  const s = store.get(),
    f = gestureFeedback.get();
  document.getElementById("lab-result")!.textContent =
    `识别 ${s.gesture} | 状态 ${s.mode} | 锁 ${s.transitioning} | 资料 ${s.infoVisible} | 已选 ${s.selected ?? "无"} | 目标 ${f.target?.id ?? "无"} | ${f.readiness} / ${f.pinchPhase} | 松开 ${f.needsRelease} | 动作 ${f.action} | 五指 ${f.zoomActive ? "开合中" : "待机"} ${(f.zoomProgress * 100).toFixed(0)}% 开度${f.zoomAperture.toFixed(2)} | 双掌 ${f.specialStage} ${(f.specialProgress * 100).toFixed(0)}% | 坍缩 ${particles.collapse.toFixed(2)} | 内部 ${particles.sunInterior.toFixed(2)} | 缩放 ${particles.targetScale.toFixed(2)} | 旋转 ${particles.targetRotation.toFixed(2)}`;
}, 50);
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(timer);
    if (previewVideo)
      (previewVideo.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
  },
  { once: true },
);
