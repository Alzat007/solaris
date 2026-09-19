import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Mesh,
  MeshBasicMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { particles } from "../particles/ParticleEngine";
export function SolarFlare() {
  const ref = useRef<Mesh>(null);
  const curve = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(2.7, -0.6, 0.95),
          new Vector3(3.48, -0.22, 1),
          new Vector3(3.7, 0.8, 0.45),
          new Vector3(2.8, 1.14, 0.05),
        ]),
        64,
        0.015,
        5,
        false,
      ),
    [],
  );
  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = Math.pow(
        Math.max(0, Math.sin(clock.elapsedTime * 0.23)),
        4,
      );
      (ref.current.material as MeshBasicMaterial).opacity =
        pulse * 0.5 * (1 - particles.focus);
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.1) * 0.3;
    }
  });
  return (
    <mesh ref={ref} geometry={curve}>
      <meshBasicMaterial
        color="#ff9a35"
        transparent
        opacity={0}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
