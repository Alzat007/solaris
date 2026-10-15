# 手机控制器

本轮新增独立入口 `controller/index.html`，生产子路径为 `/solaris/controller/`。手机页不挂载 Canvas、太阳系或星球场景；摄像头由用户主动开启，在手机本地运行现有 MediaPipe 检测、手身份过滤及手势状态机。电视端仍拥有唯一的场景状态、相机和动作审核。

## 连接边界

- 中转服务地址只读取构建配置 `VITE_REMOTE_RELAY_ORIGIN`。必须是 HTTPS origin，不接受页面 query/fragment 提供的服务器地址，也不接受含账号、密码、路径、query 或 hash 的地址。
- 扫码入口只接受 fragment 中的一次性 `session` 和 `claim`。读完立即清除 fragment；额外 query 也清除，只保留 `lang=en`。凭据不写入日志、DOM、localStorage 或 sessionStorage。
- 手机须主动点击“连接电视”；电视确认后才启用控制，摄像头不会随配对自动启动。
- 断线不盲目重连。后台、退出、用户断开会停止摄像头、释放模型/计时器/输入租约，并断开中转连接。恢复页面不自动重开摄像头或恢复旧凭据。
- 服务尚未配置时明确显示未配置，控制按钮禁用；不能把本地页面打开当成已连接中转或真实电视。

## 当前真实手势映射

| 手势                        | 手机输出                           | 保留的判定条件                                                                                     |
| --------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| POINT                       | POINTER                            | 归一化 0–1 坐标，仅定位/高亮，不自动确认                                                           |
| 稳定闭拇指 POINT 后张开拇指 | SELECT                             | ThumbOpenSelection 的稳定锁定、几何、hold、释放及冷却；携带 expectedTargetId，由电视再次核验原目标 |
| 单手 PINCH                  | ROTATE_START / ROTATE / ROTATE_END | 原 PinchStateMachine 的140ms hold和位移阈值；当前电脑手势为水平抓取，手机手势也不擅自添加竖轴      |
| V_GESTURE 掌轴旋钮          | ZOOM                               | 原 VRotationZoom 的250ms持有、掌轴几何、死区、角度平滑、150ms短失手窗口及不重放缺失时间            |
| FIST                        | BACK                               | 原 HoldStateMachine 的600ms持续握拳、冷却和释放后再触发；缩放释放帧不会同时变成返回                |

不恢复两手捏合缩放，不使用捏合点击，不把 OPEN_PALM 换星球的 flick 冒充图库翻页。手机图库上一张/下一张通过触控按钮发送 PREVIOUS_IMAGE / NEXT_IMAGE。暂停、返回、焦点方向、缩放和指向也有触控备用。

## 复用与新增

- `HandTrackingManager.useInputSink`：通过独立输入租约复用识别，手机不调用旧 GestureController 的场景 singleton。动态导入只在用户开启摄像头后发生。
- `ControllerCameraSession`：处理启动期间拒绝、迟到权限/模型结果、后台、退出和断线；旧异步结果不能恢复已取消会话。
- 手机依赖单独注入640×480、最大约15fps、无音频约束和约66.7ms总帧周期；调度扣除本次处理时间，不再在推理后额外等待整个周期。电脑默认20fps及模型检测参数保持不变。
- `RemoteGestureSink`：复用现有几何/时间状态机，输出受限语义动作；不发送原始视频、21个关键点、HandFrame、置信度或任意 store。
- 状态许可由电视反馈的 available 和 focusTarget 决定。模式/天体/可用动作变化会清除旧手势；陌生或失效目标不能沿用旧锁定。
- `focusTarget.source` 区分当前 `pointer` 命中和保留的 `focus` 界面焦点。明确来自界面焦点的旧目标不启动开拇指确认，也不消费新的捏合旋转；正在指向 UI 的捏合守卫仍保留。目标来源变化沿用既有锁定宽限，不能把原目标确认迁移到新目标。触控 SELECT 与遥控器确认仍使用共享输入层原有规则，不清空真实 DOM 焦点。
- 此字段是可选协议扩展，但旧版本的严格校验器会拒绝未知字段，联调必须同步更新 TV APK、relay 和控制页。新控制页收到缺少来源的旧状态仍保持保守的旧捏合守卫，不能据此宣称旧 APK 已修复。指向在 750ms 后过期，TV 最多再经过一个 80ms 状态发布周期及网络传输才反馈来源变化；在该窗口开始的捏合仍需释放后重试。
- 目标锁定期间发送同一个固定 POINTER 坐标以维持真实指向，不能伪造旋转或缩放漂移。静止抓取不发送零位移；超过250ms的下一次真实移动先补 ROTATE_START，配合电视的350ms输入 watchdog。
- ZOOM 的 delta 是原旋钮 speed×dt 的缩放增量，电视按自己的当前 scale 应用和限幅，手机不决定绝对相机坐标。

## 本轮验证与边界

已新增 `mobile-controller-gestures.test.ts`、`mobile-controller-lifecycle.test.ts` 和 `mobile-controller-input-lease.test.ts`。本轮实际执行25项单元测试，全部通过，覆盖语义白名单、原目标锁定、重复确认、发送失败反馈、位移、互斥、失手恢复、时钟异常、相机拒绝/取消和 fragment/config 安全。真实 HandTrackingManager 的注入依赖测试也确认：手机输入租约不会调用电脑旧场景控制器，结束后释放流、模型和计时器。

本地 Chromium 的390×844竖屏和844×390横屏各执行19项检查，共38项通过：页面没有自动相机请求、太阳系Canvas或WebGL上下文；服务未配置时诚实禁用连接和摄像头；语言与触控模式可切换；一次性fragment清除；header、独立滚动内容区和footer互不覆盖，全部方向按钮可滚动到可用位置。保留正常速度操作录屏与截图，记录在ignored `artifacts/mobile-controller-single-page-fixed-20261008-qa.json`。

单页浏览器检查未伪造已连接状态，因此没有执行真实配对后的摄像头拒绝流程；拒绝与迟到结果仅由单元测试验证。“已发送确认”只表示客户端接受发送，不声称电视已执行；中转ack也不是场景执行回执。

这些测试不能替代真实手机摄像头、iOS/Android浏览器、中转HTTPS/WSS、跨网连接、实体Fire TV及设备性能验收。需要中转配置与电视端完整接入后再检查完整扫码、TV确认、手势、触控、后台、撤销和重配对流程；不为测试购买服务或公开部署。

## 后续联合浏览器验证

同日完成另外15项真实双页面 HTTPS/WSS 检查；详细运行报告保留在本地，
不随公开文档发布。后续验证状态与发布限制见 [Publishing Guide](PUBLISHING.md)。
包括电视明确授权、四个天体图文、触控切图/返回、断线重配及真实 Chromium
摄像头/麦克风权限拒绝后仍可触控（0活动媒体轨道，未访问Mac镜头）。
这更新了单页测试未覆盖的配对和拒相机边界，不改变真机摄像头、扫码、
Fire TV App和设备性能仍未验证的结论。
