import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MathUtils,
  Mesh,
  TubeGeometry,
  Vector3,
} from "three";
import { particles } from "../particles/ParticleEngine";
import { useSolaris } from "../interaction/store";
import { colorManaged } from "../shaders/colorManagement";
import { noise } from "../shaders/noise";

const starVertex = /* glsl */ `
attribute float aSeed;
attribute float aSize;
uniform float uTime, uReveal, uPixelScale;
varying float vSeed, vAlpha;
void main() {
  vec3 p = position;
  float angle = uTime * (.009 + aSeed * .009);
  mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  p.xz = turn * p.xz;
  p.x += sin(p.y * .14 + uTime * .12 + aSeed * 13.) * .45;
  p.y += cos(p.z * .1 + uTime * .08 + aSeed * 9.) * .4;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPixelScale / max(.1, -mv.z), 1.1, 21.);
  vSeed = aSeed;
  vAlpha = uReveal * smoothstep(.35, 2.5, -mv.z)
    * (.65 + .35 * sin(uTime * (.5 + aSeed) + aSeed * 80.));
}`;
const starFragment = colorManaged(/* glsl */ `
varying float vSeed, vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2. - 1.;
  float r = length(p);
  if (r > 1.) discard;
  float halo = exp(-r * 5.) * .22;
  float core = exp(-r * r * 32.);
  float rays = (exp(-abs(p.x) * 65.) + exp(-abs(p.y) * 65.))
    * pow(1. - r, 3.) * step(.94, vSeed) * .3;
  vec3 color = mix(vec3(1.45, .22, .025), vec3(1.8, 1.22, .47), vSeed);
  color = mix(color, vec3(2.5, 2.1, 1.4), smoothstep(.86, 1., vSeed));
  gl_FragColor = vec4(color, (halo + core + rays) * vAlpha * .86);
}`);
const volumeVertex = /* glsl */ `
varying vec3 vPosition;
void main() {
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;
const volumeFragment = colorManaged(
  noise +
    /* glsl */ `
