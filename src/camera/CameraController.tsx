import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Matrix4,
  MathUtils,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { particles } from "../particles/ParticleEngine";
import { descentPhase } from "../exploration/sceneState";
import { store } from "../interaction/store";
import { isPlanetStoryOpen } from "../exploration/planetAtlasState";
export type CameraMode =
  | "SOLAR_VIEW"
  | "PLANET_VIEW"
  | "TRANSITION"
  | "CINEMATIC"
  | "SUN_INTERIOR"
  | "BIG_BANG";
export function CameraController() {
  const { camera, size } = useThree();
  const position = useMemo(() => new Vector3(), []),
    target = useMemo(() => new Vector3(), []),
    interiorPosition = useMemo(() => new Vector3(), []),
    interiorTarget = useMemo(() => new Vector3(), []),
    matrix = useMemo(() => new Matrix4(), []),
    rotation = useMemo(() => new Quaternion(), []);
  useFrame(({ clock }, dt) => {
    if (isPlanetStoryOpen(store.get())) return;
    const focus = particles.focus;
    const mobile = size.width < 700;
    const impact = particles.burst * (particles.explosion > 0 ? 1 : 0);
    position.set(
      Math.sin(clock.elapsedTime * 0.055) * 0.35 * (1 - focus),
      15 * (1 - focus) + focus * 3.5,
      (mobile ? 45 : 32) * (1 - focus) + (mobile ? 21 : 17) * focus,
    );
    position.x += particles.assembly * particles.switchDirection * 0.4 * focus;
    position.z += impact * 1.8;
    position.x += Math.sin(clock.elapsedTime * 31) * impact * 0.09;
    target.set(0, mobile ? -5.5 * (1 - focus) - 1.3 * focus : 0, focus * 2.4);
    const approach = particles.locationApproach;
    const phase = descentPhase(approach);
    const approachDistance = 6.3;
    // Keep the approach outside the scaled planet, including prior user zoom.
    position.lerp(
      interiorPosition.set(
        particles.anchor.x,
        particles.anchor.y +
          (0.3 + (approachDistance - 3.5) * Math.tan((13.3 * Math.PI) / 180)) *
            particles.scale,
        particles.anchor.z + approachDistance * particles.scale,
      ),
      phase.orbit,
    );
    target.lerp(
      interiorTarget.set(
        particles.anchor.x,
        particles.anchor.y + 0.3 * particles.scale,
        particles.anchor.z + 3.5 * particles.scale,
      ),
      phase.orbit,
    );
    if (phase.localVisible) {
      // The opaque atmosphere/dust handoff conceals the change of scene scale.
      const local = MathUtils.smoothstep(phase.local, 0, 1);
      position.set(
        0,
        MathUtils.lerp(55, mobile ? 31 : 20, local),
        MathUtils.lerp(48, mobile ? 34 : 21, local),
      );
      target.set(0, 0, mobile ? 1 : 0);
    }
    const interior = MathUtils.smoothstep(particles.sunInterior, 0, 1);
    const time = clock.elapsedTime;
    interiorPosition.set(
      Math.sin(time * 0.11) * 0.8,
      Math.sin(time * 0.08) * 0.4,
      0.6 + Math.cos(time * 0.07) * 0.35,
    );
    interiorTarget.set(
      Math.sin(time * 0.045) * 5,
      Math.sin(time * 0.055) * 2,
      -20,
    );
    position.lerp(interiorPosition, interior);
    target.lerp(interiorTarget, interior);
    camera.position.lerp(position, 1 - Math.exp(-dt * 3));
    matrix.lookAt(camera.position, target, camera.up);
    rotation.setFromRotationMatrix(matrix);
    camera.quaternion.slerp(rotation, 1 - Math.exp(-dt * 4));
    if (camera instanceof PerspectiveCamera) {
      const fov = 43 + interior * 17;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
  });
  return null;
}
