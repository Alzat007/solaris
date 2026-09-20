import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, Plane, Raycaster, Vector2, Vector3 } from "three";
import { particles } from "../particles/ParticleEngine";
import { store } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import { pickPlanet } from "./planetPicking";
export function InputField() {
  const { camera, gl, size } = useThree();
  const tip = useRef<Mesh>(null);
  const ray = useMemo(() => new Raycaster(), []),
    plane = useMemo(() => new Plane(), []),
    normal = useMemo(() => new Vector3(), []),
    hit = useMemo(() => new Vector3(), []),
    last = useMemo(() => new Vector3(), []);
  const state = useRef({
    time: 0,
    down: false,
    x: 0,
    touches: new Map<number, Vector2>(),
    pinch: 0,
    scale: 1,
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const move = (e: PointerEvent) => {
      if (store.get().tracking === "online") return;
      const rect = canvas.getBoundingClientRect();
      particles.handNDC.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      particles.active = true;
      particles.interactionTime = performance.now();
      if (state.current.touches.has(e.pointerId)) {
        state.current.touches.set(
          e.pointerId,
          new Vector2(e.clientX, e.clientY),
        );
        if (state.current.touches.size === 2) {
          const [a, b] = [...state.current.touches.values()];
          if (!state.current.pinch) {
            state.current.pinch = a.distanceTo(b);
            state.current.scale = particles.targetScale;
          }
          interaction.scale(
            (state.current.scale * a.distanceTo(b)) /
              Math.max(state.current.pinch, 20),
          );
        } else if (state.current.down && e.pointerType === "touch") {
          particles.targetRotation += (e.clientX - state.current.x) * 0.006;
        }
      }
      state.current.x = e.clientX;
    };
    const down = (e: PointerEvent) => {
      state.current.down = true;
      state.current.x = e.clientX;
      state.current.touches.set(e.pointerId, new Vector2(e.clientX, e.clientY));
      move(e);
    };
    const up = (e: PointerEvent) => {
      state.current.down = false;
      state.current.touches.delete(e.pointerId);
      state.current.pinch = 0;
      interaction.endScale();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      interaction.scale(particles.targetScale * Math.exp(-e.deltaY * 0.0006));
    };
    const key = (e: KeyboardEvent) => {
      if (
        ["Space", "ArrowRight", "ArrowLeft", "Escape", "KeyI", "KeyS"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "Space" && !e.repeat) interaction.space();
      if (e.code === "ArrowRight") interaction.next(1);
      if (e.code === "ArrowLeft") interaction.next(-1);
      if (e.code === "Escape") interaction.return();
      if (e.code === "KeyI" && !e.repeat) interaction.info();
      if (e.code === "KeyS" && !e.repeat) interaction.enterSun();
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
    };
  }, [gl]);
  useFrame((_, dt) => {
    const on =
      particles.active &&
      (store.get().tracking === "online" ||
        performance.now() - particles.interactionTime < 2200);
    particles.influence +=
      ((on ? 1 : 0) - particles.influence) * (1 - Math.exp(-dt * 8));
    camera.getWorldDirection(normal);
    plane.setFromNormalAndCoplanarPoint(
      normal,
      new Vector3(0, 0, particles.focus * 3.5),
    );
    ray.setFromCamera(particles.handNDC, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      last.copy(particles.handPosition3D);
      particles.handPosition3D.lerp(hit, 1 - Math.exp(-dt * 14));
      if (last.z < 90) {
        const v = hit
          .clone()
          .sub(last)
          .multiplyScalar(1 / Math.max(dt, 0.01));
        v.clampLength(0, 20);
        particles.handVelocity.lerp(v, 0.12);
      }
    }
    if (tip.current) {
      tip.current.position.copy(particles.handPosition3D);
      tip.current.scale.setScalar(
        (0.025 + particles.pinchStrength * 0.025) * particles.influence,
      );
    }
    if (
      [
        "SOLAR_SYSTEM",
        "POINTER",
        "PLANET_FOCUS",
        "INFO",
        "UNIVERSE_SCALE",
      ].includes(store.get().mode) &&
      particles.sunInterior < 0.05 &&
      store.get().tracking === "online" &&
      (store.get().gesture === "POINT" || store.get().gesture === "PINCH")
    ) {
      const best = pickPlanet(
        particles.handNDC,
        camera,
        size.width,
        size.height,
      );
      if (store.get().hover !== best) store.set({ hover: best });
    } else if (
      (store.get().mode === "SUN_INTERIOR" ||
        store.get().mode === "COLLAPSE") &&
      store.get().hover
    ) {
      store.set({ hover: null });
    }
  });
  return (
    <mesh ref={tip}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial
        color="#ffe1b8"
        toneMapped={false}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}
