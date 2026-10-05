import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { bodyTransforms } from "../exploration/sceneState";
import { interaction } from "../interaction/InteractionController";
import { store } from "../interaction/store";
import { particles } from "../particles/ParticleEngine";
import { captureEarthView, earthViewHandoff } from "./earthViewHandoff";

export function EarthHandoff() {
  const { camera, size } = useThree();
  useFrame(() => {
    const state = store.get();
    if (
      state.mode !== "PLANET_OVERVIEW" ||
      state.selected !== "earth" ||
      state.transitioning ||
      particles.focus < 0.99 ||
      !(camera instanceof PerspectiveCamera)
    )
      return;
    const body = bodyTransforms.get("earth");
    if (!body) return;
    earthViewHandoff.set(
      captureEarthView(camera, body, size.width, size.height),
    );
    interaction.enterBodyExplore();
  });
  return null;
}
