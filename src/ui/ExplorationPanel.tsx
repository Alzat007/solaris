import { useEffect, useRef, useState } from "react";
import { planets, planetById } from "../data/planets";
import { destinations } from "../exploration/content";
import {
  earthDirectory,
  earthDirectoryStats,
} from "../exploration/earthDirectory";
import {
  getImmersiveSite,
  immersiveSites,
  type ImmersiveHotspot,
} from "../exploration/immersiveCatalog";
import type { LocalizedText } from "../exploration/contentTypes";
import { pickerModes } from "../exploration/sceneState";
import { interaction } from "../interaction/InteractionController";
import { store, useSolaris } from "../interaction/store";
import { isTvMode } from "../platform/tvNavigation";

function tvReadingAnchor(tv: boolean, id: string) {
  return {
    tabIndex: tv ? 0 : undefined,
    "data-tv-reading-anchor": tv ? id : undefined,
  };
}

const continents = [
  { id: "asia", name: { zh: "亚洲", en: "Asia" }, open: true },
  { id: "europe", name: { zh: "欧洲", en: "Europe" }, open: false },
  { id: "africa", name: { zh: "非洲", en: "Africa" }, open: false },
  {
    id: "north-america",
    name: { zh: "北美洲", en: "North America" },
    open: false,
  },
  {
    id: "south-america",
    name: { zh: "南美洲", en: "South America" },
    open: false,
  },
  { id: "oceania", name: { zh: "大洋洲", en: "Oceania" }, open: false },
  { id: "antarctica", name: { zh: "南极洲", en: "Antarctica" }, open: false },
];

