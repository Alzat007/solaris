import { useEffect, useRef } from "react";
import { planetById } from "../data/planets";
import { useSolaris, type UIState } from "../interaction/store";
import { particles } from "../particles/ParticleEngine";
import { gestureLabels } from "./chinese";

function instruction(s: UIState, target: string | undefined) {
  if (s.mode === "INTRO") return "宇宙正在凝聚，完成后即可用手势探索。";
  if (s.mode === "PLANET_TRANSITION") return "正在靠近星球，请稍候。";
  if (s.mode === "BIG_BANG") return "宇宙正在重生，动画结束后可继续操作。";
  if (s.mode === "COLLAPSE") return "张开手掌并保持片刻，释放宇宙。";
  if (s.gesture === "NONE") return "让整只手留在镜头内，先握紧拳头试试。";
  if (s.confidence < 0.5) return "姿势还不够清晰，请让整只手留在镜头内。";
  switch (s.gesture) {
    case "FIST":
      return "保持握拳约 0.3 秒，让宇宙坍缩。";
    case "POINT":
      return target
        ? `已指向${target}，拇指与食指捏合即可进入。`
        : "只伸出食指，将指尖光标移到星球上。";
    case "PINCH":
      return target
        ? `保持捏合片刻，进入${target}。`
        : "还未指向星球。先伸出食指瞄准，再捏合。";
    case "OPEN_PALM":
      return s.selected
        ? "手掌保持张开并停稳，返回太阳系。"
        : "移动手掌拨动星尘；握拳可让宇宙坍缩。";
    case "V_SIGN":
      return s.selected
        ? `保持剪刀手约 0.3 秒，${s.mode === "INFO" ? "收起" : "查看"}星球资料。`
        : "先指向并捏合进入星球，再用剪刀手查看资料。";
    case "TWO_HAND_SCALE":
      return "双手拉开或靠近，调整宇宙大小。";
    default:
      return s.selected
        ? "左右挥手切换星球，张掌停稳返回太阳系。"
        : "先用食指指向星球，再捏合进入。";
  }
}

/** The cursor shares the exact screen coordinates used for planet picking. */
export function HandFeedback() {
  const s = useSolaris();
  const cursor = useRef<HTMLDivElement>(null);
  const online = s.tracking === "online";
  const target = planetById(s.hover)?.chineseName;
  const pointing = s.gesture === "POINT" || s.gesture === "PINCH";
  const recognized = s.gesture !== "NONE";

  useEffect(() => {
    const element = cursor.current;
    const parent = element?.parentElement;
    if (!online || !element || !parent) return;
    let width = parent.clientWidth;
    let height = parent.clientHeight;
    const resize = new ResizeObserver(() => {
      width = parent.clientWidth;
      height = parent.clientHeight;
    });
    resize.observe(parent);
    let frame = 0;
    const update = () => {
      const x = (particles.handNDC.x + 1) * 0.5 * width;
      const y = (1 - particles.handNDC.y) * 0.5 * height;
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = requestAnimationFrame(update);
    };
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [online]);

  if (!online) return null;
  return (
    <>
      <div
        ref={cursor}
        className={`hand-cursor${pointing ? " is-pointing" : ""}${target && pointing ? " has-target" : ""}${s.gesture === "PINCH" ? " is-pinching" : ""}`}
        aria-hidden="true"
      >
        <i />
        <span>{pointing ? "指尖" : "掌心"}</span>
      </div>
      <section className="hand-feedback" aria-label="实时手势反馈">
        <div className="hand-feedback-heading">
          <span className="hand-feedback-label">实时手势</span>
          <span className="hand-confidence">
            识别置信度{" "}
            {recognized
              ? `${Math.round(Math.max(0, Math.min(1, s.confidence)) * 100)}%`
              : "—"}
          </span>
        </div>
        <strong>
          {recognized
            ? gestureLabels[s.gesture] || "正在识别"
            : "手已检测到 · 姿势不明确"}
        </strong>
        <p>{instruction(s, target)}</p>
        {pointing && (
          <div className={`hand-target${target ? " has-target" : ""}`}>
            <i />
            {target ? `当前目标 · ${target}` : "当前目标 · 未指向星球"}
          </div>
        )}
      </section>
    </>
  );
}
