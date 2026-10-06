import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Ellipsoid,
  Ray,
  SceneTransforms,
} from "cesium";
import type { Viewer } from "cesium";
import type { ImmersiveHotspot } from "../exploration/immersiveCatalog";
import {
  DEFAULT_HOTSPOT_SCALE,
  exceedsHotspotDragThreshold,
  isFrontFacing,
  isProjectedPointVisible,
  isTerrainOccluded,
  nextHotspotVisibility,
  placeGlobeHotspotLabels,
} from "./hotspotVisibility";
import type { HotspotLabel, HotspotScaleLimits } from "./hotspotVisibility";
import "./storyPanel.css";

export type GlobeLabelTarget = Pick<
  ImmersiveHotspot,
  "id" | "name" | "latitude" | "longitude" | "image"
> & { priority?: number };

export interface GlobeHotspotsProps<
  T extends GlobeLabelTarget = ImmersiveHotspot,
> {
  viewer: Viewer | null;
  hotspots: readonly T[];
  enabled: boolean;
  language?: "zh" | "en";
  focusedId?: string | null;
  activeId?: string | null;
  onFocus?: (id: string | null) => void;
  onActivate: (hotspot: T) => void;
  scaleLimits?: HotspotScaleLimits;
  kind?: "story" | "city";
  maxLabels?: number;
}

