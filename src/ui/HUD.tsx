import { useEffect, useState } from "react";
import { useSolaris, store } from "../interaction/store";
import { planets, planetById } from "../data/planets";
import { interaction } from "../interaction/InteractionController";
import { handTracking } from "../gesture/HandTrackingManager";
import { audio } from "../audio/AudioManager";
import { HandIcon, OrbitIcon, SoundIcon } from "./Icons";
import { GestureHint } from "./GestureHint";
import { PlanetInfo } from "./PlanetInfo";
import { GestureCursor } from "../gesture/GestureCursor";
import { GestureTutorial } from "../gesture/GestureTutorial";
import { HandFeedback } from "./HandFeedback";
import { CameraPreview } from "../gesture/CameraPreview";
export function HUD() {
  const s = useSolaris();
  const insideSun = s.mode === "SUN_INTERIOR";
  const p = insideSun ? undefined : planetById(s.selected);
  const [soundError, setSoundError] = useState("");
  const cameraActive = ["loading", "seeking", "online"].includes(s.tracking);
  const busy =
    s.transitioning ||
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
      <GestureCursor />
      <GestureTutorial />
      <header className="topbar">
        <button
          className="wordmark"
          aria-label="返回太阳系"
          data-gesture-id="back-home"
          data-gesture-label="返回太阳系"
          disabled={busy}
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
            data-gesture-id="toggle-sound"
            data-gesture-label={s.sound ? "关闭声音" : "开启声音"}
            disabled={busy}
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
              data-gesture-id="back-from-sun"
              data-gesture-label="返回太阳系"
              disabled={busy}
              onClick={() => interaction.return()}
            >
              返回太阳系 <span>握拳 / Esc</span>
            </button>
          )}
          {p && (
            <button
              className="text-action"
              data-gesture-id="toggle-info"
              data-gesture-label={s.infoVisible ? "收起资料" : "查看资料"}
              disabled={busy}
              onClick={() => interaction.info()}
            >
              {s.infoVisible ? "收起资料" : "查看星球资料"}{" "}
              <span>{s.infoVisible ? "−" : "+"}</span>
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
          <p className="welcome-caption">指 · 捏 · 拖 · 拨 · 握</p>
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
            data-gesture-id="start-exploring"
            data-gesture-label="开始探索"
            disabled={busy}
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
      <CameraPreview />
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
        </div>
      )}
      {s.mode === "COLLAPSE" && (
        <button
          className="cosmic-action"
          aria-label="双掌展开或点击，让宇宙重生"
          data-gesture-id="solar-rebirth"
          data-gesture-label="宇宙重生"
          disabled={busy}
          onClick={() => interaction.rebirth()}
        >
          {s.tracking === "online" ? "双掌从中心向两侧拉开" : "让宇宙重生"}{" "}
          <span>
            {s.tracking === "online"
              ? "释放能量，让星球重新展开"
              : "也可以按空格键"}
          </span>
        </button>
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
              ? "指 · 捏 · 拖 · 拨 · 握"
              : "漫游无垠宇宙"}
          </div>
          <GestureHint />
        </div>
        <nav className="planet-nav" aria-label="选择星球">
          <button
            data-gesture-id="nav-sun"
            data-gesture-label="探索太阳"
            onClick={() => {
              interaction.selectBody("sun");
              startMouse();
            }}
            className={insideSun ? "active" : ""}
            disabled={busy || s.mode === "COLLAPSE"}
          >
            <i className="sun-dot" />
            <span>太阳</span>
          </button>
          {!insideSun &&
            planets.map((planet) => (
              <button
                key={planet.id}
                data-gesture-id={`nav-${planet.id}`}
                data-gesture-label={`探索${planet.chineseName}`}
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
            data-gesture-id="sun-interior"
            data-gesture-label="进入太阳内部"
            aria-label="进入太阳内部"
            aria-current={insideSun ? "page" : undefined}
            disabled={busy || insideSun || s.mode === "COLLAPSE"}
            onClick={() => {
              interaction.enterSun();
              startMouse();
            }}
          >
            <span aria-hidden="true">✦</span>
            <span>{insideSun ? "太阳粒子漫游" : "太阳内部"}</span>
          </button>
          {(s.mode === "SOLAR_SYSTEM" || s.mode === "COLLAPSE") && (
            <button
              className="cosmic-toggle"
              data-gesture-id={
                s.mode === "COLLAPSE" ? "nav-rebirth" : "nav-collapse"
              }
              data-gesture-label={
                s.mode === "COLLAPSE" ? "宇宙重生" : "宇宙坍缩"
              }
              aria-label={s.mode === "COLLAPSE" ? "宇宙重生" : "宇宙坍缩"}
              title={
                s.mode === "COLLAPSE"
                  ? "宇宙重生（空格键）"
                  : "宇宙坍缩（空格键）"
              }
              disabled={busy}
              onClick={() => {
                if (s.mode === "COLLAPSE") interaction.rebirth();
                else interaction.collapse();
                startMouse();
              }}
            >
              <span aria-hidden="true">
                {s.mode === "COLLAPSE" ? "✧" : "⊙"}
              </span>
              <span>{s.mode === "COLLAPSE" ? "重生" : "坍缩"}</span>
            </button>
          )}
          <button
            className="help-toggle"
            data-gesture-id="show-help"
            data-gesture-label="操作指南"
            disabled={busy}
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
            data-gesture-id="close-help"
            data-gesture-label="关闭操作指南"
            disabled={busy}
            aria-label="关闭操作指南"
            onClick={() => store.set({ help: false })}
          >
            ×
          </button>
          <p className="eyebrow">宇宙探索指南</p>
          <h2>指、捏、拖、拨、握。</h2>
          <div className="help-columns">
            <div>
              <h3>核心互动</h3>
              <p>
                指向 → 捏合
                <span>食指瞄准，拇指碰食指确认；进入后资料自动浮现</span>
              </p>
              <p>
                捏住 → 拖动<span>抓住太阳系空白，移动手旋转</span>
              </p>
              <p>
                五指聚拢 · 开合缩放
                <span>五个指尖聚在一起，稍停；张开变大，聚拢变小</span>
              </p>
              <p>
                左右拨动<span>聚焦后，左拨下一颗，右拨上一颗</span>
              </p>
              <p>
                握拳保持<span>返回圆环填满，即回到太阳系</span>
              </p>
            </div>
            <div>
              <h3>鼠标与触屏</h3>
              <p>
                点击进入 · 拖动旋转<span>滚轮 / 双指缩放</span>
              </p>
              <p>
                方向键 / 横滑切换<span>Esc / 左上角 SOLARIS 返回</span>
              </p>
              <h3>宇宙彩蛋</h3>
              <p>
                双掌合拢 · 坍缩
                <span>
                  双掌朝向镜头，分开后缓慢靠近；看到「保持片刻」就停住，无需相碰。动画结束后向两侧拉开，宇宙重生。
                </span>
              </p>
              <p>
                空格键<span>坍缩 / 重生</span>
              </p>
            </div>
          </div>
          <p className="help-note">
            缩放时聚拢五个指尖，不是握拳。完全张开停半秒，或移开手，结束缩放并保留大小。松开后再捏合；动画结束后继续探索。摄像头画面仅在本机处理。
          </p>
        </section>
      )}
    </div>
  );
}
