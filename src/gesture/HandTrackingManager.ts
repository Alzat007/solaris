import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { HandIdentityTracker } from "./HandIdentityTracker";
import { gestureConfig } from "./gestureConfig";
import { gestures } from "./GestureController";
import { interaction } from "../interaction/InteractionController";
import { store } from "../interaction/store";
import { cameraDiagnostics } from "./cameraDiagnostics";
import type { HandFrame } from "./GestureTypes";

type Detector = Pick<HandLandmarker, "detectForVideo" | "close">;
type Backend = "GPU" | "CPU";
export interface TrackingDependencies {
  requestStream(): Promise<MediaStream>;
  createVideo(): HTMLVideoElement;
  createModel(backend: Backend, compatibility: boolean): Promise<Detector>;
  now(): number;
  schedule(callback: () => void, delay: number): number;
  cancel(timer: number): void;
  preferredCompatibility(): boolean;
}
const defaults: TrackingDependencies = {
  requestStream: () => {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("Camera access requires HTTPS or localhost.");
    return navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: "user",
      },
      audio: false,
    });
  },
  createVideo: () => document.createElement("video"),
  createModel: async (delegate, compatibility) => {
    const { FilesetResolver, HandLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const files = await FilesetResolver.forVisionTasks(
      `${import.meta.env.BASE_URL}mediapipe`,
    );
    return HandLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
        delegate,
      },
      runningMode: "VIDEO",
      numHands: 2,
      // Compatibility mode uses MediaPipe's documented defaults. Command
      // confirmation, hand identity and gesture evidence remain independent.
      minHandDetectionConfidence: compatibility
        ? 0.5
        : gestureConfig.CAMERA_DETECTION_CONFIDENCE,
      minHandPresenceConfidence: compatibility
        ? 0.5
        : gestureConfig.CAMERA_PRESENCE_CONFIDENCE,
      minTrackingConfidence: compatibility
        ? 0.5
        : gestureConfig.CAMERA_TRACKING_CONFIDENCE,
    });
  },
  now: () => performance.now(),
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: (timer) => window.clearTimeout(timer),
  preferredCompatibility: () =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("handTracking") === "cpu",
};
interface Session {
  stream: MediaStream | null;
  video: HTMLVideoElement | null;
  model: Detector | null;
  backend: Backend;
  compatibility: boolean;
  switching: boolean;
  timer: number | null;
  lastVideo: number;
  lastFrameTime: number;
  lastReport: number;
  emptySince: number | null;
  frames: number;
}

/** Camera, model and timer share one owner. Stale async work can dispose only
 * its own session, never the resources of a newer camera connection. */
export class HandTrackingManager {
  video: HTMLVideoElement | null = null;
  frame: HandFrame = { hands: [], time: 0 };
  private session: Session | null = null;
  private identities = new HandIdentityTracker();
  private compatibilityPreferred = false;
  private dependencies: TrackingDependencies;
  constructor(dependencies: Partial<TrackingDependencies> = {}) {
    this.dependencies = { ...defaults, ...dependencies };
  }

  async start() {
    if (this.session) return;
    const compatibility =
      this.compatibilityPreferred || this.dependencies.preferredCompatibility();
    const session: Session = {
      stream: null,
      video: null,
      model: null,
      backend: compatibility ? "CPU" : "GPU",
      compatibility,
      switching: false,
      timer: null,
      lastVideo: -1,
      lastFrameTime: this.dependencies.now(),
      lastReport: -Infinity,
      emptySince: null,
      frames: 0,
    };
    this.session = session;
    cameraDiagnostics.reset();
    cameraDiagnostics.set({ stage: "camera", compatibility });
    store.set({ tracking: "loading", cameraError: "", welcome: false });
    try {
      session.stream = await this.dependencies.requestStream();
      if (this.session !== session) return this.dispose(session);
      const video = this.dependencies.createVideo();
      session.video = video;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = session.stream;
      this.video = video;
      await video.play();
      if (this.session !== session) return this.dispose(session);
      cameraDiagnostics.set({ stage: "model", backend: session.backend });
      try {
        session.model = await this.dependencies.createModel(
          session.backend,
          compatibility,
        );
      } catch (error) {
        if (this.session !== session) return this.dispose(session);
        if (session.backend === "CPU") throw error;
        session.backend = "CPU";
        session.compatibility = true;
        cameraDiagnostics.set({
          stage: "switching",
          backend: "CPU",
          compatibility: true,
        });
        session.model = await this.dependencies.createModel("CPU", true);
      }
      if (this.session !== session) return this.dispose(session);
      session.lastFrameTime = this.dependencies.now();
      cameraDiagnostics.set({
        stage: "running",
        backend: session.backend,
        compatibility: session.compatibility,
      });
      store.set({ tracking: "seeking" });
      this.loop(session);
    } catch (error) {
      if (this.session !== session) return this.dispose(session);
      const stage = cameraDiagnostics.get().stage;
      this.fail(
        session,
        stage === "camera"
          ? this.cameraError(error)
          : "摄像头已连接，但手部识别模型未能启动。请检查网络连接后重试。",
      );
    }
  }

  /** An explicit retry also handles GPU implementations that produce empty
   * results without throwing. Absence of hands alone never diagnoses GPU failure. */
  async useCompatibilityMode() {
    this.compatibilityPreferred = true;
    const session = this.session;
    if (!session) return this.start();
    if (!session.model || session.switching || session.compatibility) return;
    await this.switchToCPU(session);
  }

