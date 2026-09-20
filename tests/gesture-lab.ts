// Development-only fixture replay. This page is not a Vite production entry.
import "../src/main";
import { handFixture } from "./fixtures/hands";
import { GestureRecognizer } from "../src/gesture/GestureRecognizer";
import { gestures } from "../src/gesture/GestureController";
import { store } from "../src/interaction/store";
import { interaction } from "../src/interaction/InteractionController";
import { particles } from "../src/particles/ParticleEngine";

let pose: Parameters<typeof handFixture>[0] | "NONE" = "NONE";
const recognizer = new GestureRecognizer();
const secondRecognizer = new GestureRecognizer();
let motion = "";
let motionStarted = 0;
let target = { x: 0.5, y: 0.5 };
document.getElementById("lab-buttons")!.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button",
  );
  if (!button) return;
  pose = (button.dataset.pose ?? "NONE") as typeof pose;
  motion = button.dataset.motion ?? "";
  motionStarted = performance.now();
  recognizer.reset();
  secondRecognizer.reset();
  if (pose === "POINT") {
    const label = [
      ...document.querySelectorAll<HTMLElement>(".planet-label"),
    ].find((el) => el.textContent?.includes("地球"));
    if (label) {
      const rect = label.getBoundingClientRect();
      target = {
        x: (rect.left + rect.width / 2) / innerWidth,
        y: (rect.bottom + 18) / innerHeight,
      };
    }
  }
  store.set({ welcome: false });
});
const timer = window.setInterval(() => {
  const time = performance.now();
  if (motion) {
    const elapsed = time - motionStarted;
    const zooming = motion.startsWith("zoom");
    const progress = Math.max(
      0,
      Math.min(1, (elapsed - 450) / (motion === "expand" ? 240 : 1100)),
    );
    const distance =
      motion === "join"
        ? 0.6 - 0.48 * progress
        : motion === "expand"
          ? 0.2 + 0.56 * progress
          : motion === "zoom-in"
            ? 0.3 + 0.35 * progress
            : 0.65 - 0.35 * progress;
    const hands = [recognizer, secondRecognizer].map((r, i) => {
      const { points, world } = handFixture(zooming ? "PINCH" : "OPEN_PALM", {
        relaxed: true,
        mirror: i === 1,
      });
      const palmX = [0, 5, 9, 13, 17].reduce(
        (sum, index) => sum + points[index].x / 5,
        0,
      );
      const desiredX = 0.5 + ((i === 0 ? -1 : 1) * distance) / 2;
      points.forEach((p) => {
        p.x += 1 - desiredX - palmX;
      });
      return r.analyze(points, world, time);
    });
    gestures.update({ hands, time });
  } else if (pose !== "NONE") {
    const { points, world } = handFixture(pose, {
      relaxed: true,
      noise: 0.0003,
      frame: time / 50,
    });
    const dx = 1 - target.x - points[8].x;
    const dy = target.y - points[8].y;
    points.forEach((p) => {
      p.x += dx;
      p.y += dy;
    });
    gestures.update({ hands: [recognizer.analyze(points, world, time)], time });
  } else {
    gestures.update({ hands: [], time });
  }
  const s = store.get();
  document.getElementById("lab-result")!.textContent =
    `识别 ${s.gesture} · ${Math.round(s.confidence * 100)}% | 状态 ${s.mode} / ${interaction.machine.state} | 命中 ${s.hover ?? "无"} | 已选 ${s.selected ?? "无"} | 坍缩 ${particles.collapse.toFixed(2)} | 内部 ${particles.sunInterior.toFixed(2)} | 缩放 ${particles.targetScale.toFixed(2)}`;
}, 50);
window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
