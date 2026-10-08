import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Globe2,
  Map as MapIcon,
  Minus,
  Pause,
  Play,
  Plus,
} from "lucide-react";
import { store, useSolaris } from "../interaction/store";
import { interaction } from "../interaction/InteractionController";
import { rotation } from "../interaction/rotation";
import { particles } from "../particles/ParticleEngine";
import { planetById, type PlanetId } from "../data/planets";
import { GlobeStoryPanel } from "../globeLab/GlobeStoryPanel";
import { exceedsHotspotDragThreshold } from "../globeLab/hotspotVisibility";
import {
  getPlanetAnnotations,
  getVisiblePlanetAnnotations,
  getPlanetAnnotation,
  getPlanetStory,
} from "./planetAtlasCatalog";
import { earthDirectory } from "./earthDirectory";
import { earthAtlasView, useEarthAtlasView } from "./earthAtlasProjection";
import {
  getPlanetAtlasRotation,
  isPlanetAtlasVisible,
  isPlanetStoryOpen,
  isPlanetAutoRotating,
  setPlanetAutoRotate,
} from "./planetAtlasState";
import "./earthAtlas.css";
import { PlanetAnnotations } from "./PlanetAnnotations";
import { EarthBatchPicker } from "./EarthBatchPicker";
import { uiText } from "./bilingualLabels";

