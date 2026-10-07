import { useSolaris } from "../interaction/store";
import { HandIcon } from "./Icons";
const englishHints: Record<string, string> = {
  镜头正在穿行: "Camera in motion",
  片刻后继续探索: "Continue shortly",
  四周粒子环绕: "Surrounded by particles",
  沉浸太阳内部: "Inside the Sun",
  握拳保持: "Hold a fist",
  "点按 SOLARIS": "Tap SOLARIS",
  返回太阳系: "Back to solar system",
  双掌向两侧拉开: "Spread both palms",
  点按重生: "Tap Rebirth",
  空格键: "Space",
  宇宙重生: "Recreate the universe",
  "✌ 旋转手腕": "Twist two fingers",
  "右拧放大 · 左拧缩小": "Right: zoom in · Left: zoom out",
  左右拨动: "Swipe sideways",
  快速横滑: "Swipe sideways",
  切换星球: "Switch planets",
  "指向 · 张开拇指": "Point · Extend thumb",
  点按天体: "Tap a body",
  点击天体: "Click a body",
  进入探索: "Explore",
  "捏住空白 · 拖": "Pinch empty space · Drag",
  单指拖动: "Drag with one finger",
  拖动空白: "Drag empty space",
  旋转视角: "Rotate view",
};
export function GestureHint() {
  const { mode, tracking, selected, transitioning, language } = useSolaris();
  const labelText = (value: string) =>
    language === "zh" ? value : (englishHints[value] ?? value);
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
              ...(hand ? [["✌ 旋转手腕", "右拧放大 · 左拧缩小"]] : []),
              [hand ? "左右拨动" : touch ? "快速横滑" : "←  →", "切换星球"],
              [
                hand ? "握拳保持" : touch ? "点按 SOLARIS" : "ESC",
                "返回太阳系",
              ],
            ]
          : [
              [
                hand ? "指向 · 张开拇指" : touch ? "点按天体" : "点击天体",
                "进入探索",
              ],
              [
                hand ? "捏住空白 · 拖" : touch ? "单指拖动" : "拖动空白",
                "旋转视角",
              ],
              ...(hand ? [["✌ 旋转手腕", "右拧放大 · 左拧缩小"]] : []),
            ];
  return (
    <div className="gesture-hints">
      <HandIcon size={26} />
      {hints.map(([action, label]) => (
        <div key={action}>
          <span>{labelText(action)}</span>
          <small>{labelText(label)}</small>
        </div>
      ))}
    </div>
  );
}