uniform float uTime, uReveal;
varying vec3 vPosition;
void main() {
  vec3 d = normalize(vPosition);
  vec3 flow = d * 3.4 + vec3(uTime * .011, -uTime * .008, 0.);
  float mist = noise3(flow) * .7 + noise3(flow * 2.4) * .3;
  float band = exp(-abs(d.y + sin(d.x * 3.5 + d.z * 2.) * .27) * 5.);
  vec3 color = vec3(.004, .001, .0008);
  color += vec3(.14, .025, .003) * pow(mist, 3.) * (.35 + band);
  gl_FragColor = vec4(color, uReveal);
}`,
);
const ribbonVertex = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.y += sin(p.x * .1 + uTime * .11) * .7;
  p.x += cos(p.z * .09 - uTime * .09) * .5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
const ribbonFragment = colorManaged(/* glsl */ `
uniform float uTime, uReveal;
varying vec2 vUv;
void main() {
  float filament = .5 + .5 * sin(vUv.x * 100. - uTime * .6);
  float flowing = pow(.5 + .5 * sin(vUv.x * 17. - uTime * .13), 3.);
  float edge = pow(abs(sin(vUv.y * 3.141593)), 2.);
  vec3 color = mix(vec3(.48, .065, .005), vec3(1.7, .48, .035), flowing);
  gl_FragColor = vec4(color, uReveal * edge * (.065 + filament * .075));
}`);
const warpVertex = /* glsl */ `
attribute vec3 aDirection;
attribute float aSeed;
uniform float uWarp;
varying vec2 vUv;
varying float vAlpha, vSeed;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vec3 center = aDirection * (5. + aSeed * 68.);
  vec4 mv = modelViewMatrix * vec4(center, 1.);
  vec2 outward = normalize(mv.xy + vec2(.0001));
  vec2 side = vec2(-outward.y, outward.x);
  mv.xy += outward * position.x * (.05 + uWarp * (1. + aSeed * 3.8))
    + side * position.y * .014;
  gl_Position = projectionMatrix * mv;
  vAlpha = uWarp * smoothstep(.5, 4., -mv.z);
}`;
const warpFragment = colorManaged(/* glsl */ `
varying vec2 vUv;
varying float vAlpha, vSeed;
void main() {
  float fade = pow(1. - abs(vUv.x * 2. - 1.), 1.5)
    * (1. - abs(vUv.y * 2. - 1.));
  gl_FragColor = vec4(mix(vec3(1.4, .23, .02), vec3(2., 1.4, .6), vSeed),
    fade * vAlpha * .75);
}`);
const veilFragment = colorManaged(/* glsl */ `
uniform float uWarp;
varying vec2 vUv;
void main() {
  float center = exp(-length((vUv - .5) * vec2(1.35, 1.)) * 5.);
  float flash = pow(uWarp, 7.);
  gl_FragColor = vec4(vec3(.6, .12, .009) + vec3(1.6, .95, .35) * center,
    flash * (.62 + center * .28));
}`);

/** A volume around the camera: nearby embers, distant stars and flowing filaments. */
export function SunInterior() {
  const root = useRef<Group>(null);
  const veil = useRef<Mesh>(null);
  const warp = useRef<Mesh>(null);
  const { quality } = useSolaris();
  const forward = useMemo(() => new Vector3(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uWarp: { value: 0 },
      uPixelScale: { value: 400 },
    }),
    [],
  );
  const geometry = useMemo(() => {
    const points = new Float32Array(32000 * 3);
    const seeds = new Float32Array(32000);
    const sizes = new Float32Array(32000);
    let seed = 82726;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < seeds.length; i++) {
      const azimuth = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      // Continuous radii give real depth and parallax, including the space behind us.
      const radius = 3 + Math.pow(random(), 0.8) * 82;
      const horizontal = Math.sqrt(1 - y * y) * radius;
      points.set(
        [
          Math.cos(azimuth) * horizontal,
          y * radius,
          Math.sin(azimuth) * horizontal,
        ],
        i * 3,
      );
      seeds[i] = random();
      sizes[i] = 0.07 + Math.pow(random(), 3) * 0.42;
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(points, 3));
    result.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
    result.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    return result;
  }, []);
  const warpGeometry = useMemo(() => {
    const result = new InstancedBufferGeometry();
    result.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
        3,
      ),
    );
    result.setAttribute(
      "uv",
      new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
    );
    result.setIndex([0, 1, 2, 0, 2, 3]);
    const directions = new Float32Array(2200 * 3);
    const seeds = new Float32Array(2200);
    for (let i = 0; i < seeds.length; i++) {
      const y = 1 - (i / seeds.length) * 2;
      const angle = i * 2.399963229728653;
      const radius = Math.sqrt(1 - y * y);
      directions.set(
        [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
        i * 3,
      );
      seeds[i] = (i * 0.61803398875) % 1;
    }
    result.setAttribute(
      "aDirection",
      new InstancedBufferAttribute(directions, 3),
    );
    result.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    return result;
  }, []);
  const ribbons = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const path: Vector3[] = [];
        const radius = 15 + index * 5;
        for (let step = 0; step <= 80; step++) {
          const angle = (step / 80) * Math.PI * 2;
          const twist = angle + index * 1.15;
          path.push(
            new Vector3(
              Math.cos(angle) * radius,
              Math.sin(twist * 2) * (3 + index * 1.1) + (index - 2.5) * 2,
              Math.sin(angle) * radius + Math.sin(twist * 3) * 3,
            ),
          );
        }
        return new TubeGeometry(
          new CatmullRomCurve3(path),
          200,
          0.035 + index * 0.011,
          4,
          true,
        );
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      warpGeometry.dispose();
      ribbons.forEach((ribbon) => ribbon.dispose());
    },
    [geometry, warpGeometry, ribbons],
  );

  useFrame(({ clock, camera, gl, size }) => {
    const progress = MathUtils.clamp(particles.sunInterior, 0, 1);
    if (root.current) root.current.visible = progress > 0.002;
    if (progress <= 0.002) return;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uReveal.value = MathUtils.smoothstep(progress, 0.22, 0.75);
    uniforms.uWarp.value = Math.sin(
      Math.PI * MathUtils.smoothstep(progress, 0.06, 0.99),
    );
    uniforms.uPixelScale.value = size.height * gl.getPixelRatio() * 0.68;
    geometry.setDrawRange(
      0,
      quality === "HIGH" ? 32000 : quality === "MEDIUM" ? 16000 : 12000,
    );
    warpGeometry.instanceCount =
      quality === "HIGH" ? 2200 : quality === "MEDIUM" ? 1400 : 700;
    if (warp.current) warp.current.visible = uniforms.uWarp.value > 0.015;
    if (veil.current) {
      veil.current.visible = uniforms.uWarp.value > 0.1;
      camera.getWorldDirection(forward);
      veil.current.position.copy(camera.position).add(forward);
      veil.current.quaternion.copy(camera.quaternion);
      veil.current.scale.set(Math.max(2, (size.width / size.height) * 2), 2, 1);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh renderOrder={-2}>
        <sphereGeometry args={[110, 32, 20]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={volumeVertex}
          fragmentShader={volumeFragment}
          side={BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={starVertex}
          fragmentShader={starFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
      {ribbons.map((ribbon, index) => (
        <mesh key={index} geometry={ribbon}>
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={ribbonVertex}
            fragmentShader={ribbonFragment}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
      <mesh ref={warp} geometry={warpGeometry} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={warpVertex}
          fragmentShader={warpFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={veil} renderOrder={20} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader={veilFragment}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
