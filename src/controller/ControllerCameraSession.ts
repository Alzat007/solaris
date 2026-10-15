import type { TrackingInputSink } from "../gesture/HandTrackingManager";

export type ControllerCameraPhase = "off" | "loading" | "on" | "error";
export interface ControllerCameraManager {
  video: HTMLVideoElement | null;
  start(): Promise<void>;
  stop(): void;
  useInputSink(sink: TrackingInputSink): () => void;
}
export interface ControllerCameraCallbacks {
  phase(phase: ControllerCameraPhase): void;
  video(video: HTMLVideoElement | null): void;
}

/** A late permission/model result cannot revive a cancelled camera session. */
export class ControllerCameraSession {
  phase: ControllerCameraPhase = "off";
  private manager: ControllerCameraManager | null = null;
  private release: (() => void) | null = null;
  private generation = 0;

  constructor(
    private readonly createManager: () => Promise<ControllerCameraManager>,
    private readonly sink: TrackingInputSink,
    private readonly callbacks: ControllerCameraCallbacks,
  ) {}

  private report(phase: ControllerCameraPhase) {
    this.phase = phase;
    this.callbacks.phase(phase);
  }

  async start() {
    if (this.phase === "on" || this.phase === "loading") return;
    const generation = ++this.generation;
    this.report("loading");
    try {
      const manager = await this.createManager();
      if (generation !== this.generation) {
        manager.stop();
        return;
      }
      this.manager = manager;
      this.release = manager.useInputSink(this.sink);
      await manager.start();
      if (generation !== this.generation) return;
      if (!manager.video) {
        this.stop(true);
        return;
      }
      this.callbacks.video(manager.video);
      this.report("on");
    } catch {
      if (generation === this.generation) this.stop(true);
    }
  }

  stop(failed = false) {
    ++this.generation;
    this.manager?.stop();
    this.manager = null;
    this.release?.();
    this.release = null;
    this.sink.reset();
    this.callbacks.video(null);
    this.report(failed ? "error" : "off");
  }
}

export const CONTROLLER_CAMERA_FPS = 15;
export function controllerCameraConstraints(): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: CONTROLLER_CAMERA_FPS, max: CONTROLLER_CAMERA_FPS },
      facingMode: "user",
    },
  };
}
