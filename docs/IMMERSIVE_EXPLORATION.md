# 分层沉浸式探索交付记录

日期：2026-10-04。本轮基于 `480cbcddf46e7d074ceb97ecc08c0a8f302b9a89` 原地重构，开始时工作树干净，分支仍为 `codex/solaris-talk-text-control`。没有重建项目、升级依赖、修改锁文件、提交、推送或发布。以下是当前本地版本，不是公开网站现有版本。

## 保留与替换

保留太阳系、八行星组件、R3F 渲染、GSAP、唯一相机管理器、原粒子／太阳效果、MediaPipe 几何阈值及输入安全守卫、资源取消与过期回调保护、电视方向键层。原 `ExplorationPanel` 中目录直接打开图文读物的 UI 被分层选择与浮层信息卡替换；完整目录数据、原故事数据及许可记录不删除。

状态流由 `InteractionStateMachine` 和 `InteractionController` 集中管理，React UI 不独立驱动相机或改写导航状态。

```text
SOLAR_SYSTEM → PLANET_TRANSITION → PLANET_OVERVIEW
Earth: EARTH_CONTINENT_PICKER → EARTH_COUNTRY_PICKER → EARTH_CITY_PICKER
Others: PLANET_REGION_PICKER
Both: DESCENT_TRANSITION → LOCATION_OVERVIEW → INFO_PANEL_OPEN
```

`PLANET_TRANSITION` 是复用的行星入场中间态，`TRANSITION` 是复用的返回太阳系中间态，用于动画锁与取消恢复。原 `INFO`、太阳内部、坍缩、重生、缩放状态继续保留；不再使用 `PLANET_FOCUS`、`EXPLORATION_DIRECTORY`、`LOCATION_TRANSITION`、`LOCATION_VIEW`。

## 功能结果

- 地球已接通地球 → 亚洲 → 中国 → 北京 → 接近／云雾转场 → 局部 3D 地理示意 → 三个命名热点 → 玻璃信息卡。信息卡关闭回到局部视图，Back 再依次退回城市、国家、大洲、行星。七大洲齐全，但本批只有亚洲／中国／北京可进入，其余入口明确禁用。
- 火星已接通区域选择 → 奥林帕斯山 → 接近／尘雾转场 → NASA 轨道影像局部视图 → 峰顶破火山口、宽阔坡面热点。维京 1 号也能通过同一模板进入一个无人探测热点；没有载人登陆表述。
- 星球入场、行星返回太阳系和地点下降可以取消，恢复最近稳定状态；下降取消同时恢复星球三个旋转轴。资源加载失败不进入；旧请求或旧动画完成不能重新打开地点。太阳入场／坍缩／重生沿用原动画锁，不新增这些历史特效的手势取消路径。
- 原指向／张开拇指选择、握拳、V 旋腕、总览手势保留，阈值未变。行星总览增加当前星球的 Pinch 抓取旋转，其他星球／HUD 仍消费到释放；鼠标拖动也旋转当前星球。手势抓取经过合成路由回归，仍需真人摄像头试用。
- 热点先显示名称、脉冲与可见焦点，支持鼠标、原手势 UI 选择和电视导航。标签按屏幕尺寸避让，引线连接原地理锚点；选中高亮。地点抵达前没有可点击热点，也不会自动打开卡片。
- 信息卡有半透明磨砂玻璃、背景模糊、细边框、高光、8px 圆角、淡入及轻微上浮；图片／正文分区。电视正文提供段落焦点停靠，普通 Web 不增加阅读 Tab 停靠。

## 动画与占位边界

已实现：星球选择／旋转、约 6.4 秒地点接近、区域朝向调整、程序化云／尘雾遮罩、局部俯视镜头降低、热点脉冲、卡片入场、返回与取消恢复。减少动态效果偏好将下降缩至约 0.05 秒、关闭 CSS 脉冲与入场动画。

仍为示意级：北京 112 个建筑方块和西北绿色区域仅用于地理示意，不代表真实道路、地形或建筑；没有天安门／长城／鸟巢的精确三维模型。奥林帕斯山影像是平面展示，没有测绘配准或高度场；示意锚点不能用于精准导航。维京局部视图暂只有网格与热点，没有真实地表模型。云雾是程序化切换遮罩，不是完整大气体积模拟；太阳系与局部尺度在遮罩下切换，不是连续全星球地形。没有全星球自由漫游、完整城市复原或浏览器离线冷启动缓存。

