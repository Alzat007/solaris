import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  Color,
  MathUtils,
  type PointsMaterial,
} from "three";
import { particles } from "../particles/ParticleEngine";
export function StarField() {
  const ref = useRef<Points>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry(),
      p = [],
      c = [];
    for (let i = 0; i < 1900; i++) {
      const a = Math.random() * Math.PI * 2,
        z = Math.random() * 2 - 1,
        r = 75 + Math.random() * 65;
      p.push(
        Math.cos(a) * Math.sqrt(1 - z * z) * r,
        z * r,
        Math.sin(a) * Math.sqrt(1 - z * z) * r,
      );
      const color = new Color(
        i % 11 === 0 ? "#d1b992" : i % 9 === 0 ? "#8fabb8" : "#c5c4bf",
      ).multiplyScalar(0.25 + Math.random() * 0.6);
      c.push(color.r, color.g, color.b);
    }
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    g.setAttribute("color", new Float32BufferAttribute(c, 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y =
        clock.elapsedTime * 0.0007 + particles.collapse * 2.4;
      ref.current.scale.setScalar(
        Math.max(0.012, Math.pow(1 - particles.collapse, 1.35)),
      );
      (ref.current.material as PointsMaterial).opacity =
        0.85 * (1 - MathUtils.smoothstep(particles.collapse, 0.35, 0.94));
    }
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.085}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
