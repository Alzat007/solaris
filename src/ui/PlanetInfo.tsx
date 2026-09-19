import { planetById } from "../data/planets";
import { useSolaris } from "../interaction/store";
export function PlanetInfo() {
  const { selected, mode } = useSolaris();
  const p = planetById(selected);
  if (!p || mode !== "INFO") return null;
  return (
    <section className="planet-info" aria-label={`${p.chineseName}资料`}>
      <div className="info-line" />
      <p className="eyebrow">星球档案 / {p.chineseName}</p>
      <h2>{p.chineseName}</h2>
      <dl>
        {[
          ["直径", p.diameter],
          ["距太阳距离", p.distanceFromSun],
          ["公转周期", p.orbitalPeriod],
          ["卫星数量", p.moons],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <span className="info-footnote">画面比例经过艺术化处理</span>
    </section>
  );
}
