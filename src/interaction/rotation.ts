import { particles } from "../particles/ParticleEngine";
import { gestureConfig as config } from "../gesture/gestureConfig";
export const rotation = {
  start() {
    particles.dragging = true;
    particles.rotationVelocity = 0;
  },
  move(deltaX: number, dt: number) {
    if (!particles.dragging || !Number.isFinite(deltaX)) return;
    const elapsed = Math.max(0.008, Math.min(0.1, dt));
    const speed = Math.max(
      -config.DRAG_MAX_SPEED,
      Math.min(
        config.DRAG_MAX_SPEED,
        (deltaX * config.DRAG_ROTATION_GAIN) / elapsed,
      ),
    );
    particles.rotationVelocity +=
      (speed - particles.rotationVelocity) *
      (1 - Math.exp(-elapsed * config.DRAG_VELOCITY_RESPONSE));
    particles.targetRotation += particles.rotationVelocity * elapsed;
  },
  end() {
    particles.dragging = false;
  },
  stop() {
    particles.dragging = false;
    particles.rotationVelocity = 0;
  },
  update(dt: number, locked = false) {
    if (locked) this.stop();
    const elapsed = Math.min(dt, 0.05);
    if (!particles.dragging) {
      particles.targetRotation += particles.rotationVelocity * elapsed;
      particles.rotationVelocity *= Math.exp(
        -config.ROTATION_DAMPING * elapsed,
      );
      if (Math.abs(particles.rotationVelocity) < config.ROTATION_STOP_SPEED)
        particles.rotationVelocity = 0;
    }
    particles.dragIntensity +=
      ((particles.dragging ? 1 : 0) - particles.dragIntensity) *
      (1 - Math.exp(-elapsed * 8));
    particles.gesturePulse *= Math.exp(-elapsed * 8);
    particles.zoomIntensity *= Math.exp(-elapsed * 5);
  },
};