## 内容与目录覆盖

- 新模板：3 个地点、6 个中英文热点、5 张去重真实照片／探测影像。北京三张地标图片为本轮新增，火星两张复用。事实、地点关系、图片来源／作者／许可／拍摄日期分别核对；**人工审核通过 0 条，6 个热点全部 pending**。图片不是对应事件发生时的现场照片，信息卡明确区分地标／历史影像和事件关系。
- 新 `immersive-pack.json`：5 图共 681,753 字节，有 SHA-256。旧 `content-pack.json` 仍是旧 3 图 329,763 字节，不改变含义；两份清单去重后共 6 图 810,198 字节。
- 完整地球来源数据保留：250 个国家／地区来源条目、249 条首都关系、247 个去重首都城市、248 个城市、6 个精选名城。它是固定来源快照，不是现行法律首都全量认证，也不是完成的局部体验。
- 原八行星 9 个候选条目仍保留。新的可进入城市本批只有北京；其他国家、城市、六个未开放行星区域仍需制作和编审。原全目录搜索没有作为另一条绕过沉浸体验的入口保留，后续须把审核地点真正接入大洲／国家／城市层级。
- 仍需补充：真实城市地理底图及授权、经核对的地标模型、火星地形／影像配准、更多国家城市热点、其余行星局部场景、人工事实及权利复核、平台性能测试。不用空入口或自动生成故事充当完成。

## 验证记录

最终结果另见 `QA.md` 最新章节。`npm test` 373 条全部通过；根路径及 `/solaris/` 构建／静态校验通过。实际本地 Chromium/WebGL2 已验证桌面、小屏、电视 Web 布局、真实图片解码、玻璃卡片、热点不重叠、自然抵达、取消恢复、资源失败和模拟上下文丢失。屏幕像素检查确认场景非空，鼠标拖动实际改变地球 mesh 旋转；不把合成手势、网页电视或模拟异常当作物理设备测试。另将实际 Three.js 纹理请求延迟：等待时没有热点，纹理完成后才出现热点；加载失败仍由原场景边界处理。

未验证：本轮真实摄像头自然抓取／热点选择、Safari、真实小屏设备、Android APK 编译安装、Fire TV 模拟器及硬件、Vega、电视设备帧率与内存。没有新增手机平台、账户、AI 或答题分支。

## 修改文件完整清单

新增：

```text
docs/IMMERSIVE_EXPLORATION.md
src/exploration/LocalExplorationScene.tsx
src/exploration/hotspotLayout.ts
src/exploration/immersiveCatalog.ts
src/exploration/localScene.css
public/exploration/immersive-pack.json
public/exploration/beijing-tiananmen-2008.jpg
public/exploration/beijing-badaling-2006.jpg
public/exploration/beijing-birds-nest-2020.jpg
tests/immersive-content.test.ts
tests/immersive-navigation.test.ts
```

修改：

```text
README.md
QA.md
THIRD_PARTY_NOTICES.md
scripts/verify-exploration-content.ts
scripts/verify-static-export.mjs
src/app/App.tsx
src/camera/CameraController.tsx
src/exploration/sceneState.ts
src/gesture/GestureController.ts
src/gesture/GestureDebug.tsx
src/interaction/InteractionController.ts
src/interaction/InteractionStateMachine.ts
src/interaction/store.ts
src/interaction/textCommands.ts
src/planets/PlanetBase.tsx
src/scene/InputField.tsx
src/scene/PointerFallback.ts
src/scene/SolarScene.tsx
src/ui/ExplorationPanel.tsx
src/ui/HUD.tsx
src/ui/styles.css
tests/exploration-gesture-cancel.test.ts
tests/exploration-navigation.test.ts
tests/focus-zoom.test.ts
tests/interaction.test.ts
tests/routing.test.ts
tests/scene-controls.test.ts
tests/text-commands.test.ts
tests/thumb-selection-integration.test.ts
```

若干旧测试／Debug／文字导航仅更新状态名；原手势守卫断言继续保留。测试脚本、浏览器截图与 JSON 报告在忽略的 `artifacts/immersive-*`，不进入网站或充当比赛演示视频。
