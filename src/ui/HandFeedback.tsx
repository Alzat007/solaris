import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "../gesture/gestureFeedback";
import { gestureLabels } from "./chinese";

/** Show action progress before release reminders, especially for two-hand play. */
export function HandFeedback() {
  const s = useSolaris();
  const f = useGestureFeedback();
  if (s.tracking !== "online" && s.tracking !== "seeking") return null;
  const pose =
    f.handCount > 0 ? gestureLabels[s.gesture] || "姿势未确定" : "姿势未确定";
  const percent = Math.round(Math.max(0, Math.min(1, f.specialProgress)) * 100);
  const special =
    f.action === "COLLAPSE" ||
    f.action === "REBIRTH" ||
    f.specialStage !== "IDLE";
  const zooming = f.zoomMode !== "IDLE" && f.zoomMode !== "ZOOM_DIAL_RELEASE";
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
    if (f.zoomActive || f.zoomMode === "ZOOM_DIAL_ARMED") {
      const direction =
        f.zoomDirection === "IN"
          ? "向右放大"
          : f.zoomDirection === "OUT"
            ? "向左缩小"
            : "旋转缩放";
      return `${direction} · ${Math.round(f.zoomScale * 100)}%`;
    }
    if (f.zoomMode === "V_DETECTED") return "保持 ✌ · 准备旋转";
    if (f.zoomMode === "ZOOM_DIAL_RELEASE") return "缩放已停止";
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
    if (f.indexNeedsRelease || f.indexPhase === "WAIT_RELEASE")
      return "伸直食指，准备下一次选择";
    if (f.indexPhase === "INDEX_TRIGGERED") return "已确认";
    if (f.indexPhase === "INDEX_PRESSING") return "食指弯到底 · 正在确认";
    if (f.indexPhase === "TARGET_LOCKED")
      return `${f.lockedTarget?.label || "已就绪"} · 食指弯到底${f.lockedTarget?.kind === "body" ? "进入" : "确认"}`;
    if (f.indexPhase === "TARGET_LOCKING")
      return `${f.hoverTarget?.label || "已指向"} · 保持片刻`;
    if (f.needsRelease) return "松开手指，再抓住空白拖动";
    if (f.pinchPhase === "PINCH_START") return "捏住空白 · 准备拖动";
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
        <span
          className="recognized-pose"
          data-gesture={f.handCount > 0 ? s.gesture : "NONE"}
          aria-label={`当前识别姿势：${pose}`}
        >
          {` · ${pose}`}
        </span>
      </small>
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
