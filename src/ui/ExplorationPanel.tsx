import { useEffect, useRef, useState } from "react";
import { planets, planetById } from "../data/planets";
import {
  assets,
  contentPack,
  destinations,
  sources,
  stories,
} from "../exploration/content";
import {
  countries,
  earthDirectory,
  earthDirectoryStats,
  getEarthCity,
  searchEarthCities,
  type CityTag,
} from "../exploration/earthDirectory";
import { explorationModes } from "../exploration/sceneState";
import type { Asset, LocalizedText } from "../exploration/contentTypes";
import { interaction } from "../interaction/InteractionController";
import { store, useSolaris } from "../interaction/store";

const kinds = {
  "natural-region": { zh: "自然区域", en: "Natural region" },
  "landing-site": { zh: "无人探测着陆点", en: "Robotic landing site" },
  city: { zh: "城市与地标", en: "City and landmark" },
  observation: { zh: "观察主题", en: "Observation" },
};
const roles = {
  "event-record": { zh: "事件现场影像", en: "Event record" },
  "landmark-photo": { zh: "地标配图", en: "Landmark photograph" },
  "orbital-image": { zh: "轨道影像", en: "Orbital image" },
  "scientific-visualization": {
    zh: "科学可视化",
    en: "Scientific visualization",
  },
  "artistic-illustration": { zh: "艺术示意", en: "Artistic illustration" },
};

function SourceList({ ids }: { ids: string[] }) {
  return (
    <ul className="source-list">
      {ids.map((id) => {
        const source = sources.find((entry) => entry.id === id);
        return (
          source && (
            <li key={id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.institution} · {source.title} ↗
              </a>
            </li>
          )
        );
      })}
    </ul>
  );
}

function AssetFigure({
  asset,
  language,
}: {
  asset: Asset;
  language: "zh" | "en";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="exploration-figure">
      {failed ? (
        <p role="alert">
          {language === "zh"
            ? "图片加载失败。返回后可重试。"
            : "Image unavailable. Go back and retry."}
        </p>
      ) : (
        <img
          src={`${import.meta.env.BASE_URL}${asset.path}`}
          alt={asset.caption[language]}
          onError={() => setFailed(true)}
        />
      )}
      <figcaption>
        <span className="media-role">{roles[asset.role][language]}</span>
        {asset.caption[language]}
        <small>
          {asset.credit} · {asset.date}
        </small>
      </figcaption>
    </figure>
  );
}

