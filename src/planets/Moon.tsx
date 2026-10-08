import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { SRGBColorSpace } from "three";
import { useSolaris } from "../interaction/store";
import { particles } from "../particles/ParticleEngine";
import { colorManaged } from "../shaders/colorManagement";
import { PlanetBase } from "./PlanetBase";

function MoonSurface() {
  const map = useTexture(`${import.meta.env.BASE_URL}textures/moon-day.jpg`);
  map.colorSpace = SRGBColorSpace;
  const { selected } = useSolaris();
  const uniforms = useMemo(
    () => ({ uMap: { value: map }, uOpacity: { value: 1 } }),
    [map],
  );
  useFrame(() => {
    uniforms.uOpacity.value =
      selected === "moon"
        ? 1 - particles.assembly * 0.85
        : 1 - particles.focus * 0.88;
  });
  return (
    <shaderMaterial
      uniforms={uniforms}
      transparent
      vertexShader={`varying vec2 vUv;varying vec3 vNormal;void main(){vUv=uv;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={colorManaged(
        `uniform sampler2D uMap;uniform float uOpacity;varying vec2 vUv;varying vec3 vNormal;void main(){float light=max(dot(normalize(vNormal),normalize(vec3(-.7,.5,1.))),0.);vec3 albedo=texture2D(uMap,vUv).rgb;vec3 c=albedo*(.18+light*.82);gl_FragColor=vec4(c,uOpacity);}`,
      )}
    />
  );
}

export function Moon() {
  return <PlanetBase id="moon" surface={<MoonSurface />} />;
}
