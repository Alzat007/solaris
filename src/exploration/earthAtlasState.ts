import { Euler, MathUtils, type Group } from "three";
import type { UIState } from "../interaction/store";
import { facingRotation } from "./sceneState";

export function usesLightEarth(
  search = typeof location === "undefined" ? "" : location.search,
) {
  const params = new URLSearchParams(search);
  return params.get("earth") !== "map" && params.get("data") !== "ion";
}

export function isEarthStoryOpen(
  state: Pick<UIState, "selected" | "mode" | "activeStoryId">,
) {
  return (
    state.selected === "earth" &&
    state.mode === "INFO_PANEL_OPEN" &&
    !!state.activeStoryId?.startsWith("city-")
  );
}

export function isEarthAtlasVisible(
  state: Pick<UIState, "selected" | "mode" | "activeStoryId">,
) {
  return (
    usesLightEarth() &&
    state.selected === "earth" &&
    (["PLANET_OVERVIEW", "INFO", "UNIVERSE_SCALE"].includes(state.mode) ||
      isEarthStoryOpen(state))
  );
}

/** The existing PlanetBase remains the only writer of the Earth's transform. */
export class EarthAtlasRotation {
  private pitch = 0;
  private target: Euler | null = null;
  private initialized = false;

  constructor(
    private initialFocus: { latitude: number; longitude: number } | null = {
      latitude: 39.92,
      longitude: 116.38,
    },
  ) {}

  focus(latitude: number, longitude: number) {
    if (
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180
    )
      return false;
    const facing = facingRotation(latitude, longitude);
    this.target = new Euler(facing.x, facing.y, 0);
    this.pitch = 0;
    return true;
  }

  dragPitch(dy: number) {
    if (Number.isFinite(dy)) this.pitch += MathUtils.clamp(dy, -0.15, 0.15) * 4;
  }

  discardPending() {
    this.pitch = 0;
    this.target = null;
    this.initialized = true;
  }

  step(
    body: Group,
    options: {
      delta: number;
      dragDelta: number;
      automatic: boolean;
      dragging: boolean;
      paused: boolean;
    },
  ) {
    if (options.paused) return;
    if (!this.initialized) {
      this.initialized = true;
      if (!this.target && this.initialFocus)
        this.focus(this.initialFocus.latitude, this.initialFocus.longitude);
    }
    if (this.target) {
      body.rotation.copy(this.target);
      this.target = null;
    }
    const manual =
      options.dragging ||
      Math.abs(options.dragDelta) > 1e-7 ||
      Math.abs(this.pitch) > 1e-7;
    body.rotation.y += Number.isFinite(options.dragDelta)
      ? options.dragDelta
      : 0;
    body.rotation.x = MathUtils.clamp(
      body.rotation.x + this.pitch,
      -1.48,
      1.48,
    );
    this.pitch = 0;
    if (options.automatic && !manual)
      body.rotation.y += MathUtils.clamp(options.delta, 0, 0.05) * 0.012;
    return manual;
  }
}

export const earthAtlasRotation = new EarthAtlasRotation();
