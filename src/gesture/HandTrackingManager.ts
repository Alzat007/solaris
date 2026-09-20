import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { HandIdentityTracker } from "./HandIdentityTracker";
import { gestureConfig } from "./gestureConfig";
import { gestures } from "./GestureController";
import { interaction } from "../interaction/InteractionController";
import { store } from "../interaction/store";
import type { HandFrame } from "./GestureTypes";
/** Owns the camera lifecycle. Inference stays local and runs at a capped 20 Hz. */
export class HandTrackingManager {
  video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private model: HandLandmarker | null = null;
  private timer = 0;
  private running = false;
  private generation = 0;
  private lastVideo = -1;
  private identities = new HandIdentityTracker();
  private lastFrameTime = 0;
  frame: HandFrame = { hands: [], time: 0 };
  async start() {
    if (this.running || store.get().tracking === "loading") return;
    const generation = ++this.generation;
    let localStream: MediaStream | null = null,
      localVideo: HTMLVideoElement | null = null,
      localModel: HandLandmarker | null = null;
    const release = () => {
      localStream?.getTracks().forEach((t) => t.stop());
      if (localVideo) {
        localVideo.pause();
        localVideo.srcObject = null;
      }
      localModel?.close();
    };
    const expired = () => generation !== this.generation;
    store.set({ tracking: "loading", cameraError: "", welcome: false });
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera access requires HTTPS or localhost.");
      localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });
      if (expired()) {
        release();
        return;
      }
      localVideo = document.createElement("video");
      localVideo.muted = true;
      localVideo.playsInline = true;
      localVideo.srcObject = localStream;
      // Publish only the camera so Stop can release it even while WASM is loading.
      this.stream = localStream;
      this.video = localVideo;
      await localVideo.play();
      if (expired()) {
        release();
        return;
      }
      const { FilesetResolver, HandLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      if (expired()) {
        release();
        return;
      }
      const files = await FilesetResolver.forVisionTasks(
        `${import.meta.env.BASE_URL}mediapipe`,
      );
      if (expired()) {
        release();
        return;
      }
      const options = {
        baseOptions: {
          modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
        },
        runningMode: "VIDEO" as const,
        numHands: 2,
        minHandDetectionConfidence: gestureConfig.CAMERA_DETECTION_CONFIDENCE,
        minHandPresenceConfidence: gestureConfig.CAMERA_PRESENCE_CONFIDENCE,
        minTrackingConfidence: gestureConfig.CAMERA_TRACKING_CONFIDENCE,
      };
      try {
        localModel = await HandLandmarker.createFromOptions(files, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "GPU" },
        });
      } catch {
        if (expired()) {
          release();
          return;
        }
        localModel = await HandLandmarker.createFromOptions(files, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" },
        });
      }
      if (expired()) {
        release();
        return;
      }
      this.model = localModel;
      this.running = true;
      store.set({ tracking: "seeking" });
      this.loop();
    } catch (error) {
      release();
      if (expired()) return;
      this.cleanup();
      const message =
        error instanceof Error
          ? `${error.name} ${error.message}`
          : String(error);
      store.set({
        tracking: "unavailable",
        cameraError: /denied|notallowed|permission/i.test(message)
          ? "未获得摄像头权限，你仍可使用鼠标探索宇宙。"
          : /notfound|device|camera/i.test(message)
            ? "未找到可用摄像头。连接摄像头后重试，或继续使用鼠标。"
            : "手势追踪暂时无法启动，已为你开启鼠标与键盘操作。",
      });
    }
  }
  private loop = () => {
    if (!this.running || !this.video || !this.model) return;
    const start = performance.now();
    try {
      if (
        this.video.readyState >= 2 &&
        this.video.currentTime !== this.lastVideo
      ) {
        this.lastVideo = this.video.currentTime;
        const result = this.model.detectForVideo(this.video, start);
        const hands = this.identities.update(
          result,
          start,
          this.video.videoWidth / this.video.videoHeight,
        );
        this.lastFrameTime = start;
        this.frame = { hands, time: start };
        // Only absent / malformed geometry is removed. Uncertain poses remain
        // tracked and reach the controller as such, without repeated re-entry.
        gestures.update(this.frame);
      } else if (start - this.lastFrameTime > gestureConfig.FRAME_GAP_RESET) {
        // A frozen video feed must not leave a held gesture active indefinitely.
        this.identities.reset();
        this.frame = { hands: [], time: start };
        gestures.update(this.frame);
      }
    } catch {
      this.stop();
      store.set({
        tracking: "unavailable",
        cameraError: "手势追踪已停止，已切换为鼠标模式。你可以重新连接摄像头。",
      });
      return;
    }
    this.timer = window.setTimeout(
      this.loop,
      Math.max(
        0,
        1000 / gestureConfig.CAMERA_FPS - (performance.now() - start),
      ),
    );
  };
  private cleanup() {
    this.running = false;
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
    this.model?.close();
    this.model = null;
    this.identities.reset();
    this.lastVideo = -1;
    this.lastFrameTime = 0;
    this.frame = { hands: [], time: 0 };
    gestures.reset();
    interaction.endScale();
  }
  stop() {
    this.generation++;
    this.cleanup();
    store.set({ tracking: "off", gesture: "NONE", confidence: 0, hover: null });
  }
}
export const handTracking = new HandTrackingManager();
