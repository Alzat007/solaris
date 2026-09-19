import { colorManaged } from "../shaders/colorManagement";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color } from "three";
import { noise } from "../shaders/noise";
import { particles } from "../particles/ParticleEngine";
const vertex = `varying vec3 vPosition,vNormal,vView;varying vec2 vUv;void main(){vUv=uv;vPosition=position;vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`;
const fragment = `uniform vec3 uColor;uniform float uKind,uOpacity,uTime;varying vec3 vPosition,vNormal,vView;varying vec2 vUv;
void main(){vec3 p=normalize(vPosition);float n=fbm(p*8.);float grain=noise3(p*120.);vec3 c=uColor;
if(uKind<.5){float craters=pow(noise3(p*34.),3.);c*=.52+n*.65+grain*.16-craters*.22;}
else if(uKind<1.5){float clouds=fbm(p*5.+vec3(n*2.,0.,uTime*.012));c=mix(c*.55,vec3(.94,.81,.55),clouds);}
else if(uKind<3.5){c*=.45+n*.95+grain*.12;float polar=smoothstep(.83,.98,abs(p.y));c=mix(c,vec3(.81,.79,.71),polar*.75);}
else if(uKind<5.5){float stripes=sin(p.y*42.+n*7.);float fine=sin(p.y*145.+n*5.);c*=.7+stripes*.18+fine*.06+n*.18;float storm=exp(-length((vUv-vec2(.63,.44))*vec2(36.,65.)));c=mix(c,vec3(.56,.24,.12),storm*.9);}
else{c*=.68+n*.28+sin(p.y*28.+n*3.)*.025;}
float lit=max(dot(normalize(vNormal),normalize(vec3(-.7,.5,1.))),0.);float rim=pow(1.-max(dot(normalize(vNormal),normalize(vView)),0.),3.);c*=.12+lit*.98;c+=uColor*rim*.055;gl_FragColor=vec4(c,uOpacity);}`;
export function PlanetMaterial({
  color,
  kind,
  selected,
}: {
  color: string;
  kind: number;
  selected: boolean;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color(color) },
      uKind: { value: kind },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
    }),
    [color, kind],
  );
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uOpacity.value = selected
      ? 1 - particles.assembly * 0.85
      : 1 - particles.focus * 0.88;
  });
  return (
    <shaderMaterial
      uniforms={uniforms}
      vertexShader={vertex}
      fragmentShader={colorManaged(noise + fragment)}
      transparent
    />
  );
}
