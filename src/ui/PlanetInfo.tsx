import { planetById } from "../data/planets";
import { useSolaris } from "../interaction/store";
export function PlanetInfo() {
  const { selected, infoVisible, transitioning } = useSolaris();
  const p = planetById(selected);
  if (!p || !infoVisible || transitioning) return null;
  return (
    <section className="planet-info" aria-label={`${p.chineseName}资料`}>
      <div className="info-line" />
      <p className="eyebrow">星球档案 / {p.chineseName}</p>
      <h2>{p.chineseName}</h2>
      <dl>
        {[
          ["直径", p.diameter],
          [
            p.parentId ? "距地球距离" : "距太阳距离",
            p.distanceFromParent ?? p.distanceFromSun,
          ],
          [p.parentId ? "绕地球周期" : "公转周期", p.orbitalPeriod],
          ["卫星数量", p.moons],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <span className="info-footnote">
        {p.parentId
          ? "画面比例与观察自转为示意；真实月球自转与绕地球公转周期同步"
          : "画面比例经过艺术化处理"}
      </span>
    </section>
  );
}
