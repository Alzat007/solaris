import { useSolaris } from "../interaction/store";
import { useGestureFeedback } from "../gesture/gestureFeedback";

/** One quiet line answers whether the hand is visible and an action is ready. */
export function HandFeedback() {
  const s = useSolaris();
  const f = useGestureFeedback();
  if (s.tracking !== "online") return null;
  const label =
    f.presence === "NO_HAND"
      ? "请让手留在镜头内"
      : f.readiness === "RECONNECTING"
        ? "正在稳定追踪"
        : f.locked || s.transitioning
          ? "正在穿行"
          : f.needsRelease
            ? "松开后再捏合"
            : f.action === "FIST_BACK"
              ? "握住 · 返回"
              : f.action === "PINCH_DRAG"
                ? "已抓住 · 拖动旋转"
                : f.action === "TWO_HAND_ZOOM"
                  ? "双手捏住 · 缩放"
                  : f.action === "COLLAPSE"
                    ? "双掌合拢 · 凝聚能量"
                    : f.action === "REBIRTH"
                      ? "双掌拉开 · 重生"
                      : f.pinchPhase === "PINCH_START"
                        ? "捏合确认"
                        : f.presence === "GESTURE_TRIGGERED"
                          ? "已确认"
                          : f.cooldownMs > 0
                            ? "松开手指，继续探索"
                            : f.target
                              ? `已指向 · ${f.target.label}`
                              : "手已就绪";
  return (
    <div
      className="hand-feedback"
      data-state={f.presence}
      role="status"
      aria-live="polite"
    >
      <i aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
