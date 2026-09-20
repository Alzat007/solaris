import { useState } from "react";
import { handTracking } from "../gesture/HandTrackingManager";
import { useCameraDiagnostics } from "../gesture/cameraDiagnostics";
import { useSolaris } from "../interaction/store";
import { HandIcon } from "./Icons";

/** Distinguish an available preview from a model that is detecting hands. */
export function CameraStatus() {
  const { tracking } = useSolaris();
  const d = useCameraDiagnostics();
  const [switchError, setSwitchError] = useState("");
  if (
    !["loading", "seeking", "online"].includes(tracking) ||
    d.stage === "idle" ||
    d.stage === "failed" ||
    (d.stage === "running" && d.validHands > 0 && !d.frozen)
  )
    return null;

  const switching = d.stage === "switching";
  const starting = d.stage === "camera" || d.stage === "model";
  const incomplete = d.rawHands > 0 && d.validHands === 0;
  const waiting = d.emptyForMs >= 5000;
  const attention = !starting && (d.frozen || incomplete || waiting);
  const title = switching
    ? "正在切换兼容识别"
    : d.stage === "camera"
      ? "正在连接摄像头"
      : d.stage === "model"
        ? "画面已连接，正在加载手势模型"
        : d.frozen
          ? "摄像头画面停止更新"
          : incomplete
            ? "已找到手，关键点不完整"
            : waiting
              ? "画面已连接，尚未检测到手"
              : "请张开手掌，让整只手入镜";
  const detail = switching
    ? "正在重新启动手势识别，请稍候。"
    : d.stage === "camera"
      ? "请在浏览器提示中允许使用摄像头。"
      : d.stage === "model"
        ? "首次加载可能稍慢，出现手部骨架后即可操作。"
        : d.frozen
          ? "请先关闭再重新开启摄像头。"
          : "张开手掌，手不要贴镜头太近，并避免背光。";
  return (
    <section
      className="camera-status"
      data-stage={d.stage}
      data-attention={attention}
      aria-label="摄像头与识别状态"
      role="status"
      aria-live="polite"
    >
      <HandIcon size={21} />
      <div>
        <p className="camera-status-title">{title}</p>
        <p className="camera-status-detail">{detail}</p>
        {d.compatibility && !switching && (
          <small className="camera-status-mode">兼容识别已启用</small>
        )}
        {(switching || (attention && !d.frozen && !d.compatibility)) && (
          <button
            className="camera-compatibility-button"
            disabled={switching}
            onClick={() => {
              setSwitchError("");
              void handTracking
                .useCompatibilityMode()
                .catch(() =>
                  setSwitchError("切换未完成，请关闭摄像头后重新连接。"),
                );
            }}
          >
            {switching ? "切换中…" : "切换兼容识别"}
          </button>
        )}
        {switchError && <p className="camera-status-detail">{switchError}</p>}
      </div>
    </section>
  );
}
