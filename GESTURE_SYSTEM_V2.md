# SOLARIS Index Trigger Selection System

网站：[SOLARIS · 掌中星系](https://alzat007.github.io/solaris/)。核心手势语言：**指向、轻扣食指、拖动、拨动、握拳、✌ 旋腕**。

本版将正式选择改为「稳定指向 → 锁定目标 → 轻弯食指确认」，统一进入行星、太阳或操作 HUD。双指 Pinch 仅保留总览空白处拖动，不再选择。保留现有 ✌ 旋腕缩放、握拳返回、行星切换、双掌彩蛋、摄像头预览及原有场景视觉。

## 1. 修改的文件与职责

以下列出当前手势系统与相关视觉模块，便于继续维护。食指选择由 `IndexTriggerSelection.ts` 管理；旋腕缩放继续由 `VRotationZoom.ts` 与 `VZoomDial.tsx` 分别处理行为和反馈。

| 文件                                                                                                                                                                     | 职责                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `src/gesture/HandTrackingManager.ts`                                                                                                                                     | 相机权限与释放、本站 MediaPipe 加载、20Hz 推理；丢帧或冻结视频向状态机报告空手。                         |
| `src/gesture/HandIdentityTracker.ts`                                                                                                                                     | 利用左右手标签与二维位置预测维持身份；处理检测重排、交叉和丢失；弱左右手标签不清空手，坏关键点按手处理。 |
| `src/gesture/GestureRecognizer.ts`、`GestureTypes.ts`、`recognizerConfig.ts`                                                                                             | 严格 PIP 角度／角速度、自然 Point 证据、动态指针平滑、V 与掌轴；保留捏合与五指诊断，跟踪有效性独立。     |
| `src/gesture/GestureStateMachine.ts`                                                                                                                                     | 每只手的空白 Pinch 拖动生命周期及握拳持续确认；不负责选择。                                              |
| `src/gesture/GestureController.ts`                                                                                                                                       | 重入锁、场景锁、动作冷却、优先级、目标捕获以及互斥选择／拖动／缩放。                                     |
| `src/gesture/IndexTriggerSelection.ts`                                                                                                                                   | 七态选择流程、稳定目标锁、固定离靶宽限、轻扣阈值与速度检查、单次触发和释放保护。                         |
| `src/gesture/IndexTargetFeedback.tsx`                                                                                                                                    | 天体／HUD 投影位置上的细环、锁定进度、轻弯收缩与确认脉冲。                                               |
| `src/gesture/VRotationZoom.ts`、`dialScale.ts`                                                                                                                           | V 保持确认、固定旋转基准、角度解缠绕、死区与速度积分、漏检冻结和释放收尾。                               |
| `src/gesture/GestureMotion.ts`                                                                                                                                           | 窗口拨动；相对掌间距、近距保持和短暂弱姿势暂停组成的坍缩／重生确认。                                     |
| `src/gesture/gestureConfig.ts`                                                                                                                                           | 集中维护行为阈值、识别频率和输入响应参数。                                                               |
| `src/gesture/gestureTargets.ts`、`gestureFeedback.ts`                                                                                                                    | 统一天体／HUD 目标，发布 Armed、进度、触发、锁和 Debug 数据。                                            |
| `src/gesture/GestureCursor.tsx`、`GestureTutorial.tsx`、`GestureDebug.tsx`、`CameraPreview.tsx`、`VZoomDial.tsx`                                                         | 光标、渐进教程、掌心旋钮与 Debug；镜像预览复用现有视频，可收起，阅读时自动收起。                         |
| `src/interaction/InteractionStateMachine.ts`、`InteractionController.ts`、`store.ts`                                                                                     | 场景状态、镜头期间互斥、统一太阳选择、返回、缩放与自动显示行星资料。                                     |
| `src/interaction/rotation.ts`                                                                                                                                            | 鼠标与手势共享的旋转速度上限、平滑和松手阻尼。                                                           |
| `src/scene/InputField.tsx`、`PointerFallback.ts`、`planetPicking.ts`                                                                                                     | 渲染侧光标插值、手势天体命中区与锁定圆环定位、鼠标／触屏输入；保持旧鼠标与触屏命中范围。                 |
| `src/scene/SolarSystem.tsx`、`OrbitSystem.tsx`、`StarField.tsx`                                                                                                          | 统一旋转／缩放与拖动反馈；坍缩时轨道、天体和背景星场向中心收束。                                         |
| `src/planets/PlanetBase.tsx`、`Sun.tsx`                                                                                                                                  | 行星和太阳一致的命中／选择入口与目标反馈。                                                               |
| `src/particles/ParticleEngine.ts`、`ParticleField.tsx`、`ParticleShaders.ts`、`CollapseEffect.tsx`                                                                       | 保存预备聚能／坍缩参数；GPU 螺旋落入光迹、吸积盘、稳定能量核与内向压力波。                               |
| `src/ui/HUD.tsx`、`HandFeedback.tsx`、`GestureHint.tsx`、`PlanetInfo.tsx`、`DebugHands.tsx`、`chinese.ts`、`styles.css`                                                  | 中文教学、识别手数、双掌阶段与百分比、资料卡；底部坍缩／重生备用按钮。                                   |
| `src/app/App.tsx`                                                                                                                                                        | 按 URL 参数加载 Gesture Debug。                                                                          |
| `tests/recognizer.test.ts`、`hand-identity.test.ts`、`pinch-state.test.ts`、`routing.test.ts`、`collapse-motion.test.ts`、`v-rotation-zoom.test.ts`、`fixtures/hands.ts` | 自然手型／旋转与噪声样本、稳定身份、Pinch 生命周期、双掌阶段、旋腕缩放启停／速度／边界及互斥路由。       |
| `tests/index-trigger-selection.test.ts`、`index-selection-integration.test.ts`                                                                                           | 七态、离靶选原目标、抖动／慢放松负例、释放与场景锁，以及识别器到控制器的合成关键点联调回归。             |
| `tests/interaction.test.ts`、`picking.test.ts`、`scene-controls.test.ts`、`fallback.test.ts`、`gesture-lab.ts`、`gesture-lab.html`                                       | 场景状态、命中、输入互斥与合成关键点回放。                                                               |
| `README.md`、`GESTURE_SYSTEM_V2.md`                                                                                                                                      | 运行说明、操作语言、阈值和调试说明。                                                                     |

`tests/focus-zoom.test.ts` 是选星、镜头动画与聚焦后缩放的集成回归入口；`tests/v-rotation-zoom.test.ts` 独立检查候选确认、固定基准、静止／平移不缩放、左右同方向、±π 跨越、速度封顶、边界、漏检宽限和时间跳变。`tests/routing.test.ts` 检查旋钮、食指锁定、空白拖动的互斥与场景锁。`tests/index-trigger-selection.test.ts` 覆盖快速扫过不锁定、只指向不触发、锁后弯曲离靶仍选原目标、保持只触发一次、明确释放、手丢失及左右手一致。`tests/index-selection-integration.test.ts` 将合成关键点经识别器送入控制器，检查进入后的镜头锁、与 V／Fist 的隔离和 HUD 选择。

识别回归包含自然半弯其余手指的 Point、严格 5–6–7 PIP 角度、只移动指尖不改变关节角、角速度／迟滞与动态光标滤波，也包含自然微弯的 V、自由拇指、镜像与转腕、侧转可测性、指尖移动不改变掌部轴线及普通双指捏合反例。旧五指聚拢样本仍用于几何诊断与回归；`FIVE_PINCH` 不再驱动正式缩放。这些合成样本验证计算和动作衔接，不代表真人摄像头识别准确率。

识别层只产生特征；确认和互斥交给状态机。推理与渲染分离，识别器复用临时关键点／数值缓冲，渲染循环继续插值光标与场景参数。

## 2. 删除的旧手势与替代逻辑

| 旧行为                                  | 当前行为                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| 双指 `PINCH_SELECT`／捏合进入           | 正式入口改为 `INDEX_PRESS`；Pinch 只用于总览空白处拖动，不选择天体或 HUD。         |
| 三指查看／收起资料                      | 不再是命令；进入行星的镜头动画完成后 400ms 自动显示资料。                          |
| ✌ V 手势返回                           | 返回改为握拳持续 600ms；✌ 现在只用于保持确认后的旋腕缩放。                        |
| 双手快速张开进入太阳内部                | 删除导航作用；太阳通过 Point Lock + Index Press 进入。                             |
| 双掌间距直接缩放、双手捏合中点缩放      | 移除；双掌保留坍缩／重生，正式缩放使用 ✌ 旋腕。                                   |
| 五指撮合启动与连续开合缩放              | 移除 `ONE_HAND_ZOOM` 动作与对应行为参数，改为 `V_ZOOM`；五指几何字段保留用于诊断。 |
| 张掌、握拳或手指移动触发多种导航        | Point 仅瞄准；Fist 仅返回；张掌拨动仅切换聚焦行星。                                |
| 旧通用 `GestureStabilizer` 与旧保持时长 | 移除，采用独立状态机和统一配置。                                                   |

识别器输出 `V_GESTURE`，`V_SIGN` 仅为旧样本／调试兼容名。三指仍无命令。普通双指捏合只保留空白拖动作用，不与 `INDEX_PRESS` 共同触发选择；握拳时拇指碰到食指也不选择。

## 3. 新状态与场景规则

### 食指选择：几何与七态流程

食指关节角严格使用 **MCP（5）— PIP（6）— DIP（7）**，以 PIP 为顶点，使用向量 `MCP - PIP` 与 `DIP - PIP` 的夹角；不使用 `TIP（8）` 代替 DIP。优先使用世界关键点，缺少世界关键点时用宽高比校正后的图像三维关键点。骨段退化或无效则置 `indexAngleValid=false`、清空角速度历史，不能确认。

`indexAngle` 单位为度，`indexAngularVelocity` 为近期角度变化的平滑速度，弯曲为负；平滑时间常数 **0.075 秒**。几何 `indexState` 在 `<115°` 时进入 `BENT`，`>145°` 时进入 `EXTENDED`，中间区间保留原值；未初始化或无效时为 `BETWEEN`。几何状态仅描述手指，不能代替选择状态机的目标锁和释放保护。

Point 允许其他三指自然半弯、拇指自由放置。食指伸展证据至少 **0.62**，其他三指的最高伸展证据不超过 **0.8**，食指领先它们至少 **0.16**；V、张掌、真实捏合和完整握拳保留各自识别。锁定还要求 `pointConfidence >= 0.6`、角度 `>145°`、有效几何，以及 `hypot(pointerVelocity.x, pointerVelocity.y) <= 0.35`。这里用平滑食指光标的归一化速度，不用掌心速度冒充瞄准稳定性。

`POINT_IDLE → POINT_HOVER → TARGET_LOCKING → TARGET_LOCKED → INDEX_PRESSING → INDEX_TRIGGERED → WAIT_RELEASE`

- `POINT_HOVER`：首次稳定命中目标至少可观察一帧，开始本次计时。
- `TARGET_LOCKING`：同一个 `kind + id` 连续稳定保持 **250ms**；空白、换目标、快扫或 Point 条件不满足都会清空候选计时。
- `TARGET_LOCKED`：保存 `lockedTarget`。同目标稳定伸直可一直等待，155–165° 等仍属伸直范围的角度微抖不会单独启动超时。离靶、移动过快或不再满足伸直 Point（包括开始弯指）时，第一次记录 **450ms** 宽限；随后换 hover、弯曲或重新指回都不续期。
- `INDEX_PRESSING`：锁内食指进入 **145° 及以下** 的弯曲区间，显示按压进度。宽限内交互对象固定为原目标，光标可继续平滑移动。
- `INDEX_TRIGGERED`：第一次从 `>=115°` 降到 `<115°`，当前角度实际下降且 `indexAngularVelocity < -25°/s` 时，只返回一次锁定目标。首次越过阈值即要求释放；如果速度不足不触发，随后在临界角度抖动也不能补发。触发状态保留一帧，控制器立即执行选择并锁住镜头动画。
- `WAIT_RELEASE`：下一次更新清除锁定目标，不再独占其他手势。只有角度 `>145°` **连续 100ms** 才解除食指选择保护；中途回落重新计时。锁定后的按压另行保护握拳返回，避免一次弯曲保持几十帧后接着返回；普通手部重入的食指选择保护不会一直阻止握拳返回。

锁内可接受几何暂时变为 `NONE`／`FIST` 的轻扣，因为 Point 时另外三指本就弯着；此时只执行已锁定的选择，不执行 Fist Back。未锁定的完整握拳不进入食指按压，仍可在允许返回的场景中保持 **600ms** 返回。V、张掌、Pinch、五指撮合和三指不会完成食指确认；已锁定／按压期间禁止启动 V、拖动、Swipe 和 Fist。场景锁始终优先。

手丢失、坏角度、超过 **180ms** 的帧间隔或时钟回退立即取消目标锁并要求释放，不补算缺失时间。动画禁用帧只观察伸直释放，不累计锁定或触发；因此可在进入动画中松手，解锁后重新稳定指向。新身份的 `cancel(true)` 清除旧的释放计时，`cancel(false)` 保留现有释放保护；`reset()` 才清全状态。手重新入镜仍先等待 **250ms**。

### Point 光标和目标范围

指针继续使用镜像后的食指尖位置，经动态指数平滑和死区滤波，再由渲染循环插值。原始指针速度从 **0.12** 到 **0.8 归一化距离/s** 时，时间常数从 **0.09 秒** 过渡到 **0.045 秒**，使慢速瞄准更稳、快速移动更跟手。掌心和捏合中点保留原平滑参数。

手势天体命中半径为 `max(22px, 视觉投影半径 × 1.3, 视觉投影半径 + 12px)`，扩大的范围仅用于命中，不绘制大型可视区域；锁定反馈环按实际天体投影定位。鼠标和触屏继续使用原来的命中参数、点击／拖动／滚轮或双指缩放逻辑。

### Pinch 仅用于空白拖动

`IDLE → PINCH_START → PINCH_HOLD → PINCH_RELEASE → IDLE`

- `PINCH_START`：拇指与食指距离低于 **0.28 掌宽**，连续确认 **140ms**。
- `PINCH_HOLD`：总览空白处开始的捏合，移动达到拖动门槛后旋转太阳系；在目标上开始的捏合只被消费，不能选择。
- `PINCH_RELEASE`：距离大于 **0.43 掌宽** 时结束。
- `needsRelease`：重连、动画锁或取消时仍在捏合，必须先松开再开始新的拖动。

空白拖动经过星球不会变成选择；松手也不产生点击。Pinch Select、Pinch Click 和 Pinch Confirm 均不再是天体／HUD 的正式入口。

### ✌ 旋腕缩放

V 姿势要求食指、中指伸出，无名指、小指收起，拇指自由放置；接受自然微弯的伸出手指。食指／中指伸展证据的较小值须至少为 **0.48**，无名指／小指的较大值须不超过 **0.42**；由两组证据得到 `vConfidence`，动作层要求至少 **0.6**，同时要求跟踪有效、掌部轴线可测。

`IDLE → V_DETECTED → ZOOM_DIAL_ARMED → ZOOM_DIAL_ACTIVE → ZOOM_DIAL_RELEASE`

- `V_DETECTED`：连续可靠保持 **250ms**，候选即独占输入；不确定帧取消本次连续计时，候选不享受漏检宽限。
- `ZOOM_DIAL_ARMED`：确认这一刻记录一次起始角并保留当前比例，显示就绪；本帧不缩放，下一次可靠更新进入 `ACTIVE`。
- `ZOOM_DIAL_ACTIVE`：相对本次起始角转动控制缩放速度；保持同一手势时不重设基准。平移整只手或改变指尖位置不会直接缩放。
- `ZOOM_DIAL_RELEASE`：停止并保留大小，本帧仍占用输入；下一次更新回到 `IDLE`，再次比 ✌ 重新确认与校准。

掌部旋转使用图像关键点 **食指 MCP（5）→ 小指 MCP（17）**。原图宽高比为 `a = videoWidth / videoHeight`，镜像坐标中 x 反向、y 仍向下，因此：

```text
dx = -(x17 - x5) × a
dy = y17 - y5
palmRoll = atan2(dy, dx)
```

`palmRoll` 为弧度，镜像预览中顺时针变化为正。候选开始时若为左手，固定加 π 作为本次角度偏移；右手偏移为 0。此偏移直到释放才清除，不随短暂左右标签翻转改变，也不乘左右手正负号。逐帧用 `atan2(sin(angle - lastAngle), cos(angle - lastAngle))` 累计最短角差，避免 ±π 跨越产生跳变；确认时保存累计角作为基准。这样两手都是向右拧放大、向左拧缩小。

掌轴投影须不短于 **0.015**，投影／掌宽须至少 **0.4**，屏幕掌面法线朝向分量绝对值须至少 **0.25**；过侧的手掌或退化投影会暂停，而不是放大不可靠的角度。旋转角使用宽高比校正的图像关键点，指姿势证据优先使用世界关键点。

相对基准的角差转为度，以 **0.08 秒** 时间常数平滑。原始角差回到 **±10°** 死区立即停速，即使平滑角仍有余量也不继续积分；死区以外使用平滑角计算：

```text
t = clamp((abs(delta) - 10) / (40 - 10), 0, 1)
speed = sign(delta) × t² × 0.65
scale = clamp(currentScale + speed × dt, 0.35, 1.75)
```

其中 `delta` 为平滑角度差，`dt` 为秒，速度单位为比例／秒。达到 **40°** 后速度封顶，不会继续加速；范围沿用原 `ZOOM_MIN/MAX`，画面沿用 `ZOOM_RESPONSE` 阻尼。停止旋转或退出时，目标与当前渲染比例的收尾差距限制在 **0.01** 内，防止已累积的平滑追赶造成明显续动。

已就绪／激活后，收起 V、姿势不确定、掌轴无效或短暂漏检都立即令速度归零，冻结目标。最多 **150ms** 保留本次基准与独占权；同一 V 手及时恢复可继续，恢复首帧不补算缺失时间。即使另一只手仍在画面内，V 所属手的短暂漏检也按此宽限处理。超过宽限则释放，检测调用间隔超过 **180ms** 或时间回退也取消旧动作，不积算跳帧。场景动画锁、离开可用场景或真实身份改变同样取消；动画结束后需重新保持 250ms。

总览与行星聚焦可用 V 旋钮；缩放中仍使用内部状态 `UNIVERSE_SCALE`。`SUN_FOCUS` 当前始终为飞入太阳的锁定动画，不能实际启动旋钮；`SUN_INTERIOR` 禁用旋钮。五指 `gripAperture`／`gripConfidence` 与 `FIVE_PINCH` 仅保留识别诊断，不参与这条缩放状态机。

### 可见反馈与就绪状态

相机连接、模型加载、兼容切换和推理运行由 `cameraDiagnostics.ts` 分开记录；有摄像头预览不等于模型已经就绪。连续 5 秒未检出手时，`CameraStatus.tsx` 提供「切换兼容识别」，保留同一视频流并重新创建 CPU 模型。`?handTracking=cpu` 让下一次用户主动开启直接使用兼容模式，不自动申请权限。兼容模式将三个 MediaPipe 检测／存在／跟踪选项覆盖为官方默认 `0.5`；下方配置表的 `0.65` 是正常模式值，动作确认与几何规则不变。

GPU 创建失败或推理抛错会尝试一次 CPU；没有手部检出本身不会触发自动切换。所有资源归一个连接会话所有，停止后晚返回的流或模型只关闭自身，不会覆盖新连接。`tests/camera-lifecycle.test.ts` 覆盖这些异步竞态、回退、空检测、过滤前后手数与冻结画面。Debug 分别显示原始手数、有效手数、运行阶段、推理后端和耗时，定位问题时先判断检测链路，再调整姿势分类。

| 状态                | 用户看到的含义                                                   |
| ------------------- | ---------------------------------------------------------------- |
| `NO_HAND`           | 未检测到手，不显示手势光标。                                     |
| `HAND_VISIBLE`      | 已检测到手，出现轻光圈。                                         |
| `TARGET_HOVER`      | 命中天体或可操作 HUD，显示高亮与目标名称。                       |
| `GESTURE_ARMED`     | 目标锁定、食指轻扣、握拳、V 或彩蛋正在确认；显示收缩／进度反馈。 |
| `GESTURE_TRIGGERED` | 动作已触发，短暂脉冲反馈。                                       |
| `RECONNECTING`      | 手重新出现后的 250ms 只允许位置跟踪；禁止动作。                  |
| `READY`             | 重入等待结束且关键点几何有效；具体动作仍须通过姿势门槛。         |

`readiness` 与可见反馈独立：看见手或命中目标不意味着动作已解锁。动作通道还区分 `NONE`、`POINT`、`INDEX_PRESS`、`PINCH_DRAG`、`V_ZOOM`、`FIST_BACK`、`SWIPE`、`COLLAPSE`、`REBIRTH`。

### App State

沿用已有内部场景名，避免更改场景模型。Debug 同时显示语义场景和内部状态。

| 语义状态       | 内部状态／阶段                                                                 | 允许的核心操作                                                              |
| -------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `OVERVIEW`     | `SOLAR_SYSTEM`、兼容 `POINTER`                                                 | Point、Index Press Select、空白 Pinch Drag、✌ 旋腕缩放、双掌坍缩。         |
| `PLANET_FOCUS` | `PLANET_FOCUS`、`INFO`                                                         | Point、选择、张掌左右拨动、Fist Back、✌ 旋腕缩放；资料自动显示。           |
| 缩放进行中     | `UNIVERSE_SCALE`                                                               | V 旋钮独占；结束后回到缩放前的总览／行星状态。                              |
| 太阳飞入阶段   | `SUN_FOCUS`                                                                    | 作为进入太阳的动画阶段，全程锁定，不接受新的食指选择或 V。                  |
| `SUN_INTERIOR` | `SUN_INTERIOR`                                                                 | 可用 HUD 的食指确认、Fist Back；不选择天体，禁用 V。                        |
| `COLLAPSE`     | `COLLAPSE`                                                                     | 坍缩动画期间锁定；核心形成后允许可用 HUD 的食指确认、双掌重生或 Fist Back。 |
| `TRANSITION`   | `INTRO`、`PLANET_TRANSITION`、`SUN_FOCUS`、`TRANSITION`、`BIG_BANG` 及坍缩动画 | 禁止新的手势操作；等待动画完成。                                            |

所有已解锁的场景都可以通过 Point Lock + Index Press 点击当前可用的 HUD 按钮，包括太阳内部和坍缩完成后的状态；天体选择仍限制在总览与行星聚焦场景。

冷却与场景锁共同生效：冷却结束也不会提前打断镜头动画。普通拖动遇到手丢失、无效几何或身份集合变化会结束并重新经过就绪门槛。已拥有的 V 旋钮对所属手的短暂漏检保留上述 150ms 宽限；所属手仍在时，第二只手加入或检测排序改变不重新校准。超时或所属身份被替换后重新就绪。低姿势分数不会单独清空有效手身份，具体动作仍须通过各自证据门槛。

### 双掌确认与坍缩视觉

总览中双掌张开，先保持一定间隔，再共同向中心靠近。初始间距至少 0.28；开始减少 0.018 后记录可靠观察时间；总间距至少减少 0.1，每只手须向内移动至少 0.025。近距条件为间距不大于 `max(0.32, 初始间距 × 0.62)`，因此无需手掌碰到一起遮住关键点。有效观察累计达到 **1 秒**，且近距可靠保持达到 **200ms**，才触发一次坍缩。

双掌阶段为 `IDLE → READY → APPROACH → HOLD`；识别到 `NONE` 或低姿势分数时进入 `PAUSED`，最多保留 **220ms** 的前序进度，暂停期间不累计时间、不执行动作；超时或明确改为不兼容手势则重新开始。界面显示已识别手数、合拢／保持阶段和百分比。

触发后的坍缩动画持续 **2.4 秒**，全程锁定：背景星光旋转内收，星尘形成向心螺旋光迹，天体与轨道汇入中央，最终留下吸积盘、持续吸入的粒子、脉动能量核和内向压力波。准备合拢时有轻微聚能提示，松手取消后回落。坍缩特效由 GPU 计算，按画质使用 12,000／6,500／2,400 条实例化光迹以及两张 Shader 平面；不逐帧重建粒子数组。

核心形成后，双掌从不大于 0.42 的初始间距向两侧拉开：间距增加至少 0.18、最终至少 0.38，每手向外移动至少 0.035，并观察至少 180ms 后触发重生。现有 3.8 秒 Big Bang 与粒子爆发接续展开太阳系；展开动作不进入太阳。底部 **「坍缩」／「重生」** 按钮及空格键可独立触发同一条场景动画，作为摄像头操作的备用入口；动画锁同样生效。

## 4. 当前全部配置阈值

以下逐项列出两份配置文件的全部 **143 个字段（81 + 62）**。`ms` 是毫秒，`s` 是秒；屏幕坐标为镜像后的 0–1 归一化坐标，二维距离不是像素。掌宽比优先使用世界关键点的三维距离除以三维掌宽；缺少有效世界关键点时使用宽高比校正后的图像关键点。指数响应采用 `1 - exp(-dt × response)`，时间常数采用 `1 - exp(-dt / time)`，两者调节方向相反。

### `src/gesture/gestureConfig.ts`（81 项）

| 参数                              | 当前值 | 单位           | 用途                                                                                                    |
| --------------------------------- | -----: | -------------- | ------------------------------------------------------------------------------------------------------- |
| `PINCH_START_THRESHOLD`           |   0.28 | 掌宽比         | 拇指与食指距离小于此值时开始 Pinch。                                                                    |
| `PINCH_RELEASE_THRESHOLD`         |   0.43 | 掌宽比         | 距离大于此值才释放；必须大于开始阈值。                                                                  |
| `PINCH_HOLD_TIME`                 |    140 | ms             | 空白拖动的连续捏合确认时长，完成后进入 PINCH_HOLD；不执行选择。                                         |
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
| `TARGET_LOCK_TIME`                |    250 | ms             | 同目标稳定 Point 连续保持多久才能锁定；候选改变、空白或快扫重新计时。                                   |
| `TARGET_LOCK_GRACE`               |    450 | ms             | 已锁目标首次偏离／不稳定／弯曲后的固定保护窗口；恢复 hover 或继续弯指不续期。                           |
| `INDEX_PRESS_THRESHOLD_DEG`       |    115 | °              | 锁内首次从此值及以上降到严格小于此值，并满足下降速度，才确认一次。                                      |
| `INDEX_RELEASE_THRESHOLD_DEG`     |    145 | °              | 食指严格大于此角度才算伸直释放；与按压阈值之间保留迟滞。                                                |
| `INDEX_RELEASE_HOLD`              |    100 | ms             | 伸直释放必须连续保持的时间；中途回落清零。                                                              |
| `INDEX_PRESS_MIN_VELOCITY`        |     25 | °/s            | 轻扣辅助速度门槛：平滑角速度须小于负此值，且当前角度实际下降。                                          |
| `INDEX_POINT_MIN_CONFIDENCE`      |    0.6 | 0–1            | 开始／维持稳定目标锁所需的 Point 证据门槛。                                                             |
| `POINT_STABILITY_THRESHOLD`       |   0.35 | 归一化距离/s   | 平滑食指光标速度上限；超过后不累计目标锁。                                                              |
| `POINT_TARGET_RADIUS_MULTIPLIER`  |    1.3 | 倍             | 手势专用的天体投影命中半径倍率，另与最小半径和像素余量取最大值。                                        |
| `TARGET_MIN_RADIUS_PX`            |     22 | CSS px         | 天体在屏幕上的最小命中半径，便于瞄准较小的远处星球。                                                    |
| `TARGET_MARGIN_PX`                |     12 | CSS px         | 在天体实际投影半径之外增加的命中余量。                                                                  |
| `WHEEL_ZOOM_SENSITIVITY`          | 0.0006 | 1/deltaY 单位  | 鼠标滚轮缩放增益，比例乘以 `exp(-deltaY × sensitivity)`；越大越敏感。                                   |
| `CURSOR_DEAD_ZONE`                | 0.0025 | 归一化距离     | 位置变化小于此半径时保持光标不动。                                                                      |
| `CURSOR_SMOOTHING_TIME`           |  0.055 | s              | 掌心／捏合中点的识别侧平滑时间常数；食指光标另用动态平滑。                                              |
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
| `V_GESTURE_HOLD_TIME`             |    250 | ms             | 连续可靠保持 V 的确认时间；完成时一次性捕获起始角。                                                     |
| `V_GESTURE_RELEASE_GRACE`         |    150 | ms             | 已就绪／激活后的弱姿势或漏检宽限；立即停速，期间保留基准与输入占用。                                    |
| `V_GESTURE_MIN_CONFIDENCE`        |    0.6 | 0–1            | V 姿势证据门槛；还须通过有效几何与掌轴可测性检查。                                                      |
| `V_ZOOM_DEADZONE_DEG`             |     10 | °              | 原始角差回到正负此范围立即停速；平滑角的速率映射也保留此死区。                                          |
| `V_ZOOM_MAX_ANGLE_DEG`            |     40 | °              | 平滑角差达到此绝对值时达到最大速率，更大角度仍封顶。                                                    |
| `V_ZOOM_MAX_SPEED`                |   0.65 | 倍/s           | 旋钮目标比例每秒变化的绝对速度上限。                                                                    |
| `V_ZOOM_SMOOTHING`                |   0.08 | s              | 角度差的指数平滑时间常数，越大越稳但越迟缓。                                                            |
| `V_ZOOM_MIN`                      |   0.35 | 倍             | V 旋钮最小比例，引用同一 ZOOM_MIN 常量。                                                                |
| `V_ZOOM_MAX`                      |   1.75 | 倍             | V 旋钮最大比例，引用同一 ZOOM_MAX 常量。                                                                |
| `V_ZOOM_RELEASE_SETTLE_MAX`       |   0.01 | 倍             | 停速／退出时目标与当前渲染比例允许保留的最大收尾差距。                                                  |
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

### `src/gesture/recognizerConfig.ts`（62 项）

其中 `FIVE_PINCH_*` 与 `GRIP_*` 仍是几何诊断参数，以下保留其计算含义以便维护；它们不再启动或调整正式缩放。

| 参数                                    |  当前值 | 单位                   | 用途                                                                                                                                             |
| --------------------------------------- | ------: | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MIN_PALM_WIDTH`                        |   0.015 | 按图像高度归一化的距离 | 宽高比校正后的掌宽下限，拒绝退化关键点并保护比值计算。                                                                                           |
| `FINGER_EXTEND_ANGLE`                   |     153 | °                      | 四指伸展的关节角阈值，可由伸展长度条件补充。                                                                                                     |
| `FINGER_EXTEND_REACH`                   |     0.9 | 长度比                 | 指根至指尖距离／三段骨长，用于接受自然微弯的手指。                                                                                               |
| `FINGER_EXTEND_WRIST_RATIO`             |    1.08 | 距离比                 | 伸展时指尖至手腕距离／PIP 至手腕距离下限。                                                                                                       |
| `FINGER_RELAXED_REACH`                  |     0.8 | 长度比                 | 自然弯指仍算伸展时，指根到指尖距离／三段骨长之和的下限；须同时满足自然弯指角度与离腕比。                                                         |
| `FINGER_RELAXED_ANGLE`                  |     115 | °                      | 自然弯指补充通道的关节角下限，与指链伸展率和离腕比联合使用。                                                                                     |
| `FINGER_RELAXED_WRIST_RATIO`            |    1.12 | 距离比                 | 自然弯指补充通道要求的指尖至手腕距离／PIP 至手腕距离下限。                                                                                       |
| `FINGER_SCORE_REACH_START`              |    0.55 | 长度比                 | 指链伸展率映射到证据分数 0 的起点；结果与离腕证据取几何平均。                                                                                    |
| `FINGER_SCORE_REACH_RANGE`              |     0.4 | 长度比                 | 指链伸展率从分数 0 到 1 覆盖的范围，结果截断至 0–1。                                                                                             |
| `FINGER_SCORE_WRIST_START`              |    0.92 | 距离比                 | 指尖至腕／PIP 至腕的比值映射到离腕证据分数 0 的起点。                                                                                            |
| `FINGER_SCORE_WRIST_RANGE`              |    0.35 | 距离比                 | 离腕比从证据分数 0 到 1 覆盖的范围，结果截断至 0–1。                                                                                             |
| `OPEN_FINGER_MIN_SCORE`                 |    0.48 | 0–1                    | 宽容张掌通道要求四根手指都达到的最低伸展证据，允许一根较软的小指；真正折叠的指头不能通过。                                                       |
| `OPEN_FINGER_STRONG_SCORE`              |    0.65 | 0–1                    | 宽容张掌通道至少三根手指须达到的较强证据门槛；与四指最低证据同时使用。                                                                           |
| `POINT_INDEX_MIN_SCORE`                 |    0.62 | 0–1                    | 食指作为 Point 主导手指所需的最低伸展证据。                                                                                                      |
| `POINT_OTHER_MAX_SCORE`                 |     0.8 | 0–1                    | Point 时其余三指伸展证据的上限，允许自然半弯。                                                                                                   |
| `POINT_DOMINANCE_MIN_SCORE`             |    0.16 | 分数差                 | 食指证据必须领先其余三指最高证据的最小差值。                                                                                                     |
| `POINT_DOMINANCE_SCORE_RANGE`           |    0.35 | 分数差                 | 食指优势映射到 0–1 的范围；Point 分数由食指证据 70% 和此优势分数 30% 组成。                                                                      |
| `POINTER_SLOW_SMOOTHING_TIME`           |    0.09 | s                      | 慢速瞄准时食指位置的平滑时间常数。                                                                                                               |
| `POINTER_FAST_SMOOTHING_TIME`           |   0.045 | s                      | 快速移动时食指位置的平滑时间常数。                                                                                                               |
| `POINTER_SLOW_SPEED_SCREEN`             |    0.12 | 归一化距离/s           | 原始指尖速度低于此值时采用慢速平滑。                                                                                                             |
| `POINTER_FAST_SPEED_SCREEN`             |     0.8 | 归一化距离/s           | 原始指尖速度达到此值时采用快速平滑，两端之间线性过渡。                                                                                           |
| `INDEX_ANGLE_MIN_BONE_LENGTH`           | 0.00001 | 关键点长度             | PIP 相邻两段骨长的有效下限；世界点为米，图像回退为校正坐标单位。                                                                                 |
| `INDEX_ANGULAR_VELOCITY_SMOOTHING_TIME` |   0.075 | s                      | PIP 角速度的平滑时间常数，弯曲速度为负。                                                                                                         |
| `V_EXTENDED_MIN_SCORE`                  |    0.48 | 0–1                    | 食指与中指各自所需的最低伸展证据，允许自然微弯。                                                                                                 |
| `V_FOLDED_MAX_SCORE`                    |    0.42 | 0–1                    | 无名指与小指各自允许的最高伸展证据；拇指不参与 V 条件。                                                                                          |
| `PALM_ROLL_MIN_SCREEN`                  |   0.015 | 按图像高度归一化的距离 | 镜像、宽高比校正后的 MCP 轴屏幕投影长度下限。                                                                                                    |
| `PALM_ROLL_MIN_PROJECTION`              |     0.4 | 掌宽比                 | MCP 轴屏幕投影／校正图像三维掌宽的下限，拒绝过短投影。                                                                                           |
| `PALM_ROLL_MIN_FACING`                  |    0.25 | 0–1                    | 校正图像中掌面法线朝镜头分量的绝对比例下限，拒绝严重侧掌。                                                                                       |
| `FINGER_FOLD_ANGLE`                     |     130 | °                      | 角度低于此值且指链伸展率也低于自然弯指下限时退出伸展；离腕比过低可独立退出。                                                                     |
| `FINGER_FOLD_WRIST_RATIO`               |    0.97 | 距离比                 | 指尖回到手腕附近时退出伸展状态的阈值。                                                                                                           |
| `THUMB_EXTEND_ANGLE`                    |     150 | °                      | 调试用拇指伸展关节角阈值。                                                                                                                       |
| `THUMB_EXTEND_REACH`                    |    0.85 | 长度比                 | 拇指指根至指尖距离／骨链长度下限。                                                                                                               |
| `THUMB_EXTEND_WRIST_RATIO`              |    1.05 | 距离比                 | 拇指尖至手腕距离／上一关节至手腕距离下限。                                                                                                       |
| `FIST_TIP_TO_PALM`                      |    0.95 | 掌宽比                 | 四指弯曲且食指尖靠近掌心时识别为握拳。                                                                                                           |
| `PINCH_TIP_TO_PALM`                     |    0.65 | 掌宽比                 | 普通捏合通道的食指尖离掌心距离条件之一；紧凑对捏另用掌内对向位移和伸出距离判断。                                                                 |
| `PINCH_OPPOSITION_MIN`                  |    0.18 | 掌宽比                 | 食指尖相对食指根沿掌内拇指方向投影的下限，用于识别紧凑对捏并区分握拳中的指尖重叠。                                                               |
| `PINCH_INDEX_REACH_MIN`                 |    0.45 | 掌宽比                 | 紧凑对捏通道的食指根到指尖距离下限；同时要求拇指方向对向位移和拇食指接触。                                                                       |
| `PINCH_STRENGTH_START`                  |     0.2 | 掌宽比                 | 连续捏合强度线性映射的满强度起点。                                                                                                               |
| `PINCH_STRENGTH_RANGE`                  |    0.45 | 掌宽比                 | 连续捏合强度由满到零的距离范围。                                                                                                                 |
| `FIVE_PINCH_APERTURE_MAX`               |    0.22 | 掌宽比                 | 五指尖相对共同中心的 RMS 离散程度上限，用于确认五指聚拢。                                                                                        |
| `FIVE_PINCH_RADIUS_MAX`                 |    0.38 | 掌宽比                 | 任意一个指尖离五指尖中心的最大距离，避免一根散开的手指被均值掩盖。                                                                               |
| `GRIP_CENTER_FORWARD_MIN`               |    0.25 | 掌宽比                 | 纵向撮合通道中，五指尖中心相对四指根中心、沿手腕至指根方向的前伸投影下限；掌面法线通道不使用此门槛。                                             |
| `GRIP_CENTER_TO_PALM_MIN`               |     0.8 | 掌宽比                 | 纵向撮合通道中，五指尖中心到掌心的距离下限，与纵向前伸和离腕比共同判断。                                                                         |
| `GRIP_FINGER_WRIST_MIN`                 |    0.94 | 距离比                 | 纵向撮合通道要求四指中最小的指尖至腕／PIP 至腕距离比；不约束朝掌面法线聚拢的姿势。                                                               |
| `GRIP_FINGER_WRIST_STRONG`              |    1.02 | 距离比                 | 纵向撮合通道中，一根手指计入较强离腕证据所需的距离比门槛，与参与手指数联合判断。                                                                 |
| `GRIP_FINGER_COUNT`                     |       3 | 根                     | 纵向撮合通道中，四指至少达到较强离腕比门槛的数量。                                                                                               |
| `GRIP_THUMB_INDEX_SPREAD_MIN`           |     0.5 | 比值                   | 连续开合中拇食指距离／五指 RMS 开度的下限；避免普通双指捏合占用五指开合通道。                                                                    |
| `GRIP_NORMAL_REACH_MIN`                 |     0.4 | 掌宽比                 | 掌面法线撮合通道要求的组合伸出距离：正向纵向投影与法线投影平方和的平方根；须同时满足其他法线分支条件。                                           |
| `GRIP_NORMAL_PALM_DISTANCE_MIN`         |     0.5 | 掌宽比                 | 掌面法线撮合通道中，五指尖中心到掌心的距离下限；区分抬离掌面的聚拢与卷进掌心。                                                                   |
| `GRIP_NORMAL_FORWARD_MIN`               |   -0.35 | 掌宽比                 | 掌面法线撮合通道允许的最小纵向投影；负值允许五指尖中心适度落在指根后方，仍须满足离掌面高度等证据。                                               |
| `GRIP_EACH_TIP_NORMAL_MIN`              |     0.2 | 掌宽比                 | 掌面法线撮合通道中，每个指尖相对四指根中心的掌面法线投影下限；五个指尖必须位于共同中心所在的同一侧。                                             |
| `GRIP_NORMAL_CURL_MEAN_MIN`             |      70 | °                      | 掌面法线通道接受连续开合中间态时，四指 MCP–PIP–指尖角的平均值下限；用于区分逐渐展开与握拳卷曲，不是紧密撮合的额外条件。                          |
| `GRIP_UNFOLD_FORWARD_MIN`               |    0.05 | 掌宽比                 | 掌面法线通道接受连续开合中间态时，五指尖中心沿手腕至指根方向的最小前伸投影；与平均手指角度共同排除指根强弯的拳头，紧密 FIVE_PINCH 不使用此条件。 |
| `PALM_FACING_NORMAL`                    |    0.65 | 0–1                    | 调试用掌面法线与相机方向夹角余弦绝对值门槛；不是使用手势必须正对镜头的门槛。                                                                     |
| `VELOCITY_SMOOTHING_TIME`               |   0.095 | s                      | 掌心与食指光标速度的指数平滑时间常数。                                                                                                           |
| `MIN_FRAME_SECONDS`                     |    0.01 | s                      | 几何速度和滤波计算的最小帧间隔。                                                                                                                 |
| `MAX_FRAME_SECONDS`                     |     0.1 | s                      | 几何滤波与身份位置预测的最大帧间隔。                                                                                                             |
| `IDENTITY_MAX_STEP_SCREEN`              |    0.35 | 归一化距离             | 连续两帧同一手允许的最大位移，也作为新身份匹配代价。                                                                                             |
| `IDENTITY_AMBIGUITY_SCREEN`             |   0.025 | 归一化距离代价         | 双手两种匹配的总成本过于接近时，放弃猜测并重新等待就绪。                                                                                         |
| `IDENTITY_UNKNOWN_PENALTY`              |    0.04 | 归一化距离代价         | 已知与未知左右手标签匹配时的附加代价；不降低姿势分数。                                                                                           |
| `IDENTITY_HANDEDNESS_CONFIDENCE`        |     0.7 | 0–1                    | 左右手标签可参与可靠匹配的分数下限；低分或无效标签视为 Unknown，保留有效关键点和位置跟踪。                                                       |
| `IDENTITY_MISMATCH_PENALTY`             |    0.08 | 归一化距离代价         | 检测标签与已有左右手标签冲突时的额外匹配成本；不是硬拒绝，单帧分类翻转可保持空间连续的身份。                                                     |

**三种信息独立处理：**`confidence` 是姿势几何证据；`trackingConfidence` 是有效几何标记，当前有效的 21 关键点输出 1，它不是 MediaPipe 真实跟踪分数；`handedness.score` 只表示左右手分类把握。MediaPipe 的检测、存在和跟踪门槛在模型内部执行，模型没有向本应用返回逐手跟踪分数。左右手标签分数低、瞬时标签翻转或姿势分数不足都不会单独删除有效的手身份；各动作分别检查自身证据。V 另有 `vConfidence` 与 `palmRollValid`：姿势可靠且掌轴可测才能确认，候选期间的 `NONE` 不累计保持时间。调试分数不代表经过真人统计的识别准确率。

摄像头请求为理想 640×480、理想及最大 30fps，实际能力由设备决定；模型推理仍最多 20Hz。预览复用同一视频和已计算骨架，最多约 20Hz 绘制，不启动第二路摄像头或第二个模型。

## 5. 当前 Gesture Priority

**场景动画锁始终最高。** 重入就绪、有效几何和冷却同样先决定能否开始新动作。已有操作的互斥规则先于新的候选手势：

- V 已拥有时，`V_DETECTED`、`ARMED`、`ACTIVE`、150ms 宽限与 `RELEASE` 消费帧都独占，不能转成食指选择、双掌彩蛋、拖动、返回或拨动。
- 食指已处于 `TARGET_LOCKED`、`INDEX_PRESSING` 或触发帧时，锁住原目标，不能新启动 V、Pinch Drag、Fist 或 Swipe。高优先级场景锁／有效双掌特效可取消选择。
- `WAIT_RELEASE` 不独占其他动作，但食指选择及 Fist Back 继续等待明确释放，避免选择后的弯曲变成返回。

没有已拥有的 V 或食指锁时，每帧按下列顺序仲裁：

| 优先级 | 动作                               | 限制                                                             |
| -----: | ---------------------------------- | ---------------------------------------------------------------- |
|      0 | Scene / Animation Lock             | 锁定期间不启动动作，`SUN_FOCUS` 当前全程处于此锁。               |
|      1 | 双掌特殊效果 `COLLAPSE`／`REBIRTH` | 仅总览合拢／坍缩后展开；满足双手姿势、行程与时间。               |
|      2 | `V_ZOOM`                           | 可靠 V 连续 250ms；候选即独占，不能越过已有食指锁。              |
|      3 | `INDEX_PRESS` Select               | 单手稳定 Point 锁定目标后轻扣一次；天体与可用 HUD 共用流程。     |
|      4 | 单手 `PINCH_DRAG`                  | 仅总览空白处开始的捏合，保持并移动达到门槛；目标上的捏合被消费。 |
|      5 | `FIST_BACK`                        | 允许返回的场景中完整握拳保持 600ms，且没有待释放的食指按压。     |
|      6 | `SWIPE`                            | 仅行星聚焦、单手张掌；同时满足方向、速度、行程与窗口。           |
|      7 | `POINT` Hover                      | 只瞄准／累计稳定目标锁，不弯食指就不选择。                       |

双手捏合不缩放也不选择；五指聚拢不启动缩放。V 已拥有时第二只手出现不会触发重入或抢走动作，所属手短暂失踪立即停速并按独立宽限等待。食指锁不继承 V 的丢手宽限：真实丢手立即清除锁定目标并要求伸直释放。

## 6. 开启 Debug 与重看教程

线上：[打开 Gesture Debug](https://alzat007.github.io/solaris/?debugGesture=true)。本地：`http://localhost:5173/?debugGesture=true`。已有查询参数时追加 `&debugGesture=true`。普通地址默认隐藏调试面板，旧的 `debug=true` 仍兼容。

面板包含摄像头阶段、原始／有效手数、推理后端与耗时、左右手、姿势证据、`Hand Geometry`、`Current Gesture`、仲裁后的 `Action`、Pinch 拖动阶段／距离、掌心位置、五指状态、就绪／场景锁／冷却、双掌阶段与 FPS。食指选择增加 `Index Phase`、`Index Angle`、`Index Angular Velocity`、`Index State`、`Point Confidence`、`Hover Target`、`Locked Target`、`Target Lock`、`Index Press` 和 `Index Release Required`；分别显示严格 PIP 角度、下降速度、几何状态、目标锁进度与按压释放保护。旋钮字段包括 `Zoom Mode`、`Base Palm Angle`、`Current Palm Angle`、`Delta`、`Zoom Direction`、`Zoom Speed`、`Dead Zone`、`V Gesture Confidence`、当前比例及保持百分比。旋钮的起始／当前掌角在反馈对象内用弧度保存，Debug 转为度；旋钮角差为平滑后的度数，缩放速度为比例／秒。食指 PIP 角始终为度，食指角速度为度／秒。各类证据分数不是经过真人统计的识别准确率。

正常页面开启摄像头后也会显示小型 **镜像预览**，叠加手部骨架，指尖单独高亮，识别为 `V_GESTURE` 时重点标记食指和中指。预览只读取本机已运行的视频，可手动收起，打开帮助或资料卡时自动收起，不录像、不上传。收起后可以点击「查看手部骨架」重新展开。用预览确认手掌完整入镜、有足够光照，旋腕时能看到掌面。

`VZoomDial.tsx` 在掌心附近显示保持进度、刻度圆环、缩小／放大方向和当前百分比。首次使用提示「↶ ✌ ↷ · 旋转手腕缩放」，当已激活旋钮且转动使比例实际变化后才保存 `solarisVZoomTutorialCompleted=true`；仅比出 V 或进入就绪状态不会完成教程。退出后旋钮淡出。

选择教程与旋钮教程独立持久化。需要重新体验时，在该站点浏览器控制台执行以下操作后刷新：

```js
localStorage.removeItem("solarisIndexTriggerTutorialCompleted");
localStorage.removeItem("solarisVZoomTutorialCompleted");
location.reload();
```

选择教程首次检测到手并就绪后显示「指向星球」，锁定后显示「轻弯食指进入／确认」；如果尚未释放则提示「重新伸直食指」。只有控制器成功执行一次 `INDEX_PRESS`，才保存 `solarisIndexTriggerTutorialCompleted=true`，鼠标点击、仅悬停或仅锁定不会完成。旧的基础教程键不再控制这条教程。V 旋钮、场景动画、太阳内部或其他已拥有动作期间暂时隐藏选择教程，避免叠加提示。

目标反馈按「细环 Hover → 填充锁定环 → 就绪双环与名称 → 弯曲收缩 → 短暂确认脉冲」表达。正式 UI 使用「轻弯食指进入／确认」等自然提示，七态与其他工程字段仅在 Debug 中显示。

## 7. 最值得后续手动调整的参数

按体验问题调参，每次只改一组，使用同一台摄像头和相同光照比较：

1. **轻扣难触发或放松时误触**：先查看严格 PIP 的 `Index Angle` 与 `Index Angular Velocity`，最值得先调的五个行为参数是 `INDEX_PRESS_THRESHOLD_DEG`、`INDEX_RELEASE_THRESHOLD_DEG`、`TARGET_LOCK_TIME`、`TARGET_LOCK_GRACE`、`INDEX_PRESS_MIN_VELOCITY`。始终保留按压／释放迟滞、首次下降跨越与明确释放，不能只扩大按压角度来提高命中。
2. **光标抖动或跟手迟缓**：调 `CURSOR_DEAD_ZONE`、`POINTER_SLOW_SMOOTHING_TIME`、`POINTER_FAST_SMOOTHING_TIME` 与两个 `POINTER_*_SPEED_SCREEN` 端点，再看 `CURSOR_RENDER_RESPONSE`。慢速瞄准与快速移动分开检查；`CURSOR_SMOOTHING_TIME` 现在用于掌心和捏合中点，不是食指动态平滑开关。
3. **小星球难锁定或弯曲时超时**：联合检查 `POINT_TARGET_RADIUS_MULTIPLIER`、`TARGET_MIN_RADIUS_PX`、`TARGET_MARGIN_PX`、`POINT_STABILITY_THRESHOLD`、`TARGET_LOCK_TIME` 与 `TARGET_LOCK_GRACE`。扩大命中区可能增加邻近目标重叠；锁定后应保持 `Locked Target` 不变，即使 `Hover Target` 离开。固定 450ms 宽限只从首次偏离／不稳定／弯曲开始，不从锁定那一刻倒计时。
4. **空白拖动难开始或太敏感**：先看只用于拖动的 `PINCH_START_THRESHOLD`、`PINCH_RELEASE_THRESHOLD`、`PINCH_HOLD_TIME`，再调 `DRAG_START_DISTANCE`、`DRAG_ROTATION_GAIN`、`DRAG_MAX_SPEED`；松手后转动太久则增加 `ROTATION_DAMPING`。Pinch 参数不再影响选择。
5. **选择后难以继续或误返回**：检查 `Index Release Required`，食指须大于 `INDEX_RELEASE_THRESHOLD_DEG` 连续 `INDEX_RELEASE_HOLD`。持续弯曲应既不重复选择也不进入返回；无锁定上下文的完整握拳才使用 `FIST_HOLD_TIME`，保留至少 600ms 与中途取消。
6. **拨动切换太难或太容易**：联合调整 `SWIPE_VELOCITY`、`SWIPE_DISTANCE`、`SWIPE_WINDOW` 和 `SWIPE_COOLDOWN`，保留「仅行星聚焦且张掌」的场景条件。
7. **手重入立即操作／身份不稳**：先看镜像预览、`Hand Geometry` 与 `Readiness`。有效骨架下的姿势弱只应影响动作，不应反复进入重连；左右手标签低分也不等于手丢失。确认真实遮挡后再调 `HAND_REENTRY_DELAY` 和身份匹配参数，不通过降低模型门槛掩盖坏几何。
8. **旋钮难启动或停得不稳**：先看 `Current Gesture`、`V Gesture Confidence` 与 `Zoom Mode`，确认食指／中指伸出、另外两指收起，掌部有可测投影。行为层调 `V_GESTURE_HOLD_TIME`、`V_GESTURE_MIN_CONFIDENCE`、`V_GESTURE_RELEASE_GRACE`；候选期必须连续可靠，宽限只用于已就绪／激活阶段。速度体验调 `V_ZOOM_DEADZONE_DEG`、`V_ZOOM_MAX_ANGLE_DEG`、`V_ZOOM_MAX_SPEED` 和 `V_ZOOM_SMOOTHING`；保留原始角回到死区立即停速。`V_ZOOM_RELEASE_SETTLE_MAX` 限制停速后的渲染收尾。缩放范围和原渲染阻尼分别由共享 `ZOOM_MIN/MAX` 与 `ZOOM_RESPONSE` 控制；鼠标滚轮单独调 `WHEEL_ZOOM_SENSITIVITY`。
9. **彩蛋动作费力或意外触发**：先看 `Special Stage`，`APPROACH` 长时间不到 `HOLD` 时检查 `COLLAPSE_CLOSE_RATIO`、`COLLAPSE_CLOSE_DISTANCE` 与双手行程；频繁 `PAUSED` 先改善可见性，再考虑 `SPECIAL_POSE_GRACE_TIME`。需要更多确认时间则调 `COLLAPSE_HOLD_TIME`／`COLLAPSE_CLOSE_HOLD_TIME`。`COLLAPSE_MAX_SPEED` 只和异常单帧行程联合排除跳变，不能当作一般慢动作灵敏度旋钮。
10. **自然 Point 难被认出**：检查 `Point Confidence` 与各指伸展证据，再调 `POINT_INDEX_MIN_SCORE`、`POINT_OTHER_MAX_SCORE`、`POINT_DOMINANCE_MIN_SCORE`、`POINT_DOMINANCE_SCORE_RANGE` 和动作层 `INDEX_POINT_MIN_CONFIDENCE`。不要要求其余手指全部卷紧；每次同时复核 V、张掌、真实 Pinch 和完整 Fist 的反例。
11. **V 手型或旋转方向不可靠**：先用镜像预览区分手指分类与掌面可测性。V 分类调 `V_EXTENDED_MIN_SCORE`、`V_FOLDED_MAX_SCORE`，同时复核双指捏合、握拳和张掌反例。转腕可测性调 `PALM_ROLL_MIN_SCREEN`、`PALM_ROLL_MIN_PROJECTION`、`PALM_ROLL_MIN_FACING`；不要通过改变左右手符号修正方向，先核查镜像 MCP 公式、宽高比与基准解缠绕。每次同时检查左右两手、±π 跨越、平移和指尖抖动。保留的 `FIVE_PINCH_*`／`GRIP_*` 不再是缩放调参入口。

现成方案、许可证与可采用思路见 [GESTURE_RESEARCH.md](GESTURE_RESEARCH.md)。旋腕缩放继续基于现有 MediaPipe Hand Landmarker 的 21 关键点与本项目状态机，没有直接接入研究仓库的代码或训练模型。

几何角度和掌宽归一化参数属于第二层调试入口；先观察 Debug 里的指头状态、捏合距离与关键点，再决定是否需要修改。鼠标和触屏继续可用，摄像头是交互增强入口。
