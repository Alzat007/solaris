import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  MathUtils,
} from "three";
import { planets } from "../data/planets";
import { particles } from "../particles/ParticleEngine";
export function OrbitSystem() {
  const group = useRef<Group>(null);
  const colors = useMemo(
    () => ({ resting: new Color("#9e927e"), falling: new Color("#e9a465") }),
    [],
  );
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
    for (let index = 0; index < lines.length; index++) {
      const l = lines[index];
      const material = l.material as LineBasicMaterial;
      const delay = index * 0.022;
      const progress = Math.max(0, (particles.collapse - delay) / (1 - delay));
      material.opacity =
        0.19 *
        (1 - particles.focus * 0.93) *
        Math.max(0, (particles.intro - 0.55) * 2) *
        (1 + Math.sin(progress * Math.PI) * 0.8) *
        (1 - MathUtils.smoothstep(progress, 0.76, 1)) *
        (particles.explosion > 0
          ? Math.max(0, (particles.explosion - 0.65) / 0.35)
          : 1);
      material.color
        .copy(colors.resting)
        .lerp(colors.falling, particles.collapse);
      const shrink = Math.max(0.008, Math.pow(1 - progress, 1.4));
      l.scale.setScalar(shrink);
      l.rotation.z =
        Math.sin(progress * Math.PI) * (index % 2 === 0 ? 0.045 : -0.045);
    }
    group.current?.scale.set(1 + particles.dragIntensity * 0.025, 1, 1);
  });
  return (
    <group ref={group}>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}
