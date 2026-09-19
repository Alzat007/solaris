import { useSolaris } from "../interaction/store";
import { HandIcon } from "./Icons";
export function GestureHint() {
  const { mode, tracking, selected } = useSolaris();
  const hand = tracking === "online";
  const touch = !hand && window.matchMedia("(pointer: coarse)").matches;
  const hints =
    mode === "COLLAPSE"
      ? [[hand ? "张开手掌" : "空格键", "创造宇宙"]]
      : touch
        ? selected
          ? [
              ["双指缩放", "调整大小"],
              ["点按太阳", "返回太阳系"],
            ]
          : [
              ["点按星球", "探索星球"],
              ["单指拖动", "旋转视角"],
            ]
        : selected
          ? [
              [hand ? "左右挥手" : "←  →", "切换星球"],
              [hand ? "张开手掌" : "ESC", "返回太阳系"],
            ]
          : [
              [hand ? "指向并捏合" : "点击星球", "探索星球"],
              [hand ? "握紧拳头" : "空格键", "引力坍缩"],
            ];
  return (
    <div className="gesture-hints">
      <HandIcon size={26} />
      {hints.map(([action, label]) => (
        <div key={action}>
          <span>{action}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}
