# SOLARIS Gesture System V2.1

网站：[SOLARIS · 掌中星系](https://alzat007.github.io/solaris/)。核心手势语言：**指、捏、拖、拨、握**。

V2.1 针对电脑内置摄像头进一步分离跟踪有效性与姿势证据，增加自然弯指、侧转和紧凑捏合容错，并重做宇宙坍缩的可见过程。缩放进一步改为单手五指撮合启动、连续开合控制，保留双指捏合选择与握拳返回。现有太阳系模型、品牌界面和太阳内部保留；太阳和行星仍统一用「指向 → 捏合 → 进入」。

## 1. 修改的文件与职责

以下覆盖 V2 基础重构与 V2.1 优化所涉及的模块，便于继续维护；新增模块包括 `CameraPreview.tsx`、`CollapseEffect.tsx`、`SingleHandZoom.ts` 和 `collapse-motion.test.ts`。

| 文件                                                                                                                                                                      | 职责                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/gesture/HandTrackingManager.ts`                                                                                                                                      | 相机权限与释放、本站 MediaPipe 加载、20Hz 推理；丢帧或冻结视频向状态机报告空手。                            |
| `src/gesture/HandIdentityTracker.ts`                                                                                                                                      | 利用左右手标签与二维位置预测维持身份；处理检测重排、交叉和丢失；弱左右手标签不清空手，坏关键点按手处理。    |
| `src/gesture/GestureRecognizer.ts`、`GestureTypes.ts`、`recognizerConfig.ts`                                                                                              | 21 点的指链伸展率／离腕证据、3D 双指捏合与多方向五指撮合、指针防抖与捏合中点；跟踪有效性和姿势分数独立。    |
| `src/gesture/GestureStateMachine.ts`                                                                                                                                      | 每只手独立的 Pinch 生命周期及可取消的持续动作确认。                                                         |
| `src/gesture/GestureController.ts`                                                                                                                                        | 重入锁、场景锁、动作冷却、优先级、目标捕获以及互斥选择／拖动／缩放。                                        |
| `src/gesture/SingleHandZoom.ts`                                                                                                                                           | 五指撮合捕获后连续开合确认、张掌停留结束与当前比例保留；动画中可观察释放，独立占用输入。                    |
| `src/gesture/GestureMotion.ts`                                                                                                                                            | 窗口拨动；相对掌间距、近距保持和短暂弱姿势暂停组成的坍缩／重生确认。                                        |
| `src/gesture/gestureConfig.ts`                                                                                                                                            | 集中维护行为阈值、识别频率和输入响应参数。                                                                  |
| `src/gesture/gestureTargets.ts`、`gestureFeedback.ts`                                                                                                                     | 统一天体／HUD 目标，发布 Armed、进度、触发、锁和 Debug 数据。                                               |
| `src/gesture/GestureCursor.tsx`、`GestureTutorial.tsx`、`GestureDebug.tsx`、`CameraPreview.tsx`                                                                           | 光标、渐进教程与 Debug；复用现有视频的本机镜像预览和骨架，可收起，阅读时自动收起。                          |
| `src/interaction/InteractionStateMachine.ts`、`InteractionController.ts`、`store.ts`                                                                                      | 场景状态、镜头期间互斥、统一太阳选择、返回、缩放与自动显示行星资料。                                        |
| `src/interaction/rotation.ts`                                                                                                                                             | 鼠标与手势共享的旋转速度上限、平滑和松手阻尼。                                                              |
| `src/scene/InputField.tsx`、`PointerFallback.ts`、`planetPicking.ts`                                                                                                      | 渲染侧光标插值、天体／HUD 命中、鼠标与触屏输入序列；拖动／缩放不会在松手时变为点击。                        |
| `src/scene/SolarSystem.tsx`、`OrbitSystem.tsx`、`StarField.tsx`                                                                                                           | 统一旋转／缩放与拖动反馈；坍缩时轨道、天体和背景星场向中心收束。                                            |
| `src/planets/PlanetBase.tsx`、`Sun.tsx`                                                                                                                                   | 行星和太阳一致的命中／选择入口与目标反馈。                                                                  |
| `src/particles/ParticleEngine.ts`、`ParticleField.tsx`、`ParticleShaders.ts`、`CollapseEffect.tsx`                                                                        | 保存预备聚能／坍缩参数；GPU 螺旋落入光迹、吸积盘、稳定能量核与内向压力波。                                  |
| `src/ui/HUD.tsx`、`HandFeedback.tsx`、`GestureHint.tsx`、`PlanetInfo.tsx`、`DebugHands.tsx`、`chinese.ts`、`styles.css`                                                   | 中文教学、识别手数、双掌阶段与百分比、资料卡；底部坍缩／重生备用按钮。                                      |
| `src/app/App.tsx`                                                                                                                                                         | 按 URL 参数加载 Gesture Debug。                                                                             |
| `tests/recognizer.test.ts`、`hand-identity.test.ts`、`pinch-state.test.ts`、`routing.test.ts`、`collapse-motion.test.ts`、`single-hand-zoom.test.ts`、`fixtures/hands.ts` | 自然手型／3D 旋转与噪声样本、稳定身份、Pinch 生命周期、双掌阶段、五指缩放启停／开合映射及互斥动作路由回归。 |
| `tests/interaction.test.ts`、`picking.test.ts`、`scene-controls.test.ts`、`fallback.test.ts`、`gesture-lab.ts`、`gesture-lab.html`                                        | 场景状态、命中、输入互斥与合成关键点回放。                                                                  |
| `README.md`、`GESTURE_SYSTEM_V2.md`                                                                                                                                       | 运行说明、操作语言、阈值和调试说明。                                                                        |

`tests/focus-zoom.test.ts` 覆盖真实选星流程中的缩放衔接：选择星球 → 动画锁内松手 → 解锁后首次快速聚拢开合，检查确认不会被中间态吞掉，动画期间也不会缩放。朝镜头撮合也经过识别器与交互控制器的连续流程检查。

五指回归样本区分「整只手旋转」与「指尖相对手掌改变聚拢方向」：除纵向撮合外，还包含掌面法线方向 35／45／55mm 的合成撮合、镜像与侧转、深度噪声、自然弯指、慢速张开再聚拢、无世界关键点时的回退，以及单指未聚拢、松拇指或指根强弯的握拳、双指捏合／V／三指等反例。这些测试验证几何与动作衔接，不代表真人摄像头识别准确率。

识别层只产生特征；确认和互斥交给状态机。推理与渲染分离，识别器复用临时关键点／数值缓冲，渲染循环继续插值光标与场景参数。

## 2. 删除的旧手势与替代逻辑

| 旧行为                                  | V2.1 行为                                                 |
| --------------------------------------- | --------------------------------------------------------- |
| 三指查看／收起资料                      | 不再是命令；进入行星的镜头动画完成后 400ms 自动显示资料。 |
| ✌ V 手势返回                           | 不再是命令；握拳持续 600ms，返回进度满后执行。            |
| 双手快速张开进入太阳内部                | 删除导航作用；太阳通过 Point + Pinch 进入。               |
| 双掌间距直接缩放、双手捏合中点缩放      | 移除；单手五个指尖撮合确认后，以连续开合控制大小。        |
| 张掌、握拳或手指移动触发多种导航        | Point 仅瞄准；Fist 仅返回；双掌仅用于坍缩／重生彩蛋。     |
| 旧通用 `GestureStabilizer` 与旧保持时长 | 移除，采用独立 Pinch／Hold 状态机和统一配置。             |

V 手势和三指姿势仍可显示各手指的调试状态，但几何命令识别结果为 `NONE`。自然捏合优先，握拳时拇指碰到食指不会被当作选择。

## 3. 新状态与场景规则

### Pinch 生命周期

`IDLE → PINCH_START → PINCH_HOLD → PINCH_RELEASE → IDLE`

- `PINCH_START`：距离低于 0.28 掌宽，连续确认 140ms。
- `PINCH_HOLD`：只在首次进入时产生一次确认；继续保持不会重复点击。
- `PINCH_RELEASE`：距离大于 0.43 掌宽时结束。
- `needsRelease`：重连、动画锁或取消时仍在捏合，必须先松开再开始；不能把跨越场景动画的旧捏合当成新点击。

捏合开始时捕获目标或空白区域：目标捏合确认后选择；空白捏合保持并移动后拖动。一次手势不能在选择和拖动之间反复切换。五指撮合不是双指 Pinch；缩放确认和进行期间单独占用输入，抑制双指选择／拖动与返回／拨动。

### 单手五指开合缩放

先把五个指尖聚拢成撮合姿势，朝向镜头也可以，首次识别为 `FIVE_PINCH` 后捕获本次开合动作；随后可在可信的 `NONE`／`OPEN_PALM` 中间态继续 **180ms** 确认，无需持续闭合不动。确认完成后聚拢缩小、张开放大；五指开合幅度映射到 **0.35–1.75 倍**，不使用双掌距离或手在屏幕上的移动量。手完全张开并停留 **450ms**，或移出画面，结束缩放并保留大小。回到中间开合程度后可继续调节，无需用两只手。聚焦行星时，操作反馈使用「星球缩放」。

场景动画中只观察可靠的松手证据，用于解除五指缩放的释放保护，不累计确认时间、不改变大小。动画结束后重新计时，因此锁内已松手时，首次聚拢开合即可确认，不必再重复一轮。真实追踪丢失、重新入镜及普通双指选择的释放保护仍保留；不把动画中尚未确认的开合时间带入新场景。

`gripAperture` 是五个指尖相对其中心的 RMS 离散程度，并按掌宽归一化，因此摄像头前后距离本身不直接控制缩放；`gripConfidence` 是五指几何适用于开合控制的可信度。几何判定分别接受沿手掌纵向聚拢和指尖离开掌面、朝向镜头的聚拢；朝镜头的紧密撮合不要求指尖越过指根或满足纵向离腕比。捕获后逐渐张开的中间态另要求五指尖共同前伸与四指角度证据，避免指根强弯的拳头进入缩放。各分支仍共同检查五指尖的整体分布，避免只看拇指与食指接触。拇指与食指单独接触仍是选择／拖动；四指卷进掌心仍是握拳返回。缩放确认和进行期间屏蔽这些其他命令，避免收拢动作切入错误模式。原 `TWO_HAND_ZOOM` 动作移除，由 `ONE_HAND_ZOOM` 替代；双手仍用于坍缩与重生彩蛋。

### 可见反馈与就绪状态

| 状态                | 用户看到的含义                                           |
| ------------------- | -------------------------------------------------------- |
| `NO_HAND`           | 未检测到手，不显示手势光标。                             |
| `HAND_VISIBLE`      | 已检测到手，出现轻光圈。                                 |
| `TARGET_HOVER`      | 命中天体或可操作 HUD，显示高亮与目标名称。               |
| `GESTURE_ARMED`     | 捏合、握拳或彩蛋正在确认；显示收缩／进度反馈。           |
| `GESTURE_TRIGGERED` | 动作已触发，短暂脉冲反馈。                               |
| `RECONNECTING`      | 手重新出现后的 250ms 只允许位置跟踪；禁止动作。          |
| `READY`             | 重入等待结束且关键点几何有效；具体动作仍须通过姿势门槛。 |

`readiness` 与可见反馈独立：看见手或命中目标不意味着动作已解锁。动作通道还区分 `NONE`、`POINT`、`PINCH_SELECT`、`PINCH_DRAG`、`ONE_HAND_ZOOM`、`FIST_BACK`、`SWIPE`、`COLLAPSE`、`REBIRTH`。

### App State

沿用已有内部场景名，避免更改场景模型。Debug 同时显示语义场景和内部状态。

| 语义状态       | 内部状态／阶段                                                                 | 允许的核心操作                                                         |
| -------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `OVERVIEW`     | `SOLAR_SYSTEM`、兼容 `POINTER`                                                 | Point、Pinch Select、空白 Pinch Drag、单手五指开合缩放、双掌坍缩。     |
| `PLANET_FOCUS` | `PLANET_FOCUS`、`INFO`                                                         | Point、选择、张掌左右拨动、Fist Back、单手五指开合缩放；资料自动显示。 |
| 缩放进行中     | `UNIVERSE_SCALE`                                                               | 单手五指缩放独占；结束后回到缩放前的总览／行星状态。                   |
| 太阳飞入阶段   | `SUN_FOCUS`                                                                    | 作为进入太阳的动画阶段，全程锁定，不需要再捏第二次。                   |
| `SUN_INTERIOR` | `SUN_INTERIOR`                                                                 | Fist Back，返回外部太阳系。                                            |
| `COLLAPSE`     | `COLLAPSE`                                                                     | 坍缩动画期间锁定；核心形成后允许双掌重生或 Fist Back。                 |
| `TRANSITION`   | `INTRO`、`PLANET_TRANSITION`、`SUN_FOCUS`、`TRANSITION`、`BIG_BANG` 及坍缩动画 | 禁止新的手势操作；等待动画完成。                                       |

所有已解锁的场景都可以通过 Point + Pinch 点击当前可用的 HUD 按钮，包括太阳内部和坍缩完成后的状态；天体选择仍限制在总览与行星聚焦场景。

冷却与场景锁共同生效：冷却结束也不会提前打断镜头动画。真实手丢失、无效几何或身份集合变化会结束拖动／缩放并重新经过就绪门槛。单纯的低姿势分数不会清空手身份或把 `READY` 退回重入状态；选择、握拳、拨动和缩放依然需要各自的可靠姿势。

### 双掌确认与坍缩视觉

总览中双掌张开，先保持一定间隔，再共同向中心靠近。初始间距至少 0.28；开始减少 0.018 后记录可靠观察时间；总间距至少减少 0.1，每只手须向内移动至少 0.025。近距条件为间距不大于 `max(0.32, 初始间距 × 0.62)`，因此无需手掌碰到一起遮住关键点。有效观察累计达到 **1 秒**，且近距可靠保持达到 **200ms**，才触发一次坍缩。

双掌阶段为 `IDLE → READY → APPROACH → HOLD`；识别到 `NONE` 或低姿势分数时进入 `PAUSED`，最多保留 **220ms** 的前序进度，暂停期间不累计时间、不执行动作；超时或明确改为不兼容手势则重新开始。界面显示已识别手数、合拢／保持阶段和百分比。

触发后的坍缩动画持续 **2.4 秒**，全程锁定：背景星光旋转内收，星尘形成向心螺旋光迹，天体与轨道汇入中央，最终留下吸积盘、持续吸入的粒子、脉动能量核和内向压力波。准备合拢时有轻微聚能提示，松手取消后回落。坍缩特效由 GPU 计算，按画质使用 12,000／6,500／2,400 条实例化光迹以及两张 Shader 平面；不逐帧重建粒子数组。

核心形成后，双掌从不大于 0.42 的初始间距向两侧拉开：间距增加至少 0.18、最终至少 0.38，每手向外移动至少 0.035，并观察至少 180ms 后触发重生。现有 3.8 秒 Big Bang 与粒子爆发接续展开太阳系；展开动作不进入太阳。底部 **「坍缩」／「重生」** 按钮及空格键可独立触发同一条场景动画，作为摄像头操作的备用入口；动画锁同样生效。

## 4. 当前全部配置阈值

以下逐项列出两份配置文件的全部 **119 个字段（71 + 48）**。`ms` 是毫秒，`s` 是秒；屏幕坐标为镜像后的 0–1 归一化坐标，二维距离不是像素。掌宽比优先使用世界关键点的三维距离除以三维掌宽；缺少有效世界关键点时使用宽高比校正后的图像关键点。指数响应采用 `1 - exp(-dt × response)`，时间常数采用 `1 - exp(-dt / time)`，两者调节方向相反。

### `src/gesture/gestureConfig.ts`（71 项）

| 参数                              | 当前值 | 单位           | 用途                                                                                                    |
| --------------------------------- | -----: | -------------- | ------------------------------------------------------------------------------------------------------- |
| `PINCH_START_THRESHOLD`           |   0.28 | 掌宽比         | 拇指与食指距离小于此值时开始 Pinch。                                                                    |
| `PINCH_RELEASE_THRESHOLD`         |   0.43 | 掌宽比         | 距离大于此值才释放；必须大于开始阈值。                                                                  |
| `PINCH_HOLD_TIME`                 |    140 | ms             | 连续捏合确认时长，完成后进入 PINCH_HOLD。                                                               |
| `MIN_CONFIDENCE`                  |   0.55 | 0–1            | 有效几何的就绪门槛，同时是单手动作姿势分数门槛；姿势弱不会因此清除身份或重入，具体动作暂不确认。        |
| `TWO_HAND_MIN_CONFIDENCE`         |    0.6 | 0–1            | 双掌彩蛋要求每只手达到的姿势证据分数；彩蛋短暂弱帧暂停确认。                                            |
| `HAND_REENTRY_DELAY`              |    250 | ms             | 首次出现、重新出现或手身份集合变化后的动作禁用时间。                                                    |
| `FRAME_GAP_RESET`                 |    180 | ms             | 检测间隔过长时清除旧手势与运动历史。                                                                    |
| `MOTION_MIN_FRAME_SECONDS`        |   0.01 | s              | 双掌运动速度计算的最小时间间隔。                                                                        |
| `FIST_HOLD_TIME`                  |    600 | ms             | 握拳返回的持续确认时间。                                                                                |
| `SELECT_COOLDOWN`                 |    400 | ms             | 选择后的冷却；也用于阻止双手捏合结束后立即触发双掌彩蛋。                                                |
| `SWIPE_COOLDOWN`                  |    750 | ms             | 左右拨动切换后的冷却。                                                                                  |
| `BACK_COOLDOWN`                   |    700 | ms             | 返回后的冷却。                                                                                          |
| `SPECIAL_COOLDOWN`                |   1000 | ms             | 坍缩／重生触发后的冷却。                                                                                |
| `SWIPE_VELOCITY`                  |   0.85 | 归一化距离/s   | 水平瞬时平滑速度与窗口平均速度都须达到的阈值。                                                          |
| `SWIPE_DISTANCE`                  |   0.14 | 归一化距离     | 拨动最小水平行程；触屏按屏幕宽度归一化。                                                                |
| `SWIPE_WINDOW`                    |    280 | ms             | 拨动轨迹的最长检测窗口。                                                                                |
| `SWIPE_MIN_TIME`                  |     80 | ms             | 拨动最短观察时间，过滤单帧跳点。                                                                        |
| `SWIPE_AXIS_RATIO`                |      2 | 倍             | 水平行程至少是垂直行程的此倍数。                                                                        |
| `TARGET_GRACE_TIME`               |    160 | ms             | 开始捏合时保留刚刚指向的目标，补偿自然指尖移动。                                                        |
| `TARGET_MIN_RADIUS_PX`            |     22 | CSS px         | 天体在屏幕上的最小命中半径，便于瞄准较小的远处星球。                                                    |
| `TARGET_MARGIN_PX`                |     12 | CSS px         | 在天体实际投影半径之外增加的命中余量。                                                                  |
| `WHEEL_ZOOM_SENSITIVITY`          | 0.0006 | 1/deltaY 单位  | 鼠标滚轮缩放增益，比例乘以 `exp(-deltaY × sensitivity)`；越大越敏感。                                   |
| `CURSOR_DEAD_ZONE`                | 0.0025 | 归一化距离     | 位置变化小于此半径时保持光标不动。                                                                      |
| `CURSOR_SMOOTHING_TIME`           |  0.055 | s              | 识别侧位置平滑时间常数；越大越稳但越迟缓。                                                              |
| `CURSOR_RENDER_RESPONSE`          |     18 | 1/s            | 渲染侧光标指数插值响应；越大越快跟上目标。                                                              |
| `DRAG_START_DISTANCE`             |  0.018 | 归一化距离     | 空白处保持捏合后，移动至少此距离才进入拖动。                                                            |
| `DRAG_ROTATION_GAIN`              |      6 | rad/归一化距离 | 水平拖动距离转为太阳系旋转量的增益。                                                                    |
| `DRAG_MAX_SPEED`                  |    2.4 | rad/s          | 拖动旋转速度上限。                                                                                      |
| `DRAG_VELOCITY_RESPONSE`          |     12 | 1/s            | 旋转速度追踪手部速度的指数响应。                                                                        |
| `ROTATION_DAMPING`                |      4 | 1/s            | 松手后旋转速度的指数衰减；越大越快停下。                                                                |
| `ROTATION_STOP_SPEED`             |  0.005 | rad/s          | 惯性速度低于此值时归零。                                                                                |
| `ZOOM_MIN`                        |   0.35 | 倍             | 世界相对原始比例的最小缩放。                                                                            |
| `ZOOM_MAX`                        |   1.75 | 倍             | 世界相对原始比例的最大缩放。                                                                            |
| `ZOOM_RESPONSE`                   |      5 | 1/s            | 渲染缩放追踪目标比例的指数响应。                                                                        |
| `ONE_HAND_ZOOM_HOLD_TIME`         |    180 | ms             | 首次捕获五指撮合后，连续可靠开合确认的时间；允许可信 NONE／OPEN_PALM 中间态继续累计。                   |
| `ONE_HAND_ZOOM_MIN_CONFIDENCE`    |   0.65 | 0–1            | 五指开合几何可信度门槛；首次捕获必须为 FIVE_PINCH，后续可信开合可继续确认。                             |
| `ONE_HAND_ZOOM_CLOSED_APERTURE`   |   0.08 | 掌宽比         | 五指尖 RMS 离散程度对应缩放最小值的闭合端点。                                                           |
| `ONE_HAND_ZOOM_OPEN_APERTURE`     |   0.75 | 掌宽比         | 五指尖 RMS 离散程度对应缩放最大值的张开端点；两端之间线性映射，端点外截断。                             |
| `ONE_HAND_ZOOM_RELEASE_APERTURE`  |   0.92 | 归一化开度 0–1 | 已激活缩放中，原始映射开度达到此值且识别为 OPEN_PALM，才累计张掌结束时间。                              |
| `ONE_HAND_ZOOM_RELEASE_HOLD_TIME` |    450 | ms             | 满足张掌结束条件并持续保持的时间；结束后保留当前大小。                                                  |
| `ONE_HAND_ZOOM_POSE_GRACE_TIME`   |    220 | ms             | 已启动后短暂不可靠几何允许保持占用的时长；期间不更新缩放，超时结束且需释放。                            |
| `ONE_HAND_ZOOM_SMOOTHING_TIME`    |   0.09 | s              | 掌宽归一化开度的指数平滑时间常数，越大越稳但越迟缓。                                                    |
| `COLLAPSE_HOLD_TIME`              |   1000 | ms             | 开始有效靠近后累计的可靠观察时间下限；短暂停顿不累计，触发还须满足近距保持。                            |
| `COLLAPSE_MIN_TRAVEL`             |    0.1 | 归一化距离     | 从初始掌间距至少减少的距离；同时要求双手各自向内移动。                                                  |
| `COLLAPSE_CLOSE_DISTANCE`         |   0.32 | 归一化距离     | 近距保持的绝对间距上限；与初始间距乘相对比例取较大值，避免必须碰掌。                                    |
| `COLLAPSE_MAX_SPEED`              |    1.8 | 归一化距离/s   | 异常跳帧的速度门槛；仅当位移也超过 SPECIAL_MAX_FRAME_TRAVEL 才重新定基线，不单独否决自然快速靠近。      |
| `COLLAPSE_APPROACH_DISTANCE`      |  0.018 | 归一化距离     | 初始间距减少到此量才开始合拢计时，也用于显示重生展开阶段。                                              |
| `COLLAPSE_START_DISTANCE`         |   0.28 | 归一化距离     | 记录坍缩合拢动作时初始双掌间距的下限。                                                                  |
| `COLLAPSE_CLOSE_RATIO`            |   0.62 | 初始间距比     | 近距保持的相对边界：初始间距乘此值，与绝对边界取较大值。                                                |
| `COLLAPSE_CLOSE_HOLD_TIME`        |    200 | ms             | 达到近距边界、总行程与双手内移条件后，需可靠保持的时间；离开近距条件会清零此项计时。                    |
| `SPECIAL_POSE_GRACE_TIME`         |    220 | ms             | 双手仍有有效几何但出现 NONE／低姿势分数时允许短暂停顿的时长；期间不累计进度、不执行动作，超时重新开始。 |
| `SPECIAL_DISTANCE_SMOOTHING_TIME` |   0.08 | s              | 双掌间距的指数平滑时间常数，降低内置摄像头深度与位置噪声影响。                                          |
| `SPECIAL_MAX_FRAME_TRAVEL`        |   0.12 | 归一化距离     | 原始当前掌间距与平滑掌间距差值的异常跳变门槛；还须同时超过速度门槛才重置。                              |
| `COLLAPSE_EACH_HAND_TRAVEL`       |  0.025 | 归一化距离     | 左右两手各自须向中心移动的最小水平距离。                                                                |
| `COLLAPSE_REVERSE_TOLERANCE`      |  0.065 | 归一化距离     | 合拢中相对已到达最小平滑间距允许的反向回退；超出后重新定基线与计时。                                    |
| `REBIRTH_MIN_SPREAD`              |   0.18 | 归一化距离     | 重生须增加的最小双掌间距。                                                                              |
| `REBIRTH_DISTANCE`                |   0.38 | 归一化距离     | 重生触发时双掌须达到的总间距。                                                                          |
| `REBIRTH_MIN_TIME`                |    180 | ms             | 重生动作最短持续时间。                                                                                  |
| `REBIRTH_START_DISTANCE`          |   0.42 | 归一化距离     | 坍缩后开始展开重生时允许的最大初始掌间距，无需重叠双掌。                                                |
| `REBIRTH_EACH_HAND_SPREAD`        |  0.035 | 归一化距离     | 左右两手各自须向外移动的最小水平距离。                                                                  |
| `TOUCH_DRAG_START_PX`             |     10 | CSS px         | 触屏移动超过此距离即不再作为轻点。                                                                      |
| `MOUSE_DRAG_START_PX`             |      6 | CSS px         | 鼠标移动超过此距离即不再作为点击。                                                                      |
| `TOUCH_ZOOM_MIN_DISTANCE_PX`      |     20 | CSS px         | 触屏双指缩放初始间距下限。                                                                              |
| `POINTER_TAP_MAX_TIME`            |    650 | ms             | 鼠标／触屏一次点击或轻点的最长按住时间。                                                                |
| `POINTER_MIN_FRAME_SECONDS`       |  0.008 | s              | 鼠标／触屏拖动速度计算的最小时间间隔。                                                                  |
| `TRIGGER_FEEDBACK_TIME`           |    380 | ms             | 已触发状态与脉冲反馈的显示时长。                                                                        |
| `INFO_REVEAL_DELAY`               |    400 | ms             | 进入行星的镜头动画完成后，资料卡延迟出现的时间。                                                        |
| `CAMERA_FPS`                      |     20 | 次/s           | 摄像头推理频率上限；渲染循环独立运行。                                                                  |
| `CAMERA_DETECTION_CONFIDENCE`     |   0.65 | 0–1            | 传给 MediaPipe 的手检测最低置信度。                                                                     |
| `CAMERA_PRESENCE_CONFIDENCE`      |   0.65 | 0–1            | 传给 MediaPipe 的手存在最低置信度。                                                                     |
| `CAMERA_TRACKING_CONFIDENCE`      |   0.65 | 0–1            | 传给 MediaPipe 的手跟踪最低置信度。                                                                     |

### `src/gesture/recognizerConfig.ts`（48 项）

| 参数                             | 当前值 | 单位                   | 用途                                                                                                                                             |
| -------------------------------- | -----: | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MIN_PALM_WIDTH`                 |  0.015 | 按图像高度归一化的距离 | 宽高比校正后的掌宽下限，拒绝退化关键点并保护比值计算。                                                                                           |
| `FINGER_EXTEND_ANGLE`            |    153 | °                      | 四指伸展的关节角阈值，可由伸展长度条件补充。                                                                                                     |
| `FINGER_EXTEND_REACH`            |    0.9 | 长度比                 | 指根至指尖距离／三段骨长，用于接受自然微弯的手指。                                                                                               |
| `FINGER_EXTEND_WRIST_RATIO`      |   1.08 | 距离比                 | 伸展时指尖至手腕距离／PIP 至手腕距离下限。                                                                                                       |
| `FINGER_RELAXED_REACH`           |    0.8 | 长度比                 | 自然弯指仍算伸展时，指根到指尖距离／三段骨长之和的下限；须同时满足自然弯指角度与离腕比。                                                         |
| `FINGER_RELAXED_ANGLE`           |    115 | °                      | 自然弯指补充通道的关节角下限，与指链伸展率和离腕比联合使用。                                                                                     |
| `FINGER_RELAXED_WRIST_RATIO`     |   1.12 | 距离比                 | 自然弯指补充通道要求的指尖至手腕距离／PIP 至手腕距离下限。                                                                                       |
| `FINGER_SCORE_REACH_START`       |   0.55 | 长度比                 | 指链伸展率映射到证据分数 0 的起点；结果与离腕证据取几何平均。                                                                                    |
| `FINGER_SCORE_REACH_RANGE`       |    0.4 | 长度比                 | 指链伸展率从分数 0 到 1 覆盖的范围，结果截断至 0–1。                                                                                             |
| `FINGER_SCORE_WRIST_START`       |   0.92 | 距离比                 | 指尖至腕／PIP 至腕的比值映射到离腕证据分数 0 的起点。                                                                                            |
| `FINGER_SCORE_WRIST_RANGE`       |   0.35 | 距离比                 | 离腕比从证据分数 0 到 1 覆盖的范围，结果截断至 0–1。                                                                                             |
| `OPEN_FINGER_MIN_SCORE`          |   0.48 | 0–1                    | 宽容张掌通道要求四根手指都达到的最低伸展证据，允许一根较软的小指；真正折叠的指头不能通过。                                                       |
| `OPEN_FINGER_STRONG_SCORE`       |   0.65 | 0–1                    | 宽容张掌通道至少三根手指须达到的较强证据门槛；与四指最低证据同时使用。                                                                           |
| `POINT_FOLDED_MAX_SCORE`         |   0.45 | 0–1                    | Point 除食指外三指各自允许的最高伸展证据，避免整体微弯手掌因单指迟滞而变成指向。                                                                 |
| `FINGER_FOLD_ANGLE`              |    130 | °                      | 角度低于此值且指链伸展率也低于自然弯指下限时退出伸展；离腕比过低可独立退出。                                                                     |
| `FINGER_FOLD_WRIST_RATIO`        |   0.97 | 距离比                 | 指尖回到手腕附近时退出伸展状态的阈值。                                                                                                           |
| `THUMB_EXTEND_ANGLE`             |    150 | °                      | 调试用拇指伸展关节角阈值。                                                                                                                       |
| `THUMB_EXTEND_REACH`             |   0.85 | 长度比                 | 拇指指根至指尖距离／骨链长度下限。                                                                                                               |
| `THUMB_EXTEND_WRIST_RATIO`       |   1.05 | 距离比                 | 拇指尖至手腕距离／上一关节至手腕距离下限。                                                                                                       |
| `FIST_TIP_TO_PALM`               |   0.95 | 掌宽比                 | 四指弯曲且食指尖靠近掌心时识别为握拳。                                                                                                           |
| `PINCH_TIP_TO_PALM`              |   0.65 | 掌宽比                 | 普通捏合通道的食指尖离掌心距离条件之一；紧凑对捏另用掌内对向位移和伸出距离判断。                                                                 |
| `PINCH_OPPOSITION_MIN`           |   0.18 | 掌宽比                 | 食指尖相对食指根沿掌内拇指方向投影的下限，用于识别紧凑对捏并区分握拳中的指尖重叠。                                                               |
| `PINCH_INDEX_REACH_MIN`          |   0.45 | 掌宽比                 | 紧凑对捏通道的食指根到指尖距离下限；同时要求拇指方向对向位移和拇食指接触。                                                                       |
| `PINCH_STRENGTH_START`           |    0.2 | 掌宽比                 | 连续捏合强度线性映射的满强度起点。                                                                                                               |
| `PINCH_STRENGTH_RANGE`           |   0.45 | 掌宽比                 | 连续捏合强度由满到零的距离范围。                                                                                                                 |
| `FIVE_PINCH_APERTURE_MAX`        |   0.22 | 掌宽比                 | 五指尖相对共同中心的 RMS 离散程度上限，用于确认五指聚拢。                                                                                        |
| `FIVE_PINCH_RADIUS_MAX`          |   0.38 | 掌宽比                 | 任意一个指尖离五指尖中心的最大距离，避免一根散开的手指被均值掩盖。                                                                               |
| `GRIP_CENTER_FORWARD_MIN`        |   0.25 | 掌宽比                 | 纵向撮合通道中，五指尖中心相对四指根中心、沿手腕至指根方向的前伸投影下限；掌面法线通道不使用此门槛。                                             |
| `GRIP_CENTER_TO_PALM_MIN`        |    0.8 | 掌宽比                 | 纵向撮合通道中，五指尖中心到掌心的距离下限，与纵向前伸和离腕比共同判断。                                                                         |
| `GRIP_FINGER_WRIST_MIN`          |   0.94 | 距离比                 | 纵向撮合通道要求四指中最小的指尖至腕／PIP 至腕距离比；不约束朝掌面法线聚拢的姿势。                                                               |
| `GRIP_FINGER_WRIST_STRONG`       |   1.02 | 距离比                 | 纵向撮合通道中，一根手指计入较强离腕证据所需的距离比门槛，与参与手指数联合判断。                                                                 |
| `GRIP_FINGER_COUNT`              |      3 | 根                     | 纵向撮合通道中，四指至少达到较强离腕比门槛的数量。                                                                                               |
| `GRIP_THUMB_INDEX_SPREAD_MIN`    |    0.5 | 比值                   | 连续开合中拇食指距离／五指 RMS 开度的下限；避免普通双指捏合占用五指开合通道。                                                                    |
| `GRIP_NORMAL_REACH_MIN`          |    0.4 | 掌宽比                 | 掌面法线撮合通道要求的组合伸出距离：正向纵向投影与法线投影平方和的平方根；须同时满足其他法线分支条件。                                           |
| `GRIP_NORMAL_PALM_DISTANCE_MIN`  |    0.5 | 掌宽比                 | 掌面法线撮合通道中，五指尖中心到掌心的距离下限；区分抬离掌面的聚拢与卷进掌心。                                                                   |
| `GRIP_NORMAL_FORWARD_MIN`        |  -0.35 | 掌宽比                 | 掌面法线撮合通道允许的最小纵向投影；负值允许五指尖中心适度落在指根后方，仍须满足离掌面高度等证据。                                               |
| `GRIP_EACH_TIP_NORMAL_MIN`       |    0.2 | 掌宽比                 | 掌面法线撮合通道中，每个指尖相对四指根中心的掌面法线投影下限；五个指尖必须位于共同中心所在的同一侧。                                             |
| `GRIP_NORMAL_CURL_MEAN_MIN`      |     70 | °                      | 掌面法线通道接受连续开合中间态时，四指 MCP–PIP–指尖角的平均值下限；用于区分逐渐展开与握拳卷曲，不是紧密撮合的额外条件。                          |
| `GRIP_UNFOLD_FORWARD_MIN`        |   0.05 | 掌宽比                 | 掌面法线通道接受连续开合中间态时，五指尖中心沿手腕至指根方向的最小前伸投影；与平均手指角度共同排除指根强弯的拳头，紧密 FIVE_PINCH 不使用此条件。 |
| `PALM_FACING_NORMAL`             |   0.65 | 0–1                    | 调试用掌面法线与相机方向夹角余弦绝对值门槛；不是使用手势必须正对镜头的门槛。                                                                     |
| `VELOCITY_SMOOTHING_TIME`        |  0.095 | s                      | 掌心速度的指数平滑时间常数。                                                                                                                     |
| `MIN_FRAME_SECONDS`              |   0.01 | s                      | 几何速度和滤波计算的最小帧间隔。                                                                                                                 |
| `MAX_FRAME_SECONDS`              |    0.1 | s                      | 几何滤波与身份位置预测的最大帧间隔。                                                                                                             |
| `IDENTITY_MAX_STEP_SCREEN`       |   0.35 | 归一化距离             | 连续两帧同一手允许的最大位移，也作为新身份匹配代价。                                                                                             |
| `IDENTITY_AMBIGUITY_SCREEN`      |  0.025 | 归一化距离代价         | 双手两种匹配的总成本过于接近时，放弃猜测并重新等待就绪。                                                                                         |
| `IDENTITY_UNKNOWN_PENALTY`       |   0.04 | 归一化距离代价         | 已知与未知左右手标签匹配时的附加代价；不降低姿势分数。                                                                                           |
| `IDENTITY_HANDEDNESS_CONFIDENCE` |    0.7 | 0–1                    | 左右手标签可参与可靠匹配的分数下限；低分或无效标签视为 Unknown，保留有效关键点和位置跟踪。                                                       |
| `IDENTITY_MISMATCH_PENALTY`      |   0.08 | 归一化距离代价         | 检测标签与已有左右手标签冲突时的额外匹配成本；不是硬拒绝，单帧分类翻转可保持空间连续的身份。                                                     |

**三种信息独立处理：**`confidence` 是姿势几何证据；`trackingConfidence` 是有效几何标记，当前有效的 21 关键点输出 1，它不是 MediaPipe 真实跟踪分数；`handedness.score` 只表示左右手分类把握。MediaPipe 的检测、存在和跟踪门槛在模型内部执行，模型没有向本应用返回逐手跟踪分数。左右手标签分数低、瞬时标签翻转或姿势分数不足都不会单独删除有效的手身份；各动作分别检查自身证据；五指撮合已捕获后，具有可靠开合几何的 `NONE` 中间态可继续缩放确认。调试分数不代表经过真人统计的识别准确率。

摄像头请求为理想 640×480、理想及最大 30fps，实际能力由设备决定；模型推理仍最多 20Hz。预览复用同一视频和已计算骨架，最多约 20Hz 绘制，不启动第二路摄像头或第二个模型。

## 5. 当前 Gesture Priority

先检查重入锁、有效几何、场景锁和动作冷却，再按顺序仲裁；每种动作单独检查姿势证据，每一帧至多一个动作占用输入。

| 优先级 | 动作                               | 限制                                                                               |
| -----: | ---------------------------------- | ---------------------------------------------------------------------------------- |
|      1 | 双掌特殊效果 `COLLAPSE`／`REBIRTH` | 仅总览合拢／坍缩后展开；满足双手姿势、行程、时间与近距保持，弱姿势短暂停顿不累计。 |
|      2 | 单手 `ONE_HAND_ZOOM`               | 五指撮合捕获后连续开合确认；确认及运行期间禁止同时选择、拖动、返回或拨动。         |
|      3 | 单手 `PINCH_DRAG`                  | 总览空白处开始，保持并移动超过拖动门槛。                                           |
|      4 | `PINCH_SELECT`                     | 捏合开始时捕获目标；一个捏合只确认一次。                                           |
|      5 | `FIST_BACK`                        | 二级场景持续握拳；可取消，触发后需先松开。                                         |
|      6 | `SWIPE`                            | 仅行星聚焦、单手张掌；同时满足方向、速度、行程、时间窗口。                         |
|      7 | `POINT` Hover                      | 只更新位置与目标；不触发导航。                                                     |

## 6. 开启 Debug 与重看教程

线上：[打开 Gesture Debug](https://alzat007.github.io/solaris/?debugGesture=true)。本地：`http://localhost:5173/?debugGesture=true`。已有查询参数时追加 `&debugGesture=true`。普通地址默认隐藏调试面板，旧的 `debug=true` 仍兼容。

面板包含左右手与数量、`Pose Evidence Score`、`Hand Geometry: VALID / WEAK`、中英对应的当前几何姿势、仲裁后的 Action、Pinch 阶段／距离、五指缩放状态／启动进度、平滑归一化开度和当前倍数、掌心位置、五指状态、Gesture State、App State、重入就绪状态、Gesture Lock、是否必须松手、剩余冷却、目标、三个确认进度、`Special Stage` 和渲染 FPS。姿势证据分数与有效几何分开；分数用于动作判定，不是经过真人统计的识别准确率。

正常页面开启摄像头后也会显示小型 **镜像预览**，叠加手部骨架，五个指尖单独高亮，识别为 `FIVE_PINCH` 时骨架和指尖变为暖色。它只读取本机已运行的视频；可手动收起，打开帮助或资料卡时自动收起，不录像、不上传。收起后可以点击「查看手部骨架」重新展开。用预览确认手掌和五个指尖完整在画面内、有足够正面光照，并在底部查看已识别手数、当前姿势和确认进度；「五指聚拢」「双指捏合」「握拳」对应不同的识别结果。

教程使用 `localStorage` 的 `solarisGestureTutorialCompleted`。需要重新体验时，在该站点浏览器控制台执行以下操作后刷新：

```js
localStorage.removeItem("solarisGestureTutorialCompleted");
location.reload();
```

首次检测到手后逐步提示 Point、Pinch、Swipe、Fist。拨动提示停留 3 秒后可继续提示返回；只有实际完成返回动作才保存教程完成。若先进入太阳，直接教握拳返回。

## 7. 最值得后续手动调整的参数

按体验问题调参，每次只改一组，使用同一台摄像头和相同光照比较：

1. **捏合难确认或容易误触**：先看 `PINCH_START_THRESHOLD`、`PINCH_RELEASE_THRESHOLD`、`PINCH_HOLD_TIME`。开始阈值调大会更容易确认；保持时间调长会更稳。始终保留「释放阈值大于开始阈值」的迟滞间隔。
2. **光标抖动或跟手迟缓**：调 `CURSOR_DEAD_ZONE`、`CURSOR_SMOOTHING_TIME`、`CURSOR_RENDER_RESPONSE`。先消除静止微抖，再调追踪响应；不要靠扩大目标来掩盖明显抖动。
3. **小星球难命中或捏合时丢失原目标**：调 `TARGET_MIN_RADIUS_PX`、`TARGET_MARGIN_PX` 与 `TARGET_GRACE_TIME`。前两项控制屏幕命中范围，范围过大会增加相邻目标重叠；后一项过短会漏选，过长可能选择刚离开的目标。应同时查看 Debug 的 Target。
4. **拖动太敏感或太迟钝**：调 `DRAG_START_DISTANCE`、`DRAG_ROTATION_GAIN`、`DRAG_MAX_SPEED`；松手后旋转太久则增加 `ROTATION_DAMPING`。
5. **握拳太慢或随意弯手就返回**：调 `FIST_HOLD_TIME`，保留进度环与中途松开取消。
6. **拨动切换太难或太容易**：联合调整 `SWIPE_VELOCITY`、`SWIPE_DISTANCE`、`SWIPE_WINDOW` 和 `SWIPE_COOLDOWN`，保留「仅行星聚焦且张掌」的场景条件。
7. **手重入立即操作／身份不稳**：先看镜像预览、`Hand Geometry` 与 `Readiness`。有效骨架下的姿势弱只应影响动作，不应反复进入重连；左右手标签低分也不等于手丢失。确认真实遮挡后再调 `HAND_REENTRY_DELAY` 和身份匹配参数，不通过降低模型门槛掩盖坏几何。
8. **五指缩放难启动或响应不适合设备**：先看底部当前姿势，再展开镜像骨架确认五个指尖都被定位；朝向镜头的撮合也属于有效方向。Debug 的 `Current Gesture` 显示几何分类，`Five-Finger Zoom` 和 `Zoom Aperture` 显示动作确认与缩放开度，不能把尚未启动的缩放进度当作指尖聚合程度。代码侧可进一步检查原始 `gripAperture`／`gripConfidence`；这两个原始字段未直接显示在当前 Debug 面板中。行为层先调 `ONE_HAND_ZOOM_HOLD_TIME`、`ONE_HAND_ZOOM_CLOSED_APERTURE`、`ONE_HAND_ZOOM_OPEN_APERTURE` 与 `ONE_HAND_ZOOM_SMOOTHING_TIME`；需要调整张掌结束时间则改 `ONE_HAND_ZOOM_RELEASE_HOLD_TIME`。`ZOOM_MIN`、`ZOOM_MAX`、`ZOOM_RESPONSE` 控制范围与渲染响应。鼠标滚轮单独调 `WHEEL_ZOOM_SENSITIVITY`。
9. **彩蛋动作费力或意外触发**：先看 `Special Stage`，`APPROACH` 长时间不到 `HOLD` 时检查 `COLLAPSE_CLOSE_RATIO`、`COLLAPSE_CLOSE_DISTANCE` 与双手行程；频繁 `PAUSED` 先改善可见性，再考虑 `SPECIAL_POSE_GRACE_TIME`。需要更多确认时间则调 `COLLAPSE_HOLD_TIME`／`COLLAPSE_CLOSE_HOLD_TIME`。`COLLAPSE_MAX_SPEED` 只和异常单帧行程联合排除跳变，不能当作一般慢动作灵敏度旋钮。
10. **张掌或紧凑捏合不符合自然手型**：观察五指伸展证据与掌内对向位移，再调 `FINGER_RELAXED_*`、`OPEN_FINGER_*`、`PINCH_OPPOSITION_MIN`、`PINCH_INDEX_REACH_MIN`；同时复核拳头接触和 V／THREE 不触发动作，避免只提高单一正例的通过率。

11. **五指撮合被当成握拳／双指捏合**：观察镜像骨架并复核原始五指尖分布，先区分沿手掌纵向伸出的撮合与离开掌面、朝向镜头的撮合。前者使用纵向前伸和离腕证据，后者在紧密撮合时使用掌面法线方向的距离，中间开合态再检查前伸与平均手指角度；无需让两种方向同时满足全部门槛。再按对应分支调整 `FIVE_PINCH_*` 和 `GRIP_*`，每次同时复核普通握拳、双指捏合、V／三指和单根手指未聚拢的反例。

现成方案、许可证与可采用思路见 [GESTURE_RESEARCH.md](GESTURE_RESEARCH.md)。本轮保留现有 MediaPipe Hand Landmarker，在其 21 关键点上独立改进几何判定，没有直接接入研究仓库的代码或训练模型。

几何角度和掌宽归一化参数属于第二层调试入口；先观察 Debug 里的指头状态、捏合距离与关键点，再决定是否需要修改。鼠标和触屏继续可用，摄像头是交互增强入口。
