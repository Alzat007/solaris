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
let target = { x: 0.5, y: 0.5 };
document.getElementById("lab-buttons")!.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button",
  );
  if (!button) return;
  pose = button.dataset.pose as typeof pose;
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
  if (pose !== "NONE") {
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
    `识别 ${s.gesture} · ${Math.round(s.confidence * 100)}% | 状态 ${s.mode} / ${interaction.machine.state} | 命中 ${s.hover ?? "无"} | 已选 ${s.selected ?? "无"} | 坍缩 ${particles.collapse.toFixed(2)}`;
}, 50);
window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
