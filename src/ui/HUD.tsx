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
import { ThumbTargetFeedback } from "../gesture/ThumbTargetFeedback";
import { GestureTutorial } from "../gesture/GestureTutorial";
import { VZoomDial } from "../gesture/VZoomDial";
import { HandFeedback } from "./HandFeedback";
import { CameraPreview } from "../gesture/CameraPreview";
import { CameraStatus } from "./CameraStatus";
import { useCameraDiagnostics } from "../gesture/cameraDiagnostics";
import { TextCommandInput } from "./TextCommandInput";
import { ExplorationPanel } from "./ExplorationPanel";
import { explorationModes } from "../exploration/sceneState";
import { isTvMode } from "../platform/tvNavigation";
import { PlanetAtlasUI } from "../exploration/EarthAtlasUI";
import { isPlanetAtlasVisible } from "../exploration/planetAtlasState";
import { bilingualName, uiText } from "../exploration/bilingualLabels";
import { LanguageSwitcher } from "./LanguageSwitcher";

const englishTaglines = {
  mercury: "A world racing around the Sun",
  venus: "A planet beneath golden clouds",
  earth: "Our blue home",
  mars: "The red planet",
  jupiter: "King of the planets",
  saturn: "A world encircled by rings",
  uranus: "The quiet ice giant",
  neptune: "A world of deep blue",
};

