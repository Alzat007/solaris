import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  X,
} from "lucide-react";
import type { ImmersiveHotspot } from "../exploration/immersiveCatalog";
import { isGalleryStory } from "../exploration/galleryStory";
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
  const mainImage = useRef<HTMLImageElement>(null);
  const [imageStatus, setImageStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const story = isGalleryStory(hotspot) ? hotspot : null;
  const gallery = story?.gallery ?? (hotspot.image ? [hotspot.image] : []);
  const imageIndex = Math.min(selectedImage, Math.max(0, gallery.length - 1));
  const image = gallery[imageIndex];
  const imageKey = `${hotspot.id}-${imageIndex}-${attempt}-${image?.path ?? "none"}`;
  const activeImage = useRef(imageKey);
  activeImage.current = imageKey;
  const zh = language === "zh";
  const sectionTitle =
    story?.sectionTitle?.[language] ??
    (zh ? "历史与教育" : "History and learning");
  const titleId = `globe-story-${hotspot.id}`;
  useLayoutEffect(() => {
    const element = mainImage.current;
    if (!element || activeImage.current !== imageKey) return;
    // Cached images can finish before React's load handler or focus effect.
    setImageStatus(
      element.complete
        ? element.naturalWidth > 0
          ? "loaded"
          : "error"
        : "loading",
    );
  }, [imageKey]);
  useEffect(() => {
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setAttempt(0);
    setSelectedImage(0);
    close.current?.focus();
    return () => {
      if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
    };
  }, [hotspot.id, restoreFocus]);
  function selectImage(index: number) {
    if (index === imageIndex || index < 0 || index >= gallery.length) return;
    setImageStatus("loading");
    setAttempt(0);
    setSelectedImage(index);
  }
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
    <div
      className="globe-story-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="globe-story-panel"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        data-story-id={hotspot.id}
        data-tv-scroll-keys="vertical"
      >
        <button
          className="globe-story-close"
          data-gesture-id="story-close"
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
            <p className="globe-story-mobile-title" aria-hidden="true">
              {hotspot.name[language]}
            </p>
            <div className="globe-story-image-area">
              {image && (
                <img
                  key={imageKey}
                  ref={mainImage}
                  src={`${import.meta.env.BASE_URL}${image.path}`}
                  alt={image.caption[language]}
                  decoding="async"
                  data-gallery-index={imageIndex}
                  onLoad={() => {
                    if (activeImage.current === imageKey)
                      setImageStatus("loaded");
                  }}
                  onError={() => {
                    if (activeImage.current === imageKey)
                      setImageStatus("error");
                  }}
                  style={{ opacity: imageStatus === "loaded" ? 1 : 0 }}
                />
              )}
              {image && imageStatus === "loading" && (
                <div className="globe-story-image-status" role="status">
                  {zh ? "正在加载图片" : "Loading image"}
                </div>
              )}
              {(!image || imageStatus === "error") && (
                <div className="globe-story-image-status" role="status">
                  <ImageIcon size={28} aria-hidden="true" />
                  <span>
                    {image
                      ? zh
                        ? "图片加载失败"
                        : "Image could not be loaded"
                      : zh
                        ? "该地点图片尚未录入"
                        : "Images for this place are pending"}
                  </span>
                  {image && (
                    <button
                      type="button"
                      data-gesture-id="story-gallery-retry"
                      aria-label={zh ? "重新加载图片" : "Reload image"}
                      title={zh ? "重新加载图片" : "Reload image"}
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
            {gallery.length > 1 && (
              <>
                <div className="globe-story-gallery-controls">
                  <button
                    className="globe-story-gallery-arrow"
                    type="button"
                    data-gesture-id="story-gallery-prev"
                    aria-label={zh ? "上一张图片" : "Previous image"}
                    title={zh ? "上一张图片" : "Previous image"}
                    onClick={() =>
                      selectImage(
                        (imageIndex - 1 + gallery.length) % gallery.length,
                      )
                    }
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <p role="status" aria-live="polite" aria-atomic="true">
                    {imageIndex + 1} / {gallery.length}
                  </p>
                  <button
                    className="globe-story-gallery-arrow"
                    type="button"
                    data-gesture-id="story-gallery-next"
                    aria-label={zh ? "下一张图片" : "Next image"}
                    title={zh ? "下一张图片" : "Next image"}
                    onClick={() =>
                      selectImage((imageIndex + 1) % gallery.length)
                    }
                  >
                    <ChevronRight size={22} />
                  </button>
                </div>
                <div
                  className="globe-story-thumbnails"
                  role="group"
                  aria-label={zh ? "图片集" : "Image collection"}
                >
                  {gallery.map((entry, index) => (
                    <button
                      key={entry.path}
                      className="globe-story-thumbnail"
                      type="button"
                      data-gesture-id={`story-gallery-image-${index}`}
                      aria-label={
                        zh
                          ? `图片 ${index + 1}：${entry.caption.zh}`
                          : `Image ${index + 1}: ${entry.caption.en}`
                      }
                      title={zh ? `图片 ${index + 1}` : `Image ${index + 1}`}
                      aria-pressed={index === imageIndex}
                      onClick={() => selectImage(index)}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}${entry.path}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      <span aria-hidden="true">{index + 1}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {image && (
              <figcaption>
                <p>{image.caption[language]}</p>
                <p>{image.credit}</p>
                <p>
                  {zh ? "影像日期" : "Image date"}: {image.date} ·{" "}
                  <a href={image.licenseUrl} target="_blank" rel="noreferrer">
                    {image.license}
                  </a>
                </p>
                <a href={image.sourceUrl} target="_blank" rel="noreferrer">
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
            {story ? (
              <>
                <p className="globe-story-summary">
                  {story.introduction[language]}
                </p>
                <section
                  className="globe-story-events"
                  aria-label={sectionTitle}
                >
                  <h3>{sectionTitle}</h3>
                  {story.events.map((event) => (
                    <article className="globe-story-event" key={event.id}>
                      <p className="globe-story-date">{event.date}</p>
                      <h4>{event.title[language]}</h4>
                      <p>{event.description[language]}</p>
                      <div className="globe-story-event-photos">
                        {event.imageIndices.map((index) => {
                          const entry = gallery[index];
                          if (!entry) return null;
                          return (
                            <button
                              key={index}
                              type="button"
                              data-gesture-id={`story-event-${event.id}-image-${index}`}
                              aria-label={
                                zh
                                  ? `${event.title.zh}：图片 ${index + 1}`
                                  : `${event.title.en}: image ${index + 1}`
                              }
                              title={
                                zh ? `图片 ${index + 1}` : `Image ${index + 1}`
                              }
                              aria-pressed={index === imageIndex}
                              onClick={() => {
                                selectImage(index);
                                const thumbnail =
                                  panel.current?.querySelector<HTMLElement>(
                                    `[data-gesture-id="story-gallery-image-${index}"]`,
                                  );
                                thumbnail?.focus({ preventScroll: true });
                                panel.current
                                  ?.querySelector<HTMLElement>(
                                    ".globe-story-image-area",
                                  )
                                  ?.scrollIntoView({
                                    block: "start",
                                    inline: "nearest",
                                  });
                              }}
                            >
                              <ImageIcon size={16} />
                              {zh ? `图片 ${index + 1}` : `Image ${index + 1}`}
                            </button>
                          );
                        })}
                      </div>
                      <div className="globe-story-event-sources">
                        {event.sourceUrls.map((url, index) => (
                          <a
                            href={url}
                            key={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {zh
                              ? `事件来源 ${index + 1}`
                              : `Event source ${index + 1}`}
                            <ExternalLink size={13} />
                          </a>
                        ))}
                      </div>
                    </article>
                  ))}
                </section>
              </>
            ) : (
              <>
                <p className="globe-story-date">{hotspot.date}</p>
                <p className="globe-story-summary">
                  {hotspot.summary[language]}
                </p>
                {hotspot.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph[language]}</p>
                ))}
              </>
            )}
            <div className="globe-story-context">
              <p>{hotspot.relation[language]}</p>
              <p>{hotspot.coordinateNote[language]}</p>
              {image && <p>{image.processing[language]}</p>}
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
