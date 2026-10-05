# V5 continuous globe: isolated verification

Date: 2026-10-04. This is an engine/input prototype, not completion of V5.

## Scope and purpose

- Preserve the existing main entry, solar system, unpublished immersive samples and calibrated gesture thresholds.
- Use `globe-lab.html` as a separate Vite entry. It never mounts `SolarScene`, an inactive solar-system canvas or the old HUD.
- Verify one geographic camera owner before committing to a city scene or map provider. Free browsing and guided Beijing flight operate on the same Cesium WGS84 globe.
- Do not open paid services, use user credentials, call Google Maps/Cesium ion, deploy or submit a contest entry.

## Running

Node.js 22.12+ is required. Existing dependency versions are unchanged; CesiumJS 1.146.0 and Lucide React 0.468.0 are new pinned dependencies.

```sh
npm ci
npm test
npm run build
npm run dev
```

Open `/globe-lab.html` on the dev server. The current local verification uses `http://127.0.0.1:5174/globe-lab.html` because another server already uses 5173. Static Cesium assets are copied by `predev` / `prebuild`. The GitHub Pages base path is respected; no publishing has been performed.

## Camera and input contract

`GlobeCameraActions` alone writes the active geographic camera. Cesium's default input controller is disabled; mouse, the gesture bridge, toolbar and browser-remote preview send actions to this owner.

- Drag locks a picked ellipsoid position and rotates the camera, not the global tile root. Release stops dragging without new inertia.
- Wheel/V input approaches the picked pointer position. When there is no intersection, it uses the previous stable target. Steps scale with current height.
- The local global image has no regional refinement. Its explicit experimental observation boundary is 250 km; it is not a promise of image quality or a universal production boundary.
- A manual action interrupts flight at the current pose. Explicit cancel restores position, direction, up vector and geographic focus; the UI restores the initiating navigation button.
- Skip sets the same Beijing target directly. Repeated start and stale completion callbacks cannot create another flight.
- Pointer interaction resets the gesture clutch; gesture frames cannot overwrite a held pointer grab. Keyboard/toolbar camera actions also require the hand to release and rearm.
- The existing camera manager accepts an optional frame/reset sink. Its default remains the existing gesture controller; detection, identity filtering, thresholds and session cleanup are retained.
- Browser remote preview separates DOM focus navigation from view control. It is not Fire TV platform validation.

Developer diagnostics are exposed only with `?qa=1`. They report poses, picks, projections, render counts and allow synthetic filtered hand frames; no API credential or detector output is exported to a server.

## Data and rights status

| Layer               | Current status                                                                                                    | Missing evidence                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Base imagery        | Existing local `textures/earth-day.jpg`, sourced from Three.js r160 example textures                              | No new original imagery-rights certification; retain the existing notice and pending review     |
| Geographic surface  | WGS84 ellipsoid from Cesium                                                                                       | No measured elevation/terrain dataset connected                                                 |
| Beijing target      | Center ray targets 116.4074 E, 39.9042 N; camera is south of the target at 500 km height, tilted about 15 degrees | Not a city mesh, landmark position survey or local exploration view                             |
| Buildings/landmarks | Not connected; no generated blocks labelled as real Beijing in this entry                                         | Authorized geometries, placement, heights, simplification disclosure and target-platform checks |
| Stories/photographs | Existing catalog remains untouched and pending human review                                                       | No new reviewed stories or images                                                               |
| Online provider     | Google Maps and Cesium ion not connected                                                                          | Credentials, budget, domain restrictions, service access and live regional coverage             |

