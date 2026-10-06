import type { PlanetId } from "../data/planets";
import { store, type UIState } from "../interaction/store";
import {
  EarthAtlasRotation,
  earthAtlasRotation,
  isEarthAtlasVisible,
  isEarthStoryOpen,
} from "./earthAtlasState";
import { getPlanetAnnotations, getPlanetStory } from "./planetAtlasCatalog";

type AtlasState = Pick<UIState, "selected" | "mode" | "activeStoryId">;
const rotations = new Map<PlanetId, EarthAtlasRotation>([
  ["earth", earthAtlasRotation],
]);

export function getPlanetAtlasRotation(bodyId: PlanetId) {
  let controller = rotations.get(bodyId);
  if (!controller) {
    const first = getPlanetAnnotations(bodyId).find(
      (entry) => !entry.localPosition,
    );
    controller = new EarthAtlasRotation(first ?? null);
    rotations.set(bodyId, controller);
  }
  return controller;
}

export function isPlanetStoryOpen(state: AtlasState) {
  return (
    isEarthStoryOpen(state) ||
    (!!state.selected &&
      state.selected !== "earth" &&
      state.mode === "INFO_PANEL_OPEN" &&
      !!state.activeStoryId &&
      !!getPlanetStory(state.selected, state.activeStoryId))
  );
}

export function isPlanetAtlasVisible(state: AtlasState) {
  if (state.selected === "earth") return isEarthAtlasVisible(state);
  return (
    !!state.selected &&
    getPlanetAnnotations(state.selected).length > 0 &&
    (["PLANET_OVERVIEW", "INFO", "UNIVERSE_SCALE"].includes(state.mode) ||
      isPlanetStoryOpen(state))
  );
}

export function isPlanetAutoRotating(state: UIState, bodyId = state.selected) {
  return bodyId === "earth"
    ? state.earthAutoRotate
    : bodyId
      ? state.planetAutoRotate[bodyId] !== false
      : false;
}

export function setPlanetAutoRotate(bodyId: PlanetId, automatic: boolean) {
  if (bodyId === "earth") store.set({ earthAutoRotate: automatic });
  else
    store.set({
      planetAutoRotate: {
        ...store.get().planetAutoRotate,
        [bodyId]: automatic,
      },
    });
}
