import { useSolaris } from "../interaction/store";
import { HandIcon } from "./Icons";
export function GestureHint() {
  const { mode, tracking, selected } = useSolaris();
  const hand = tracking === "online";
  const touch = !hand && window.matchMedia("(pointer: coarse)").matches;
  const hints =
    mode === "SUN_INTERIOR"
      ? [
          ["四周粒子环绕", "沉浸太阳内部"],
          [hand ? "比出 ✌" : touch ? "点按返回" : "ESC", "返回太阳系"],
        ]
      : mode === "COLLAPSE"
        ? [
            [
              hand ? "双手快速张掌拉开" : touch ? "点按进入太阳" : "空格键 / S",
              "进入太阳内部",
            ],
          ]
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
                [hand ? "左右滑动" : "←  →", "切换星球"],
                [hand ? "三指 / ✌" : "I / ESC", "资料 / 返回"],
              ]
            : [
                [hand ? "指向并捏合" : "点击星球", "探索星球"],
                [hand ? "双手合拢" : "空格键", "引力坍缩"],
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
