import { Vector2, Vector3 } from "three";
export type ParticleState =
  | "REST"
  | "EXPLODE"
  | "ATTRACT"
  | "REPEL"
  | "VORTEX"
  | "COLLAPSE"
  | "ASSEMBLE";
export const particleStates: Record<ParticleState, number> = {
  REST: 0,
  EXPLODE: 1,
  ATTRACT: 2,
  REPEL: 3,
  VORTEX: 4,
  COLLAPSE: 5,
  ASSEMBLE: 6,
};
/** Shared GPU uniforms; no particle positions are rewritten on the CPU. */
export class ParticleEngine {
  state: ParticleState = "REST";
  handPosition3D = new Vector3(0, 0, 100);
  handNDC = new Vector2();
  handTargetNDC = new Vector2();
  cursorVisible = false;
  gesturePulse = 0;
  dragging = false;
  dragIntensity = 0;
  zoomIntensity = 0;
  rotationVelocity = 0;
  handVelocity = new Vector3();
  handDirection = new Vector3(0, 1, 0);
  handOpenness = 1;
  pinchStrength = 0;
  active = false;
  influence = 0;
  burst = 0;
  collapse = 0;
  explosion = 0;
  intro = 0;
  assembly = 0;
  switchDirection = 1;
  focus = 0;
  /** Smoothly blends the solar-system view into the surrounding solar interior. */
  sunInterior = 0;
  scale = 1;
  targetScale = 1;
  rotation = 0;
  targetRotation = 0;
  anchor = new Vector3();
  targetAnchor = new Vector3();
  interactionTime = 0;
  setState(state: ParticleState) {
    this.state = state;
  }
}
export const particles = new ParticleEngine();
