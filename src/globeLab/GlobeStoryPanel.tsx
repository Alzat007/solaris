import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ExternalLink, RefreshCw, X } from "lucide-react";
import type { ImmersiveHotspot } from "../exploration/immersiveCatalog";
import "./storyPanel.css";

export interface GlobeStoryPanelProps {
  hotspot: ImmersiveHotspot;
  language?: "zh" | "en";
  onClose: () => void;
  restoreFocus?: boolean;
}

export function GlobeStoryPanel({
  hotspot,
  language = "zh",
  onClose,
  restoreFocus = true,
}: GlobeStoryPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [imageStatus, setImageStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  const zh = language === "zh";
  const titleId = `globe-story-${hotspot.id}`;
  useEffect(() => {
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setImageStatus("loading");
    setAttempt(0);
    close.current?.focus();
    return () => {
      if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
    };
  }, [hotspot.id, restoreFocus]);
  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "BrowserBack") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) onClose();
      return;
    }
    const elements = Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex="0"]',
      ) ?? [],
    ).filter((element) => element.getClientRects().length > 0);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      const index = elements.findIndex(
        (element) => element === document.activeElement,
      );
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next =
        elements[(index + direction + elements.length) % elements.length];
      next?.focus();
      next?.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const shared = panel.current?.querySelector<HTMLElement>(
        ".globe-story-scroll",
      );
      const focused =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const pane =
        shared && getComputedStyle(shared).overflowY === "auto"
          ? shared
          : (focused?.closest<HTMLElement>(
              ".globe-story-media, .globe-story-copy",
            ) ??
            panel.current?.querySelector<HTMLElement>(".globe-story-copy"));
      const direction =
        event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1;
      pane?.scrollBy({
        top:
          direction *
          (event.key.startsWith("Page") ? pane.clientHeight * 0.8 : 120),
      });
      return;
    }
    if (event.key !== "Tab") return;
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return (
    <div className="globe-story-backdrop">
      <div
        className="globe-story-panel"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        data-story-id={hotspot.id}
      >
        <button
          className="globe-story-close"
          ref={close}
          type="button"
          aria-label={zh ? "关闭信息卡" : "Close information panel"}
          title={zh ? "关闭信息卡" : "Close information panel"}
          onClick={onClose}
        >
          <X size={22} />
        </button>
        <div className="globe-story-scroll">
          <figure className="globe-story-media">
            <div className="globe-story-image-area">
              {hotspot.image && imageStatus !== "error" && (
                <img
                  key={`${hotspot.id}-${attempt}`}
                  src={`${import.meta.env.BASE_URL}${hotspot.image.path}`}
                  alt={hotspot.image.caption[language]}
                  onLoad={() => setImageStatus("loaded")}
                  onError={() => setImageStatus("error")}
                  style={{ opacity: imageStatus === "loaded" ? 1 : 0 }}
                />
              )}
              {hotspot.image && imageStatus === "loading" && (
                <div className="globe-story-image-status" role="status">
                  {zh ? "正在加载图片" : "Loading image"}
                </div>
              )}
              {(!hotspot.image || imageStatus === "error") && (
                <div className="globe-story-image-status" role="status">
                  <span>{zh ? "图片暂不可用" : "Image unavailable"}</span>
                  {hotspot.image && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageStatus("loading");
                        setAttempt((value) => value + 1);
                      }}
                    >
                      <RefreshCw size={18} />
                      {zh ? "重试" : "Retry"}
                    </button>
                  )}
                </div>
              )}
            </div>
            {hotspot.image && (
              <figcaption>
                <p>{hotspot.image.caption[language]}</p>
                <p>{hotspot.image.credit}</p>
                <p>
                  {zh ? "拍摄日期" : "Image date"}: {hotspot.image.date} ·{" "}
                  <a
                    href={hotspot.image.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {hotspot.image.license}
                  </a>
                </p>
                <a
                  href={hotspot.image.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {zh ? "图片原始来源" : "Original image source"}
                  <ExternalLink size={13} />
                </a>
              </figcaption>
            )}
          </figure>
          <section className="globe-story-copy">
            <p className="globe-story-review">
              {zh
                ? "开发预览 · 内容待人工审核"
                : "Development preview · Human review pending"}
            </p>
            <h2 id={titleId}>{hotspot.name[language]}</h2>
            <p className="globe-story-date">{hotspot.date}</p>
            <p className="globe-story-summary">{hotspot.summary[language]}</p>
            {hotspot.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph[language]}</p>
            ))}
            <div className="globe-story-context">
              <p>{hotspot.relation[language]}</p>
              <p>{hotspot.coordinateNote[language]}</p>
              {hotspot.image && <p>{hotspot.image.processing[language]}</p>}
            </div>
            <div className="globe-story-sources">
              <h3>{zh ? "事实与地点来源" : "Fact and location sources"}</h3>
              {hotspot.sourceUrls.map((url, index) => (
                <a href={url} key={url} target="_blank" rel="noreferrer">
                  {zh ? `来源 ${index + 1}` : `Source ${index + 1}`} ·{" "}
                  {new URL(url).hostname}
                  <ExternalLink size={13} />
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
