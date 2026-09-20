import { useRef, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { BigBang } from "../particles/BigBang";
import { CollapseEffect } from "../particles/CollapseEffect";
import { Sun } from "../planets/Sun";
import { Mercury } from "../planets/Mercury";
import { Venus } from "../planets/Venus";
import { Earth } from "../planets/Earth";
import { Mars } from "../planets/Mars";
import { Jupiter } from "../planets/Jupiter";
import { Saturn } from "../planets/Saturn";
import { Uranus } from "../planets/Uranus";
import { Neptune } from "../planets/Neptune";
import { OrbitSystem } from "./OrbitSystem";
import { ParticleField } from "../particles/ParticleField";
import { rotation } from "../interaction/rotation";
import { store } from "../interaction/store";
import { gestureConfig } from "../gesture/gestureConfig";
import { particles } from "../particles/ParticleEngine";
export function SolarSystem() {
  const root = useRef<Group>(null);
  useFrame((_, dt) => {
    rotation.update(dt, store.get().transitioning);
    particles.scale +=
      (particles.targetScale - particles.scale) *
      (1 - Math.exp(-dt * gestureConfig.ZOOM_RESPONSE));
    particles.rotation +=
      (particles.targetRotation - particles.rotation) * (1 - Math.exp(-dt * 4));
    particles.anchor.lerp(particles.targetAnchor, 1 - Math.exp(-dt * 5));
    if (root.current) {
      // The bright entry veil covers this handoff before the camera reaches
      // the Sun's opaque surface. Keep its whole hierarchy out of the interior.
      root.current.visible = particles.sunInterior < 0.55;
      root.current.scale.setScalar(particles.scale);
      root.current.position.copy(particles.anchor);
    }
  });
  return (
    <group ref={root}>
      <Sun />
      <BigBang />
      <CollapseEffect />
      <OrbitSystem />
      <Mercury />
      <Venus />
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <Mars />
      <Jupiter />
      <Saturn />
      <Uranus />
      <Neptune />
      <ParticleField count={115000} />
    </group>
  );
}
