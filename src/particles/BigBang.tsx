import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Group,
  ShaderMaterial,
} from "three";
import { particles } from "./ParticleEngine";
import { useSolaris } from "../interaction/store";
const vertex = /*glsl*/ `attribute vec3 aDirection;attribute float aSeed;uniform float uProgress;varying vec2 vUv;varying float vAlpha,vSeed;
void main(){vUv=uv;vSeed=aSeed;float t=uProgress;float travel=(1.-exp(-t*8.))*(18.+aSeed*65.);vec3 center=aDirection*travel;vec4 mv=modelViewMatrix*vec4(center,1.);vec3 viewDir=normalize(mat3(modelViewMatrix)*aDirection);vec2 dir=normalize(viewDir.xy+vec2(.0001));vec2 side=vec2(-dir.y,dir.x);float streak=(.3+pow(1.-t,3.)*4.)*(.3+aSeed);mv.xy+=dir*position.x*streak+side*position.y*.015;gl_Position=projectionMatrix*mv;vAlpha=(1.-smoothstep(.13,.82,t))*(.2+aSeed*.8)*smoothstep(0.,.018,t)*smoothstep(1.,4.,-mv.z);}`;
const fragment = /*glsl*/ `varying vec2 vUv;varying float vAlpha,vSeed;void main(){float fade=pow(1.-abs(vUv.x*2.-1.),1.5)*(1.-abs(vUv.y*2.-1.));vec3 c=mix(vec3(.78,.32,.09),vec3(1.6,1.35,.85),vSeed);gl_FragColor=vec4(c,fade*vAlpha);}`;
export function BigBang() {
  const ref = useRef<Mesh>(null),
    flash = useRef<Mesh>(null),
    ring = useRef<Mesh>(null);
  const { quality } = useSolaris();
  const geometry = useMemo(() => {
    const g = new InstancedBufferGeometry();
    g.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
        3,
      ),
    );
    g.setAttribute(
      "uv",
      new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const directions = new Float32Array(18000 * 3),
      seeds = new Float32Array(18000);
    for (let i = 0; i < 18000; i++) {
      const a = Math.random() * Math.PI * 2,
        z = Math.random() * 2 - 1,
        r = Math.sqrt(1 - z * z);
      directions.set([Math.cos(a) * r, z, Math.sin(a) * r], i * 3);
      seeds[i] = Math.random();
    }
    g.setAttribute("aDirection", new InstancedBufferAttribute(directions, 3));
    g.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uProgress: { value: 0 } }), []);
  const glare = useMemo(() => ({ uOpacity: { value: 0 } }), []);
  useFrame(({ camera }) => {
    const t = particles.explosion;
    uniforms.uProgress.value = t;
    geometry.instanceCount =
      quality === "HIGH" ? 18000 : quality === "MEDIUM" ? 10000 : 4000;
    if (ref.current) ref.current.visible = t > 0 && t < 0.85;
    if (flash.current) {
      flash.current.quaternion.copy(camera.quaternion);
      glare.uOpacity.value =
        t > 0 ? Math.exp(-t * 45) * 1.1 : particles.collapse * 0.3;
      flash.current.scale.setScalar(t > 0 ? 1 + Math.min(t * 30, 1) * 5 : 0.3);
    }
    if (ring.current) {
      ring.current.quaternion.copy(camera.quaternion);
      ring.current.visible = t > 0 && t < 0.5;
      ring.current.scale.setScalar(0.1 + t * 90);
      (ring.current.material as ShaderMaterial).uniforms.uOpacity.value =
        Math.max(0, 1 - t * 2.5) * 0.4;
    }
  });
  return (
    <group>
      <mesh ref={ref} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={flash}>
        <planeGeometry args={[12, 12]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={glare}
          vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader="varying vec2 vUv;uniform float uOpacity;void main(){float r=length(vUv-.5);gl_FragColor=vec4(1.5,.95,.45,exp(-r*9.)*uOpacity);}"
        />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.97, 1, 128]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{ uOpacity: { value: 0 } }}
          vertexShader="void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader="uniform float uOpacity;void main(){gl_FragColor=vec4(.9,.55,.2,uOpacity);}"
        />
      </mesh>
    </group>
  );
}