On 2026-10-04, [Google's official coverage table](https://developers.google.com/maps/coverage) lists CN/China with a single Map Tiles coverage indicator rather than the two 2D/3D indicators used for covered 3D regions; Maps JavaScript 3D is `—`. The legend means unavailable or low quality/availability. This does not establish usable Beijing photorealistic buildings. No live authenticated Beijing tile request has been made.

The [Photorealistic 3D Tiles guide](https://developers.google.com/maps/documentation/tile/3d-tiles) requires billing/API setup and a key. The [Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies) require attribution and restrict prefetching, storage and offline use. No Google content is cached, proxied or packaged by this prototype.

## Platform boundaries

- Automated browser QA is Mac-hosted headless Chromium with software WebGL when available, not Safari on physical M2 graphics hardware and not a performance benchmark.
- Physical camera accuracy, camera-on frame rate and M2 Safari interaction remain unverified.
- Android/Fire TV packaging, APK installation and physical remote navigation remain unverified.
- The existing Android TV shell blocks non-local resource requests and lacks Internet permission. An online provider needs a separately approved networking/security change, not an unrestricted WebView workaround.
- There is no integrated solar-system-to-Cesium renderer handoff, Beijing local terrain/models, globe-to-local LOD dataset or non-Earth continuous sample yet.

## Test evidence

Final `npm test`: **398 passed / 0 failed / 0 skipped**, including 25 new camera pose, flight lifecycle, injected camera sink and gesture bridge tests. TypeScript, `VITE_BASE_PATH=/solaris/ npm run build`, the static export check and `git diff --check` passed. The static export still verifies both existing exploration image packs; it is not an offline cold-start check.

The dev browser report (`artifacts/globe-lab-report.json`) passed 13 groups with no page errors or experiment requests to external services. They cover actual globe pixels and moving camera, two-axis drag, pointer-centered zoom, flight/cancel/skip/manual takeover, the height boundary, synthetic gesture arbitration, resource failure/retry, narrow layouts and Web TV controls. Across four off-center wheel steps, the tested geographic target drift was at most **0.181 pixels**. The roughly eight-second flight and skip reached the same Beijing-target pose; cancel restored the prior pose without late re-entry. These observations are not universal error bounds or real-hand validation.

The built `/solaris/globe-lab.html` passed a separate production browser check at 1440 x 900 and 390 x 844, including nonblank colored imagery, no HTTP/JavaScript failures and the geographic skip destination. The first preview run incorrectly omitted the preview server's `/solaris/` base configuration and failed with asset 404s; that configuration was corrected and the check rerun successfully. Failed and final reports are retained separately in ignored `artifacts/`. Screenshots were visually inspected. The normal main entry remains functional and does not request GlobeLab or Cesium; its three existing Google Fonts requests are not removed by this experiment.

Browser verification used Mac-hosted headless Chromium 151 with SwiftShader software WebGL. No physical camera permission was requested, no forced GPU-context-loss check was performed, and no physical M2 Safari or Fire TV result is claimed. Generated reports/screenshots are local QA evidence, not a contest demonstration video.

Cesium currently produces a **4.24 MB uncompressed / 1.14 MB gzip** isolated lab bundle. The build warning is retained. The main entry does not fetch the experiment's bundle in the tested workflow; production scene transfer, bundle size and device memory budgets require later profiling.

## Next decision

Before implementing the final Beijing UI, verify an authorized imagery/terrain/model combination at the requested location. If only ellipsoid/global imagery is available, report that gap and retain the boundary; do not hide a jump with clouds or substitute a photograph as the local 3D scene.

## 真实数据接入准备 · 2026-10-05

本轮核验的是账户准备与官方数据规格，没有配置凭据或连接真实资产。继续复用 CesiumJS 1.146.0、统一相机动作、FlightSession、手势检测和输入桥接，不扩充地点目录或重建界面。现有默认入口仍是本地单张全球影像与椭球；它不是下面三项资产的加载证据。

### 用户需要准备

在 [Cesium ion](https://ion.cesium.com/) 查看套餐与用量，再在 Asset Depot 查找以下资产，添加前检查其条款和费用提示。参考 ID 来自官方示例与当前 SDK；最终核对用户 My Assets 中的名称和 ID。

| 资产                                 | 参考 Asset ID | 目的                                         | 项目实测状态 |
| ------------------------------------ | ------------- | -------------------------------------------- | ------------ |
| Cesium World Terrain                 | 1             | 地球起伏地形；不是建筑                       | 未连接       |
| Google Maps 2D Satellite with Labels | 3830183       | 最终任务书默认的带标签卫星影像；不是立体建筑 | 未连接       |
| Cesium Mars                          | 3644333       | 现成火星地形与影像 3D Tiles                  | 未连接       |

Google Satellite 的 ion 路线与自备 Google key 的直连路线不同；优先 ion，不要求另开 Google Cloud 计费。最终任务书指定默认带标签影像 3830183；普通卫星 3830184 是独立可选资产，不同时添加多种影像层以增加会话。参见 [官方 imagery 教程](https://cesium.com/learn/cesiumjs-learn/cesiumjs-imagery/)、[Google2DImageryProvider](https://cesium.com/learn/cesiumjs/ref-doc/Google2DImageryProvider.html)。不能抽取 ion 返回的第三方凭据用于独立 Google API 请求；参见 [第三方条款](https://cesium.com/legal/third-party-terms/)。

新建独立 SOLARIS 开发令牌，仅启用公共权限 `assets:read`，Selected assets 只选实际使用的上述三项。关闭 `geocode`，不授予 `assets:list`、`assets:write`、`profile:read`、`tokens:read` 或 `tokens:write`。Allowed URLs 限制为当前实际开发来源 `http://127.0.0.1:5174`；发布时另建生产令牌。URL 限制依赖 Referer，电视本地 WebView 是否满足还未验证，不能取消安全限制来绕过。客户端只读令牌仍可被用户看到，不把前端环境变量称为保密。参见 [官方令牌指南](https://cesium.com/learn/ion/cesium-ion-access-tokens/)。

先提供隐藏令牌的资产名称/ID与套餐/用量截图即可。不要求用户交出密码、默认令牌或任何管理令牌。实际配置前先保护本地配置的 Git 忽略与日志脱敏；本轮没有创建含凭据的文件。

### 费用边界

截至本轮核验，Community 为个人免费计划，包含 10 GB 存储、15 GB/月 streaming、1,000 次/月 Global Imagery sessions，适用个人非商业、未获资助教育活动及探索评估。不是因学生身份就自动获准任何商业或公开分发用途。Commercial 个人计划列价为 149 美元/月，但本轮不购买。实际以账户当前计划、使用目的和许可为准。参见 [价格与 FAQ](https://cesium.com/platform/cesium-ion/pricing/)。

配额不能当作自动停机或零费用保证：服务条款允许超额收费。真实验证前先看已有用量及通知/限制条件，限定本地小规模测试，不循环跑付费数据的浏览器测试，不开放公众流量。参见 [配额指南](https://cesium.com/learn/ion/optimizing-quotas/)、[服务条款 §4.1](https://cesium.com/legal/terms-of-service/)。不得私自预取、永久缓存或打包 Google 瓦片；视频使用也要另外核验，其政策列有宣传视频时长与署名条件，不能把比赛的三分钟视频要求视为 Google 许可。参见 [Map Tiles 政策](https://developers.google.com/maps/documentation/tile/policies)。

### 北京：分开核验，不能合并为一个成功标志

| 项目     | 可核验的公开信息                                                         | 仍缺的实测                                                                                          |
| -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 卫星影像 | Google 覆盖表列 CN 的 2D 覆盖；ion 有对应资产                            | 北京当地实际最高有效瓦片级别、道路/屋顶可辨性、日期与原生分辨率（未给出时标未提供）、署名和网络失败 |
| 地形     | World Terrain 为全球数据；官网对约南纬60至北纬60列 30–90 m 参考档        | 北京市区与八达岭的实际地形源/细节、高程取样、贴地定位、防穿地；官网范围不是北京每点的测量保证       |
| 三维建筑 | 以上影像与地形组合不包含完整建筑网格；CN 未列 Google 3D 的第二个覆盖标志 | 北京实景建筑覆盖未证实，也未连接任何建筑资产                                                        |

来源：[Google 覆盖表](https://developers.google.com/maps/coverage)、[World Terrain 规格](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/)、[Google viewport 覆盖元数据](https://developers.google.com/maps/documentation/tile/2d-tiles-overview)。SDK 的默认 `maximumLevel: 22` 不是北京真实源影像精度保证；显示像素间距也不等于原生采集分辨率。

### 火星：先验证现成数据

| 官网覆盖档            | 近似影像分辨率 | 近似地形分辨率 |
| --------------------- | -------------- | -------------- |
| 全球                  | 232 m          | 200 m          |
| Jezero 陨石坑增强区域 | 6 m            | 20 m           |
| Gale 陨石坑增强区域   | 25 cm          | 1 m            |

Cesium Mars 是 3D Tiles，使用 IAU_2015:49901。Olympus Mons 有官网展示，但不据此承诺米级山体细节；Viking 1 区域不能套用 Gale 的精度。Jezero/Gale 增强区域的实际边界须连接后检查；增强颜色包含灰度与低精度颜色合成，不能标天然真彩色。没有验证或承诺着陆器近景模型。参见 [官方 Mars 规格与示例](https://cesium.com/platform/cesium-ion/content/cesium-mars/)。本轮没有加工原始资料，也没有虚构近景。

### 接入时的最小工程范围与验收

- 地球更换现有 provider 初始化，不重做相机和手势：复用 `IonImageryProvider.fromAssetId`。1.146 的 terrain 类型未声明 token 字段，采用 `IonResource.fromAssetId(id, {accessToken})` 后交给 `CesiumTerrainProvider.fromUrl`，不修改全局 token，不调用账户管理 API。
- `GlobeCameraActions`/`cameraPose` 当前含 WGS84 与椭球拾取假设。地形和 Mars 接入要统一注入天体椭球，使用实际表面拾取及净空约束，不能只换资产 ID 或全局 default。Mars 官方示例关闭 Earth globe，使用火星椭球与全局 3D Tiles。
- 真实测试先核验资产可访问、必要瓦片完成加载和署名，再查北京/八达岭与 Olympus/Jezero 的分辨率边界；最后复测指向缩放、拖动、取消、接管、跳过、丢手、拒绝凭据/断网和平台网络限制。mock 与本地贴图不计真实数据通过。
- 本轮重跑 `npm test`：398 通过、0 失败、0 跳过；`VITE_BASE_PATH=/solaris/ npm run build`、静态导出及 `git diff --check` 通过。Cesium 大包警告仍在。真实 ion/Google/Mars 加载、M2 Safari/摄像头、Fire TV 安装运行均未验证。未登录账户、开通计费、配置令牌、公开部署或比赛提交。

## 最终任务书增量：热点、玻璃阅读与受限数据入口

2026-10-05 后续任务以 `SOLARIS_FINAL_CODEX_BRIEF.md` 为当前产品基线。历史检查记录保留；下列状态覆盖本页早期“热点/最终玻璃面板尚未实现”的描述，但不改变真实数据未连接的结论。

### 实际修改范围

- 复用 `GlobeLab.tsx`、`GlobeCameraActions.ts`、`GlobeGestureBridge.ts`，没有重搭第二个地图壳。后续单页交接增量已移除 `HUD.tsx` 的独立地球预览入口；旧太阳系/区域原型保留。
- 新增 `earthProvider.ts`：显式 per-provider token、固定资产 1/3830183、缺凭据错误、30 秒超时和取消 gate、错误脱敏、资源错误与重试；不自动 fallback 后宣称成功。取消不能撤销 SDK 已发出的请求，但能阻止迟到 terrain 再启动新影像会话。
- 新增 `GlobeHotspots.tsx` / `hotspotVisibility.ts`：WGS84 地理投影、背面及已加载地形遮挡、集中 m/px 迟滞、稳定避让、圆点/折线/名称、44px 命中区。鼠标拖动超过 6px 不开卡，悬停只高亮；首次可见时有界预加载最多三张自有故事图片，不预取地图。
- 新增 `GlobeStoryPanel.tsx` / `storyPanel.css`：26px 玻璃、45/55 宽屏与窄屏上下布局、90ms 纯淡入、清晰图文、同面板加载/错误/重试、滚动和焦点圈定、固定关闭按钮。开卡冻结地图；关闭不写相机姿态、不重新飞行，并恢复热点焦点。必要 Cesium 署名留在面板之外且可访问。
- `.gitignore` 与无凭据 `.env.example` 保护本地配置不进入 Git；客户端令牌依然公开可见。没有生成 `.env.local`、配置凭据、操作账户或新增依赖。
- 新增 provider / camera-actions / hotspots 测试，扩展既有 globe-gesture 测试；README、QA 与本记录更新。此清单只描述本轮增量，不把工作树早已有的修改归为本轮。

### 当前运行方法

本轮开发服务器为 `http://127.0.0.1:5174/`。太阳系直接选择地球 → 原有靠近动画 → 自动进入同页自由浏览 → 连续放大，或北京定位/跳过 → 名称聚焦 → 确认地点 → 阅读 → 关闭 → 另一个热点 → 拉远。保留但冻结旧太阳系 canvas，仅一个 canvas 可见/活跃；独立 `globe-lab.html` 仅供工程测试。默认均为本地低精度验证，最低 250 km；本地预览使用较宽的 m/px 热点范围，不冒充城市精细尺度。

用户自行确认资产/套餐后，在本机 `.env.local` 填 `VITE_CESIUM_ION_READ_TOKEN` 并重启 dev，主动打开主站 `/?data=ion` 后选择地球（或工程入口 `globe-lab.html?data=ion`）才请求真实资源。令牌只选 assets:read、资产 1/3830183，来源限制到实际本地 origin；Mars 3644333 留待后续独立连接。`qa=1&data=ion` 被拒绝以避免自动回归产生真实会话。无需将密码或管理令牌交给开发者。

### 单页地球交接增量

新增 `BODY_EXPLORE` 与 `ENTER_BODY_EXPLORE`，仅从稳定 `PLANET_OVERVIEW` 且选中地球时进入。新 `EarthHandoff.tsx` / `earthViewHandoff.ts` 把 Earth body 的实际 world matrix 和相机转换为 ECEF，保留画面位置、尺度、有效 FOV 和朝向。App 延迟加载复用的地球组件，无第二次入场、无 URL 导航；数据/模块加载失败保留已选地球画面并提供返回。太阳系 Canvas 使用 `frameloop="never"`，输入与 TV 键盘让出；Cesium 所有动作继续经 `GlobeCameraActions`。`HandTrackingManager.useInputSink` 使用独立可释放 lease，输入交接不重开摄像头，不更改原有识别阈值。返回释放地球 viewer 并恢复太阳系循环；取消返回重新挂载时恢复最近地理相机姿态，不强制返回北京。

数值姿态与投影可验证；R3F 的程序化云、夜面、粒子与 Cesium 的大气/材质仍有外观差异，尚不是逐像素连续的最终视觉。两套 WebGL context 在探索期间仍驻留，只有一个活跃渲染；真实电视 GPU 内存/性能需另测。本轮没有新增城市内容或真实地图连接。

加载和已就绪两条路径复用原平台的 `isBackKey` 判定，继续识别 Escape、GoBack、BrowserBack、Android keyCode 4，重复按键只消费不重复返回；原生 `solaris-back` 也保留。返回取消仍会重新创建 Cesium Viewer 并等待首帧，延续的是姿态与摄像头检测会话，而非旧 Viewer 本身。

### 八大行星完成矩阵

| 天体   | 已有可用模块                                    | 最终连续区域流程/真实数据状态                            |
| ------ | ----------------------------------------------- | -------------------------------------------------------- |
| 水星   | 原太阳系选择/旋转；经典区域候选                 | 新连续区域、真实影像/地形与共用故事未接通                |
| 金星   | 原太阳系选择/旋转；经典区域候选                 | 云外观/雷达地表分模式未完成                              |
| 地球   | 连续低精度整球、北京 3 个地理热点、共用玻璃阅读 | ion 入口已实现但未连接；影像/标签/地形精度、建筑均未实测 |
| 火星   | 原奥林帕斯/维京图文与示意区域原型保留           | Mars 3644333 未连接；新连续相机/热点的火星坐标适配未完成 |
| 木星   | 原云带/大红斑视觉与旋转                         | 新云顶区域、观测时期锚点与共用面板未接通                 |
| 土星   | 原环/旋转                                       | 新环面/径向热点与共用面板未接通；现有颗粒是示意          |
| 天王星 | 原太阳系视觉/旋转                               | 连续区域、时期观测资料与共用面板未接通                   |
| 海王星 | 原太阳系视觉/旋转                               | 连续区域、历史风暴时期与共用面板未接通                   |

### 城市、目录与内容矩阵

| 范围                                        | 目录                         | 可读内容/真实地图验证                                                                                                                                                            |
| ------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 北京                                        | 既有城市对象                 | 3 个既有热点/3 张地标照片接到新面板；约略坐标与人审 pending 保留；没有清晰街区/建筑证明                                                                                          |
| 东京                                        | 既有城市对象/精选标签        | 尚无第二城新流程/图文验收；不能称两城复用已通过                                                                                                                                  |
| 伦敦、纽约、巴黎、罗马                      | 既有精选目录                 | 没有新地图与完整故事流程验收                                                                                                                                                     |
| 其余首都                                    | 固定来源快照，未全量现行复核 | 地图/故事未因目录数量自动变完成                                                                                                                                                  |
| 最终任务书其余点名城市及台湾、北海道 region | 范围保留，本轮不盲目扩目录   | 上海、深圳、杭州、香港、京都、平壤、首尔、新加坡、吉隆坡、东南亚首都、华盛顿特区、洛杉矶、曼彻斯特、莫斯科、圣彼得堡及非洲/南美/大洋洲首都仍需逐批核验接入；region 不能冒充 city |

目录数不变：250 国家/地区来源条目、249 首都关系、247 去重来源首都城市，合计 248 城市、6 个精选标签。已有局部内容合计 3 sites / 6 hotspots / 5 去重图片。本轮新增故事/照片 **0**，人工审核批准 **0**。既有事实/地点/权利记录复用且仍待审核；没有修改批准位。正式 release 校验仍按预期拒绝这些 pending 记录。

### 未完成与下一项工程任务

首先实际连接受限 ion 资产，小规模人工验证北京及东京的影像、标签、地形、署名、加载失败、相机近地净空，分别记录覆盖与真实分辨率；两城图文素材独立补证。未连接前，共用流程只能算本地预览验收，不能算任务书阶段 B 完成。

然后适配独立 Mars 椭球/3D Tiles，统一确认语义（太阳系已有 thumb 保留，lab 此批使用现有 pinch 状态机短捏，尚未统一 thumb），补分层国家/城市标签与辅助搜索，再验证云层与环类型，继续八行星及全球城市完整范围。现有 Android TV 壳无网络权限且拦截外网，不私自解除限制；真实网络路线、API来源限制与目标设备图形必须先设计验证。Mac独立App、M2 Safari/真人摄像头、Fire TV模拟器/真机、Vega均未验证；不开额外App框架或AI聊天支线。

开发录屏来自自动化本地 Web 操作，不是真人手势、真实城市数据或电视证明。非地球的新连续流程尚未完成，因此未伪造其验收录屏。桌面60/电视30FPS仍是目标，20次开关的DOM/canvas稳定也不等于完整GPU泄漏或性能证明。公共站点和参赛草稿没有更新。
