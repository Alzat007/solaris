import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, Plane, Raycaster, Vector2, Vector3 } from "three";
import { particles } from "../particles/ParticleEngine";
import { store } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import { rotation } from "../interaction/rotation";
import { gestureConfig as config } from "../gesture/gestureConfig";
import { gestureFeedback } from "../gesture/gestureFeedback";
import { gestureTargets } from "../gesture/gestureTargets";
import { planets } from "../data/planets";
import {
  pickPlanet,
  planetObjects,
  projectPlanetTarget,
} from "./planetPicking";
import { PointerFallback } from "./PointerFallback";
export function InputField() {
  const { camera, gl, size } = useThree();
  const tip = useRef<Mesh>(null);
  const uiHover = useRef<HTMLButtonElement | null>(null);
  const hadHand = useRef(false);
  const ray = useMemo(() => new Raycaster(), []);
  const plane = useMemo(() => new Plane(), []);
  const normal = useMemo(() => new Vector3(), []);
  const hit = useMemo(() => new Vector3(), []);
  const last = useMemo(() => new Vector3(), []);
  const velocity = useMemo(() => new Vector3(), []);
  const planeOrigin = useMemo(() => new Vector3(), []);
  const pointer = useMemo(() => new Vector2(), []);
  useEffect(() => {
    const canvas = gl.domElement;
    const unregisterScreen = gestureTargets.registerScreenResolver((target) => {
      if (target.kind === "ui") {
        const element = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            "button[data-gesture-id]",
          ),
        ).find((button) => button.dataset.gestureId === target.id);
        if (!element || element.disabled || !element.getClientRects().length)
          return null;
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          radius: Math.max(rect.width, rect.height) / 2 + 5,
        };
      }
      const rect = canvas.getBoundingClientRect();
      const projected = projectPlanetTarget(
        target.id,
        camera,
        rect.width,
        rect.height,
      );
      return projected
        ? {
            x: rect.left + projected.x,
            y: rect.top + projected.y,
            radius: projected.radius + 5,
          }
        : null;
    });
    const pick = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((x - rect.left) / rect.width) * 2 - 1,
        1 - ((y - rect.top) / rect.height) * 2,
      );
      if (!interaction.machine.can("SELECT") || particles.sunInterior > 0.05)
        return null;
      return pickPlanet(pointer, camera, rect.width, rect.height);
    };
    const fallback = new PointerFallback({
      locked: () => interaction.isLocked(),
      overview: () => ["SOLAR_SYSTEM", "POINTER"].includes(store.get().mode),
      focused: () => ["PLANET_FOCUS", "INFO"].includes(store.get().mode),
      width: () => canvas.getBoundingClientRect().width,
      pick,
      point(x, y) {
        const hover = pick(x, y);
        if (store.get().hover !== hover) store.set({ hover });
        if (store.get().tracking !== "online" || !particles.cursorVisible)
          particles.handNDC.copy(pointer);
        particles.active = true;
        particles.interactionTime = performance.now();
      },
      select: (id) => interaction.selectBody(id),
      next: (direction) => interaction.next(direction),
      scale: (value) => interaction.scale(value),
      endScale: () => interaction.endScale(),
      currentScale: () => particles.targetScale,
      startDrag: () => rotation.start(),
      drag: (dx, dt) => rotation.move(dx, dt),
      endDrag: () => rotation.end(),
    });
    const down = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType !== "touch") return;
      if (fallback.down(event)) canvas.setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent) => fallback.move(event);
    const up = (event: PointerEvent) => {
      fallback.up(event);
      if (canvas.hasPointerCapture?.(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    };
    const cancel = () => fallback.cancel();
    const leave = () => {
      if (!particles.cursorVisible && store.get().hover)
        store.set({ hover: null });
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (
        interaction.scale(
          particles.targetScale *
            Math.exp(-event.deltaY * config.WHEEL_ZOOM_SENSITIVITY),
        )
      )
        interaction.endScale();
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))
      )
        return;
      if (
        ["Space", "ArrowRight", "ArrowLeft", "Escape", "KeyI", "KeyS"].includes(
          event.code,
        )
      )
        event.preventDefault();
      if (event.repeat || interaction.isLocked()) return;
      if (event.code === "Space") interaction.space();
      if (event.code === "ArrowRight") interaction.next(1);
      if (event.code === "ArrowLeft") interaction.next(-1);
      if (event.code === "Escape") interaction.return();
      if (event.code === "KeyI") interaction.info();
      if (event.code === "KeyS") interaction.selectBody("sun");
    };
    const unsubscribe = store.subscribe(() => {
      if (interaction.isLocked()) fallback.cancel();
    });
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("lostpointercapture", cancel);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      unsubscribe();
      unregisterScreen();
      fallback.cancel();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("lostpointercapture", cancel);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      uiHover.current?.removeAttribute("data-gesture-hover");
      gestureTargets.set(null);
    };
  }, [camera, gl, pointer]);
  useFrame((_, dt) => {
    const state = store.get();
    const hand = state.tracking === "online" && particles.cursorVisible;
    const on =
      particles.active &&
      (hand || performance.now() - particles.interactionTime < 2200);
    particles.influence +=
      ((on ? 1 : 0) - particles.influence) * (1 - Math.exp(-dt * 8));
    if (hand)
      particles.handNDC.lerp(
        particles.handTargetNDC,
        1 - Math.exp(-dt * config.CURSOR_RENDER_RESPONSE),
      );
    camera.getWorldDirection(normal);
    planeOrigin.set(0, 0, particles.focus * 3.5);
    plane.setFromNormalAndCoplanarPoint(normal, planeOrigin);
    ray.setFromCamera(particles.handNDC, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      last.copy(particles.handPosition3D);
      particles.handPosition3D.lerp(hit, 1 - Math.exp(-dt * 14));
      if (last.z < 90) {
        velocity
          .copy(hit)
          .sub(last)
          .multiplyScalar(1 / Math.max(dt, 0.01))
          .clampLength(0, 20);
        particles.handVelocity.lerp(velocity, 0.12);
      }
    }
    if (tip.current) {
      // The screen-space cursor owns interior feedback; a world-space marker
      // can sit against the travelling camera and appear as a large solid orb.
      tip.current.visible = on && particles.sunInterior < 0.05;
      tip.current.position.copy(particles.handPosition3D);
      tip.current.scale.setScalar(
        (0.025 + particles.pinchStrength * 0.025) * particles.influence,
      );
    }
    const feedback = gestureFeedback.get();
    const lockedTarget = !interaction.isLocked() ? feedback.lockedTarget : null;
    let button: HTMLButtonElement | null = null;
    if (
      hand &&
      (state.gesture === "POINT" ||
        state.gesture === "PINCH" ||
        !!lockedTarget) &&
      !interaction.isLocked()
    ) {
      const rect = gl.domElement.getBoundingClientRect();
      const x = rect.left + ((particles.handNDC.x + 1) * rect.width) / 2;
      const y = rect.top + ((1 - particles.handNDC.y) * rect.height) / 2;
      const element = document
        .elementFromPoint(x, y)
        ?.closest<HTMLButtonElement>("button[data-gesture-id]");
      if (
        element &&
        !element.disabled &&
        element.getAttribute("aria-disabled") !== "true" &&
        element.getClientRects().length
      ) {
        const style = getComputedStyle(element);
        if (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity) > 0 &&
          style.pointerEvents !== "none"
        )
          button = element;
      }
      if (button) {
        gestureTargets.set({
          kind: "ui",
          id: button.dataset.gestureId!,
          label:
            button.dataset.gestureLabel ||
            button.getAttribute("aria-label") ||
            button.textContent?.trim() ||
            "选择",
        });
        if (
          state.hover !==
          (lockedTarget?.kind === "body" ? lockedTarget.id : null)
        )
          store.set({
            hover: lockedTarget?.kind === "body" ? lockedTarget.id : null,
          });
      } else {
        const best =
          interaction.machine.can("SELECT") && particles.sunInterior < 0.05
            ? pickPlanet(
                particles.handNDC,
                camera,
                size.width,
                size.height,
                planetObjects,
                config.POINT_TARGET_RADIUS_MULTIPLIER,
              )
            : null;
        const visibleHover =
          lockedTarget?.kind === "body" ? lockedTarget.id : best;
        if (state.hover !== visibleHover) store.set({ hover: visibleHover });
        gestureTargets.set(
          best
            ? {
                kind: "body",
                id: best,
                label:
                  best === "sun"
                    ? "太阳"
                    : planets.find((planet) => planet.id === best)!.chineseName,
              }
            : null,
        );
      }
    } else {
      gestureTargets.set(null);
      if (
        (state.tracking === "online" ||
          hadHand.current ||
          interaction.isLocked()) &&
        state.hover
      )
        store.set({ hover: null });
    }
    if (uiHover.current !== button) {
      uiHover.current?.removeAttribute("data-gesture-hover");
      button?.setAttribute("data-gesture-hover", "true");
      uiHover.current = button;
    }
    hadHand.current = hand;
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
