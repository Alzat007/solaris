# SOLARIS 轻量地球验收记录

日期：2026-10-06。本轮按最新产品方向实施：原太阳系中的地球可旋转、缩放，展示国家轮廓与城市注释标注；点击后在同一场景打开玻璃图文面板。不再以街道级无限缩放或复杂下降动画为验收目标。

## 当前版本与保护范围

- 工作目录：`/Users/zhatiaili/Desktop/比赛项目/SOLARIS-掌中星系/项目源码`。
- 分支：`codex/solaris-talk-text-control`；HEAD：`f8e37aee019a0b1033a83c89739c0e333802d8c2`。
- 本轮修改尚未提交。构建标记 `dirty: true`，不能把 HEAD 或 URL 查询参数当作这些功能已公开部署的证据。
- 本轮未提交、推送或公开发布，也未开通付费服务、配置账户凭据。
- 开始时已有的 16 个修改/新增文件，按 `artifacts/classic-preserved-worktree.json` 的 SHA-256 逐文件复查，内容完全不变。之前的地图接入、诊断和构建配置工作保留。
- 原始手势识别模块未重写，经典版打包与 GitHub Pages 发布流程未修改。

## 复用与控制归属

- 继续使用原 `SolarScene`、`SolarSystem`、`Earth`、`PlanetBase` 和同一个 R3F Canvas，不增加第二个地球模型。
- 地球 body 旋转仍由 `PlanetBase` 写入；缩放、选择、返回仍经过 `InteractionController`；相机仍由 `CameraController` 控制。
- 新增投影组件只读取现有地球世界矩阵和相机，将城市经纬度投影到 HUD，不另写相机或球体变换。
- 复用 `GlobeStoryPanel`，扩展图库、事件、署名和焦点管理；既有火星单图内容兼容。
- 状态复用 `PLANET_OVERVIEW → INFO_PANEL_OPEN → PLANET_OVERVIEW`，没有增加互相竞争的场景状态机。打开城市面板时冻结相机、地球旋转和缩放，并清除尚未执行的旋转/城市聚焦请求。
- 默认使用轻量地球。原 Cesium 路线保留在显式 `?earth=map` 或 `?data=ion` 参数下；没有把未连接的地图服务伪装为已连接。

## 功能验收

| 能力 | 实际结果 |
| --- | --- |
| 自动旋转 | 缓慢自转，可暂停/恢复；手动操作暂停自动旋转 |
| 手动旋转与缩放 | 鼠标横向/纵向拖动、滚轮、旋转与缩放按钮可用，复用原控制链 |
| 国家轮廓 | 真实本地 GeoJSON，177 个国家/地区要素，289 个边界环，10,479 条球面线段，随原地球旋转缩放 |
| 城市标注 | 245 个有效坐标入口；背面隐藏、前面按视口避让；重点城市优先，文字不全部同时挤在球面上 |
| 注释样式 | 圆点/圆圈、折弯引导线、名称；经纬度绑定球体，不是固定屏幕位置或普通 pin |
| 点击才打开 | 悬停/聚焦只高亮，城市选择只转向目标；主动点击、键盘确认才打开面板；拖动和取消不误开 |
| 玻璃图文 | 半透明、背景模糊、柔和高光与淡入上浮；保留原地球背景，照片和文字无模糊滤镜 |
| 图库与历史事件 | 上一张/下一张、缩略图、事件配图切换；每张独立署名和许可；加载失败可重试 |
| 关闭恢复 | 开关面板前后相机、地球矩阵、缩放和朝向不变；取消返回太阳系也恢复稳定姿态 |
| 原场景 | 可返回太阳系，并继续选择火星；不删除既有非地球探索能力 |

## 文件清单

修改现有源码 14 个文件：

- `src/interaction/store.ts`
- `src/interaction/InteractionStateMachine.ts`
- `src/interaction/InteractionController.ts`
- `src/planets/PlanetBase.tsx`
- `src/planets/Earth.tsx`
- `src/camera/CameraController.tsx`
- `src/scene/SolarSystem.tsx`
- `src/scene/EarthHandoff.tsx`
- `src/scene/SolarScene.tsx`
- `src/scene/PointerFallback.ts`
- `src/scene/InputField.tsx`
- `src/ui/HUD.tsx`
- `src/globeLab/GlobeStoryPanel.tsx`
- `src/globeLab/storyPanel.css`

新增源码 9 个文件：

- `src/exploration/earthAtlasState.ts`
- `src/exploration/earthAtlasCatalog.ts`
- `src/exploration/earthAtlasProjection.ts`
- `src/exploration/EarthAtlasProjector.tsx`
- `src/exploration/EarthAtlasUI.tsx`
- `src/exploration/earthAtlas.css`
- `src/exploration/CountryOutlineLayer.tsx`
- `src/exploration/countryOutlines.ts`
- `src/exploration/cityStories.ts`

新增测试、数据与来源记录：

- `tests/city-stories.test.ts`
- `tests/country-outlines.test.ts`
- `tests/earth-atlas.test.ts`
- `tests/earth-atlas-interactions.test.ts`
- `public/geography/ne_110m_admin_0_countries.geojson`
- `public/exploration/cities/`：18 张新 JPEG 与 `source-records.json`；北京复用 4 张既有照片。
- `docs/CITY_STORIES_SOURCES.md`
- `docs/COUNTRY_OUTLINES_SOURCES.md`
- 本验收记录。

