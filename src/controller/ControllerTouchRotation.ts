import type { RemoteAction, RemotePayload } from "../remote/controlProtocol";
import { gestureConfig } from "../gesture/gestureConfig";

type Point = { x: number; y: number };
const bounded = (value: number) => Math.max(-0.15, Math.min(0.15, value));

/** Keep only recent displacement while transport applies backpressure. */
export class ControllerTouchRotation {
  private lastPoint: Point;
  private lastMotionAt = -Infinity;
  private pendingSince: number | null = null;

  constructor(
    point: Point,
    time: number,
    private readonly send: (
      action: RemoteAction,
      payload?: RemotePayload,
    ) => boolean,
  ) {
    this.lastPoint = point;
    if (send("ROTATE_START")) this.lastMotionAt = time;
  }

  move(point: Point, time: number) {
    const dx = bounded(point.x - this.lastPoint.x);
    const dy = bounded(point.y - this.lastPoint.y);
    if (Math.abs(dx) + Math.abs(dy) <= 1e-7) return;
    if (time - this.lastMotionAt >= 250) {
      this.lastPoint = point;
      this.pendingSince = null;
      if (this.send("ROTATE_START")) this.lastMotionAt = time;
      return;
    }
    if (
      this.pendingSince !== null &&
      time - this.pendingSince > gestureConfig.FRAME_GAP_RESET
    ) {
      this.lastPoint = point;
      this.pendingSince = null;
      return;
    }
    if (this.send("ROTATE", { dx, dy })) {
      this.lastPoint = point;
      this.lastMotionAt = time;
      this.pendingSince = null;
    } else this.pendingSince ??= time;
  }
}
