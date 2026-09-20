import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
} from "three";
import { particles } from "./ParticleEngine";
import { useSolaris } from "../interaction/store";

const vertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uCollapse, uCharge, uOpacity;
varying vec2 vUv;
varying float vAlpha, vHeat;

vec3 orbit(float progress) {
  float delay = aSeed.w * .12;
  float p = clamp((progress - delay) / (1. - delay), 0., 1.);
  float initialRadius = 4. + pow(aSeed.x, .65) * 25.;
  float radius = .3 + initialRadius * pow(1. - p, 1.55);
  float angle = aSeed.y * 6.283185 + uTime * (.035 + aSeed.x * .02)
    + p * (4. + aSeed.z * 3.) + uCharge * .18;
  float height = (aSeed.z - .5) * (1.2 + aSeed.x * 5.) * pow(1. - p, 1.8);
  vec3 falling = vec3(cos(angle) * radius, height, sin(angle) * radius);
  // A small, continuously feeding accretion cloud remains around the core.
  // It is independent of the planet hierarchy, which shrinks during collapse.
  float cycle = fract(aSeed.x + uTime * (.07 + aSeed.w * .035));
  float coreRadius = .33 + pow(1. - cycle, 2.) * (1.5 + aSeed.z);
  float coreAngle = aSeed.y * 6.283185 + uTime * (.5 + aSeed.z) + cycle * 4.;
  vec3 settled = vec3(cos(coreAngle) * coreRadius,
    sin(coreAngle * 1.7) * .18 * (1. - cycle), sin(coreAngle) * coreRadius);
  return mix(falling, settled, smoothstep(.89, 1., p));
}

void main() {
  vUv = uv;
  float tail = (.012 + aSeed.w * .045) * smoothstep(.015, .2, uCollapse);
  vec3 head = orbit(uCollapse);
  vec3 trail = orbit(max(0., uCollapse - tail));
  // A finite tail at the stable endpoint avoids vanishing into a single pixel.
  float settled = smoothstep(.9, 1., uCollapse);
  trail += vec3(-head.z, .08, head.x) * (.09 + aSeed.z * .12) * settled;
  vec4 headView = modelViewMatrix * vec4(head, 1.);
  vec4 tailView = modelViewMatrix * vec4(trail, 1.);
  vec2 direction = normalize(headView.xy - tailView.xy + vec2(.0001));
  vec2 side = vec2(-direction.y, direction.x);
  vec4 mv = mix(tailView, headView, uv.x);
  float width = .008 + aSeed.w * .016 + settled * .008;
  mv.xy += side * position.y * width;
  gl_Position = projectionMatrix * mv;
  float activity = max(uCharge * .16, smoothstep(.005, .13, uCollapse));
  vAlpha = uOpacity * activity * (.12 + aSeed.w * .4)
    * mix(1., .36, settled) * smoothstep(1., 4., -mv.z);
  vHeat = clamp(uCollapse * .5 + aSeed.z * .5, 0., 1.);
}
`;
const fragment = /* glsl */ `
varying vec2 vUv;
varying float vAlpha, vHeat;
void main() {
  float across = pow(max(0., 1. - abs(vUv.y * 2. - 1.)), 1.5);
  float along = smoothstep(0., .2, vUv.x) * (1. - smoothstep(.87, 1., vUv.x));
  vec3 color = mix(vec3(.32, .53, .68), vec3(1.7, .91, .32), vHeat);
  gl_FragColor = vec4(color, across * along * vAlpha);
}
`;
const planeVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;
const coreFragment = /* glsl */ `
varying vec2 vUv;
uniform float uTime, uCollapse, uCharge, uOpacity;
void main() {
  vec2 p = (vUv - .5) * 2.;
  float r = length(p);
  float angle = atan(p.y, p.x);
  float visibility = smoothstep(.15, .7, uCollapse) * uOpacity;
  float pulse = .94 + .06 * sin(uTime * 3.6);
  float heart = exp(-r * r * 950.) * 1.6;
  float glow = exp(-r * 19.) * .48;
  float corona = exp(-abs(r - .09 * pulse) * 125.) * .16;
  float rays = pow(.5 + .5 * sin(angle * 13. + sin(angle * 7. + uTime) * 1.2), 5.);
  glow += rays * exp(-r * 13.) * .075;
  // A visible, inward-moving pressure wave surrounds the stable energy core.
  float wave = 1. - fract(uTime * .45);
  float pressure = exp(-abs(r - (.12 + wave * .38)) * 90.)
    * sin(wave * 3.141593) * .09 * smoothstep(.75, 1., uCollapse);
  vec3 color = mix(vec3(1.35, .42, .09), vec3(2., 1.62, .9), exp(-r * 22.));
  gl_FragColor = vec4(color, (heart + glow + corona + pressure) * visibility);
}
`;
const diskFragment = /* glsl */ `
varying vec2 vUv;
uniform float uTime, uCollapse, uCharge, uOpacity;
void main() {
  vec2 p = (vUv - .5) * 2.;
  float r = length(p), angle = atan(p.y, p.x);
  float arms = pow(.5 + .5 * sin(angle * 5. + log(r + .025) * 12. - uTime * 1.4), 9.);
  float ring = exp(-abs(r - .28) * 24.);
  float edge = smoothstep(.04, .17, r) * (1. - smoothstep(.4, .95, r));
  float activity = max(uCharge * .2, smoothstep(.03, .3, uCollapse));
  vec3 color = mix(vec3(.26, .43, .58), vec3(1.4, .57, .17), uCollapse);
  gl_FragColor = vec4(color, (arms * .18 + ring * .09) * edge * activity * uOpacity);
}
`;

/** Three bounded draw calls; all infall trajectories are evaluated on the GPU. */
export function CollapseEffect() {
  const group = useRef<Group>(null),
    core = useRef<Mesh>(null),
    disk = useRef<Mesh>(null);
  const charge = useRef(0);
  const { quality } = useSolaris();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCollapse: { value: 0 },
      uCharge: { value: 0 },
      uOpacity: { value: 0 },
    }),
    [],
  );
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
    const seeds = new Float32Array(12000 * 4);
    let random = 29431;
    for (let i = 0; i < seeds.length; i++) {
      random = (random * 1664525 + 1013904223) >>> 0;
      seeds[i] = random / 4294967296;
    }
    g.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
    return g;
  }, []);
  useFrame(({ clock, camera }, dt) => {
    charge.current +=
      (particles.collapseCharge - charge.current) * (1 - Math.exp(-dt * 9));
    const collapse = particles.collapse;
    // Let the existing BigBang take over immediately, with a short core afterglow.
    const release =
      particles.explosion > 0 ? Math.max(0, 1 - particles.explosion / 0.14) : 1;
    const visible = (collapse > 0.001 || charge.current > 0.005) && release > 0;
    if (group.current) group.current.visible = visible;
    if (!visible) return;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uCollapse.value = collapse;
    uniforms.uCharge.value = charge.current;
    uniforms.uOpacity.value = release;
    geometry.instanceCount =
      quality === "HIGH" ? 12000 : quality === "MEDIUM" ? 6500 : 2400;
    if (core.current) core.current.quaternion.copy(camera.quaternion);
    if (disk.current) disk.current.scale.setScalar(1 - collapse * 0.7);
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>
      <mesh ref={disk} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[25, 25]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={planeVertex}
          fragmentShader={diskFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>
      <mesh ref={core} renderOrder={2}>
        <planeGeometry args={[12, 12]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={planeVertex}
          fragmentShader={coreFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
