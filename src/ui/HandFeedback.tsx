import { useEffect, useRef } from "react";
import { planetById } from "../data/planets";
import { useSolaris, type UIState } from "../interaction/store";
import { particles } from "../particles/ParticleEngine";
import { gestureLabels } from "./chinese";

function instruction(s: UIState, target: string | undefined) {
  if (s.mode === "INTRO") return "宇宙正在凝聚，完成后即可用手势探索。";
  if (s.mode === "PLANET_TRANSITION") return "正在靠近星球，请稍候。";
  if (s.mode === "BIG_BANG") return "宇宙正在重生，动画结束后可继续操作。";
  if (s.mode === "COLLAPSE")
    return "张开双手五指，快速向两侧拉开，进入太阳内部；比出 ✌ 返回太阳系。";
  if (s.mode === "SUN_INTERIOR") {
    if (s.gesture === "V_SIGN") return "保持 ✌ 片刻，返回太阳系。";
    if (s.gesture === "TWO_HAND_COLLAPSE")
      return "双手向中心合拢，让星系再次坍缩。";
    return "四周金色粒子环绕。比出 ✌ 返回太阳系，或双手合拢再次坍缩。";
  }
  if (s.gesture === "NONE")
    return "让整只手留在镜头内，伸出食指，把光标移到星球上。";
  if (s.confidence < 0.5) return "姿势还不够清晰，请让整只手留在镜头内。";
  switch (s.gesture) {
    case "FIST":
      return "伸出食指瞄准星球，再将拇指与食指捏合。";
    case "POINT":
      return target
        ? `已指向${target}，拇指与食指捏合即可进入。`
        : "只伸出食指，将指尖光标移到星球上。";
    case "PINCH":
      return target
        ? `保持捏合片刻，进入${target}。`
        : "还未指向星球。先伸出食指瞄准，再捏合。";
    case "OPEN_PALM":
      return "移动手掌拨动星尘；双手合拢可坍缩，双手快速张掌拉开可进入太阳。";
    case "THREE":
      return s.selected
        ? `保持三指片刻，${s.mode === "INFO" ? "收起" : "查看"}星球资料。`
        : "先指向并捏合进入星球，再伸出三指查看资料。";
    case "V_SIGN":
      return s.selected
        ? "保持 ✌ 片刻，返回太阳系。"
        : "你已在太阳系。先指向星球，再捏合进入。";
    case "TWO_HAND_SCALE":
      return "双手各自保持拇食指捏合，拉开变大、靠近变小；松开结束缩放。";
    case "TWO_HAND_COLLAPSE":
      return "双手向中心合拢，让星系坍缩；随后快速张掌拉开，进入太阳内部。";
    case "TWO_HAND_EXPAND":
      return "双手快速张掌拉开，穿入太阳，被金色粒子环绕。";
    default:
      return s.selected
        ? "左右滑动切换星球，三指查看资料，✌ 返回太阳系。"
        : "先用食指指向星球，再捏合进入。";
  }
}

/** The cursor shares the exact screen coordinates used for planet picking. */
export function HandFeedback() {
  const s = useSolaris();
  const cursor = useRef<HTMLDivElement>(null);
  const online = s.tracking === "online";
  const target =
    s.mode === "SUN_INTERIOR" ? undefined : planetById(s.hover)?.chineseName;
  const pointing =
    s.mode !== "SUN_INTERIOR" &&
    (s.gesture === "POINT" || s.gesture === "PINCH");
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
