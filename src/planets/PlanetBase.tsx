import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { planets, type PlanetId } from "../data/planets";
import { useSolaris, store } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import { particles } from "../particles/ParticleEngine";
import { PlanetMaterial } from "./PlanetMaterial";
import { ParticleField } from "../particles/ParticleField";
import { planetObjects } from "../scene/planetPicking";
export function PlanetBase({
  id,
  children,
  surface,
}: {
  id: PlanetId;
  children?: ReactNode;
  surface?: ReactNode;
}) {
  const data = planets.find((p) => p.id === id)!;
  const root = useRef<Group>(null),
    body = useRef<Group>(null);
  const { selected, hover } = useSolaris();
  const active = selected === id;
  const target = useMemo(() => new Vector3(), []);
  const isHover = hover === id;
  const wasActive = useRef(false),
    exitAmount = useRef(0);
  const focusTarget = useMemo(() => new Vector3(), []);
  useLayoutEffect(() => {
    const object = root.current!;
    planetObjects.set(id, object);
    return () => {
      if (planetObjects.get(id) === object) planetObjects.delete(id);
    };
  }, [id]);
  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const angle =
      data.angle +
      clock.elapsedTime * data.orbitSpeed * 0.3 +
      particles.rotation;
    target.set(
      Math.cos(angle) * data.distance,
      0,
      Math.sin(angle) * data.distance,
    );
    const f = particles.focus;
    if (wasActive.current && !active) exitAmount.current = 1;
    wasActive.current = active;
    exitAmount.current *= Math.exp(-delta * 3);
    if (active) {
      focusTarget.set(
        particles.switchDirection * particles.assembly * 5 * f,
        0.3,
        3.5,
      );
      target.lerp(focusTarget, f);
    } else if (f > 0) {
      target.multiplyScalar(1 + f * 0.18);
      if (exitAmount.current > 0.02)
        target.lerp(
          focusTarget.set(-particles.switchDirection * 11, 0.3, 3.5),
          exitAmount.current,
        );
    }
    const birth = Math.min(
      1,
      Math.max(
        0,
        (particles.intro - 0.22 - planets.indexOf(data) * 0.035) * 2.2,
      ),
    );
    target.multiplyScalar(1 - particles.collapse * 0.998);
    root.current.position.lerp(target, 1 - Math.exp(-delta * (active ? 5 : 8)));
    const visual = active
      ? data.visualRadius +
        ((data.id === "saturn" ? 2.35 : 2.6) - data.visualRadius) * f
      : data.visualRadius;
    const reassembly =
      particles.explosion > 0
        ? Math.max(
            0.001,
            Math.min(
              1,
              (particles.explosion - 0.35 - planets.indexOf(data) * 0.025) /
                0.35,
            ),
          )
        : 1;
    target.multiplyScalar(reassembly);
    const desired = Math.max(
      0.0001,
      visual * birth * (1 - particles.collapse * 0.995) * reassembly,
    );
    root.current.scale.lerp(
      new Vector3(desired, desired, desired),
      1 - Math.exp(-delta * 6),
    );
    if (body.current) body.current.rotation.y += delta * data.rotationSpeed;
  });
  return (
    <group ref={root}>
      <group ref={body}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation();
            store.set({ hover: id });
          }}
          onPointerOut={() => store.set({ hover: null })}
          onClick={(e) => {
            e.stopPropagation();
            interaction.select(id);
          }}
        >
          <sphereGeometry args={[1, 56, 40]} />
          {surface || (
            <PlanetMaterial
              color={data.color}
              kind={data.kind}
              selected={active}
            />
          )}
        </mesh>
      </group>
      {children}
      {active && (
        <ParticleField
          kind="planet"
          count={18000}
          radius={1.03}
          color={data.particleColor}
        />
      )}
      {!selected && (
        <Html
          position={[0, 1.65, 0]}
          center
          distanceFactor={23}
          className={`planet-label ${isHover ? "is-hover" : ""}`}
          style={{ pointerEvents: "none" }}
        >
          <span>{data.chineseName}</span>
          <i />
        </Html>
      )}
      {isHover && !selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.24, 1.27, 64]} />
          <meshBasicMaterial
            color="#ded5bb"
            transparent
            opacity={0.8}
            side={2}
          />
        </mesh>
      )}
    </group>
  );
}