export function GlobeHotspots<T extends GlobeLabelTarget = ImmersiveHotspot>({
  viewer,
  hotspots,
  enabled,
  language = "zh",
  focusedId,
  activeId,
  onFocus,
  onActivate,
  scaleLimits = DEFAULT_HOTSPOT_SCALE,
  kind = "story",
  maxLabels = 12,
}: GlobeHotspotsProps<T>) {
  const [labels, setLabels] = useState<HotspotLabel[]>([]);
  const visible = useRef(new Map<string, boolean>());
  const offsets = useRef(new Map<string, { dx: number; dy: number }>());
  const buttonNodes = useRef(new Map<string, HTMLButtonElement>());
  const preloaded = useRef(new Set<string>());
  const pointer = useRef<{
    id: number;
    start: { x: number; y: number };
    active: boolean;
    suppressClick: boolean;
  } | null>(null);

  useEffect(() => {
    let count = 0;
    for (const label of labels) {
      const hotspot = hotspots.find((entry) => entry.id === label.id);
      if (!hotspot?.image || preloaded.current.has(hotspot.id)) continue;
      if (/^(?:https?:|\/\/)/.test(hotspot.image.path)) continue;
      preloaded.current.add(hotspot.id);
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}${hotspot.image.path}`;
      if (++count === 3) break;
    }
  }, [hotspots, labels]);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    pointer.current = {
      id: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      active: true,
      suppressClick: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current?.active || current.id !== event.pointerId) return;
    if (
      exceedsHotspotDragThreshold(current.start, {
        x: event.clientX,
        y: event.clientY,
      })
    )
      current.suppressClick = true;
  }

  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    pointerMove(event);
    const current = pointer.current;
    if (current?.id === event.pointerId) current.active = false;
  }

  function pointerCancel(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (current?.id === event.pointerId) {
      current.active = false;
      current.suppressClick = true;
    }
  }

  function lostCapture(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current?.active) pointerCancel(event);
  }

  useEffect(() => {
    if (!viewer || !enabled || viewer.isDestroyed()) {
      visible.current.clear();
      setLabels([]);
      return;
    }
    // These records are Earth/WGS84. Never reinterpret their degrees on Mars.
    if (!viewer.scene.globe.ellipsoid.equals(Ellipsoid.WGS84)) {
      setLabels([]);
      return;
    }
    let previousFrame: string | null = null;
    const direction = new Cartesian3();
    const normal = new Cartesian3();
    const render = () => {
      if (viewer.isDestroyed()) return;
      const canvas = viewer.canvas;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cameraPosition = viewer.camera.positionWC;
      const anchors = hotspots.flatMap((hotspot) => {
        const location = Cartographic.fromDegrees(
          hotspot.longitude,
          hotspot.latitude,
        );
        const elevation = viewer.scene.globe.getHeight(location) ?? 0;
        const position = Cartesian3.fromDegrees(
          hotspot.longitude,
          hotspot.latitude,
          elevation + 3,
          Ellipsoid.WGS84,
        );
        Ellipsoid.WGS84.geodeticSurfaceNormal(position, normal);
        if (!isFrontFacing(position, normal, cameraPosition)) return [];
        const pixel = SceneTransforms.worldToWindowCoordinates(
          viewer.scene,
          position,
        );
        if (!pixel || !isProjectedPointVisible(pixel.x, pixel.y, width, height))
          return [];
        const metersPerPixel = viewer.camera.getPixelSize(
          new BoundingSphere(position, 1),
          width,
          height,
        );
        const show = nextHotspotVisibility(
          visible.current.get(hotspot.id) ?? false,
          metersPerPixel,
          scaleLimits,
        );
        visible.current.set(hotspot.id, show);
        if (!show) return [];
        Cartesian3.subtract(position, cameraPosition, direction);
        const pointDistance = Cartesian3.magnitude(direction);
        Cartesian3.normalize(direction, direction);
        const intersection = viewer.scene.globe.pick(
          new Ray(cameraPosition, direction),
          viewer.scene,
        );
        if (
          isTerrainOccluded(
            pointDistance,
            intersection
              ? Cartesian3.distance(cameraPosition, intersection)
              : undefined,
            Math.max(2, Math.min(10, metersPerPixel * 0.05)),
          )
        )
          return [];
        const button = buttonNodes.current.get(hotspot.id);
        return [
          {
            id: hotspot.id,
            x: pixel.x,
            y: pixel.y,
            width:
              button?.offsetWidth ||
              Math.min(
                240,
                Math.max(116, hotspot.name[language].length * 15 + 32),
              ),
            height: 44,
            priority:
              hotspot.id === activeId
                ? 100
                : hotspot.id === focusedId
                  ? 50
                  : (hotspot.priority ?? 0),
          },
        ];
      });
      const next = placeGlobeHotspotLabels(
        anchors,
        {
          width,
          height,
          insetTop: Math.max(
            78,
            (canvas
              .closest(".globe-lab")
              ?.querySelector(".lab-bar")
              ?.getBoundingClientRect().bottom ?? 66) -
              canvas.getBoundingClientRect().top +
              12,
          ),
        },
        offsets.current,
      ).slice(0, maxLabels);
      for (const label of next)
        offsets.current.set(label.id, { dx: label.dx, dy: label.dy });
      const frame = next
        .map(
          (label) =>
            `${label.id}:${Math.round(label.x)}:${Math.round(label.y)}:${Math.round(label.left)}:${Math.round(label.top)}`,
        )
        .join("|");
      if (frame !== previousFrame) {
        previousFrame = frame;
        setLabels(next);
      }
    };
    const remove = viewer.scene.postRender.addEventListener(render);
    render();
    viewer.scene.requestRender();
    return remove;
  }, [
    viewer,
    hotspots,
    enabled,
    language,
    focusedId,
    activeId,
    scaleLimits.showBelow,
    scaleLimits.hideAbove,
    scaleLimits.showAbove,
    scaleLimits.hideBelow,
    maxLabels,
  ]);

  const byId = new Map(hotspots.map((hotspot) => [hotspot.id, hotspot]));
  return (
    <div
      className="globe-hotspots"
      data-marker-kind={kind}
      aria-label={language === "zh" ? "地理热点" : "Geographic hotspots"}
    >
      <svg className="globe-hotspot-connectors" aria-hidden="true">
        {labels.map((label) => (
          <polyline
            key={label.id}
            points={`${label.x},${label.y} ${label.elbow.x},${label.elbow.y} ${label.endpoint.x},${label.endpoint.y}`}
          />
        ))}
      </svg>
      {labels.map((label) => {
        const hotspot = byId.get(label.id);
        if (!hotspot) return null;
        const selected = activeId === label.id;
        const focused = focusedId === label.id;
        const className = `globe-hotspot ${selected ? "is-active" : ""} ${focused ? "is-focused" : ""}`;
        const events = {
          onClick: (event: MouseEvent<HTMLButtonElement>) => {
            if (event.detail > 0 && pointer.current?.suppressClick) {
              event.preventDefault();
              return;
            }
            onActivate(hotspot);
          },
          onPointerDown: pointerDown,
          onPointerMove: pointerMove,
          onPointerUp: pointerUp,
          onPointerCancel: pointerCancel,
          onLostPointerCapture: lostCapture,
          onFocus: () => onFocus?.(hotspot.id),
          onMouseEnter: () => onFocus?.(hotspot.id),
          onMouseLeave: () => onFocus?.(null),
        };
        return (
          <div key={label.id}>
            <button
              type="button"
              className={`${className} globe-hotspot-point globe-hotspot-hit`}
              style={{ left: label.x - 22, top: label.y - 22 }}
              tabIndex={-1}
              data-hotspot-id={label.id}
              data-location-kind={kind}
              aria-label={hotspot.name[language]}
              aria-pressed={selected}
              {...events}
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${className} globe-hotspot-label globe-hotspot-hit`}
              style={{ left: label.left, top: label.top, width: label.width }}
              ref={(element) => {
                if (element) buttonNodes.current.set(label.id, element);
                else buttonNodes.current.delete(label.id);
              }}
              data-hotspot-id={label.id}
              data-location-kind={kind}
              aria-pressed={selected}
              {...events}
            >
              {hotspot.name[language]}
            </button>
          </div>
        );
      })}
    </div>
  );
}
