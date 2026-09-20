# SOLARIS Gesture System V2

网站：[SOLARIS · 掌中星系](https://alzat007.github.io/solaris/)。核心手势语言：**指、捏、拖、拨、握**。

本版重构摄像头识别、交互状态与反馈，沿用现有太阳系模型、品牌界面、太阳内部与粒子视觉。太阳和行星统一用「指向 → 捏合 → 进入」。

## 1. 修改的文件与职责

| 文件                                                                                                                               | 职责                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/gesture/HandTrackingManager.ts`                                                                                               | 相机权限与释放、本站 MediaPipe 加载、20Hz 推理；丢帧或冻结视频向状态机报告空手。       |
| `src/gesture/HandIdentityTracker.ts`                                                                                               | 利用左右手标签与二维位置预测维持身份；处理检测重排、交叉、丢失、低置信度及无效关键点。 |
| `src/gesture/GestureRecognizer.ts`、`GestureTypes.ts`、`recognizerConfig.ts`                                                       | 21 关键点几何特征、指针平滑与防抖、捏合中点、五指伸展状态和几何参数。                  |
| `src/gesture/GestureStateMachine.ts`                                                                                               | 每只手独立的 Pinch 生命周期及可取消的持续动作确认。                                    |
| `src/gesture/GestureController.ts`                                                                                                 | 重入锁、场景锁、动作冷却、优先级、目标捕获以及互斥选择／拖动／缩放。                   |
| `src/gesture/GestureMotion.ts`                                                                                                     | 有时间窗口、速度与距离条件的拨动；双掌坍缩／重生识别。                                 |
| `src/gesture/gestureConfig.ts`                                                                                                     | 集中维护行为阈值、识别频率和输入响应参数。                                             |
| `src/gesture/gestureTargets.ts`、`gestureFeedback.ts`                                                                              | 统一天体／HUD 目标，发布 Armed、进度、触发、锁和 Debug 数据。                          |
| `src/gesture/GestureCursor.tsx`、`GestureTutorial.tsx`、`GestureDebug.tsx`                                                         | 光标与确认反馈、渐进教程、本地完成记录、查询参数开启的调试面板。                       |
| `src/interaction/InteractionStateMachine.ts`、`InteractionController.ts`、`store.ts`                                               | 场景状态、镜头期间互斥、统一太阳选择、返回、缩放与自动显示行星资料。                   |
| `src/interaction/rotation.ts`                                                                                                      | 鼠标与手势共享的旋转速度上限、平滑和松手阻尼。                                         |
| `src/scene/InputField.tsx`、`PointerFallback.ts`、`planetPicking.ts`                                                               | 渲染侧光标插值、天体／HUD 命中、鼠标与触屏输入序列；拖动／缩放不会在松手时变为点击。   |
| `src/scene/SolarSystem.tsx`、`OrbitSystem.tsx`                                                                                     | 将统一旋转、缩放响应及轻量拖动反馈接入现有场景。                                       |
| `src/planets/PlanetBase.tsx`、`Sun.tsx`                                                                                            | 行星和太阳一致的命中／选择入口与目标反馈。                                             |
| `src/particles/ParticleEngine.ts`、`ParticleField.tsx`                                                                             | 保存交互参数，提供触发脉冲和与操作对应的粒子响应。                                     |
| `src/ui/HUD.tsx`、`HandFeedback.tsx`、`GestureHint.tsx`、`PlanetInfo.tsx`、`DebugHands.tsx`、`chinese.ts`、`styles.css`            | 中文教学、极简状态提示、资料卡与调试画面的 V2 整合。                                   |
| `src/app/App.tsx`                                                                                                                  | 按 URL 参数加载 Gesture Debug。                                                        |
| `tests/recognizer.test.ts`、`hand-identity.test.ts`、`pinch-state.test.ts`、`routing.test.ts`                                      | 识别几何、稳定身份、Pinch 生命周期和场景动作路由的回归用例。                           |
| `tests/interaction.test.ts`、`picking.test.ts`、`scene-controls.test.ts`、`fallback.test.ts`、`gesture-lab.ts`、`gesture-lab.html` | 场景状态、命中、输入互斥与合成关键点回放。                                             |
| `README.md`、`GESTURE_SYSTEM_V2.md`                                                                                                | 运行说明、操作语言、阈值和调试说明。                                                   |

识别层只产生特征；确认和互斥交给状态机。推理与渲染分离，识别器复用临时关键点／数值缓冲，渲染循环继续插值光标与场景参数。

## 2. 删除的旧手势与替代逻辑

| 旧行为                                  | V2 行为                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| 三指查看／收起资料                      | 不再是命令；进入行星的镜头动画完成后 400ms 自动显示资料。 |
| ✌ V 手势返回                           | 不再是命令；握拳持续 600ms，返回进度满后执行。            |
| 双手快速张开进入太阳内部                | 删除导航作用；太阳通过 Point + Pinch 进入。               |
| 以双掌间距直接缩放                      | 两只手都进入 `PINCH_HOLD` 后，才根据捏合中点距离缩放。    |
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

捏合开始时捕获目标或空白区域：目标捏合确认后选择；空白捏合保持并移动后拖动。一次手势不能在选择和拖动之间反复切换。双手缩放会占用两只手的捏合序列。

### 可见反馈与就绪状态

| 状态                | 用户看到的含义                                  |
| ------------------- | ----------------------------------------------- |
| `NO_HAND`           | 未检测到手，不显示手势光标。                    |
| `HAND_VISIBLE`      | 已检测到手，出现轻光圈。                        |
| `TARGET_HOVER`      | 命中天体或可操作 HUD，显示高亮与目标名称。      |
| `GESTURE_ARMED`     | 捏合、握拳或彩蛋正在确认；显示收缩／进度反馈。  |
| `GESTURE_TRIGGERED` | 动作已触发，短暂脉冲反馈。                      |
| `RECONNECTING`      | 手重新出现后的 250ms 只允许位置跟踪；禁止动作。 |
| `READY`             | 重入等待结束且置信度满足要求。                  |

`readiness` 与可见反馈独立：看见手或命中目标不意味着动作已解锁。动作通道还区分 `NONE`、`POINT`、`PINCH_SELECT`、`PINCH_DRAG`、`TWO_HAND_ZOOM`、`FIST_BACK`、`SWIPE`、`COLLAPSE`、`REBIRTH`。

### App State

沿用已有内部场景名，避免更改场景模型。Debug 同时显示语义场景和内部状态。

| 语义状态       | 内部状态／阶段                                                                 | 允许的核心操作                                                        |
| -------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `OVERVIEW`     | `SOLAR_SYSTEM`、兼容 `POINTER`                                                 | Point、Pinch Select、空白 Pinch Drag、双手 Pinch Zoom、双掌坍缩。     |
| `PLANET_FOCUS` | `PLANET_FOCUS`、`INFO`                                                         | Point、选择、张掌左右拨动、Fist Back、双手 Pinch Zoom；资料自动显示。 |
| 缩放进行中     | `UNIVERSE_SCALE`                                                               | 双手缩放独占；结束后回到缩放前的总览／行星状态。                      |
| 太阳飞入阶段   | `SUN_FOCUS`                                                                    | 作为进入太阳的动画阶段，全程锁定，不需要再捏第二次。                  |
| `SUN_INTERIOR` | `SUN_INTERIOR`                                                                 | Fist Back，返回外部太阳系。                                           |
| `COLLAPSE`     | `COLLAPSE`                                                                     | 坍缩动画期间锁定；核心形成后允许双掌重生或 Fist Back。                |
| `TRANSITION`   | `INTRO`、`PLANET_TRANSITION`、`SUN_FOCUS`、`TRANSITION`、`BIG_BANG` 及坍缩动画 | 禁止新的手势操作；等待动画完成。                                      |

所有已解锁的场景都可以通过 Point + Pinch 点击当前可用的 HUD 按钮，包括太阳内部和坍缩完成后的状态；天体选择仍限制在总览与行星聚焦场景。

冷却与场景锁共同生效：冷却结束也不会提前打断镜头动画。任意手丢失、数据无效或身份变化会结束拖动／缩放，重新经过就绪门槛。

## 4. 当前全部配置阈值

以下列出两份配置文件的全部 80 个字段（58 + 22），值以源码为准。`ms` 是毫秒，`s` 是秒；屏幕坐标为镜像后的 0–1 归一化坐标，二维距离不是像素。掌宽比为经过宽高比校正的三维距离除以掌宽。指数响应采用 `1 - exp(-dt × response)`，时间常数采用 `1 - exp(-dt / time)`，两者调节方向相反。

### `src/gesture/gestureConfig.ts`（58 项）

| 参数                            | 当前值 | 单位           | 用途                                                                  |
| ------------------------------- | -----: | -------------- | --------------------------------------------------------------------- |
| `PINCH_START_THRESHOLD`         |   0.28 | 掌宽比         | 拇指与食指距离小于此值时开始 Pinch。                                  |
| `PINCH_RELEASE_THRESHOLD`       |   0.43 | 掌宽比         | 距离大于此值才释放；必须大于开始阈值。                                |
| `PINCH_HOLD_TIME`               |    140 | ms             | 连续捏合确认时长，完成后进入 PINCH_HOLD。                             |
| `MIN_CONFIDENCE`                |   0.55 | 0–1            | 单手动作最低置信度；低于此值重新等待就绪。                            |
| `TWO_HAND_MIN_CONFIDENCE`       |    0.6 | 0–1            | 双手动作要求两只手均达到的置信度。                                    |
| `HAND_REENTRY_DELAY`            |    250 | ms             | 首次出现、重新出现或手身份集合变化后的动作禁用时间。                  |
| `FRAME_GAP_RESET`               |    180 | ms             | 检测间隔过长时清除旧手势与运动历史。                                  |
| `MOTION_MIN_FRAME_SECONDS`      |   0.01 | s              | 双掌运动速度计算的最小时间间隔。                                      |
| `FIST_HOLD_TIME`                |    600 | ms             | 握拳返回的持续确认时间。                                              |
| `SELECT_COOLDOWN`               |    400 | ms             | 选择后的冷却，也隔离双手缩放结束后的彩蛋动作。                        |
| `SWIPE_COOLDOWN`                |    750 | ms             | 左右拨动切换后的冷却。                                                |
| `BACK_COOLDOWN`                 |    700 | ms             | 返回后的冷却。                                                        |
| `SPECIAL_COOLDOWN`              |   1000 | ms             | 坍缩／重生触发后的冷却。                                              |
| `SWIPE_VELOCITY`                |   0.85 | 归一化距离/s   | 水平瞬时平滑速度与窗口平均速度都须达到的阈值。                        |
| `SWIPE_DISTANCE`                |   0.14 | 归一化距离     | 拨动最小水平行程；触屏按屏幕宽度归一化。                              |
| `SWIPE_WINDOW`                  |    280 | ms             | 拨动轨迹的最长检测窗口。                                              |
| `SWIPE_MIN_TIME`                |     80 | ms             | 拨动最短观察时间，过滤单帧跳点。                                      |
| `SWIPE_AXIS_RATIO`              |      2 | 倍             | 水平行程至少是垂直行程的此倍数。                                      |
| `TARGET_GRACE_TIME`             |    160 | ms             | 开始捏合时保留刚刚指向的目标，补偿自然指尖移动。                      |
| `TARGET_MIN_RADIUS_PX`          |     22 | CSS px         | 天体在屏幕上的最小命中半径，便于瞄准较小的远处星球。                  |
| `TARGET_MARGIN_PX`              |     12 | CSS px         | 在天体实际投影半径之外增加的命中余量。                                |
| `WHEEL_ZOOM_SENSITIVITY`        | 0.0006 | 1/deltaY 单位  | 鼠标滚轮缩放增益，比例乘以 `exp(-deltaY × sensitivity)`；越大越敏感。 |
| `CURSOR_DEAD_ZONE`              | 0.0025 | 归一化距离     | 位置变化小于此半径时保持光标不动。                                    |
| `CURSOR_SMOOTHING_TIME`         |  0.055 | s              | 识别侧位置平滑时间常数；越大越稳但越迟缓。                            |
| `CURSOR_RENDER_RESPONSE`        |     18 | 1/s            | 渲染侧光标指数插值响应；越大越快跟上目标。                            |
| `DRAG_START_DISTANCE`           |  0.018 | 归一化距离     | 空白处保持捏合后，移动至少此距离才进入拖动。                          |
| `DRAG_ROTATION_GAIN`            |      6 | rad/归一化距离 | 水平拖动距离转为太阳系旋转量的增益。                                  |
| `DRAG_MAX_SPEED`                |    2.4 | rad/s          | 拖动旋转速度上限。                                                    |
| `DRAG_VELOCITY_RESPONSE`        |     12 | 1/s            | 旋转速度追踪手部速度的指数响应。                                      |
| `ROTATION_DAMPING`              |      4 | 1/s            | 松手后旋转速度的指数衰减；越大越快停下。                              |
| `ROTATION_STOP_SPEED`           |  0.005 | rad/s          | 惯性速度低于此值时归零。                                              |
| `ZOOM_MIN`                      |   0.35 | 倍             | 世界相对原始比例的最小缩放。                                          |
| `ZOOM_MAX`                      |   1.75 | 倍             | 世界相对原始比例的最大缩放。                                          |
| `ZOOM_MIN_DISTANCE`             |   0.08 | 归一化距离     | 双捏合初始间距的下限，避免除以接近零的距离。                          |
| `ZOOM_RESPONSE`                 |      5 | 1/s            | 渲染缩放追踪目标比例的指数响应。                                      |
| `COLLAPSE_HOLD_TIME`            |   1000 | ms             | 双掌缓慢合拢须持续的时间。                                            |
| `COLLAPSE_MIN_TRAVEL`           |   0.12 | 归一化距离     | 合拢须减少的最小双掌间距。                                            |
| `COLLAPSE_CLOSE_DISTANCE`       |   0.24 | 归一化距离     | 坍缩触发时允许的最大双掌间距。                                        |
| `COLLAPSE_MAX_SPEED`            |   0.65 | 归一化距离/s   | 合拢最大速度；过快闭合不触发彩蛋。                                    |
| `COLLAPSE_APPROACH_MIN_SPEED`   |  0.015 | 归一化距离/s   | 开始记录持续合拢的最小靠近速度。                                      |
| `COLLAPSE_EACH_HAND_TRAVEL`     |  0.025 | 归一化距离     | 左右两手各自须向中心移动的最小水平距离。                              |
| `COLLAPSE_REVERSE_TOLERANCE`    |  0.025 | 归一化距离     | 合拢途中允许的反向间距抖动，超过则重新计时。                          |
| `REBIRTH_MIN_SPREAD`            |   0.18 | 归一化距离     | 重生须增加的最小双掌间距。                                            |
| `REBIRTH_DISTANCE`              |   0.38 | 归一化距离     | 重生触发时双掌须达到的总间距。                                        |
| `REBIRTH_MIN_TIME`              |    180 | ms             | 重生动作最短持续时间。                                                |
| `REBIRTH_START_DISTANCE_MARGIN` |   0.04 | 归一化距离     | 重生起始间距可比坍缩合拢阈值多出的余量。                              |
| `REBIRTH_EACH_HAND_SPREAD`      |  0.035 | 归一化距离     | 左右两手各自须向外移动的最小水平距离。                                |
| `TOUCH_DRAG_START_PX`           |     10 | CSS px         | 触屏移动超过此距离即不再作为轻点。                                    |
| `MOUSE_DRAG_START_PX`           |      6 | CSS px         | 鼠标移动超过此距离即不再作为点击。                                    |
| `TOUCH_ZOOM_MIN_DISTANCE_PX`    |     20 | CSS px         | 触屏双指缩放初始间距下限。                                            |
| `POINTER_TAP_MAX_TIME`          |    650 | ms             | 鼠标／触屏一次点击或轻点的最长按住时间。                              |
| `POINTER_MIN_FRAME_SECONDS`     |  0.008 | s              | 鼠标／触屏拖动速度计算的最小时间间隔。                                |
| `TRIGGER_FEEDBACK_TIME`         |    380 | ms             | 已触发状态与脉冲反馈的显示时长。                                      |
| `INFO_REVEAL_DELAY`             |    400 | ms             | 进入行星的镜头动画完成后，资料卡延迟出现的时间。                      |
| `CAMERA_FPS`                    |     20 | 次/s           | 摄像头推理频率上限；渲染循环独立运行。                                |
| `CAMERA_DETECTION_CONFIDENCE`   |   0.65 | 0–1            | 传给 MediaPipe 的手检测最低置信度。                                   |
| `CAMERA_PRESENCE_CONFIDENCE`    |   0.65 | 0–1            | 传给 MediaPipe 的手存在最低置信度。                                   |
| `CAMERA_TRACKING_CONFIDENCE`    |   0.65 | 0–1            | 传给 MediaPipe 的手跟踪最低置信度。                                   |

### `src/gesture/recognizerConfig.ts`（22 项）

| 参数                        | 当前值 | 单位                   | 用途                                                     |
| --------------------------- | -----: | ---------------------- | -------------------------------------------------------- |
| `MIN_PALM_WIDTH`            |  0.015 | 按图像高度归一化的距离 | 宽高比校正后的掌宽下限，拒绝退化关键点并保护比值计算。   |
| `FINGER_EXTEND_ANGLE`       |    153 | °                      | 四指伸展的关节角阈值，可由伸展长度条件补充。             |
| `FINGER_EXTEND_REACH`       |    0.9 | 长度比                 | 指根至指尖距离／三段骨长，用于接受自然微弯的手指。       |
| `FINGER_EXTEND_WRIST_RATIO` |   1.08 | 距离比                 | 伸展时指尖至手腕距离／PIP 至手腕距离下限。               |
| `FINGER_FOLD_ANGLE`         |    130 | °                      | 关节角低于此值时退出伸展状态。                           |
| `FINGER_FOLD_WRIST_RATIO`   |   0.97 | 距离比                 | 指尖回到手腕附近时退出伸展状态的阈值。                   |
| `FINGER_SCORE_MIN_ANGLE`    |    100 | °                      | 手指伸展分数线性映射的起点。                             |
| `FINGER_SCORE_ANGLE_RANGE`  |     65 | °                      | 伸展分数从 0 到 1 覆盖的角度范围。                       |
| `THUMB_EXTEND_ANGLE`        |    150 | °                      | 调试用拇指伸展关节角阈值。                               |
| `THUMB_EXTEND_REACH`        |   0.85 | 长度比                 | 拇指指根至指尖距离／骨链长度下限。                       |
| `THUMB_EXTEND_WRIST_RATIO`  |   1.05 | 距离比                 | 拇指尖至手腕距离／上一关节至手腕距离下限。               |
| `FIST_TIP_TO_PALM`          |   0.95 | 掌宽比                 | 四指弯曲且食指尖靠近掌心时识别为握拳。                   |
| `PINCH_TIP_TO_PALM`         |   0.65 | 掌宽比                 | 自然捏合的位置条件之一，用于区分拇指重叠的拳头。         |
| `PINCH_STRENGTH_START`      |    0.2 | 掌宽比                 | 连续捏合强度线性映射的满强度起点。                       |
| `PINCH_STRENGTH_RANGE`      |   0.45 | 掌宽比                 | 连续捏合强度由满到零的距离范围。                         |
| `PALM_FACING_NORMAL`        |   0.65 | 0–1                    | 掌面法线与相机方向夹角余弦绝对值的阈值。                 |
| `VELOCITY_SMOOTHING_TIME`   |  0.095 | s                      | 掌心速度的指数平滑时间常数。                             |
| `MIN_FRAME_SECONDS`         |   0.01 | s                      | 几何速度和滤波计算的最小帧间隔。                         |
| `MAX_FRAME_SECONDS`         |    0.1 | s                      | 几何滤波与身份位置预测的最大帧间隔。                     |
| `IDENTITY_MAX_STEP_SCREEN`  |   0.35 | 归一化距离             | 连续两帧同一手允许的最大位移，也作为新身份匹配代价。     |
| `IDENTITY_AMBIGUITY_SCREEN` |  0.025 | 归一化距离代价         | 双手两种匹配的总成本过于接近时，放弃猜测并重新等待就绪。 |
| `IDENTITY_UNKNOWN_PENALTY`  |   0.04 | 归一化距离代价         | 身份标签从已知变为未知等情况下的额外匹配代价。           |

几何分数与模型置信度是不同信息。MediaPipe 的检测、手存在、跟踪置信阈值由模型内部执行；返回的 `handedness.score` 表示左右手分类置信度。当前动作置信度结合几何分数与该分类分数，不能把 Debug 中的百分数当成经过统计验证的识别准确率。

## 5. 当前 Gesture Priority

先检查重入锁、最低置信度、场景锁和动作冷却，再按顺序仲裁；每一帧至多一个动作占用输入。

| 优先级 | 动作                               | 限制                                                       |
| -----: | ---------------------------------- | ---------------------------------------------------------- |
|      1 | 双掌特殊效果 `COLLAPSE`／`REBIRTH` | 仅总览合拢／坍缩后展开；须满足双手置信度、行程与持续时间。 |
|      2 | 双手 `TWO_HAND_ZOOM`               | 两只手均为 `PINCH_HOLD`；禁止同时选择、拖动或拨动。        |
|      3 | 单手 `PINCH_DRAG`                  | 总览空白处开始，保持并移动超过拖动门槛。                   |
|      4 | `PINCH_SELECT`                     | 捏合开始时捕获目标；一个捏合只确认一次。                   |
|      5 | `FIST_BACK`                        | 二级场景持续握拳；可取消，触发后需先松开。                 |
|      6 | `SWIPE`                            | 仅行星聚焦、单手张掌；同时满足方向、速度、行程、时间窗口。 |
|      7 | `POINT` Hover                      | 只更新位置与目标；不触发导航。                             |

## 6. 开启 Debug 与重看教程

线上：[打开 Gesture Debug](https://alzat007.github.io/solaris/?debugGesture=true)。本地：`http://localhost:5173/?debugGesture=true`。已有查询参数时追加 `&debugGesture=true`。普通地址默认隐藏调试面板，旧的 `debug=true` 仍兼容。

面板包含左右手与数量、置信度、当前几何姿势、仲裁后的 Action、Pinch 阶段／距离、掌心位置、五指状态、Gesture State、App State、重入就绪状态、Gesture Lock、是否必须松手、剩余冷却、目标、三个确认进度和渲染 FPS。镜像骨架用于检查遮挡和关键点位置。

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
7. **手重入立即操作／身份不稳**：先查骨架和 `Readiness`，再调 `HAND_REENTRY_DELAY`、置信度与身份匹配参数。不要用更短等待去掩盖遮挡或左右手识别跳变。
8. **缩放范围或响应不适合设备**：调 `ZOOM_MIN`、`ZOOM_MAX`、`ZOOM_RESPONSE`；仍要求双手完成捏合。鼠标滚轮单独调 `WHEEL_ZOOM_SENSITIVITY`。
9. **彩蛋动作费力或意外触发**：最后调 `COLLAPSE_HOLD_TIME`、`COLLAPSE_MIN_TRAVEL`、`COLLAPSE_MAX_SPEED`、`REBIRTH_MIN_SPREAD`。核心导航稳定后再调特殊效果。

几何角度和掌宽归一化参数属于第二层调试入口；先观察 Debug 里的指头状态、捏合距离与关键点，再决定是否需要修改。鼠标和触屏继续可用，摄像头是交互增强入口。
