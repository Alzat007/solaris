import { useEffect, useState } from "react";
import { useSolaris, store } from "../interaction/store";
import { planets, planetById } from "../data/planets";
import { interaction } from "../interaction/InteractionController";
import { handTracking } from "../gesture/HandTrackingManager";
import { audio } from "../audio/AudioManager";
import { HandIcon, OrbitIcon, SoundIcon } from "./Icons";
import { GestureHint } from "./GestureHint";
import { PlanetInfo } from "./PlanetInfo";
import { gestureLabels } from "./chinese";
import { HandFeedback } from "./HandFeedback";
export function HUD() {
  const s = useSolaris();
  const insideSun = s.mode === "SUN_INTERIOR";
  const p = insideSun ? undefined : planetById(s.selected);
  const [soundError, setSoundError] = useState("");
  const cameraActive = ["loading", "seeking", "online"].includes(s.tracking);
  const busy =
    s.mode === "INTRO" ||
    s.mode === "BIG_BANG" ||
    s.mode === "PLANET_TRANSITION";
  const number = p ? String(planets.indexOf(p) + 2).padStart(2, "0") : "01";
  const cameraLabel =
    s.tracking === "online"
      ? "手势追踪 · 已连接"
      : s.tracking === "seeking"
        ? "请抬起手掌"
        : s.tracking === "loading"
          ? "正在连接摄像头"
          : s.tracking === "unavailable"
            ? "鼠标模式"
            : "鼠标模式";
  const startMouse = () => store.set({ welcome: false });
  useEffect(() => {
    const click = (e: PointerEvent) => {
      if (e.target instanceof HTMLCanvasElement && s.mode !== "INTRO")
        startMouse();
    };
    window.addEventListener("pointerdown", click);
    return () => window.removeEventListener("pointerdown", click);
  }, [s.mode]);
  return (
    <div
      className={`hud ${s.mode === "INTRO" ? "intro-hud" : ""}${s.tracking === "online" ? " hand-active" : ""}${insideSun ? " sun-interior-hud" : ""}`}
    >
      <header className="topbar">
        <button
          className="wordmark"
          aria-label="返回太阳系"
          onClick={() => {
            interaction.return();
            store.set({ welcome: false });
          }}
        >
          <OrbitIcon />
          <span>SOLARIS</span>
        </button>
        <span className="top-note">向无垠宇宙，再靠近一点</span>
        <div className="top-actions">
          <button
            className={`tracking-button ${s.tracking === "online" ? "online" : ""}`}
            onClick={() =>
              cameraActive ? handTracking.stop() : void handTracking.start()
            }
            aria-label={cameraActive ? "关闭摄像头" : "开启手势控制"}
          >
            <i className={s.tracking} />
            <span>{cameraLabel}</span>
            {!cameraActive && <HandIcon size={17} />}
          </button>
          <button
            className="sound-button"
            title="开启或关闭声音"
            aria-label={s.sound ? "关闭声音" : "开启声音"}
            aria-pressed={s.sound}
            onClick={() =>
              void audio
                .toggle()
                .then((sound) => store.set({ sound }))
                .catch(() => setSoundError("当前浏览器暂不支持音频播放。"))
            }
          >
            <SoundIcon on={s.sound} />
            <span>声音{s.sound ? "已开启" : "已关闭"}</span>
          </button>
        </div>
      </header>
      <div className="edge-label">
        {insideSun ? "恒星内部" : "太阳系"} <span>✦</span>{" "}
        {insideSun ? "粒子漫游" : "银河系"}
      </div>
      {!s.welcome && s.mode !== "COLLAPSE" && s.mode !== "BIG_BANG" && (
        <section
          className="object-title"
          key={insideSun ? "sun-interior" : s.selected || "sun"}
        >
          <p className="eyebrow">
            {insideSun
              ? "沉浸漫游 / 被光环绕"
              : `${number} / ${p ? "探索行星" : "太阳系的中心"}`}
          </p>
          <h1>{insideSun ? "太阳内部" : p?.chineseName || "太阳"}</h1>
          <p className="object-subtitle">
            {insideSun
              ? "四周皆是星火，每一粒光都在流动。"
              : p?.description || "一颗恒星，八个世界，由你掌控。"}
          </p>
          {insideSun && (
            <button
              className="text-action"
              onClick={() => interaction.return()}
            >
              返回太阳系 <span>✌ / Esc</span>
            </button>
          )}
          {p && (
            <button className="text-action" onClick={() => interaction.info()}>
              {s.mode === "INFO" ? "收起资料" : "查看星球资料"}{" "}
              <span>{s.mode === "INFO" ? "−" : "+"}</span>
            </button>
          )}
        </section>
      )}
      {s.welcome && (
        <section className="welcome">
          <p className="eyebrow">掌中星系</p>
          <h1>
            浩瀚宇宙
            <br />
            <span>尽在掌中</span>
          </h1>
          <p className="welcome-caption">探索 · 触碰 · 坍缩 · 创造</p>
          <button
            className="enter-button"
            disabled={s.mode === "INTRO" || s.tracking === "loading"}
            onClick={() => void handTracking.start()}
          >
            <HandIcon />
            {s.mode === "INTRO" ? "正在凝聚你的宇宙" : "开启手势控制"}
            <span>↗</span>
          </button>
          <button
            className="mouse-link"
            disabled={s.mode === "INTRO"}
            onClick={startMouse}
          >
            也可以用鼠标探索 <span>→</span>
          </button>
          <p className="privacy">摄像头画面仅在本机处理</p>
        </section>
      )}
      {s.tracking === "seeking" && (
        <div className="tracking-prompt">
          <HandIcon size={32} />
          <span>请抬起手掌</span>
          <small>请让整只手掌保持在镜头内</small>
        </div>
      )}
      <HandFeedback />
      {s.tracking === "unavailable" && (
        <div className="camera-notice" role="status">
          <span>手势追踪不可用 · 已开启鼠标模式</span>
          <p>{s.cameraError}</p>
          <button onClick={() => void handTracking.start()}>
            重新连接摄像头 ↗
          </button>
          <button
            aria-label="关闭摄像头提示"
            onClick={() => store.set({ tracking: "off", cameraError: "" })}
          >
            ×
          </button>
        </div>
      )}
      {soundError && (
        <div className="camera-notice" role="status">
          {soundError}
          <button onClick={() => setSoundError("")}>×</button>
        </div>
      )}
      {(s.mode === "COLLAPSE" || s.mode === "BIG_BANG") && (
        <div className="cosmic-event">
          <p className="eyebrow">
            {s.mode === "COLLAPSE"
              ? "每一次终结，都是新的起点"
              : "让光，再次诞生"}
          </p>
          <h2>{s.mode === "COLLAPSE" ? "奇点" : "重生"}</h2>
          {s.mode === "COLLAPSE" && (
            <button onClick={() => interaction.enterSun()}>
              {s.tracking === "online" ? "双手快速张掌拉开" : "进入太阳内部"}{" "}
              <span>
                {s.tracking === "online"
                  ? "穿过奇点，被金色粒子环绕"
                  : "也可以按空格键或 S"}
              </span>
            </button>
          )}
        </div>
      )}
      {s.heldUniverse && <div className="held-universe">宇宙，尽在掌中</div>}
      {!insideSun && <PlanetInfo />}
      <footer>
        <div className="footer-top">
          <div className="location">
            <span className="location-cross">+</span>
            <span>
              {insideSun ? "太阳内部" : s.selected ? "星球聚焦" : "太阳系"}
              <small>
                {insideSun
                  ? "金色星火 · 环绕你我"
                  : s.mode === "COLLAPSE"
                    ? "引力坍缩"
                    : s.mode === "BIG_BANG"
                      ? "宇宙正在重组"
                      : "诞生于约 46 亿年前"}
              </small>
            </span>
          </div>
          <div className="quiet-status">
            {s.tracking === "online"
              ? (gestureLabels[s.gesture] ?? "等待手势")
              : "漫游无垠宇宙"}
          </div>
          <GestureHint />
        </div>
        <nav className="planet-nav" aria-label="选择星球">
          <button
            onClick={() => {
              interaction.return();
              startMouse();
            }}
            className={!s.selected && !insideSun ? "active" : ""}
            disabled={busy || s.mode === "COLLAPSE"}
          >
            <i className="sun-dot" />
            <span>{insideSun ? "返回太阳系" : "太阳"}</span>
          </button>
          {!insideSun &&
            planets.map((planet) => (
              <button
                key={planet.id}
                aria-label={`探索${planet.chineseName}`}
                aria-current={s.selected === planet.id ? "true" : undefined}
                disabled={busy || s.mode === "COLLAPSE"}
                onClick={() => interaction.select(planet.id)}
                className={s.selected === planet.id ? "active" : ""}
              >
                <i
                  style={{
                    background: planet.color,
                    boxShadow:
                      planet.id === "saturn" ? "0 0 0 2px #b2a17a33" : "",
                  }}
                />
                <span>{planet.chineseName}</span>
              </button>
            ))}
          <button
            className={`interior-entry${insideSun ? " active" : ""}`}
            aria-label="进入太阳内部"
            aria-current={insideSun ? "page" : undefined}
            disabled={busy || insideSun}
            onClick={() => {
              interaction.enterSun();
              startMouse();
            }}
          >
            <span aria-hidden="true">✦</span>
            <span>{insideSun ? "太阳粒子漫游" : "太阳内部"}</span>
          </button>
          <button
            className="help-toggle"
            aria-label="操作指南"
            aria-expanded={s.help}
            onClick={() => store.set({ help: !s.help })}
          >
            ?
          </button>
        </nav>
      </footer>
      {s.help && (
        <section className="help-panel">
          <button
            className="help-close"
            aria-label="关闭操作指南"
            onClick={() => store.set({ help: false })}
          >
            ×
          </button>
          <p className="eyebrow">宇宙探索指南</p>
          <h2>用双手，掌控宇宙。</h2>
          <div className="help-columns">
            <div>
              <h3>手势操作</h3>
              <p>
                ① 食指瞄准 → 捏一下
                <span>光圈变金色后，拇指碰食指，进入星球</span>
              </p>
              <p>
                ② 伸出三根手指
                <span>食指、中指、无名指伸直，查看 / 收起资料</span>
              </p>
              <p>
                ③ 比出 ✌ <span>保持片刻，返回太阳系</span>
              </p>
              <p>
                ④ 手向左 / 向右滑动 <span>进入星球后，切换相邻星球</span>
              </p>
              <p>
                ⑤ 双手捏合，再拉开 / 靠近
                <span>
                  太阳系 / 星球视角中，两手各自拇指碰食指，拉开变大、靠近变小
                </span>
              </p>
              <p>
                ⑥ 双手向中心合拢 <span>张开五指，让整个星系向中心坍缩</span>
              </p>
              <p>
                ⑦ 双手快速张掌拉开
                <span>进入太阳内部，在环绕四周的金色粒子中漫游</span>
              </p>
            </div>
            <div>
              <h3>鼠标与触屏</h3>
              <p>
                移动鼠标 <span>拨动星尘粒子</span>
              </p>
              <p>
                点击星球 <span>拉近观察</span>
              </p>
              <p>
                ← / → <span>切换星球</span>
              </p>
              <p>
                滚动滚轮 <span>太阳系 / 星球视角中调整大小</span>
              </p>
              <p>
                空格键，再按空格键 <span>坍缩，然后进入太阳内部</span>
              </p>
              <p>
                S / 点击「太阳内部」 <span>直接体验太阳粒子漫游</span>
              </p>
              <p>
                Esc / I <span>返回 / 查看资料</span>
              </p>
              <p>
                单指拖动 <span>太阳系 / 星球视角中旋转 · 双指缩放</span>
              </p>
            </div>
          </div>
          <p className="help-note">
            双手操作时，两只手都要完整留在镜头内。捏合双手用于缩放，张开五指用于合拢
            / 拉开；做完动作稍停一下。摄像头画面始终留在本机。
          </p>
        </section>
      )}
    </div>
  );
}
