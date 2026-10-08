import { colorManaged } from "../shaders/colorManagement";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AdditiveBlending, Color } from "three";
import { PlanetBase } from "./PlanetBase";
import { particles } from "../particles/ParticleEngine";
import { useSolaris } from "../interaction/store";
import atmosphereVert from "../shaders/atmosphere.vert?raw";
import atmosphereFrag from "../shaders/atmosphere.frag?raw";
import { noise } from "../shaders/noise";
import { CountryOutlineLayer } from "../exploration/CountryOutlineLayer";
import { isEarthAtlasVisible } from "../exploration/earthAtlasState";
import {
  earthAtlasView,
  useEarthAtlasView,
} from "../exploration/earthAtlasProjection";
function EarthSurface() {
  const [day, night] = useTexture([
    `${import.meta.env.BASE_URL}textures/earth-day.jpg`,
    `${import.meta.env.BASE_URL}textures/earth-night.png`,
  ]);
  const { selected } = useSolaris();
  const uniforms = useMemo(
    () => ({
      uDay: { value: day },
      uNight: { value: night },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
    }),
    [day, night],
  );
  useFrame(({ clock }) => {
    uniforms.uOpacity.value =
      selected === "earth"
        ? 1 - particles.assembly * 0.85
        : 1 - particles.focus * 0.88;
    uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <shaderMaterial
      uniforms={uniforms}
      transparent
      vertexShader={`varying vec2 vUv;varying vec3 vNormal,vPos;void main(){vUv=uv;vPos=position;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={colorManaged(
        noise +
          `uniform sampler2D uDay,uNight;uniform float uOpacity,uTime;varying vec2 vUv;varying vec3 vNormal,vPos;void main(){float light=dot(normalize(vNormal),normalize(vec3(-1.,.25,.6)));vec3 day=texture2D(uDay,vUv).rgb;vec3 night=texture2D(uNight,vUv).rgb;float cloud=smoothstep(.59,.72,fbm(vPos*9.+vec3(uTime*.008,0.,0.)))*.42;day=mix(day,vec3(.9),cloud);vec3 c=day*(.05+max(light,0.)*.95)+night*pow(1.-max(light,0.),5.)*.65;gl_FragColor=vec4(c,uOpacity);}`,
      )}
    />
  );
}
export function Earth() {
  const state = useSolaris();
  const atlas = useEarthAtlasView();
  const { selected } = state;
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color("#72bbeb") },
      uOpacity: { value: 0.32 },
    }),
    [],
  );
  useFrame(() => {
    uniforms.uOpacity.value = selected === "earth" ? 0.2 : 0.15;
  });
  return (
    <PlanetBase
      id="earth"
      surface={<EarthSurface />}
      surfaceChildren={
        <CountryOutlineLayer
          visible={isEarthAtlasVisible(state) && atlas.showBoundaries}
          onStatus={(countries) => earthAtlasView.set({ countries })}
        />
      }
    >
      <mesh scale={1.018}>
        <sphereGeometry args={[1, 48, 32]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={atmosphereVert}
          fragmentShader={atmosphereFrag}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </PlanetBase>
  );
}
