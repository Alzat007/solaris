import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  ShaderMaterial,
  Vector3,
  Points,
} from "three";
import { particles, particleStates } from "./ParticleEngine";
import {
  particleVertex,
  particleFragment,
  ringVertex,
} from "./ParticleShaders";
import { useSolaris } from "../interaction/store";
export function ParticleField({
  kind = "dust",
  count = 100000,
  color = "#ba9875",
  radius = 3.1,
}: {
  kind?: "dust" | "sun" | "ring" | "planet";
  count?: number;
  color?: string;
  radius?: number;
}) {
  const mesh = useRef<Points>(null),
    { quality, selected } = useSolaris();
  const geometry = useMemo(() => {
    const g = new BufferGeometry(),
      p = new Float32Array(count * 3),
      seed = new Float32Array(count),
      size = new Float32Array(count);
    let randomSeed = 1827;
    const rand = () => {
      randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
      return randomSeed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2,
        s = rand();
      seed[i] = s;
      size[i] = 0.1 + rand() * 0.29;
      if (kind === "ring") {
        const r = radius * (1.35 + rand() * 1.08);
        p[i * 3] = Math.cos(a) * r;
        p[i * 3 + 1] = (rand() - 0.5) * 0.025;
        p[i * 3 + 2] = Math.sin(a) * r;
        if (r / radius > 1.89 && r / radius < 1.96) size[i] *= 0.15;
      } else if (kind === "sun" || kind === "planet") {
        const y = rand() * 2 - 1,
          r =
            radius *
            (1 + Math.pow(rand(), 5) * (kind === "sun" ? 0.35 : 0.045));
        const q = Math.sqrt(1 - y * y);
        p[i * 3] = Math.cos(a) * q * r;
        p[i * 3 + 1] = y * r;
        p[i * 3 + 2] = Math.sin(a) * q * r;
      } else {
        const r = 4 + Math.pow(rand(), 0.65) * 23;
        p[i * 3] = Math.cos(a) * r;
        p[i * 3 + 1] = (rand() - 0.5) * (0.4 + rand() * 4);
        p[i * 3 + 2] = Math.sin(a) * r;
        size[i] *= 0.55;
      }
    }
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
    g.setAttribute("aSize", new Float32BufferAttribute(size, 1));
    return g;
  }, [count, kind, radius]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAssembly: { value: 0 },
      uCollapse: { value: 0 },
      uExplosion: { value: 0 },
      uBurst: { value: 0 },
      uIntro: { value: 0 },
      uInfluence: { value: 0 },
      uPinch: { value: 0 },
      uState: { value: 0 },
      uSize: { value: 1 },
      uOpacity: { value: 1 },
      uHand: { value: new Vector3() },
      uVelocity: { value: new Vector3() },
      uColor: { value: new Color(color) },
    }),
    [color],
  );
  const localHand = useMemo(() => new Vector3(), []),
    localVelocity = useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const u = uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uAssembly.value =
      kind === "planet"
        ? particles.assembly
        : kind === "sun"
          ? (1 - particles.intro) * 1.8
          : 0;
    u.uCollapse.value = kind === "dust" ? particles.collapse : 0;
    u.uExplosion.value = particles.explosion;
    u.uBurst.value = particles.burst;
    u.uIntro.value = particles.intro;
    u.uInfluence.value = particles.influence;
    u.uPinch.value = particles.pinchStrength;
    u.uState.value = particleStates[particles.state];
    u.uSize.value = quality === "LOW" ? 1.4 : 1;
    localHand.copy(particles.handPosition3D);
    mesh.current.worldToLocal(localHand);
    u.uHand.value.copy(localHand);
    localVelocity.copy(particles.handPosition3D).add(particles.handVelocity);
    mesh.current.worldToLocal(localVelocity).sub(localHand);
    u.uVelocity.value.copy(localVelocity);
    u.uOpacity.value =
      kind === "dust"
        ? 0.115 * (1 - particles.focus * 0.75) + particles.explosion * 0.3
        : kind === "sun"
          ? 0.33 * (1 - particles.focus * 0.8)
          : 0.48 * (selected && selected !== "saturn" ? 0.05 : 1);
    if (kind === "planet") u.uOpacity.value = particles.assembly * 0.8;
    geometry.setDrawRange(
      0,
      Math.floor(
        count * (quality === "HIGH" ? 1 : quality === "MEDIUM" ? 0.5 : 0.2),
      ),
    );
  });
  return (
    <points ref={mesh} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={kind === "ring" ? ringVertex : particleVertex}
        fragmentShader={particleFragment}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
