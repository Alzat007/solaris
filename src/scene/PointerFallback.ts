import type { CelestialId } from "../gesture/gestureFeedback";
import { gestureConfig as config } from "../gesture/gestureConfig";

export interface PointerSample {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  timeStamp: number;
}
interface Contact {
  x: number;
  y: number;
  startX: number;
  startY: number;
  at: number;
  lastAt: number;
  target: CelestialId | null;
}
interface FallbackActions {
  locked(): boolean;
  overview(): boolean;
  focused(): boolean;
  width(): number;
  pick(x: number, y: number): CelestialId | null;
  point(x: number, y: number): void;
  select(id: CelestialId): unknown;
  next(direction: number): unknown;
  scale(value: number): boolean;
  endScale(): unknown;
  currentScale(): number;
  startDrag(): void;
  drag(dx: number, dt: number): void;
  endDrag(): void;
}
/** One shared pointer sequence owns selection, rotation or zoom until all
 * contacts lift. A drag/pinch can never turn into a release click. */
export class PointerFallback {
  private contacts = new Map<number, Contact>();
  private moved = false;
  private multiple = false;
  private dragging = false;
  private scaling = false;
  private initialDistance = 0;
  private initialScale = 1;
  constructor(private actions: FallbackActions) {}
  private distance() {
    const values = this.contacts.values();
    const a = values.next().value,
      b = values.next().value;
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  down(event: PointerSample) {
    if (this.actions.locked()) return false;
    if (!this.contacts.size) {
      this.moved = false;
      this.multiple = false;
    }
    this.actions.point(event.clientX, event.clientY);
    this.contacts.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      at: event.timeStamp,
      lastAt: event.timeStamp,
      target: this.actions.pick(event.clientX, event.clientY),
    });
    if (this.contacts.size >= 2) {
      this.multiple = true;
      this.actions.endDrag();
      this.dragging = false;
      this.initialDistance = Math.max(
        config.TOUCH_ZOOM_MIN_DISTANCE_PX,
        this.distance(),
      );
      this.initialScale = this.actions.currentScale();
    }
    return true;
  }
  move(event: PointerSample) {
    if (this.actions.locked()) {
      this.cancel();
      return;
    }
    this.actions.point(event.clientX, event.clientY);
    const contact = this.contacts.get(event.pointerId);
    if (!contact) return;
    const dx = event.clientX - contact.x;
    const dt = Math.max(
      config.POINTER_MIN_FRAME_SECONDS,
      (event.timeStamp - contact.lastAt) / 1000,
    );
    contact.x = event.clientX;
    contact.y = event.clientY;
    contact.lastAt = event.timeStamp;
    if (this.contacts.size >= 2) {
      if (
        this.actions.scale(
          (this.initialScale * this.distance()) / this.initialDistance,
        )
      )
        this.scaling = true;
      return;
    }
    if (this.multiple) return;
    const distance = Math.hypot(
      contact.x - contact.startX,
      contact.y - contact.startY,
    );
    if (
      distance >
      (event.pointerType === "touch"
        ? config.TOUCH_DRAG_START_PX
        : config.MOUSE_DRAG_START_PX)
    )
      this.moved = true;
    if (this.moved && this.actions.overview()) {
      if (!this.dragging) {
        this.actions.startDrag();
        this.dragging = true;
      }
      this.actions.drag(dx / Math.max(1, this.actions.width()), dt);
    }
  }
  up(event: PointerSample) {
    const contact = this.contacts.get(event.pointerId);
    if (!contact) return;
    // Some browsers deliver the final position only with pointerup.
    this.move(event);
    if (!this.contacts.has(event.pointerId)) return;
    this.contacts.delete(event.pointerId);
    if (this.scaling && this.contacts.size < 2) {
      this.actions.endScale();
      this.scaling = false;
    }
    if (this.contacts.size) return;
    this.actions.endDrag();
    this.dragging = false;
    if (this.actions.locked() || this.multiple) return;
    const elapsed = event.timeStamp - contact.at;
    const dx = event.clientX - contact.startX,
      dy = event.clientY - contact.startY;
    const width = Math.max(1, this.actions.width());
    if (
      event.pointerType === "touch" &&
      this.actions.focused() &&
      this.moved &&
      elapsed >= config.SWIPE_MIN_TIME &&
      elapsed <= config.SWIPE_WINDOW &&
      Math.abs(dx) / width >= config.SWIPE_DISTANCE &&
      Math.abs(dx) / width / (elapsed / 1000) >= config.SWIPE_VELOCITY &&
      Math.abs(dx) >= Math.abs(dy) * config.SWIPE_AXIS_RATIO
    ) {
      this.actions.next(dx < 0 ? 1 : -1);
      return;
    }
    if (
      !this.moved &&
      elapsed <= config.POINTER_TAP_MAX_TIME &&
      contact.target &&
      this.actions.pick(event.clientX, event.clientY) === contact.target
    )
      this.actions.select(contact.target);
  }
  cancel() {
    this.contacts.clear();
    if (this.scaling) this.actions.endScale();
    this.scaling = false;
    this.multiple = true;
    this.moved = true;
    this.actions.endDrag();
    this.dragging = false;
  }
}
