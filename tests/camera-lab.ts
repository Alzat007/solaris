// Dev-only: real MediaPipe inference over a canvas stream. Never production.
// Official photo fixtures live in ignored artifacts/: right_hands.jpg,
// victory.jpg, pointing_up.jpg and fist.jpg. The latter two filenames are
// listed in MediaPipe's tasks/testdata/vision/BUILD official fixture manifest.
// No camera/photo is recorded or uploaded. No landmark is generated or changed.
import "../src/main";
import { handTracking } from "../src/gesture/HandTrackingManager";
import { cameraDiagnostics } from "../src/gesture/cameraDiagnostics";
import { store } from "../src/interaction/store";
import { gestureFeedback } from "../src/gesture/gestureFeedback";

const canvas = document.createElement("canvas");
canvas.width = 640;
canvas.height = 480;
const ctx = canvas.getContext("2d")!;
let sample: HTMLImageElement | null = null;
let sampleName = "空白";
let sampleError = "";
let visualAngle = 0;
let mirrored = false;
let sampleRequest = 0;
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
    // Fit the whole image's diagonal into the frame so rotating a photo never
    // crops fingers. All rotation/mirroring happens in pixels before inference.
    const scale = 440 / Math.hypot(sample.width, sample.height);
    ctx.save();
    ctx.translate(320, 240);
    // Production camera preview flips x. M * R(-a) = R(a) * M, so a positive
    // visual angle is clockwise in that preview for BOTH image handednesses.
    // Reflect the photo before rotating it, never the already-rotated frame.
    ctx.rotate((-visualAngle * Math.PI) / 180);
    ctx.scale(mirrored ? -1 : 1, 1);
    ctx.drawImage(
      sample,
      (-sample.width * scale) / 2,
      (-sample.height * scale) / 2,
      sample.width * scale,
      sample.height * scale,
    );
    ctx.restore();
  }
  ctx.fillStyle = "#152333";
  ctx.font = "15px sans-serif";
  ctx.fillText(`TEST CAMERA ${Math.floor(now / 100)}`, 8, 470);
  animation = requestAnimationFrame(draw);
}
animation = requestAnimationFrame(draw);
document.getElementById("blank")!.onclick = () => {
  sampleRequest++;
  sample = null;
  sampleName = "空白";
  sampleError = "";
  report();
};
async function loadSample(file: string, name: string) {
  const request = ++sampleRequest;
  sampleError = "";
  const image = new Image();
  image.src = `/artifacts/${file}`;
  try {
    await image.decode();
    if (request !== sampleRequest) return;
    sample = image;
    sampleName = name;
    visualAngle = 0;
  } catch {
    if (request !== sampleRequest) return;
    sampleError = `缺少官方样图，请先下载到 artifacts/${file}。`;
  }
  report();
}
document.getElementById("sample")!.onclick = () => {
  void loadSample("right_hands.jpg", "官方手部样图");
};
document.getElementById("victory")!.onclick = () => {
  void loadSample("victory.jpg", "官方 V 样图");
};
document.getElementById("pointing-up")!.onclick = () => {
  void loadSample("pointing_up.jpg", "官方 POINT 原图（伸直）");
};
document.getElementById("fist")!.onclick = () => {
  void loadSample("fist.jpg", "官方握拳样图");
};
document.getElementById("mirror")!.onclick = () => {
  mirrored = !mirrored;
  const button = document.getElementById("mirror")!;
  button.textContent = `镜像样图：${mirrored ? "开" : "关"}`;
  button.setAttribute("aria-pressed", String(mirrored));
  report();
};
document.getElementById("rotate-right")!.onclick = () => {
  visualAngle = 30;
  report();
};
document.getElementById("rotate-left")!.onclick = () => {
  visualAngle = -30;
  report();
};
document.getElementById("rotate-reset")!.onclick = () => {
  visualAngle = 0;
  report();
};
const report = () => {
  const d = cameraDiagnostics.get();
  const f = gestureFeedback.get();
  const s = store.get();
  document.getElementById("camera-result")!.textContent =
    `样图 ${sampleName} | 镜像 ${mirrored} | 画面旋转 ${visualAngle >= 0 ? "+" : ""}${visualAngle}° | 阶段 ${d.stage} | 后端 ${d.backend ?? "无"} | 兼容 ${d.compatibility} | 推理帧 ${d.frames} | 原始手 ${d.rawHands} | 有效手 ${d.validHands} | 无手 ${Math.round(d.emptyForMs)}ms | 摄像头请求 ${requestedStreams} | ${s.tracking} | Gesture ${s.gesture} | Hand ${f.handedness} | Index Angle ${f.indexAngle === null ? "—" : `${f.indexAngle.toFixed(1)}°`} | Index Velocity ${f.indexAngularVelocity.toFixed(1)}°/s | Point Confidence ${f.pointConfidence.toFixed(3)} | Index Phase ${f.indexPhase} | Locked Target ${f.lockedTarget ? `${f.lockedTarget.kind}/${f.lockedTarget.id}` : "none"} | Selected ${s.selected ?? "none"} | Last Action ${f.lastAction} | Mode ${f.zoomMode} | Delta ${f.zoomDelta >= 0 ? "+" : ""}${f.zoomDelta.toFixed(1)}° | Speed ${f.zoomSpeed.toFixed(3)} | Scale ${f.zoomScale.toFixed(3)}${sampleError ? ` | ${sampleError}` : ""}`;
};
const unsubscribe = cameraDiagnostics.subscribe(report);
const unsubscribeState = store.subscribe(report);
const unsubscribeGesture = gestureFeedback.subscribe(report);
report();
window.addEventListener("pagehide", () => {
  handTracking.stop();
  cancelAnimationFrame(animation);
  unsubscribe();
  unsubscribeState();
  unsubscribeGesture();
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: nativeGetUserMedia,
  });
});
