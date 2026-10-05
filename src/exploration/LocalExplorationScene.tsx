import { Suspense, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Line, useTexture } from "@react-three/drei";
import { Color, DoubleSide, Group, Mesh, SRGBColorSpace, Vector3 } from "three";
import { useSolaris } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import { particles } from "../particles/ParticleEngine";
import { assets } from "./content";
import { getImmersiveSite, type ImmersiveSite } from "./immersiveCatalog";
import { descentPhase, localAtlasPoint } from "./sceneState";
import { noise } from "../shaders/noise";
import { colorManaged } from "../shaders/colorManagement";
import { placeHotspotLabels } from "./hotspotLayout";
import "./localScene.css";

function OrbitalSurface({ path }: { path: string }) {
  const texture = useTexture(`${import.meta.env.BASE_URL}${path}`);
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <planeGeometry args={[22, 22]} />
      <meshBasicMaterial map={texture} side={DoubleSide} color="#d4c5b6" />
    </mesh>
  );
}

function CityAtlas() {
  const blocks = useMemo(
    () =>
      Array.from({ length: 112 }, (_, i) => {
        const column = i % 14,
          row = Math.floor(i / 14);
        return {
          x: (column - 6.5) * 1.15,
          z: (row - 3.5) * 1.4 + 2,
          height: 0.07 + ((i * 17) % 11) * 0.016,
        };
      }),
    [],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#243f35" roughness={0.95} />
      </mesh>
      <gridHelper
        args={[24, 24, "#769a89", "#385a4b"]}
        position={[0, 0.04, 0]}
      />
      {blocks.map((block, i) => (
        <mesh key={i} position={[block.x, block.height / 2, block.z]}>
          <boxGeometry args={[0.73, block.height, 0.8]} />
          <meshStandardMaterial
            color={i % 4 === 0 ? "#779180" : "#456958"}
            roughness={0.85}
          />
        </mesh>
      ))}
      <mesh position={[-4.6, 0.3, -7]} rotation={[-Math.PI / 2, 0, -0.3]}>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color="#416552" roughness={1} />
      </mesh>
    </group>
  );
}

function Hotspots({ site }: { site: ImmersiveSite }) {
  const s = useSolaris();
  const { size } = useThree();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const connectors = useRef<(HTMLSpanElement | null)[]>([]);
  const points = useMemo(
    () =>
      site.hotspots.map((h) => localAtlasPoint(site, h.latitude, h.longitude)),
    [site],
  );
  const projected = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const anchors = points.map((point, index) => {
      projected.copy(point).project(camera);
      return {
        x: ((projected.x + 1) * size.width) / 2,
        y: ((1 - projected.y) * size.height) / 2,
        width: buttons.current[index]?.offsetWidth ?? 130,
        height: buttons.current[index]?.offsetHeight ?? 42,
      };
    });
    const labels = placeHotspotLabels(anchors, size);
    labels.forEach((label, index) => {
      const button = buttons.current[index],
        connector = connectors.current[index];
      if (button) {
        button.style.left = `${label.x - label.width / 2}px`;
        button.style.top = `${label.y - label.height / 2}px`;
      }
      if (connector) {
        const anchor = anchors[index],
          dx = label.x - anchor.x,
          dy = label.y - anchor.y;
        connector.style.left = `${anchor.x}px`;
        connector.style.top = `${anchor.y}px`;
        connector.style.width = `${Math.hypot(dx, dy)}px`;
        connector.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      }
    });
  });
  return (
    <group>
      {site.hotspots.map((hotspot) => {
        const point = localAtlasPoint(
          site,
          hotspot.latitude,
          hotspot.longitude,
        );
        const selected = s.activeHotspotId === hotspot.id;
        return (
          <group key={hotspot.id} position={point}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.22, 0.28, 48]} />
              <meshBasicMaterial
                color={selected ? "#ffdd87" : "#8be6ce"}
                transparent
                opacity={0.9}
                side={DoubleSide}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.075, 12, 12]} />
              <meshBasicMaterial color="#caffee" toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <Html
        fullscreen
        calculatePosition={() => [size.width / 2, size.height / 2]}
        zIndexRange={[20, 10]}
        style={{ pointerEvents: "none" }}
      >
        {site.hotspots.map((hotspot, index) => (
          <div key={hotspot.id}>
            <span
              ref={(element) => {
                connectors.current[index] = element;
              }}
              className="atlas-connector"
              aria-hidden="true"
            />
            <button
              ref={(element) => {
                buttons.current[index] = element;
              }}
              className={`atlas-hotspot ${s.activeHotspotId === hotspot.id ? "selected" : ""}`}
              data-gesture-id={`hotspot-${hotspot.id}`}
              data-gesture-label={hotspot.name[s.language]}
              aria-pressed={s.activeHotspotId === hotspot.id}
              disabled={s.mode !== "LOCATION_OVERVIEW"}
              onClick={() => interaction.openHotspot(hotspot.id)}
            >
              <i aria-hidden="true" />
              <span>{hotspot.name[s.language]}</span>
            </button>
          </div>
        ))}
      </Html>
    </group>
  );
}

