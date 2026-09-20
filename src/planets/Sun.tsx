import { colorManaged } from "../shaders/colorManagement";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, Group, type Mesh } from "three";
import { particles } from "../particles/ParticleEngine";
import { ParticleField } from "../particles/ParticleField";
import { noise } from "../shaders/noise";
import vertex from "../shaders/sun.vert?raw";
import fragment from "../shaders/sun.frag?raw";
import atmosphereVert from "../shaders/atmosphere.vert?raw";
import atmosphereFrag from "../shaders/atmosphere.frag?raw";
import { SolarFlare } from "./SolarFlare";
import { useSolaris } from "../interaction/store";
import { planetObjects } from "../scene/planetPicking";
import { gestureFeedback } from "../gesture/gestureFeedback";
const glowVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const glowFragment = `varying vec2 vUv;uniform float uOpacity;uniform float uTime;void main(){vec2 p=vUv-.5;float r=length(p)*2.;float a=atan(p.y,p.x);float glow=exp(-r*6.5)*.28;float corona=exp(-abs(r-.31)*22.)*.055;float rays=pow(.5+.5*sin(a*21.+sin(a*13.-uTime*.1)*2.),3.);glow+=rays*exp(-r*8.)*.045;gl_FragColor=vec4(1.,.28,.045,(glow+corona)*uOpacity);}`;
export function Sun() {
  const { hover, selected, transitioning } = useSolaris();
  const group = useRef<Group>(null),
    glow = useRef<Group>(null);
  const hoverRing = useRef<Mesh>(null);
  const surface = useMemo(
    () => ({ uTime: { value: 0 }, uOpacity: { value: 1 } }),
    [],
  );
  const corona = useMemo(
    () => ({
      uColor: { value: new Color("#ff8c2e") },
      uOpacity: { value: 0.22 },
    }),
    [],
  );
  useLayoutEffect(() => {
    const object = group.current!;
    object.userData.pickRadius = 3.05;
    planetObjects.set("sun", object);
    return () => {
      if (planetObjects.get("sun") === object) planetObjects.delete("sun");
    };
  }, []);
  useFrame(({ clock, camera }) => {
    if (!group.current) return;
    const birth =
      Math.max(0.001, particles.intro) *
      (particles.explosion > 0
        ? Math.max(0.003, Math.min(1, (particles.explosion - 0.28) / 0.64))
        : 1);
    const scale =
      (1 - particles.collapse * 0.988) * birth * (1 - particles.focus * 0.68);
    group.current.scale.setScalar(scale);
    group.current.position.set(-particles.focus * 10, 0, -particles.focus * 9);
    surface.uTime.value = clock.elapsedTime;
    surface.uOpacity.value = 1 - particles.focus * 0.8;
    corona.uOpacity.value =
      (0.19 + Math.sin(clock.elapsedTime * 0.8) * 0.025) *
      (1 - particles.focus * 0.7);
    glow.current?.quaternion.copy(camera.quaternion);
    if (hoverRing.current)
      hoverRing.current.scale.setScalar(
        1 - gestureFeedback.get().pinchProgress * 0.12,
      );
  });
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[3.05, 80, 64]} />
        <shaderMaterial
          uniforms={surface}
          vertexShader={vertex}
          fragmentShader={colorManaged(noise + fragment)}
          transparent
        />
      </mesh>
      {hover === "sun" && !selected && !transitioning && (
        <mesh ref={hoverRing} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.36, 3.39, 80]} />
          <meshBasicMaterial
            color="#ffe3b0"
            transparent
            opacity={0.8}
            side={2}
          />
        </mesh>
      )}
      <mesh scale={1.025}>
        <sphereGeometry args={[3.05, 48, 32]} />
        <shaderMaterial
          uniforms={corona}
          vertexShader={atmosphereVert}
          fragmentShader={atmosphereFrag}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={glow}>
        <mesh>
          <planeGeometry args={[21, 21]} />
          <shaderMaterial
            uniforms={surface}
            vertexShader={glowVertex}
            fragmentShader={glowFragment}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
      <SolarFlare />
      <ParticleField kind="sun" count={95000} color="#ec7625" radius={3.08} />
      <pointLight color="#ffc185" intensity={90} distance={70} decay={1.4} />
    </group>
  );
}
