import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
} from "three";
import { planets } from "../data/planets";
import { particles } from "../particles/ParticleEngine";
export function OrbitSystem() {
  const group = useRef<Group>(null);
  const lines = useMemo(
    () =>
      planets.map((p) => {
        const g = new BufferGeometry(),
          points = [];
        for (let i = 0; i < 256; i++) {
          const a = (i / 256) * Math.PI * 2;
          points.push(Math.cos(a) * p.distance, 0, Math.sin(a) * p.distance);
        }
        g.setAttribute("position", new Float32BufferAttribute(points, 3));
        return new LineLoop(
          g,
          new LineBasicMaterial({
            color: "#9e927e",
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        );
      }),
    [],
  );
  useFrame(() => {
    for (const l of lines)
      (l.material as LineBasicMaterial).opacity =
        0.19 *
        (1 - particles.focus * 0.93) *
        Math.max(0, (particles.intro - 0.55) * 2) *
        (1 - particles.collapse) *
        (particles.explosion > 0
          ? Math.max(0, (particles.explosion - 0.65) / 0.35)
          : 1);
    group.current?.scale.setScalar(1 - particles.collapse * 0.997);
  });
  return (
    <group ref={group}>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}
