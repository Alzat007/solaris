// Development-only anatomical replay. Never included in the production entry.
import "../src/main";
import { handFixture } from "./fixtures/hands";
import { GestureRecognizer } from "../src/gesture/GestureRecognizer";
import { gestures } from "../src/gesture/GestureController";
import { gestureFeedback } from "../src/gesture/gestureFeedback";
import { store } from "../src/interaction/store";
import { particles } from "../src/particles/ParticleEngine";
import type { HandFeatures } from "../src/gesture/GestureTypes";

type Pose = Parameters<typeof handFixture>[0];
let pose: Pose | "NONE" = "NONE";
const recognizers = [new GestureRecognizer(), new GestureRecognizer()];
let target = { x: 0.5, y: 0.5 };
let motion = "";
let started = 0;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
document.getElementById("lab-buttons")!.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button",
  );
  if (!button) return;
  pose = (button.dataset.pose ?? "NONE") as typeof pose;
  motion = button.dataset.motion ?? "";
  started = performance.now();
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
): HandFeatures {
  const { points, world } = handFixture(pose, {
    relaxed: true,
    noise: 0.0003,
    frame: time / 50,
    mirror: index === 1,
    foldedPinch: pose === "PINCH",
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
  if (motion === "drag") {
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
  } else if (motion === "reentry") {
    if (elapsed >= 350) hands = [feature("PINCH", target.x, target.y, time)];
  } else if (motion) {
    const zoom = motion.startsWith("zoom"),
      progress = clamp(
        (elapsed - (zoom ? 950 : 500)) / (motion === "expand" ? 450 : 1400),
      );
    const distance =
      motion === "join"
        ? 0.6 - 0.42 * progress
        : motion === "expand"
          ? 0.18 + 0.5 * progress
          : motion === "zoom-in"
            ? 0.35 + 0.35 * progress
            : 0.65 - 0.34 * progress;
    const pairedPose = zoom && elapsed >= 500 ? "PINCH" : "OPEN_PALM";
    hands = [
      feature(pairedPose, 0.5 - distance / 2, 0.5, time, 0, true),
      feature(pairedPose, 0.5 + distance / 2, 0.5, time, 1, true),
    ];
  } else if (pose !== "NONE") hands = [feature(pose, target.x, target.y, time)];
  gestures.update({ hands, time });
  const s = store.get(),
    f = gestureFeedback.get();
  document.getElementById("lab-result")!.textContent =
    `识别 ${s.gesture} | 状态 ${s.mode} | 锁 ${s.transitioning} | 资料 ${s.infoVisible} | 已选 ${s.selected ?? "无"} | 目标 ${f.target?.id ?? "无"} | ${f.readiness} / ${f.pinchPhase} | 松开 ${f.needsRelease} | 动作 ${f.action} | 坍缩 ${particles.collapse.toFixed(2)} | 内部 ${particles.sunInterior.toFixed(2)} | 缩放 ${particles.targetScale.toFixed(2)} | 旋转 ${particles.targetRotation.toFixed(2)}`;
}, 50);
window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