## 数据覆盖与审核边界

- 保留既有目录：250 个国家/地区条目、248 个城市、247 个首都标签，244 个城市已有有效坐标；另加上海故事锚点，得到本轮 245 个可投影城市入口。这些数字不等于主权国家数量，也不等于已完成故事数量。
- 完整图文覆盖 10 城：北京、上海、纽约、华盛顿特区、巴黎、伦敦、东京、首尔、莫斯科、新加坡。
- 这 10 城共 11 个教育事件、22 张真实图片；其余 235 个入口只提供明确标识的目录信息，不虚构事件、照片或已完成故事。
- 事实依据、城市坐标关系、图像权利分别记录于来源文档与数据对象。大多数图片是对应历史主题的后期地标照片，明确区分于当年活动现场图片。
- 已由来源与图片元数据核验，人工批准数量仍为 0，10 城的 `humanReview` 均为 `pending`，需参赛者逐条确认。
- 国家轮廓采用 Natural Earth 公有领域数据。`110m` 是 1:110,000,000 制图比例尺，不是 110 米分辨率；小岛、小国和复杂边界会被简化或省略。
- 默认图层没有街道、地形或三维建筑。本次展示是整球示意，不声称 Google Maps / Cesium 真实地图加载已成功。
- 国家轮廓的争议边界口径、首都角色和面向发行地区的地图合规仍需人工审核，未宣称通过地图审查。

## 实际测试

| 项目 | 结果 |
| --- | --- |
| `npm test` | 520/520 通过，无失败或跳过 |
| `npm run build`，默认 `/` base | 通过 |
| `VITE_BASE_PATH=/solaris/ npm run build` | 通过，生产构建使用 `/solaris/` 资源前缀 |
| `node scripts/verify-static-export.mjs` | 通过，既有静态资源和许可检查保留 |
| 新轮廓与 18 张新增 JPEG 的源/构建字节比对 | 通过 |
| Playwright，生产构建、实际 WebGL | 12 组端到端检查通过；无页面错误或资源请求失败 |
| 桌面与 390px/320px 视口 | 截图目视检查和非空 Canvas 像素检查通过；无水平溢出 |
| 十城图库 | 22 张图片全部实际加载；第二城市巴黎验证非北京写死 |
| 图库缓存/错误恢复 | 十城多次缓存重开、切图、旧单图、缺图、阻断请求后重试通过 |
| 1920px TV 模式键盘模拟 | 城市选择、方向键焦点、Enter、Escape 返回通过；不等于 Fire TV 真机验收 |

生产浏览器证据：`artifacts/light-earth-production-qa.json`，配套截图位于相同目录。开关面板前后相机/地球姿态以 1e-6 容差比较。通过 `?qa=1` 的只读调试接口读取真实场景对象可见性和轮廓几何数，不以 DOM 文案代替 WebGL 检查。

构建仍有既有可选 `GlobeLab` 大分块警告，不影响构建通过；本轮未删除地图接入代码来消除警告。生产构建的 ion `tokenConfigured: false`，轻量地球不需要该令牌。尚未验证离线冷启动。

## 本地复现

1. 开发地址：`http://127.0.0.1:5176/`。已测试的生产预览：`http://127.0.0.1:5179/solaris/`。
2. 选择“也可以用鼠标探索”，进入太阳系后选择“地球”。这是同一太阳系中的原地球。
3. 观察自动旋转；拖动地球后自动旋转暂停。滚轮或缩放按钮改变原控制器缩放。
4. 从城市选择器定位北京，再点击地球表面的北京注释标注，浏览主图、其他照片和历史事件。城市选择本身不会弹出卡片。
5. 关闭面板确认地球视角未重置；选择巴黎，重复图文流程。其他城市使用同一组件和数据结构。
6. 打开/关闭国家轮廓，返回太阳系并选择火星，确认原路径仍可用。

可复跑浏览器验收：`node artifacts/qa-light-earth.mjs http://127.0.0.1:5179/solaris/ light-earth-production`。`artifacts` 是本地测试证据，不是公开发布内容。

## 尚未完成

- 更多国家首都与世界名城的完整介绍、精选教育事件和已授权图片；235 个现有投影入口尚无完整故事。
- 既有目录的布隆方丹、开普敦、比勒陀利亚、拉姆安拉缺少已核验坐标，未编造补齐。
- 更多真正历史活动现场图片需逐张核验；现有后期地标照片不能冒充现场档案。
- 10 城人工图文审核，以及国家轮廓/首都角色/发行地区地图合规审核。
- Fire TV 真机遥控器与性能、长文阅读体验，M2 Safari 实机和实际摄像头手势仍未验证。浏览器键盘模拟不替代这些测试。
- 显式 Cesium 数据路线本轮未重新做真实账户加载验证；其已有工作保留，不计入轻量地球的通过项。
- 本轮未公开部署；公开网页仍是之前版本，不能用本地构建结果宣称公网已更新。
