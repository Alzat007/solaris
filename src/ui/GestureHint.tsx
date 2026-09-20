import { useSolaris } from "../interaction/store";
import { HandIcon } from "./Icons";
export function GestureHint() {
  const { mode, tracking, selected, transitioning } = useSolaris();
  const hand = tracking === "online";
  const touch = !hand && window.matchMedia("(pointer: coarse)").matches;
  const hints = transitioning
    ? [["镜头正在穿行", "片刻后继续探索"]]
    : mode === "SUN_INTERIOR"
      ? [
          ["四周粒子环绕", "沉浸太阳内部"],
          [hand ? "握拳保持" : touch ? "点按 SOLARIS" : "ESC", "返回太阳系"],
        ]
      : mode === "COLLAPSE"
        ? [
            [
              hand ? "双掌向两侧拉开" : touch ? "点按重生" : "空格键",
              "宇宙重生",
            ],
          ]
        : selected
          ? [
              [hand ? "左右拨动" : touch ? "快速横滑" : "←  →", "切换星球"],
              [
                hand ? "握拳保持" : touch ? "点按 SOLARIS" : "ESC",
                "返回太阳系",
              ],
            ]
          : [
              [
                hand ? "指向 · 捏合" : touch ? "点按天体" : "点击天体",
                "进入探索",
              ],
              [
                hand ? "捏住空白 · 拖" : touch ? "单指拖动" : "拖动空白",
                "旋转视角",
              ],
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