export function PlanetAtlasUI() {
  const state = useSolaris();
  const view = useEarthAtlasView();
  const [pickedIds, setPickedIds] = useState<Partial<Record<PlanetId, string>>>(
    {},
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const lastStory = useRef<string | null>(null);
  const ui = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (state.activeStoryId) {
      lastStory.current = state.activeStoryId;
      return;
    }
    const id = lastStory.current;
    lastStory.current = null;
    if (id && isPlanetAtlasVisible(state)) {
      const marker = Array.from(
        ui.current?.querySelectorAll<HTMLButtonElement>(
          ".earth-atlas-label[data-annotation-id]",
        ) ?? [],
      ).find((element) => element.dataset.annotationId === id);
      marker?.focus({ preventScroll: true });
    }
  }, [state.activeStoryId, state.mode, state.selected, view.labels]);
  if (!state.selected || !isPlanetAtlasVisible(state)) return null;
  const bodyId = state.selected;
  const earth = bodyId === "earth";
  const atlasCities = getVisiblePlanetAnnotations(bodyId, view.scopeCityId);
  const cityById = new Map(atlasCities.map((city) => [city.id, city]));
  const automatic = isPlanetAutoRotating(state);
  const zh = state.language === "zh";
  const storyOpen = isPlanetStoryOpen(state);
  const story =
    storyOpen && state.activeStoryId
      ? getPlanetStory(bodyId, state.activeStoryId)
      : null;
  const stopRotation = () => {
    rotation.stop();
    particles.targetRotation = particles.rotation;
    setPlanetAutoRotate(bodyId, false);
  };
  const focusCity = (id: string) => {
    const city = getPlanetAnnotation(bodyId, id);
    if (!city) return;
    stopRotation();
    const position = city.localPosition;
    const latitude = position
      ? (Math.atan2(position[1], Math.hypot(position[0], position[2])) * 180) /
        Math.PI
      : city.latitude;
    const longitude = position
      ? (Math.atan2(-position[2], position[0]) * 180) / Math.PI
      : city.longitude;
    getPlanetAtlasRotation(bodyId).focus(latitude, longitude);
    earthAtlasView.set({
      focusId: id,
      scopeCityId: earth ? (city.cityId ?? id) : null,
    });
    setPickedIds((current) => ({ ...current, [bodyId]: id }));
  };
  const nudge = (x: number, y: number) => {
    stopRotation();
    if (x) {
      rotation.start();
      rotation.move(x * 0.035, 0.08);
      rotation.end();
    }
    if (y) getPlanetAtlasRotation(bodyId).dragPitch(y * 0.035);
  };
  const zoom = (factor: number) => {
    interaction.scale(particles.targetScale * factor);
    interaction.endScale();
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = pointer.current;
    if (
      current?.id === event.pointerId &&
      exceedsHotspotDragThreshold(current, {
        x: event.clientX,
        y: event.clientY,
      })
    )
      current.moved = true;
  };
  const markerProps = (id: string, suffix = "") => ({
    "data-city-id": id,
    "data-annotation-id": id,
    "data-gesture-id": `atlas-${id}${suffix}`,
    "data-gesture-label": cityById.get(id)?.name[state.language],
    disabled: !getPlanetStory(bodyId, id),
    onPointerDown: pointerDown,
    onPointerMove: pointerMove,
    onPointerUp: pointerMove,
    onPointerCancel: () => {
      pointer.current = null;
    },
    onFocus: () => {
      earthAtlasView.set({ focusId: id });
    },
    onMouseEnter: () => {
      setHoverId(id);
    },
    onMouseLeave: () =>
      setHoverId((current) => (current === id ? null : current)),
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      const moved = event.detail > 0 && pointer.current?.moved;
      pointer.current = null;
      if (!moved) {
        earthAtlasView.set({ focusId: id });
        if (earth && getPlanetStory(bodyId, id))
          earthAtlasView.set({
            scopeCityId: getPlanetAnnotation(bodyId, id)?.cityId ?? id,
          });
        interaction.openPlanetStory(id);
      }
    },
  });
  return (
    <div
      ref={ui}
      className={`earth-atlas${storyOpen ? " story-open" : ""}`}
      data-atlas-planet={bodyId}
    >
      {!storyOpen && (
        <>
          <div
            className="earth-atlas-tools"
            role="toolbar"
            aria-label={
              earth
                ? zh
                  ? "地球探索"
                  : "Earth exploration"
                : zh
                  ? "星球探索"
                  : "Planet exploration"
            }
          >
            <div className="earth-atlas-heading">
              <Globe2 size={21} />
              <strong>
                {planetById(bodyId)?.[zh ? "chineseName" : "name"]}
              </strong>
            </div>
            {earth ? (
              <EarthBatchPicker
                language={state.language}
                cityId={view.scopeCityId}
                focusId={view.focusId}
                onFocus={focusCity}
                onScopeChange={(cityId) =>
                  earthAtlasView.set({ scopeCityId: cityId, focusId: null })
                }
              />
            ) : (
              <select
                aria-label={zh ? "选择经典区域" : "Choose a classic region"}
                value={pickedIds[bodyId] ?? ""}
                onChange={(event) => focusCity(event.target.value)}
              >
                <option value="" disabled>
                  {zh ? "经典区域" : "Classic regions"}
                </option>
                {getPlanetAnnotations(bodyId).map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.label[state.language]}
                  </option>
                ))}
              </select>
            )}
            <div className="earth-atlas-controls">
              <button
                type="button"
                aria-label={uiText("backToSolarSystem", state.language, {
                  zh: "返回太阳系",
                  en: "Return to solar system",
                })}
                title={uiText("backToSolarSystem", state.language, {
                  zh: "返回太阳系",
                  en: "Return to solar system",
                })}
                data-gesture-id="atlas-back"
                onClick={() => interaction.return()}
              >
                <ArrowLeft size={20} />
              </button>
              <button
                type="button"
                aria-label={
                  zh
                    ? automatic
                      ? "暂停自转"
                      : "开启自转"
                    : automatic
                      ? "Pause rotation"
                      : "Start rotation"
                }
                title={
                  zh
                    ? automatic
                      ? "暂停自转"
                      : "开启自转"
                    : "Automatic rotation"
                }
                aria-pressed={automatic}
                data-gesture-id="atlas-auto-rotate"
                onClick={() => {
                  const next = !automatic;
                  stopRotation();
                  setPlanetAutoRotate(bodyId, next);
                }}
              >
                {automatic ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                type="button"
                aria-label={uiText("zoomOut", state.language, {
                  zh: "缩小",
                  en: "Zoom out",
                })}
                title={uiText("zoomOut", state.language, {
                  zh: "缩小",
                  en: "Zoom out",
                })}
                data-gesture-id="atlas-zoom-out"
                onClick={() => zoom(0.84)}
              >
                <Minus size={19} />
              </button>
              <button
                type="button"
                aria-label={uiText("zoomIn", state.language, {
                  zh: "放大",
                  en: "Zoom in",
                })}
                title={uiText("zoomIn", state.language, {
                  zh: "放大",
                  en: "Zoom in",
                })}
                data-gesture-id="atlas-zoom-in"
                onClick={() => zoom(1.19)}
              >
                <Plus size={19} />
              </button>
              {earth && (
                <button
                  type="button"
                  aria-label={zh ? "国家轮廓" : "Country outlines"}
                  title={zh ? "国家轮廓" : "Country outlines"}
                  aria-pressed={view.showBoundaries}
                  data-gesture-id="atlas-boundaries"
                  onClick={() =>
                    earthAtlasView.set({ showBoundaries: !view.showBoundaries })
                  }
                >
                  <MapIcon size={19} />
                </button>
              )}
            </div>
            <div className="earth-atlas-nudges">
              {[
                [ArrowLeft, -1, 0, "向左旋转", "Rotate left"],
                [ArrowRight, 1, 0, "向右旋转", "Rotate right"],
                [ArrowUp, 0, -1, "向上旋转", "Rotate up"],
                [ArrowDown, 0, 1, "向下旋转", "Rotate down"],
              ].map(([Icon, x, y, cn, en], index) => {
                const Symbol = Icon as typeof ArrowLeft;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={String(zh ? cn : en)}
                    title={String(zh ? cn : en)}
                    data-gesture-id={`atlas-rotate-${index}`}
                    onClick={() => nudge(Number(x), Number(y))}
                  >
                    <Symbol size={18} />
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="earth-atlas-credits"
            style={{ bottom: view.insetBottom ?? 180 }}
          >
            {earth &&
              view.showBoundaries &&
              view.countries.state !== "ready" && (
                <span
                  role="status"
                  className={view.countries.state === "error" ? "error" : ""}
                >
                  {view.countries.state === "error"
                    ? zh
                      ? "国家轮廓加载失败"
                      : "Country outlines unavailable"
                    : zh
                      ? "正在加载国家轮廓"
                      : "Loading country outlines"}
                </span>
              )}
            {earth ? (
              <span
                className="earth-atlas-source-links"
                title={earthDirectory.databaseLicense.attribution}
              >
                <a
                  href="https://www.naturalearthdata.com/about/terms-of-use/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Natural Earth
                </a>
                <span>·</span>
                <a
                  href={earthDirectory.databaseLicense.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  REST Countries / mledoze
                </a>
                <a
                  href={earthDirectory.databaseLicense.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  ODbL 1.0
                </a>
              </span>
            ) : (
              <span>
                {zh
                  ? "科学示意球 · 图像与位置说明见内容来源"
                  : "Illustrative globe · Image and position notes in sources"}
              </span>
            )}
          </div>
        </>
      )}
      <div aria-hidden={storyOpen} inert={storyOpen}>
        <PlanetAnnotations
          entries={atlasCities}
          view={view}
          language={state.language}
          hoverId={hoverId}
          markerProps={markerProps}
          label={
            earth
              ? zh
                ? "地球城市标注"
                : "Earth city annotations"
              : zh
                ? "星球区域标注"
                : "Planet region annotations"
          }
        />
      </div>
      {story && (
        <GlobeStoryPanel
          hotspot={story}
          language={state.language}
          onLanguageChange={(language) => store.set({ language })}
          onClose={() => interaction.finishPlanetStoryClose(story.id)}
          bindControls={interaction.bindPlanetStoryPresentation}
          restoreFocus={false}
        />
      )}
    </div>
  );
}

export const EarthAtlasUI = PlanetAtlasUI;