  private async switchToCPU(session: Session) {
    if (this.session !== session || session.switching) return;
    session.switching = true;
    if (session.timer !== null) this.dependencies.cancel(session.timer);
    session.timer = null;
    const oldModel = session.model;
    session.model = null;
    // Stop all pending commands before inference changes. Reacquisition must
    // re-enter the ordinary readiness/release flow.
    this.identities.reset();
    this.frame = { hands: [], time: this.dependencies.now() };
    gestures.update(this.frame);
    store.set({
      tracking: "loading",
      gesture: "NONE",
      confidence: 0,
      hover: null,
    });
    cameraDiagnostics.set({
      stage: "switching",
      compatibility: true,
      backend: "CPU",
      rawHands: 0,
      validHands: 0,
    });
    try {
      try {
        oldModel?.close();
      } catch {
        // A broken GPU graph may also throw during disposal. The independent
        // CPU graph can still recover the already-running camera.
      }
      const model = await this.dependencies.createModel("CPU", true);
      if (this.session !== session) {
        model.close();
        return;
      }
      session.model = model;
      session.backend = "CPU";
      session.compatibility = true;
      session.switching = false;
      session.lastVideo = -1;
      session.lastFrameTime = this.dependencies.now();
      session.lastReport = -Infinity;
      session.emptySince = null;
      session.frames = 0;
      cameraDiagnostics.set({
        stage: "running",
        frames: 0,
        emptyForMs: 0,
        frozen: false,
      });
      store.set({ tracking: "seeking" });
      this.loop(session);
    } catch {
      if (this.session !== session) return;
      this.fail(
        session,
        "兼容识别未能启动。请重新连接摄像头，或暂时使用鼠标探索。",
      );
    }
  }

  private loop(session: Session) {
    session.timer = null;
    if (
      this.session !== session ||
      session.switching ||
      !session.video ||
      !session.model
    )
      return;
    const now = this.dependencies.now(),
      video = session.video;
    try {
      if (
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        video.currentTime !== session.lastVideo
      ) {
        session.lastVideo = video.currentTime;
        const result = session.model.detectForVideo(video, now);
        const inferenceMs = this.dependencies.now() - now;
        const hands = this.identities.update(
          result,
          now,
          video.videoWidth / video.videoHeight,
        );
        session.lastFrameTime = now;
        session.frames++;
        session.emptySince = hands.length ? null : (session.emptySince ?? now);
        this.frame = { hands, time: now };
        gestures.update(this.frame);
        const previous = cameraDiagnostics.get();
        if (
          now - session.lastReport >= 500 ||
          previous.rawHands !== result.landmarks.length ||
          previous.validHands !== hands.length ||
          previous.frozen
        ) {
          session.lastReport = now;
          cameraDiagnostics.set({
            frames: session.frames,
            rawHands: result.landmarks.length,
            validHands: hands.length,
            emptyForMs:
              session.emptySince === null ? 0 : now - session.emptySince,
            frozen: false,
            inferenceMs,
          });
        }
      } else if (now - session.lastFrameTime > gestureConfig.FRAME_GAP_RESET) {
        this.identities.reset();
        this.frame = { hands: [], time: now };
        gestures.update(this.frame);
        if (now - session.lastReport >= 500) {
          session.lastReport = now;
          cameraDiagnostics.set({
            frozen: now - session.lastFrameTime > 2000,
            rawHands: 0,
            validHands: 0,
          });
        }
      }
    } catch {
      if (session.backend === "GPU") {
        void this.switchToCPU(session);
      } else {
        this.fail(
          session,
          "兼容识别在处理画面时停止。请重新连接摄像头，或暂时使用鼠标探索。",
        );
      }
      return;
    }
    if (this.session === session && !session.switching)
      session.timer = this.dependencies.schedule(
        () => this.loop(session),
        Math.max(
          0,
          1000 / gestureConfig.CAMERA_FPS - (this.dependencies.now() - now),
        ),
      );
  }

  private cameraError(error: unknown) {
    const message =
      error instanceof Error ? `${error.name} ${error.message}` : String(error);
    return /denied|notallowed|permission/i.test(message)
      ? "未获得摄像头权限，你仍可使用鼠标探索宇宙。"
      : /notreadable|trackstart/i.test(message)
        ? "摄像头暂时无法读取。请关闭占用摄像头的应用后重试。"
        : /notfound|device|camera/i.test(message)
          ? "未找到可用摄像头。连接摄像头后重试，或继续使用鼠标。"
          : "摄像头未能启动，请检查浏览器权限后重试。";
  }
  private dispose(session: Session) {
    if (session.timer !== null) this.dependencies.cancel(session.timer);
    session.timer = null;
    session.stream?.getTracks().forEach((track) => track.stop());
    session.stream = null;
    if (session.video) {
      session.video.pause();
      session.video.srcObject = null;
      if (this.video === session.video) this.video = null;
      session.video = null;
    }
    const model = session.model;
    session.model = null;
    try {
      model?.close();
    } catch {
      /* Resource cleanup must still finish. */
    }
  }
  private clear() {
    const session = this.session;
    this.session = null;
    if (session) this.dispose(session);
    this.identities.reset();
    this.frame = { hands: [], time: 0 };
    gestures.reset();
    interaction.endScale();
  }
  private fail(session: Session, message: string) {
    if (this.session !== session) return;
    this.clear();
    cameraDiagnostics.set({ stage: "failed", rawHands: 0, validHands: 0 });
    store.set({
      tracking: "unavailable",
      gesture: "NONE",
      confidence: 0,
      hover: null,
      cameraError: message,
    });
  }
  stop() {
    this.clear();
    cameraDiagnostics.reset();
    store.set({ tracking: "off", gesture: "NONE", confidence: 0, hover: null });
  }
}
export const handTracking = new HandTrackingManager();
