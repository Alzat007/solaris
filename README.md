# SOLARIS · 掌中星系

一个可本地运行、用双手拨动的太阳系。React 19 + TypeScript + Vite + Three.js / React Three Fiber，使用 GPU 粒子、GLSL 太阳、GSAP 镜头过渡和 MediaPipe Hand Landmarker。

正式网站：[SOLARIS · 掌中星系](https://alzat007.github.io/solaris/)。使用 GitHub Pages 公开托管，无需登录。后续部署以 GitHub Pages 为准。

## 发布更新

推送 `main` 分支后，`.github/workflows/pages.yml` 自动安装依赖、运行测试、构建和校验资源，再发布到 GitHub Pages。MediaPipe 模型、WASM 和地球纹理一同发布，摄像头仅在用户主动开启后使用。

本地复核 GitHub Pages 的仓库子路径：

```sh
VITE_BASE_PATH=/solaris/ npm run build
VITE_BASE_PATH=/solaris/ node scripts/verify-static-export.mjs
npm run preview
```

打开预览地址下的 `/solaris/`。普通本地开发仍用 `npm run dev`，默认根路径 `/`。

## 运行

需要 **Node.js 20.19+ 或 22.12+**。

```sh
npm install
npm run dev
```

打开终端显示的地址，默认 `http://localhost:5173`。摄像头只能用于 **localhost 或 HTTPS**；通过局域网 HTTP 在手机上打开时，使用触屏模式。当前 Mac 也可以双击 `启动 SOLARIS.command` 使用已有的 Codex Node 运行时。

```sh
npm run build       # TypeScript 校验和生产构建
npm run preview     # 预览 dist
npm test            # 手势稳定器、交互状态机和数据约束
npm run format      # 格式化源代码
```

## 体验

开场约 5 秒，太阳形成、行星与轨道依次显现。点击 **开启手势控制** 请求摄像头，抬起手掌即可。首次识别会产生太阳粒子脉冲；摄像头画面默认隐藏。

连接后，右上角的**实时手势**会显示姿势、识别置信度与操作提示。画面里的光圈跟随掌心或指尖；命中星球时变为金色，并显示目标名称。可以先握拳保持半秒验证坍缩，再张开手掌让宇宙重生。“已连接”只代表看到了手，姿势不明确时会另行提示。

| 手势 | 作用 |
| --- | --- |
| 食指指向 + 捏合 | 高亮并聚焦星球；也可点击底部行星名称 |
| 快速左右挥手 | 聚焦时切换行星 |
| 稳定张掌 | 返回太阳系 |
| 握拳 | 约 1.75 秒引力坍缩 |
| 坍缩后张掌 | Big Bang、冲击波与约 3.8 秒重组 |
| ✌️ | 当前行星的信息 HUD |
| 双手拉开/靠近 | 平滑缩放太阳系 |
| 双手张掌缓慢合拢 | 缩小到两手之间；快速拉开释放 |

手势确认需要短暂稳定：POINT 100ms、PINCH 70ms、OPEN 220ms、FIST 250ms、V_SIGN 300ms。Pinch 有双阈值滞回，Swipe 有冷却时间。指向目标会短暂锁定，防止捏合过程中指尖移动造成误选。主场景以连续的手部位置、速度、开放程度和捏合强度驱动 GPU 物理场。

也可以直接把捏合光标移到星球上。一次捏合只选择一次，松开后才能再次选择。命中范围跟随星球画面尺寸，并为自然手部抖动留有余量。

**鼠标与键盘：**移动扰动粒子，点击星球选择，滚轮缩放，`← / →` 切换，`Space` 坍缩 / 重生，`Esc` 返回，`I` 信息。右下角 `?` 可打开完整说明。**触屏：**单指拖动旋转，点按行星聚焦，双指缩放。默认静音，右上角声音按钮主动开启后才创建音频上下文。

访问 `/?debug=true` 可以看到镜像摄像头、21 个关键点及骨架、几何手势置信度、速度、pinch 距离和场景 FPS。摄像头按钮再次点击即关闭摄像头并释放资源。

开发服务器的 `/tests/gesture-lab.html` 提供合成 21 关键点回放，可验证识别、目标命中、动作路由与场景效果，不使用摄像头，也不包含在生产构建中。它不能代替真人在实际光照下的识别测试。

## 项目结构

- `src/scene`：太阳系组合、深空、轨道、屏幕与 3D 交互场映射。
- `src/planets`：Sun、八个独立行星组件、PlanetBase、表面材质、日珥、地球云层和月球、土星粒子环。
- `src/particles`：ParticleEngine 共享物理参数、GPU 粒子、组装与爆发 Shader、Big Bang 实例化光迹。
- `src/gesture`：摄像头生命周期、21 点特征提取、手势稳定器与动作路由。模型推理限制为 20Hz，渲染独立运行。
- `src/interaction`：显式状态机、互斥动画时间线、轻量外部 UI 状态。
- `src/camera`：相机惯性、位置和四元数插值、冲击后坐。
- `src/audio`：本地合成的低频氛围、切换和爆发声。
- `src/performance`：平均帧率监测、持续低帧率降级。
- `src/ui`：最小 HUD、行星资料、手势提示和调试画面。
- `src/data/planets.ts`：真实数据与视觉半径、轨道尺寸分离。

## 性能与范围

HIGH 静态分配约 27 万主粒子，其中太阳 9.5 万、星尘 11.5 万、土星环 6 万；Big Bang 另有最多 1.8 万 GPU 实例化光迹。MEDIUM 使用一半主粒子，LOW 使用约 5.4 万。连续平均帧率低于阈值时依次降低 drawRange、DPR 与 Bloom，避免逐帧重写粒子。DPR 上限 1.5。粒子运动使用解析 Shader 物理场，属于可实时响应的艺术模拟，不是 N 体天体力学。

地球使用本地日照/夜景贴图，其他星球为程序化 Shader。星球尺寸、距离和时间流速均为艺术比例。气态行星的卫星发现数量持续变化，资料 HUD 使用“多颗”或“至少”标记。

复杂双手合拢是实验性交互：依赖光照、手掌可见程度及检测稳定性。普通电脑浏览器、模型加载、拒绝权限和触屏布局已进行自动化检查；真实双手准确率及 iPhone Safari / Android Chrome 的实际设备帧率仍需现场验证。

## 隐私与资源

视频仅在浏览器内处理，不录像、不持久保存、不上传。MediaPipe 模型和 WASM 均从本站加载；首次安装后无需依赖模型 CDN。`postinstall` 会把与依赖版本一致的 WASM 复制到 `public/mediapipe`。字体通过 Google Fonts 请求；无法联网时自动使用系统字体。

- MediaPipe Hand Landmarker：Google 官方 float16 模型，`public/models/hand_landmarker.task`。
- Earth day / night：Three.js r160 examples 的 `earth_atmos_2048.jpg` 和 `earth_lights_2048.png`，来源 https://github.com/mrdoob/three.js/tree/r160/examples/textures/planets 。
- 原始素材与第三方许可证信息见 `THIRD_PARTY_NOTICES.md`。

WebGL 上下文丢失、渲染初始化/Shader 故障会显示可恢复提示；摄像头拒绝、缺失或模型失败会进入鼠标模式，不阻断作品。
