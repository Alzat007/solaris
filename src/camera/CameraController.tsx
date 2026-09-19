import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, Quaternion, Vector3 } from "three";
import { particles } from "../particles/ParticleEngine";
export type CameraMode =
  | "SOLAR_VIEW"
  | "PLANET_VIEW"
  | "TRANSITION"
  | "CINEMATIC"
  | "BIG_BANG";
export function CameraController() {
  const { camera, size } = useThree();
  const position = useMemo(() => new Vector3(), []),
    target = useMemo(() => new Vector3(), []),
    matrix = useMemo(() => new Matrix4(), []),
    rotation = useMemo(() => new Quaternion(), []);
  useFrame(({ clock }, dt) => {
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
    camera.position.lerp(position, 1 - Math.exp(-dt * 3));
    matrix.lookAt(camera.position, target, camera.up);
    rotation.setFromRotationMatrix(matrix);
    camera.quaternion.slerp(rotation, 1 - Math.exp(-dt * 4));
  });
  return null;
}