function HotspotImage({
  hotspot,
  language,
  tv,
}: {
  hotspot: ImmersiveHotspot;
  language: "zh" | "en";
  tv: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const image = hotspot.image;
  useEffect(() => setFailed(false), [hotspot.id]);
  if (!image) return null;
  return (
    <figure className="immersive-info-media">
      {failed ? (
        <p role="alert">
          {language === "zh" ? "图片暂时无法加载。" : "Image unavailable."}
        </p>
      ) : (
        <img
          src={`${import.meta.env.BASE_URL}${image.path}`}
          alt={image.caption[language]}
          onError={() => setFailed(true)}
        />
      )}
      <figcaption {...tvReadingAnchor(tv, "image-caption")}>
        <span>{image.caption[language]}</span>
        <small>
          {image.credit} · {image.date}
        </small>
        <div className="immersive-source-links">
          <a href={image.sourceUrl} target="_blank" rel="noreferrer">
            {language === "zh" ? "原始影像" : "Original image"} ↗
          </a>
          <a href={image.licenseUrl} target="_blank" rel="noreferrer">
            {image.license} ↗
          </a>
        </div>
      </figcaption>
    </figure>
  );
}

export function ExplorationPanel() {
  const s = useSolaris();
  const panel = useRef<HTMLElement>(null);
  const previousHotspot = useRef<string | null>(null);
  const lang = s.language;
  const tv = isTvMode(location.search);
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const text = (value: LocalizedText) => value[lang];
  const body = planetById(s.selected);
  const site = getImmersiveSite(s.destinationId ?? "");
  const hotspot = site?.hotspots.find((item) => item.id === s.activeHotspotId);
  const isPicker = pickerModes.includes(s.mode);
  const isDescent = s.mode === "DESCENT_TRANSITION";
  const isLocal = s.mode === "LOCATION_OVERVIEW";
  const isInfo = s.mode === "INFO_PANEL_OPEN";
  const active = (isPicker || isDescent || isLocal || isInfo) && !s.webglError;
  const modal = isPicker || isInfo;
  const stats = earthDirectoryStats();
  const back = () => interaction.return();

  useEffect(() => {
    if (s.activeHotspotId) previousHotspot.current = s.activeHotspotId;
    if (!active) return;
    const timer = setTimeout(() => {
      if (isLocal && previousHotspot.current) {
        const marker = document.querySelector<HTMLButtonElement>(
          `[data-gesture-id="hotspot-${previousHotspot.current}"]`,
        );
        if (marker) {
          marker.focus();
          return;
        }
      }
      panel.current
        ?.querySelector<HTMLButtonElement>(
          isInfo ? ".immersive-info-close" : "button:not(:disabled)",
        )
        ?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [active, s.mode, s.activeHotspotId, isInfo, isLocal]);

  if (!active || !body) return null;
  const heading =
    s.mode === "EARTH_CONTINENT_PICKER"
      ? t("地球 / 大洲", "Earth / Continents")
      : s.mode === "EARTH_COUNTRY_PICKER"
        ? t("地球 / 亚洲 / 国家", "Earth / Asia / Countries")
        : s.mode === "EARTH_CITY_PICKER"
          ? t("地球 / 亚洲 / 中国 / 城市", "Earth / Asia / China / Cities")
          : site
            ? `${t(body.chineseName, body.name)} / ${text(site.name)}`
            : `${t(body.chineseName, body.name)} / ${t("经典区域", "Regions")}`;
  const option = (
    id: string,
    title: string,
    caption: string,
    action: () => void,
    disabled = false,
  ) => (
    <button
      key={id}
      className="immersive-option"
      data-gesture-id={id}
      data-gesture-label={title}
      disabled={disabled}
      onClick={action}
    >
      <span>
        <strong>{title}</strong>
        <small>{caption}</small>
      </span>
      <span className="immersive-option-arrow" aria-hidden="true">
        {disabled ? "·" : "→"}
      </span>
    </button>
  );

  const scope = (
    <details className="immersive-scope">
      <summary>{t("目录与内容覆盖", "Directory and content coverage")}</summary>
      <p>
        {t(
          "北京是第一标准样板，不是最终城市范围。完整目标包含各国首都、世界名城和所有行星的经典区域。",
          "Beijing is the first reference city, not the complete city scope. The full target includes national capitals, selected world cities and classic regions on every planet.",
        )}
      </p>
      <p>
        {stats.countryEntries}{" "}
        {t("条国家／地区来源记录", "source country/territory records")}
        {" · "}
        {stats.capitalRelations}{" "}
        {t("条来源首都关系", "source-listed capital relationships")}
        {" · "}
        {stats.cities} {t("条城市记录", "city records")}
      </p>
      <p>
        {t(
          "目录记录不代表已完成局部场景。未开放条目的资料与素材继续分批核验，首都角色及生效日期待逐条审核。",
          "Directory records are not completed local scenes. Unavailable entries remain pending source and media review, including capital roles and effective dates.",
        )}
      </p>
      <ul>
        {planets.map((planet) => (
          <li key={planet.id}>
            {t(planet.chineseName, planet.name)}:{" "}
            {immersiveSites.filter((item) => item.bodyId === planet.id).length}{" "}
            {t("局部视图", "local views")}
            {" / "}
            {
              destinations.filter((item) => item.bodyId === planet.id).length
            }{" "}
            {t("原有地点记录", "existing destination records")}
          </li>
        ))}
      </ul>
      <p>{earthDirectory.databaseLicense.attribution}</p>
      <div className="immersive-source-links">
        <a
          href={earthDirectory.databaseLicense.url}
          target="_blank"
          rel="noreferrer"
        >
          {earthDirectory.databaseLicense.id} ↗
        </a>
        <a
          href={earthDirectory.databaseLicense.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {t("数据库来源与许可", "Source database license")} ↗
        </a>
        <a
          href={earthDirectory.databaseLicense.downloadUrl}
          target="_blank"
          rel="noreferrer"
          download="earth-directory-source.json"
        >
          {t("完整城市目录 JSON", "Complete city directory JSON")} ↗
        </a>
      </div>
    </details>
  );

  return (
    <section
      ref={panel}
      className={`immersive-shell ${isPicker ? "immersive-picker-mode" : ""} ${isInfo ? "immersive-info-mode" : ""}`}
      role={modal ? "dialog" : "region"}
      aria-modal={modal ? true : undefined}
      aria-label={t("分层星球探索", "Layered planetary exploration")}
      onKeyDown={(event) => {
        if (new URLSearchParams(window.location.search).get("tv") === "1")
          return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) back();
        } else if (event.key === "Tab" && modal) {
          const items = Array.from(
            panel.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled), a[href], summary",
            ),
          ).filter((item) => {
            const closed = item.closest("details:not([open])");
            return (
              item.getClientRects().length &&
              (!closed || item === closed.querySelector("summary"))
            );
          });
          const first = items[0],
            last = items.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
          event.stopPropagation();
        } else event.stopPropagation();
      }}
    >
      <header className="immersive-toolbar">
        <button
          className="immersive-icon-button"
          title={t("返回上一层", "Go back")}
          aria-label={t("返回上一层", "Go back")}
          data-gesture-id="exploration-back"
          data-gesture-label={t("返回", "Back")}
          onClick={back}
        >
          ←
        </button>
        <span className="immersive-heading">
          <span>{heading}</span>
          <small>
            {t(
              "公开测试版 · 人工复核待完成",
              "Public beta · human review pending",
            )}
          </small>
        </span>
        <button
          className="immersive-language"
          title={t("切换为英文", "Switch to Chinese")}
          onClick={() => store.set({ language: lang === "zh" ? "en" : "zh" })}
          data-gesture-id="exploration-language"
          data-gesture-label={lang === "zh" ? "English" : "中文"}
        >
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </header>
      {s.explorationError && (
        <p className="immersive-error" role="alert">
          {s.explorationError}
        </p>
      )}
      {isPicker && (
        <aside className="immersive-picker">
          <p className="immersive-eyebrow">{t(body.chineseName, body.name)}</p>
          <h2>
            {s.mode === "EARTH_CONTINENT_PICKER"
              ? t("选择大洲", "Continents")
              : s.mode === "EARTH_COUNTRY_PICKER"
                ? t("选择国家", "Countries")
                : s.mode === "EARTH_CITY_PICKER"
                  ? t("选择城市", "Cities")
                  : t("选择经典区域", "Classic regions")}
          </h2>
          <div className="immersive-options">
            {s.mode === "EARTH_CONTINENT_PICKER" &&
              continents.map((item) =>
                option(
                  `continent-${item.id}`,
                  text(item.name),
                  item.open
                    ? t("中国 · 北京", "China · Beijing")
                    : t("局部场景待补充", "Local scenes pending"),
                  () => interaction.chooseContinent(item.id),
                  !item.open,
                ),
              )}
            {s.mode === "EARTH_COUNTRY_PICKER" &&
              option(
                "country-cn",
                t("中国", "China"),
                t("北京 · 首都与名城样板", "Beijing · reference city"),
                () => interaction.chooseCountry("cn"),
              )}
            {s.mode === "EARTH_CITY_PICKER" &&
              option(
                "city-city-beijing",
                t("北京", "Beijing"),
                t(
                  "天安门 · 八达岭长城 · 鸟巢",
                  "Tiananmen · Badaling Great Wall · Bird's Nest",
                ),
                () => {
                  void interaction.chooseCity("city-beijing");
                },
              )}
            {s.mode === "PLANET_REGION_PICKER" &&
              destinations
                .filter((item) => item.bodyId === s.selected)
                .map((item) => {
                  const localSite = getImmersiveSite(item.id);
                  return option(
                    `enter-${item.id}`,
                    text(item.name),
                    localSite
                      ? t(
                          `${localSite.hotspots.length} 个科学热点`,
                          `${localSite.hotspots.length} scientific hotspots`,
                        )
                      : t(
                          "局部场景与资料待编审",
                          "Local scene and content pending",
                        ),
                    () => {
                      void interaction.enterDestination(item.id);
                    },
                    !localSite,
                  );
                })}
          </div>
          {scope}
        </aside>
      )}
      {isDescent && site && (
        <div className="immersive-descent" role="status">
          <p className="immersive-eyebrow">
            {s.locationResourcesReady
              ? t("正在接近", "Approaching")
              : t("准备局部资源", "Preparing local resources")}
          </p>
          <h2>{text(site.name)}</h2>
          <div className="immersive-progress" aria-hidden="true">
            <i
              className={
                s.locationResourcesReady ? "immersive-progress-ready" : ""
              }
            />
          </div>
          <div className="immersive-descent-actions">
            <button
              data-gesture-id="cancel-approach"
              data-gesture-label={t("取消", "Cancel")}
              onClick={back}
            >
              {t("取消", "Cancel")}
            </button>
            <button
              data-gesture-id="skip-approach"
              data-gesture-label={t("跳过转场", "Skip approach")}
              disabled={!s.locationResourcesReady}
              onClick={() => interaction.skipLocationTransition()}
            >
              {t("跳过", "Skip")}
            </button>
          </div>
        </div>
      )}
      {isLocal && site && (
        <div className="immersive-local-note">
          <strong>{text(site.name)}</strong>
          <p>
            {t(
              site.kind === "city-atlas"
                ? "地理定位示意 · 非实景城市重建"
                : "科学区域示意 · 非真实连续地表",
              site.kind === "city-atlas"
                ? "Geographic atlas · not a city reconstruction"
                : "Scientific regional atlas · not continuous terrain",
            )}
          </p>
        </div>
      )}
      {isInfo && hotspot && (
        <article className="immersive-info-card" key={hotspot.id}>
          <header className="immersive-info-title">
            <div>
              <p className="immersive-eyebrow">{hotspot.date}</p>
              <h2>{text(hotspot.name)}</h2>
            </div>
            <button
              className="immersive-info-close immersive-icon-button"
              title={t("关闭信息卡", "Close information")}
              aria-label={t("关闭信息卡", "Close information")}
              data-gesture-id="close-hotspot"
              data-gesture-label={t("关闭信息卡", "Close information")}
              onClick={back}
            >
              ×
            </button>
          </header>
          <div
            className={`immersive-info-layout ${!hotspot.image ? "immersive-info-no-image" : ""}`}
          >
            <HotspotImage hotspot={hotspot} language={lang} tv={tv} />
            <div className="immersive-info-copy">
              <p
                className="immersive-info-summary"
                {...tvReadingAnchor(tv, "summary")}
              >
                {text(hotspot.summary)}
              </p>
              {hotspot.paragraphs.map((paragraph, index) => (
                <p key={index} {...tvReadingAnchor(tv, `paragraph-${index}`)}>
                  {text(paragraph)}
                </p>
              ))}
              <p
                className="immersive-relation"
                {...tvReadingAnchor(tv, "relation")}
              >
                {text(hotspot.relation)}
              </p>
              <p
                className="immersive-coordinate"
                {...tvReadingAnchor(tv, "coordinate")}
              >
                {text(hotspot.coordinateNote)}
              </p>
              <p
                className="immersive-review"
                {...tvReadingAnchor(tv, "review")}
              >
                {t(
                  "事实、地点与图片已作来源核对；人工复核待完成。",
                  "Facts, locations and images checked against sources; human review pending.",
                )}
              </p>
              <details className="immersive-info-sources">
                <summary>
                  {t("科学资料与图片说明", "Sources and image notes")}
                </summary>
                {hotspot.image && (
                  <p {...tvReadingAnchor(tv, "image-processing")}>
                    {text(hotspot.image.processing)}
                  </p>
                )}
                <ul>
                  {hotspot.sourceUrls.map((url, index) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {t(`资料来源 ${index + 1}`, `Source ${index + 1}`)} ·{" "}
                        {new URL(url).hostname} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
