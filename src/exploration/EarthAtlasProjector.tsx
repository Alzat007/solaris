import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { LineSegments, Object3D } from "three";
import type { PlanetId } from "../data/planets";
import { store } from "../interaction/store";
import { particles } from "../particles/ParticleEngine";
import { bodyTransforms } from "./sceneState";
import { atlasCities } from "./earthAtlasCatalog";
import {
  getPlanetAnnotations,
  getVisiblePlanetAnnotations,
} from "./planetAtlasCatalog";
import {
  atlasProjectionSignature,
  earthAtlasView,
  projectAtlasCities,
} from "./earthAtlasProjection";
import { isPlanetAtlasVisible, isPlanetAutoRotating } from "./planetAtlasState";

export function EarthAtlasProjector() {
  const { camera, size, gl } = useThree();
  const previous = useRef(new Map<string, { dx: number; dy: number }>());
  const signature = useRef("");
  const previousBody = useRef<PlanetId | null>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("qa") !== "1") return;
    const capture = (bodyId = store.get().selected ?? "earth") => {
      const body = bodyTransforms.get(bodyId);
      body?.updateWorldMatrix(true, false);
      const outlines = body?.getObjectByName("earth-country-outlines") as
        | LineSegments
        | undefined;
      let visible = !!body;
      for (
        let object: Object3D | null | undefined = body;
        object;
        object = object.parent
      )
        visible &&= object.visible;
      return {
        cameraPosition: camera.position.toArray(),
        cameraQuaternion: camera.quaternion.toArray(),
        bodyId,
        bodyRotation: body?.rotation.toArray(),
        bodyMatrix: body?.matrixWorld.toArray(),
        bodyVisible: visible,
        earthRotation: body?.rotation.toArray(),
        earthMatrix: body?.matrixWorld.toArray(),
        scale: particles.scale,
        targetScale: particles.targetScale,
        anchor: particles.anchor.toArray(),
        autoRotate: isPlanetAutoRotating(store.get(), bodyId),
        mode: store.get().mode,
        storyId: store.get().activeStoryId,
        cities: atlasCities.length,
        annotations: getPlanetAnnotations(bodyId).map((entry) => entry.id),
        scopeCityId: earthAtlasView.get().scopeCityId,
        points: earthAtlasView.get().points,
        labels: earthAtlasView.get().labels,
        countries: earthAtlasView.get().countries,
        earthVisible: visible,
        countrySegments:
          (outlines?.geometry.getAttribute("position").count ?? 0) / 2,
      };
    };
    Object.assign(window, {
      __SOLARIS_LIGHT_EARTH: { capture: () => capture("earth") },
      __SOLARIS_PLANET_ATLAS: { capture },
    });
    return () => {
      Reflect.deleteProperty(window, "__SOLARIS_LIGHT_EARTH");
      Reflect.deleteProperty(window, "__SOLARIS_PLANET_ATLAS");
    };
  }, [camera]);
  useFrame(() => {
    const state = store.get();
    const bodyId = state.selected;
    const body = bodyId ? bodyTransforms.get(bodyId) : null;
    if (!body || !bodyId || !isPlanetAtlasVisible(state) || state.webglError) {
      if (signature.current) {
        signature.current = "";
        earthAtlasView.set({ points: [], labels: [] });
      }
      return;
    }
    if (previousBody.current !== bodyId) {
      previousBody.current = bodyId;
      previous.current.clear();
      signature.current = "";
      earthAtlasView.set({ focusId: null, scopeCityId: null });
    }
    const entries = getVisiblePlanetAnnotations(
      bodyId,
      earthAtlasView.get().scopeCityId,
    );
    const toolbar = document
      .querySelector(".earth-atlas-tools")
      ?.getBoundingClientRect();
    const footer = document
      .querySelector(".hud > footer")
      ?.getBoundingClientRect();
    const rect = gl.domElement.getBoundingClientRect();
    const viewport = {
      width: size.width,
      height: size.height,
      tv: new URLSearchParams(location.search).get("tv") === "1",
      language: store.get().language,
      insetTop: toolbar ? toolbar.bottom - rect.top + 14 : 130,
      insetBottom:
        footer && footer.height ? size.height - footer.top + 14 : 130,
    };
    const view = projectAtlasCities(
      camera,
      body,
      entries,
      viewport,
      earthAtlasView.get().focusId,
      previous.current,
    );
    const key = atlasProjectionSignature(bodyId, viewport, view);
    if (key === signature.current) return;
    signature.current = key;
    for (const label of view.labels)
      previous.current.set(label.id, { dx: label.dx, dy: label.dy });
    earthAtlasView.set({
      ...view,
      width: size.width,
      height: size.height,
      insetBottom: viewport.insetBottom,
    });
  });
  return null;
}
