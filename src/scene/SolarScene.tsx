import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Vignette,
  ToneMapping,
} from "@react-three/postprocessing";
import { ACESFilmicToneMapping } from "three";
import gsap from "gsap";
import { SolarSystem } from "./SolarSystem";
import { StarField } from "./StarField";
import { CameraController } from "../camera/CameraController";
import { PerformanceManager } from "../performance/PerformanceManager";
import { InputField } from "./InputField";
import { particles } from "../particles/ParticleEngine";
import { interaction } from "../interaction/InteractionController";
import { useSolaris, store } from "../interaction/store";
function RendererLifecycle() {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      store.set({ webglError: true });
    };
    const restored = () => store.set({ webglError: false });
    gl.debug.onShaderError = () => store.set({ webglError: true });
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    restored();
    return () => {
      // A disposed renderer also loses its context during a development refresh.
      // It must not mark the newly mounted renderer as broken.
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      gl.debug.onShaderError = null;
    };
  }, [gl]);
  return null;
}
function Intro() {
  useEffect(() => {
    const animation = gsap.to(particles, {
      intro: 1,
      duration: 5.2,
      ease: "power2.out",
      onComplete: () => interaction.ready(),
    });
    return () => {
      animation.kill();
    };
  }, []);
  return null;
}
function Scene() {
  const { quality } = useSolaris();
  return (
    <>
      <color attach="background" args={["#020204"]} />
      <ambientLight intensity={0.24} />
      <directionalLight
        position={[-6, 8, 10]}
        intensity={1.8}
        color="#fff1d7"
      />
      <StarField />
      <SolarSystem />
      <CameraController />
      <InputField />
      <Intro />
      <RendererLifecycle />
      <PerformanceManager />
      {quality !== "LOW" && (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.43}
            luminanceThreshold={1.05}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
          <ToneMapping />
          <Vignette eskil={false} offset={0.13} darkness={0.6} />
        </EffectComposer>
      )}
    </>
  );
}
export function SolarScene() {
  return (
    <Canvas
      camera={{ position: [0, 15, 32], fov: 43, near: 0.1, far: 250 }}
      dpr={window.innerWidth < 700 ? 1 : [1, 1.5]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        alpha: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor("#020204");
      }}
      fallback={
        <div className="render-error">
          <h1>暂时无法呈现宇宙</h1>
          <p>请开启浏览器硬件加速，或换用支持 WebGL 2 的浏览器。</p>
          <button onClick={() => location.reload()}>重新尝试 ↗</button>
        </div>
      }
    >
      <Scene />
    </Canvas>
  );
}