export function LocalExplorationScene() {
  const s = useSolaris();
  const site = getImmersiveSite(s.destinationId ?? "");
  const root = useRef<Group>(null);
  useFrame(() => {
    if (root.current)
      root.current.visible = descentPhase(
        particles.locationApproach,
      ).localVisible;
  });
  if (!site || !s.locationResourcesReady) return null;
  const base = assets.find((asset) => asset.id === site.baseAssetId);
  const local = s.mode === "LOCATION_OVERVIEW" || s.mode === "INFO_PANEL_OPEN";
  return (
    <group ref={root} visible={false}>
      <hemisphereLight args={["#cee6e0", "#18282c", 2]} />
      <Suspense
        fallback={
          local ? (
            <Html center>
              <span className="atlas-loading" role="status">
                {s.language === "zh"
                  ? "局部影像加载中"
                  : "Loading local imagery"}
              </span>
            </Html>
          ) : null
        }
      >
        {site.kind === "city-atlas" ? (
          <CityAtlas />
        ) : (
          base && <OrbitalSurface path={base.path} />
        )}
        <gridHelper
          args={[22, 11, "#bbd5cb", "#5a756e"]}
          position={[0, 0.06, 0]}
        />
        <Line
          points={[
            [0, 0.09, -11],
            [0, 0.09, 11],
          ]}
          color="#c1d8d1"
          transparent
          opacity={0.25}
        />
        <Line
          points={[
            [-11, 0.09, 0],
            [11, 0.09, 0],
          ]}
          color="#c1d8d1"
          transparent
          opacity={0.25}
        />
        {local && <Hotspots site={site} />}
      </Suspense>
    </group>
  );
}

export function DescentVeil() {
  const mesh = useRef<Mesh>(null);
  const offset = useMemo(() => new Vector3(0, 0, -0.7), []);
  const { selected, mode } = useSolaris();
  const uniforms = useMemo(
    () => ({
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uColor: {
        value: new Color(selected === "earth" ? "#dce9eb" : "#b5a59a"),
      },
    }),
    [selected],
  );
  useFrame(({ camera, size, clock }) => {
    if (!mesh.current) return;
    const opacity =
      mode === "DESCENT_TRANSITION"
        ? descentPhase(particles.locationApproach).cloudOpacity
        : 0;
    mesh.current.visible = opacity > 0.005;
    mesh.current.position
      .copy(offset)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    mesh.current.quaternion.copy(camera.quaternion);
    mesh.current.scale.set((size.width / size.height) * 1.3, 1.3, 1);
    uniforms.uOpacity.value = opacity;
    uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh ref={mesh} renderOrder={1000} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={colorManaged(
          noise +
            `uniform float uOpacity,uTime;uniform vec3 uColor;varying vec2 vUv;void main(){float cloud=fbm(vec3(vUv*5.,uTime*.1));vec3 color=uColor*(.76+cloud*.35);gl_FragColor=vec4(color,uOpacity*(.92+cloud*.08));}`,
        )}
      />
    </mesh>
  );
}
