import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "../gesture/gestureFeedback";

/** Show action progress before release reminders, especially for two-hand play. */
export function HandFeedback() {
  const s = useSolaris();
  const f = useGestureFeedback();
  if (s.tracking !== "online" && s.tracking !== "seeking") return null;
  const percent = Math.round(Math.max(0, Math.min(1, f.specialProgress)) * 100);
  const special =
    f.action === "COLLAPSE" ||
    f.action === "REBIRTH" ||
    f.specialStage !== "IDLE";
  const zooming = f.action === "ONE_HAND_ZOOM" || f.zoomActive;
  const zoomPercent = Math.round(
    Math.max(0, Math.min(1, f.zoomActive ? f.zoomAperture : f.zoomProgress)) *
      100,
  );
  const progressVisible =
    special && !zooming && percent > 0 && !f.locked && !s.transitioning;
  const label = (() => {
    if (f.presence === "NO_HAND" || f.handCount === 0)
      return "请让整只手留在镜头内";
    if (f.readiness === "RECONNECTING") return "正在稳定追踪";
    if (f.locked || s.transitioning) {
      if (s.mode === "COLLAPSE") return "正在坍缩 · 能量汇入中心";
      if (s.mode === "BIG_BANG") return "宇宙正在重生";
      return "正在穿行";
    }
    if (s.gesture === "FIVE_PINCH" && f.needsRelease && !f.zoomActive)
      return "先张开五指，再聚拢";
    if (f.zoomActive)
      return `${s.selected ? "星球缩放" : "开合缩放"} · ${f.zoomScale.toFixed(2)}×`;
    if (f.action === "ONE_HAND_ZOOM") return `逐渐张开 · 启动 ${zoomPercent}%`;
    if (f.action === "FIST_BACK") return "握住 · 返回";
    if (f.action === "PINCH_DRAG") return "已抓住 · 拖动旋转";
    if (s.mode === "COLLAPSE")
      return f.handCount >= 2
        ? "双掌向两侧拉开 · 宇宙重生"
        : "再抬起另一只手，准备重生";
    if (f.specialStage === "PAUSED")
      return f.handCount < 2
        ? "请让另一只手也留在画面内"
        : "双掌保持张开 · 继续合拢";
    if (f.specialStage === "HOLD") return `保持片刻 · ${percent}%`;
    if (f.specialStage === "APPROACH") return `缓慢合拢 · ${percent}%`;
    if (f.specialStage === "READY") return "双掌张开 · 向中心靠近";
    if (f.action === "COLLAPSE") return `双掌合拢 · ${percent}%`;
    if (f.action === "REBIRTH") return "双掌拉开 · 重生";
    if (f.needsRelease) return "松开后再捏合";
    if (f.pinchPhase === "PINCH_START") return "捏合确认";
    if (f.presence === "GESTURE_TRIGGERED") return "已确认";
    if (f.cooldownMs > 0) return "松开手指，继续探索";
    if (f.target) return `已指向 · ${f.target.label}`;
    if (f.handCount >= 2 && s.mode === "SOLAR_SYSTEM")
      return "双掌张开，再向中心合拢";
    return "手已就绪";
  })();
  return (
    <div
      className="hand-feedback"
      data-state={f.presence}
      data-action={f.action}
      data-special-stage={f.specialStage}
      data-zoom-active={f.zoomActive}
      role="status"
      aria-live="polite"
    >
      <div className="hand-feedback-line">
        <i aria-hidden="true" />
        <span>{label}</span>
      </div>
      <small>
        {f.handCount > 0 ? `已识别 ${f.handCount} 只手` : "尚未识别到手"}
        {zooming && " · 张开变大，聚拢变小"}
      </small>
      {zooming && !f.locked && !s.transitioning && (
        <div
          className="hand-special-progress hand-zoom-progress"
          role={f.zoomActive ? "meter" : "progressbar"}
          aria-label={f.zoomActive ? "五指张开程度" : "五指缩放启动进度"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={zoomPercent}
        >
          <i style={{ transform: `scaleX(${zoomPercent / 100})` }} />
        </div>
      )}
      {progressVisible && (
        <div
          className="hand-special-progress"
          role="progressbar"
          aria-label={
            s.mode === "COLLAPSE" ? "双掌展开重生进度" : "双掌坍缩确认进度"
          }
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <i style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
      )}
    </div>
  );
}
