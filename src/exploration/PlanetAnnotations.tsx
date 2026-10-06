import type { ButtonHTMLAttributes } from "react";
import type { AtlasAnnotation } from "./planetAtlasCatalog";
import type { AtlasView } from "./earthAtlasProjection";

interface AnnotationProps {
  entries: readonly AtlasAnnotation[];
  view: AtlasView;
  language: "zh" | "en";
  hoverId: string | null;
  label: string;
  markerProps: (
    id: string,
    suffix?: string,
  ) => ButtonHTMLAttributes<HTMLButtonElement>;
}

export function PlanetAnnotations({
  entries,
  view,
  language,
  hoverId,
  label,
  markerProps,
}: AnnotationProps) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const focused = (id: string) => view.focusId === id || hoverId === id;
  return (
    <div className="earth-atlas-markers" aria-label={label}>
      <svg
        className="earth-atlas-leaders"
        width={view.width}
        height={view.height}
        aria-hidden="true"
      >
        {view.points.map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r={point.featured ? 2.8 : 1.65}
            className={point.featured ? "featured-point" : "capital-point"}
          />
        ))}
        {view.labels.map((entry) => (
          <g key={entry.id} className={focused(entry.id) ? "focused" : ""}>
            <polyline
              points={`${entry.x},${entry.y} ${entry.elbow.x},${entry.elbow.y} ${entry.endpoint.x},${entry.endpoint.y}`}
            />
            <circle cx={entry.x} cy={entry.y} r="6" className="anchor-ring" />
          </g>
        ))}
      </svg>
      {view.labels.map((placement) => {
        const entry = byId.get(placement.id);
        if (!entry) return null;
        return (
          <div key={entry.id}>
            <button
              type="button"
              className="earth-atlas-anchor"
              {...markerProps(entry.id, "-point")}
              aria-label={`${entry.name[language]} · ${language === "zh" ? "打开图文" : "Open story"}`}
              tabIndex={-1}
              style={{ left: placement.x - 18, top: placement.y - 18 }}
            />
            <button
              type="button"
              className={`earth-atlas-label${focused(entry.id) ? " focused" : ""}${entry.featured ? " featured" : ""}`}
              {...markerProps(entry.id)}
              title={entry.label[language]}
              style={{
                left: placement.left,
                top: placement.top,
                width: placement.width,
                height: placement.height,
              }}
            >
              <span>{entry.label[language]}</span>
              <span className="earth-atlas-label-index">
                {entry.featured ? "◦" : "+"}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
