// Dev-only: real MediaPipe inference over a canvas stream. Never production.
// Optional positive fixture: download MediaPipe's official right_hands.jpg to
// ignored artifacts/right_hands.jpg. No camera/photo is recorded or uploaded.
import "../src/main";
import { handTracking } from "../src/gesture/HandTrackingManager";
import { cameraDiagnostics } from "../src/gesture/cameraDiagnostics";
import { store } from "../src/interaction/store";

const canvas = document.createElement("canvas");
canvas.width = 640;
canvas.height = 480;
const ctx = canvas.getContext("2d")!;
let sample: HTMLImageElement | null = null;
let requestedStreams = 0;
const nativeGetUserMedia = navigator.mediaDevices.getUserMedia;
Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
  configurable: true,
  value: async () => {
    requestedStreams++;
    return canvas.captureStream(30);
  },
});
let animation = 0;
function draw(now: number) {
  ctx.fillStyle = "#d8d8d8";
  ctx.fillRect(0, 0, 640, 480);
  if (sample) {
    const scale = Math.min(640 / sample.width, 480 / sample.height);
    ctx.drawImage(
      sample,
      (640 - sample.width * scale) / 2,
      (480 - sample.height * scale) / 2,
      sample.width * scale,
      sample.height * scale,
    );
  }
  ctx.fillStyle = "#152333";
  ctx.font = "15px sans-serif";
  ctx.fillText(`TEST CAMERA ${Math.floor(now / 100)}`, 8, 470);
  animation = requestAnimationFrame(draw);
}
animation = requestAnimationFrame(draw);
document.getElementById("blank")!.onclick = () => {
  sample = null;
};
document.getElementById("sample")!.onclick = async () => {
  const image = new Image();
  image.src = "/artifacts/right_hands.jpg";
  try {
    await image.decode();
    sample = image;
  } catch {
    document.getElementById("camera-result")!.textContent =
      "缺少官方样图，请先下载到 artifacts/right_hands.jpg。";
  }
};
const report = () => {
  const d = cameraDiagnostics.get();
  document.getElementById("camera-result")!.textContent =
    `阶段 ${d.stage} | 后端 ${d.backend ?? "无"} | 兼容 ${d.compatibility} | 推理帧 ${d.frames} | 原始手 ${d.rawHands} | 有效手 ${d.validHands} | 无手 ${Math.round(d.emptyForMs)}ms | 摄像头请求 ${requestedStreams} | ${store.get().tracking}`;
};
const unsubscribe = cameraDiagnostics.subscribe(report);
const unsubscribeState = store.subscribe(report);
report();
window.addEventListener("pagehide", () => {
  handTracking.stop();
  cancelAnimationFrame(animation);
  unsubscribe();
  unsubscribeState();
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: nativeGetUserMedia,
  });
});