export function HUD() {
  const s = useSolaris();
  const zh = s.language === "zh";
  const text = (chinese: string, english: string) => (zh ? chinese : english);
  const camera = useCameraDiagnostics();
  const insideSun = s.mode === "SUN_INTERIOR";
  const exploring = explorationModes.includes(s.mode);
  const lightEarth = isPlanetAtlasVisible(s);
  const tv = isTvMode(location.search);
  const p = insideSun ? undefined : planetById(s.selected);
  const bodyName = bilingualName(p?.id ?? "sun", {
    zh: p?.chineseName ?? "太阳",
    en: p?.name ?? "Sun",
  });
  const homeLabel = uiText("backToSolarSystem", s.language, {
    zh: "返回太阳系",
    en: "Back to solar system",
  });
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
      ? text("手势追踪 · 已连接", "Hand tracking connected")
      : s.tracking === "seeking"
        ? text("请抬起手掌", "Raise your hand")
        : s.tracking === "loading"
          ? camera.stage === "switching"
            ? text("正在切换识别", "Switching tracking mode")
            : camera.stage === "model"
              ? text("正在加载手势模型", "Loading hand tracking")
              : text("正在连接摄像头", "Connecting camera")
          : text("鼠标模式", "Mouse mode");
  const startMouse = () => store.set({ welcome: false });
  useEffect(() => {
    document.documentElement.lang = zh ? "zh-CN" : "en";
  }, [zh]);
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
      className={`hud ${s.mode === "INTRO" ? "intro-hud" : ""}${s.tracking === "online" ? " hand-active" : ""}${insideSun ? " sun-interior-hud" : ""}${exploring ? " exploring" : ""}${lightEarth ? " earth-atlas-open" : ""}`}
    >
      <GestureCursor />
      <ThumbTargetFeedback />
      <VZoomDial />
      <GestureTutorial />
      <header className="topbar">
        <div className="brand-block">
          <button
            className="wordmark"
            aria-label={homeLabel}
            data-gesture-id="back-home"
            data-gesture-label={homeLabel}
            disabled={busy && !interaction.canCancelPlanetTransition()}
            onClick={() => {
              interaction.return();
              store.set({ welcome: false });
            }}
          >
            <OrbitIcon />
            <span>SOLARIS</span>
          </button>
          <small className="public-beta">
            {s.language === "zh" ? "公开测试版" : "Public beta"}
          </small>
        </div>
        <span className="top-note">
          {text("向无垠宇宙，再靠近一点", "A little closer to the cosmos")}
        </span>
        <div className="top-actions">
          <LanguageSwitcher
            language={s.language}
            onChange={(language) => store.set({ language })}
            context="header"
          />
          <button
            className={`tracking-button ${s.tracking === "online" ? "online" : ""}`}
            onClick={() =>
              cameraActive ? handTracking.stop() : void handTracking.start()
            }
            aria-label={
              cameraActive
                ? text("关闭摄像头", "Turn off camera")
                : text("开启手势控制", "Enable hand tracking")
            }
            title={cameraLabel}
          >
            <i className={s.tracking} />
            <span>{cameraLabel}</span>
            {!cameraActive && <HandIcon size={17} />}
          </button>
          <button
            className="sound-button"
            data-gesture-id="toggle-sound"
            data-gesture-label={
              s.sound
                ? text("关闭声音", "Mute sound")
                : text("开启声音", "Enable sound")
            }
            disabled={busy}
            title={text("开启或关闭声音", "Toggle sound")}
            aria-label={
              s.sound
                ? text("关闭声音", "Mute sound")
                : text("开启声音", "Enable sound")
            }
            aria-pressed={s.sound}
            onClick={() =>
              void audio
                .toggle()
                .then((sound) => store.set({ sound }))
                .catch(() => setSoundError("当前浏览器暂不支持音频播放。"))
            }
          >
            <SoundIcon on={s.sound} />
            <span>
              {s.sound
                ? text("声音已开启", "Sound on")
                : text("声音已关闭", "Sound off")}
            </span>
          </button>
        </div>
      </header>
      <div className="edge-label">
        {insideSun
          ? text("恒星内部", "Stellar interior")
          : text("太阳系", "Solar system")}{" "}
        <span>✦</span>{" "}
        {insideSun
          ? text("粒子漫游", "Particle exploration")
          : text("银河系", "Milky Way")}
      </div>
      {!s.welcome && s.mode !== "COLLAPSE" && s.mode !== "BIG_BANG" && (
        <section
          className="object-title"
          key={insideSun ? "sun-interior" : s.selected || "sun"}
        >
          <p className="eyebrow">
            {insideSun
              ? text(
                  "沉浸漫游 / 被光环绕",
                  "Immersive exploration / Surrounded by light",
                )
              : `${number} / ${p ? text("探索行星", "Explore a planet") : text("太阳系的中心", "Heart of the solar system")}`}
          </p>
          <h1>
            {insideSun
              ? text("太阳内部", "Inside the Sun")
              : bodyName[s.language]}
          </h1>
          <p className="object-subtitle">
            {insideSun
              ? text(
                  "四周皆是星火，每一粒光都在流动。",
                  "Surrounded by starlight, every particle in motion.",
                )
              : p
                ? zh
                  ? p.description
                  : englishTaglines[p.id]
                : text(
                    "一颗恒星，八个世界，由你掌控。",
                    "One star. Eight worlds. Yours to explore.",
                  )}
          </p>
          {insideSun && (
            <button
              className="text-action"
              data-gesture-id="back-from-sun"
              data-gesture-label={homeLabel}
              disabled={busy}
              onClick={() => interaction.return()}
            >
              {homeLabel} <span>{text("握拳 / Esc", "Fist / Esc")}</span>
            </button>
          )}
          {p && !lightEarth && (
            <button
              className="text-action explore-entry"
              data-gesture-id="browse-destinations"
              data-gesture-label={text("探索经典区域", "Explore destinations")}
              disabled={busy}
              onClick={() => interaction.browse()}
            >
              {s.language === "zh" ? "探索经典区域" : "Explore destinations"}{" "}
              <span>→</span>
            </button>
          )}
          {p && !lightEarth && (
            <button
              className="text-action"
              data-gesture-id="toggle-info"
              data-gesture-label={
                s.infoVisible
                  ? text("收起资料", "Hide details")
                  : text("查看资料", "Show details")
              }
              disabled={busy}
              onClick={() => interaction.info()}
            >
              {s.infoVisible
                ? text("收起资料", "Hide details")
                : text("查看星球资料", "Planet details")}{" "}
              <span>{s.infoVisible ? "−" : "+"}</span>
            </button>
          )}
        </section>
      )}
      {s.welcome && (
        <section className="welcome">
          <p className="eyebrow">
            {text("掌中星系", "A solar system in your hands")}
          </p>
          <h1>
            {text("浩瀚宇宙", "The cosmos")}
            <br />
            <span>{text("尽在掌中", "in your hands")}</span>
          </h1>
          <p className="welcome-caption">
            {text(
              "指 · 张拇指 · 拖 · 转 · 拨 · 握",
              "Point · Thumb · Drag · Turn · Swipe · Fist",
            )}
          </p>
          <button
            className="enter-button"
            disabled={s.mode === "INTRO" || s.tracking === "loading"}
            onClick={() => void handTracking.start()}
          >
            <HandIcon />
            {s.mode === "INTRO"
              ? text("正在凝聚你的宇宙", "Gathering your universe")
              : text("开启手势控制", "Enable hand tracking")}
            <span>↗</span>
          </button>
          <button
            className="mouse-link"
            data-gesture-id="start-exploring"
            data-gesture-label={text("开始探索", "Start exploring")}
            disabled={busy}
            onClick={startMouse}
          >
            {tv
              ? text("开始探索", "Start exploring")
              : text("也可以用鼠标探索", "Explore with a mouse")}{" "}
            <span>→</span>
          </button>
          <p className="privacy">
            {text(
              "摄像头画面仅在本机处理",
              "Camera frames are processed on this device only",
            )}
          </p>
        </section>
      )}
      <CameraStatus />
      <HandFeedback />
      <CameraPreview />
      {s.tracking === "unavailable" && (
        <div className="camera-notice" role="status">
          <span>
            {text(
              "手势追踪不可用 · 已开启鼠标模式",
              "Hand tracking unavailable · Mouse mode enabled",
            )}
          </span>
          <p>{s.cameraError}</p>
          <button onClick={() => void handTracking.start()}>
            {text("重新连接摄像头", "Reconnect camera")} ↗
          </button>
          <button
            aria-label={text("关闭摄像头提示", "Dismiss camera notice")}
            onClick={() => store.set({ tracking: "off", cameraError: "" })}
          >
            ×
          </button>
        </div>
      )}
      {soundError && (
        <div className="camera-notice" role="status">
          {text(soundError, "Audio playback is not supported in this browser.")}
          <button onClick={() => setSoundError("")}>×</button>
        </div>
      )}
      {(s.mode === "COLLAPSE" || s.mode === "BIG_BANG") && (
        <div className="cosmic-event">
          <p className="eyebrow">
            {s.mode === "COLLAPSE"
              ? text(
                  "每一次终结，都是新的起点",
                  "Every ending is a new beginning",
                )
              : text("让光，再次诞生", "Let light return")}
          </p>
          <h2>
            {s.mode === "COLLAPSE"
              ? text("奇点", "Singularity")
              : text("重生", "Rebirth")}
          </h2>
        </div>
      )}
      {s.mode === "COLLAPSE" && (
        <button
          className="cosmic-action"
          aria-label={text(
            "双掌展开或点击，让宇宙重生",
            "Spread both palms or click to recreate the universe",
          )}
          data-gesture-id="solar-rebirth"
          data-gesture-label={text("宇宙重生", "Recreate the universe")}
          disabled={busy}
          onClick={() => interaction.rebirth()}
        >
          {s.tracking === "online"
            ? text("双掌从中心向两侧拉开", "Spread both palms outward")
            : text("让宇宙重生", "Recreate the universe")}{" "}
          <span>
            {s.tracking === "online"
              ? text("释放能量，让星球重新展开", "Release the planets again")
              : text("也可以按空格键", "Or press Space")}
          </span>
        </button>
      )}
      {s.heldUniverse && (
        <div className="held-universe">
          {text("宇宙，尽在掌中", "The universe in your hands")}
        </div>
      )}
      {!insideSun && !exploring && !lightEarth && <PlanetInfo />}
      {!lightEarth && <ExplorationPanel />}
      <PlanetAtlasUI />
      <footer>
        <div className="footer-top">
          <div className="location">
            <span className="location-cross">+</span>
            <span>
              {insideSun
                ? text("太阳内部", "Inside the Sun")
                : s.selected
                  ? text("星球聚焦", "Planet focus")
                  : text("太阳系", "Solar system")}
              <small>
                {insideSun
                  ? text(
                      "金色星火 · 环绕你我",
                      "Surrounded by golden starlight",
                    )
                  : s.mode === "COLLAPSE"
                    ? text("引力坍缩", "Gravitational collapse")
                    : s.mode === "BIG_BANG"
                      ? text("宇宙正在重组", "The universe is re-forming")
                      : text(
                          "诞生于约 46 亿年前",
                          "Formed about 4.6 billion years ago",
                        )}
              </small>
            </span>
          </div>
          {!lightEarth && <TextCommandInput />}
          <GestureHint />
        </div>
        <nav
          className="planet-nav"
          aria-label={text("选择星球", "Choose a celestial body")}
        >
          <button
            data-gesture-id="nav-sun"
            data-gesture-label={text("探索太阳", "Explore Sun")}
            aria-label={text("探索太阳", "Explore Sun")}
            onClick={() => {
              interaction.selectBody("sun");
              startMouse();
            }}
            className={insideSun ? "active" : ""}
            disabled={busy || s.mode === "COLLAPSE"}
          >
            <i className="sun-dot" />
            <span>{text("太阳", "Sun")}</span>
          </button>
          {!insideSun &&
            planets.map((planet) => (
              <button
                key={planet.id}
                data-gesture-id={`nav-${planet.id}`}
                data-gesture-label={
                  zh
                    ? `探索${planet.chineseName}`
                    : `Explore ${bilingualName(planet.id, { zh: planet.chineseName, en: planet.name }).en}`
                }
                aria-label={
                  zh
                    ? `探索${planet.chineseName}`
                    : `Explore ${bilingualName(planet.id, { zh: planet.chineseName, en: planet.name }).en}`
                }
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
                <span>
                  {
                    bilingualName(planet.id, {
                      zh: planet.chineseName,
                      en: planet.name,
                    })[s.language]
                  }
                </span>
              </button>
            ))}
          <button
            className={`interior-entry${insideSun ? " active" : ""}`}
            data-gesture-id="sun-interior"
            data-gesture-label={text("进入太阳内部", "Enter the Sun")}
            aria-label={text("进入太阳内部", "Enter the Sun")}
            aria-current={insideSun ? "page" : undefined}
            disabled={busy || insideSun || s.mode === "COLLAPSE"}
            onClick={() => {
              interaction.enterSun();
              startMouse();
            }}
          >
            <span aria-hidden="true">✦</span>
            <span>
              {insideSun
                ? text("太阳粒子漫游", "Solar particles")
                : text("太阳内部", "Inside the Sun")}
            </span>
          </button>
          {(s.mode === "SOLAR_SYSTEM" || s.mode === "COLLAPSE") && (
            <button
              className="cosmic-toggle"
              data-gesture-id={
                s.mode === "COLLAPSE" ? "nav-rebirth" : "nav-collapse"
              }
              data-gesture-label={
                s.mode === "COLLAPSE"
                  ? text("宇宙重生", "Recreate the universe")
                  : text("宇宙坍缩", "Collapse the universe")
              }
              aria-label={
                s.mode === "COLLAPSE"
                  ? text("宇宙重生", "Recreate the universe")
                  : text("宇宙坍缩", "Collapse the universe")
              }
              title={
                s.mode === "COLLAPSE"
                  ? text("宇宙重生（空格键）", "Recreate the universe (Space)")
                  : text("宇宙坍缩（空格键）", "Collapse the universe (Space)")
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
              <span>
                {s.mode === "COLLAPSE"
                  ? text("重生", "Rebirth")
                  : text("坍缩", "Collapse")}
              </span>
            </button>
          )}
          <button
            className="help-toggle"
            data-gesture-id="show-help"
            data-gesture-label={text("操作指南", "Exploration guide")}
            disabled={busy}
            aria-label={text("操作指南", "Exploration guide")}
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
            data-gesture-label={text("关闭操作指南", "Close exploration guide")}
            disabled={busy}
            aria-label={text("关闭操作指南", "Close exploration guide")}
            onClick={() => store.set({ help: false })}
          >
            ×
          </button>
          <p className="eyebrow">
            {text("宇宙探索指南", "Cosmic exploration guide")}
          </p>
          <h2>{text("指向、张拇指、探索。", "Point. Thumb. Explore.")}</h2>
          <div className="help-columns">
            <div>
              <h3>{text("核心互动", "Hand controls")}</h3>
              <p>
                {text(
                  "指向锁定 → 张开大拇指",
                  "Point to lock → Extend your thumb",
                )}
                <span>
                  {text(
                    "先收拢拇指，用食指指向星球；等圆环填满后，食指保持指向，张开大拇指进入。收回大拇指后可继续选择；进入后资料自动浮现。",
                    "Keep your thumb tucked and point your index finger at a planet. Once the ring fills, keep pointing and extend your thumb to enter. Tuck your thumb again before the next selection.",
                  )}
                </span>
              </p>
              <p>
                {text("捏住 → 拖动", "Pinch → Drag")}
                <span>
                  {text(
                    "抓住太阳系空白，移动手旋转",
                    "Grab empty space and move your hand to rotate",
                  )}
                </span>
              </p>
              <p>
                {text("✌ 旋转手腕 · 缩放", "Two fingers · Twist to zoom")}
                <span>
                  {text(
                    "食指和中指自然伸开，保持片刻；以此刻为中点，向右拧放大、向左拧缩小。松开 ✌ 即停止。",
                    "Extend your index and middle fingers and hold briefly. Twist right to zoom in or left to zoom out. Release the gesture to stop.",
                  )}
                </span>
              </p>
              <p>
                {text("左右拨动", "Swipe sideways")}
                <span>
                  {text(
                    "聚焦后，左拨下一颗，右拨上一颗",
                    "When focused, swipe left for the next planet or right for the previous one",
                  )}
                </span>
              </p>
              <p>
                {text("握拳保持", "Hold a fist")}
                <span>
                  {text(
                    "返回圆环填满，即回到太阳系",
                    "Return to the solar system when the return ring fills",
                  )}
                </span>
              </p>
            </div>
            <div>
              <h3>{text("鼠标与触屏", "Mouse and touch")}</h3>
              <p>
                {text("点击进入 · 拖动旋转", "Click to enter · Drag to rotate")}
                <span>{text("滚轮 / 双指缩放", "Scroll / Pinch to zoom")}</span>
              </p>
              <p>
                {text("方向键 / 横滑切换", "Arrow keys / Swipe to switch")}
                <span>
                  {text(
                    "Esc / 左上角 SOLARIS 返回",
                    "Esc / SOLARIS at the top left to return",
                  )}
                </span>
              </p>
              <h3>{text("宇宙彩蛋", "Cosmic surprises")}</h3>
              <p>
                {text(
                  "双掌合拢 · 坍缩",
                  "Bring both palms together · Collapse",
                )}
                <span>
                  {text(
                    "双掌朝向镜头，分开后缓慢靠近；看到「保持片刻」就停住，无需相碰。动画结束后向两侧拉开，宇宙重生。",
                    "Face both palms toward the camera, then slowly bring them together. Stop when asked to hold; your hands do not need to touch. After the animation, spread your palms to recreate the universe.",
                  )}
                </span>
              </p>
              <p>
                {text("空格键", "Space")}
                <span>{text("坍缩 / 重生", "Collapse / Rebirth")}</span>
              </p>
            </div>
          </div>
          <p className="help-note">
            {text(
              "选择时保持食指指向，不要弯曲食指；如果大拇指一开始已张开，先收回再操作。捏合仅用于抓住空白拖动。左右手都可以旋转缩放，手腕回到起始角度会暂停；动画结束后继续探索。若有画面却一直没有手部骨架，可点击「切换兼容识别」。摄像头画面仅在本机处理。",
              "Keep your index finger straight when selecting; tuck your thumb first if it is already extended. Pinching grabs empty space for dragging. Either hand can rotate and zoom; returning your wrist to its starting angle pauses zoom. If tracking does not detect your hand, try the compatibility mode. Camera frames stay on this device.",
            )}
          </p>
        </section>
      )}
    </div>
  );
}