export function ExplorationPanel() {
  const s = useSolaris();
  const panel = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [tag, setTag] = useState<CityTag | "">("");
  const [limit, setLimit] = useState(30);
  const [showCoverage, setShowCoverage] = useState(false);
  const lang = s.language;
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const text = (value: LocalizedText) => value[lang];
  const body = planetById(s.selected);
  const active = explorationModes.includes(s.mode) && !s.webglError;
  const location = destinations.find((entry) => entry.id === s.destinationId);
  const city = getEarthCity(s.explorationCityId ?? "");
  const directory = destinations.filter(
    (entry) =>
      entry.bodyId === s.selected &&
      (!s.explorationCityId || entry.cityId === s.explorationCityId),
  );
  const matches = searchEarthCities(query, {
    countryId: country || undefined,
    tag: tag || undefined,
  });
  const stats = earthDirectoryStats();
  const story = stories.find((entry) => entry.id === s.activeStoryId);
  useEffect(() => {
    setQuery("");
    setCountry("");
    setTag("");
    setLimit(30);
    setShowCoverage(false);
  }, [s.selected]);
  useEffect(() => {
    setLimit(30);
  }, [query, country, tag]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(
      () =>
        panel.current
          ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
          ?.focus(),
      0,
    );
    return () => clearTimeout(timer);
  }, [active, s.mode, s.activeStoryId, s.explorationCityId]);
  if (!active || !body) return null;
  const button = (
    id: string,
    label: string,
    action: () => void,
    disabled = false,
  ) => (
    <button
      key={id}
      data-gesture-id={id}
      data-gesture-label={label}
      onClick={action}
      disabled={disabled}
    >
      {label}
    </button>
  );
  const back = () => {
    interaction.return();
  };
  const listing = (
    <div className="destination-list">
      {directory.map((entry) => (
        <div className="destination-row" key={entry.id}>
          <div>
            <small>{text(kinds[entry.kind])}</small>
            <h3>{text(entry.name)}</h3>
            <p>{text(entry.summary)}</p>
          </div>
          {entry.status === "ready" ? (
            button(`enter-${entry.id}`, t("进入探索 →", "Explore →"), () => {
              void interaction.enterDestination(entry.id);
            })
          ) : (
            <span className="pending-content">
              {t("图文待编审 · 暂未开放", "Content pending review · not open")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
  return (
    <section
      ref={panel}
      className={`exploration-panel ${s.mode === "LOCATION_VIEW" ? "location-view" : "directory-view"} ${s.mode === "LOCATION_TRANSITION" ? "approaching" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("地点探索", "Destination exploration")}
      onKeyDown={(event) => {
        if (new URLSearchParams(window.location.search).get("tv") === "1")
          return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) back();
        } else if (event.key === "Tab") {
          const items = Array.from(
            panel.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input, select, a[href], summary",
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
      <header className="exploration-toolbar">
        <button
          title={t("返回上一层", "Go back")}
          aria-label={t("返回上一层", "Go back")}
          data-gesture-id="exploration-back"
          data-gesture-label={t("返回", "Back")}
          onClick={back}
        >
          ←
        </button>
        <span className="exploration-heading">
          <span>
            {t(body.chineseName, body.name)} <span aria-hidden="true">/</span>{" "}
            {location ? text(location.name) : t("经典区域", "Destinations")}
          </span>
          <small className="public-beta">
            {t("公开测试版", "Public beta")}
          </small>
        </span>
        <button
          onClick={() => store.set({ language: lang === "zh" ? "en" : "zh" })}
          data-gesture-id="exploration-language"
          data-gesture-label={lang === "zh" ? "English" : "中文"}
        >
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </header>
      <div className="exploration-scroll">
        {s.explorationError && (
          <p className="exploration-error" role="alert">
            {s.explorationError}
          </p>
        )}
        {s.mode === "LOCATION_TRANSITION" && location ? (
          <div className={`approach-stage ${location.approach}`}>
            <p className="eyebrow">
              {s.locationResourcesReady
                ? t("正在接近", "Approaching")
                : t("正在准备本地资源", "Preparing local resources")}
            </p>
            <h2>{text(location.name)}</h2>
            <p>
              {location.approach === "observation"
                ? t(
                    "进入观察视角，不进行地表着陆。",
                    "Approaching an observation view, not landing on a surface.",
                  )
                : t(
                    "视觉接近转场，非真实地表漫游。",
                    "A visual approach, not a continuous surface reconstruction.",
                  )}
            </p>
            <div className="approach-progress" aria-hidden="true">
              <i />
            </div>
            <div className="exploration-actions">
              {button(
                "skip-approach",
                t("跳过转场", "Skip approach"),
                () => {
                  interaction.skipLocationTransition();
                },
                !s.locationResourcesReady,
              )}
              {button(
                "cancel-approach",
                t("取消并返回", "Cancel and return"),
                back,
              )}
            </div>
          </div>
        ) : s.mode === "LOCATION_VIEW" && location ? (
          <>
            <div className="location-columns">
              <div className="location-media">
                {location.assetIds.map((id) => {
                  const asset = assets.find((entry) => entry.id === id);
                  return (
                    asset && (
                      <AssetFigure
                        key={asset.id}
                        asset={asset}
                        language={lang}
                      />
                    )
                  );
                })}
              </div>
              <article className="location-copy">
                <p className="eyebrow">{text(kinds[location.kind])}</p>
                <h2>{text(location.name)}</h2>
                <p className="location-lead">{text(location.summary)}</p>
                <p className="position-note">
                  {text(location.locationDescription)}
                  {location.position && !location.position.exact && (
                    <span>
                      {" "}
                      ·{" "}
                      {t(
                        "坐标仅作区域定位示意",
                        "Approximate regional location",
                      )}
                    </span>
                  )}
                </p>
                <p className="review-note">
                  {t(
                    "已核对来源与图片许可；人工复核待完成。",
                    "Sources and image rights checked; human review pending.",
                  )}
                </p>
                {story ? (
                  <section className="story-article">
                    <p className="eyebrow">{story.date}</p>
                    <h3>{text(story.title)}</h3>
                    <p>{text(story.body)}</p>
                    <p className="relation-note">
                      {story.links
                        .filter((link) => link.destinationId === location.id)
                        .map((link) => text(link.description))
                        .join(" ")}
                    </p>
                    <SourceList ids={story.sourceIds} />
                    {button("close-story", t("收起故事", "Close story"), () => {
                      interaction.openStory(null);
                    })}
                  </section>
                ) : (
                  <section className="story-index">
                    <h3>{t("探索与故事", "Exploration and stories")}</h3>
                    {location.storyIds.map((id) => {
                      const item = stories.find((entry) => entry.id === id);
                      return (
                        item && (
                          <button
                            key={id}
                            className="story-row"
                            data-gesture-id={`story-${id}`}
                            data-gesture-label={text(item.title)}
                            onClick={() => interaction.openStory(id)}
                          >
                            <small>{item.date}</small>
                            <strong>{text(item.title)}</strong>
                            <span>{text(item.summary)}</span>
                          </button>
                        )
                      );
                    })}
                  </section>
                )}
                <details>
                  <summary>
                    {t(
                      "详细资料、来源与素材署名",
                      "Details, sources and image credits",
                    )}
                  </summary>
                  <SourceList ids={location.sourceIds} />
                  {location.assetIds.map((id) => {
                    const asset = assets.find((entry) => entry.id === id)!;
                    return (
                      <div className="asset-credits" key={id}>
                        <strong>{asset.credit}</strong>
                        <p>{text(asset.location)}</p>
                        <p>{text(asset.processing)}</p>
                        <a
                          href={asset.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("原始素材页面", "Original file record")} ↗
                        </a>
                        <a
                          href={asset.rightsUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {asset.license} ↗
                        </a>
                      </div>
                    );
                  })}
                </details>
              </article>
            </div>
          </>
        ) : (
          <>
            <div className="directory-heading">
              <p className="eyebrow">
                {t("星球 · 地点 · 故事", "PLANET · PLACE · STORY")}
              </p>
              <h2>{city ? text(city.name) : t(body.chineseName, body.name)}</h2>
              <p>
                {t(
                  "目录收录与图文开放分别计数。",
                  "Directory entries and available content are counted separately.",
                )}
              </p>
            </div>
            {s.selected === "earth" && !city && (
              <>
                <label className="directory-search">
                  {t("搜索城市或国家", "Search cities or countries")}
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t(
                      "北京 / 纽约 / Paris",
                      "Beijing / New York / Paris",
                    )}
                  />
                </label>
                <div className="directory-filters">
                  <label>
                    {t("国家与地区", "Country / territory")}
                    <select
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                    >
                      <option value="">
                        {t("全部来源条目", "All source entries")}
                      </option>
                      {countries.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {text(entry.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("城市标签", "City category")}
                    <select
                      value={tag}
                      onChange={(event) =>
                        setTag(event.target.value as CityTag | "")
                      }
                    >
                      <option value="">{t("全部", "All")}</option>
                      <option value="capital">
                        {t("来源列示首都", "Source-listed capitals")}
                      </option>
                      <option value="featured">
                        {t("精选名城", "Selected cities")}
                      </option>
                    </select>
                  </label>
                </div>
                <p className="directory-count">
                  {matches.length} {t("条城市记录", "city records")} ·{" "}
                  {stats.countryEntries}{" "}
                  {t("国家／地区来源条目", "source country/territory entries")}
                </p>
                <div className="city-list">
                  {matches.slice(0, limit).map((entry) => (
                    <button
                      key={entry.id}
                      className="city-row"
                      data-gesture-id={`city-${entry.id}`}
                      data-gesture-label={text(entry.name)}
                      onClick={() => store.set({ explorationCityId: entry.id })}
                    >
                      <span>
                        <strong>{text(entry.name)}</strong>
                        <small>
                          {entry.countryIds
                            .map(
                              (id) =>
                                countries.find((item) => item.id === id)?.name[
                                  lang
                                ],
                            )
                            .join(" · ")}
                        </small>
                      </span>
                      <span>
                        {entry.tags.includes("capital") && (
                          <small>{t("来源首都", "Listed capital")}</small>
                        )}
                        {entry.tags.includes("featured") && (
                          <small>{t("精选名城", "Selected city")}</small>
                        )}
                        <small>
                          {destinations.some(
                            (item) =>
                              item.cityId === entry.id &&
                              item.status === "ready",
                          )
                            ? t("图文可读", "Content available")
                            : t("图文待编审", "Content pending")}
                        </small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
                {!matches.length && (
                  <p role="status">
                    {t(
                      "没有匹配记录，可换名称或筛选条件。",
                      "No matching records. Try another name or filter.",
                    )}
                  </p>
                )}
                {limit < matches.length &&
                  button("more-cities", t("显示更多", "Show more"), () =>
                    setLimit(limit + 30),
                  )}
              </>
            )}
            {city ? (
              <>
                <p>{city.notes}</p>
                {city.coordinates && (
                  <p className="position-note">
                    {city.coordinates.latitude}°, {city.coordinates.longitude}°
                    · WGS84
                  </p>
                )}
                {!directory.length && (
                  <p className="pending-content">
                    {t(
                      "城市目录已收录；地点故事和图片待核验，暂无可进入内容。",
                      "Listed in the city directory; stories and images await review. No destination is open yet.",
                    )}
                  </p>
                )}
                {listing}
              </>
            ) : (
              s.selected !== "earth" && listing
            )}
            <details
              className="coverage-details"
              open={showCoverage}
              onToggle={(event) => setShowCoverage(event.currentTarget.open)}
            >
              <summary>
                {t("目录范围与内容进度", "Directory scope and content status")}
              </summary>
              <p>
                {lang === "zh"
                  ? earthDirectory.baseline.scope
                  : earthDirectory.baseline.scopeEn}
              </p>
              <p>
                {earthDirectory.version} · {stats.capitalRelations}{" "}
                {t(
                  "条来源首都关系；角色及生效日期待逐条核验。",
                  "source-listed capital relationships; roles and effective dates require record-by-record review.",
                )}
              </p>
              {s.selected === "earth" && (
                <div className="database-license">
                  <p>{earthDirectory.databaseLicense.attribution}</p>
                  <div className="database-license-links">
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
                      {t("原始数据库许可", "Source database license")} ↗
                    </a>
                    <a
                      href={earthDirectory.databaseLicense.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      download="earth-directory-source.json"
                    >
                      {t("下载完整目录 JSON", "Download complete directory JSON")} ↗
                    </a>
                  </div>
                </div>
              )}
              <p>
                {t(
                  "完整目标仍覆盖所有行星区域、各国首都及选录名城；当前开放批次不是最终范围。",
                  "The full target remains all planetary regions, national capitals and selected world cities. This available batch is not the final scope.",
                )}
              </p>
              <p>
                {contentPack.version} ·{" "}
                {contentPack.totalBytes.toLocaleString()} bytes ·{" "}
                {t(
                  "三张随构建分发的图片；浏览器离线冷启动包尚未缓存／验证。",
                  "Three bundled images; browser offline cold-start cache is not implemented or verified.",
                )}
              </p>
              <ul>
                {planets.map((planet) => (
                  <li key={planet.id}>
                    {t(planet.chineseName, planet.name)}:{" "}
                    {
                      destinations.filter(
                        (item) =>
                          item.bodyId === planet.id && item.status === "ready",
                      ).length
                    }{" "}
                    /{" "}
                    {
                      destinations.filter((item) => item.bodyId === planet.id)
                        .length
                    }{" "}
                    {t("图文开放／目录条目", "open / listed")}
                  </li>
                ))}
              </ul>
              {earthDirectory.sources.map((source) => (
                <p key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title} ↗
                  </a>
                  <small>
                    {source.revision} · {source.license}
                  </small>
                </p>
              ))}
            </details>
          </>
        )}
      </div>
    </section>
  );
}
