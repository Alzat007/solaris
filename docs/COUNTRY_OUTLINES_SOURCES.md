# SOLARIS 国家轮廓来源与适用范围

核验日期：2026-10-06。此图层只为现有 R3F 地球提供轻量国家轮廓，不提供街道、城市地形、建筑、政治立场判断或测绘精度。

## 官方来源与权利

- [Natural Earth 110m Admin 0 - Countries 官方说明](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/)：下载页的 countries 图层版本为 5.1.1，默认采用实际控制状况（de facto），不是各方主张的法定边界（de jure）。
- [Natural Earth 官方使用条款](https://www.naturalearthdata.com/about/terms-of-use/)：矢量与栅格数据属于公有领域，可修改并用于教育、个人与商业项目，无须另外申请授权。保留来源记录便于核验；此结论针对数据，不扩展到网站图片、标志或其他网页内容。
- [维护者官方仓库说明](https://github.com/nvkelso/natural-earth-vector)：`110m` 指 **1:110,000,000 制图比例尺**，并非 110 米空间分辨率，也不是边界误差保证。

## 固定版本与本地资产

使用官方仓库 `nvkelso/natural-earth-vector` 的 `v5.1.2` 标签，固定提交为 `f1890d9f152c896d250a77557a5751a93d494776`。仓库标签版本与单独图层版本不同，不将标签 5.1.2 冒充 countries 图层 5.1.2。

- [固定提交中的 GeoJSON 源文件](https://github.com/nvkelso/natural-earth-vector/blob/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_110m_admin_0_countries.geojson)
- [同一提交中的图层 VERSION 文件](https://github.com/nvkelso/natural-earth-vector/blob/f1890d9f152c896d250a77557a5751a93d494776/110m_cultural/ne_110m_admin_0_countries.VERSION.txt)：`5.1.1`
- 下载方式：GitHub Contents API 返回原文件的 Base64 字节，解码后原样保存。未修改坐标、属性、名称或边界。
- 本地文件：`public/geography/ne_110m_admin_0_countries.geojson`
- 大小：838,726 bytes
- SHA-256：`6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`
- 上游 Git blob SHA：`1e6ab74c7042f97013be69ceec798be8e1aff27d`
- 坐标系：CRS84，坐标顺序为 `[经度, 纬度]`，角度单位为度。
- 数据包 bounding box：`[-180, -90, 180, 83.64513]`

运行时仅请求同源的本地资产，不请求 Natural Earth、GitHub、Cesium 或其他地理服务，不需要 token、账号或付费服务。

## 覆盖计数与边界局限

从固定文件实际解析得到：

| 项目                      |          数量 |
| ------------------------- | ------------: |
| 国家/地区要素             |           177 |
| Polygon 要素              |           148 |
| MultiPolygon 要素         |            29 |
| 多边形（含岛屿部分）      |           288 |
| 闭合边界环（含内环）      |           289 |
| 源坐标点（含各环闭合点）  |        10,654 |
| 绘制线段（球面分段后）    |        10,479 |
| 顶点位置 Float32 缓冲大小 | 251,496 bytes |

177 是这个 **110m 简化数据包的要素数**，不是世界主权国家总数，更不是本项目首都/名城内容的完成数量。小型国家、岛屿与复杂边界可能简化、合并或省略；不能据此声明各国轮廓全部完整，也不适合近距离解释精确国界。

数据按上游 de facto 规则保留，争议地区与国家归属可能不同于其他地图或司法辖区的规范。包括中国周边及其他争议地区在内的发布合规、边界口径与政治中立表述仍需单独人工审核。**当前只核验来源、权利、数据完整性与几何格式，不声明已通过中国地图审查或所有目标发行地区的法律审核。** 正式公开发行前需要明确这一限制。

国家间共用边界可能存在于相邻两个多边形中；图层绘制原始边界环而不填充国家、不附加国家 pin，也不暗中改写争议边界。数据的属性不用于判断本项目城市的国家关系。

## 渲染与验证

- `CountryOutlines` 嵌入现有 `PlanetBase` 的 body group 内，继承已有地球旋转与缩放。不创建另一个地球、相机或输入源。
- 直接调用已有 `geographicPoint(latitude, longitude)`：北极为 `+Y`，东经 90 度为 `-Z`，与原 `SphereGeometry` UV 和地球贴图一致。
- 边界位于本地球半径 `1.003`；较长边按最短球面路径分为至多 2 度的小弦，跨反子午线不会绕远或穿过球体。重复点跳过；对跖点的歧义边明确报错。
- 严格验证 FeatureCollection、Feature、Polygon/MultiPolygon、非空层级、闭合环、坐标个数/类型/有限值/范围及至少三个不同坐标。此验证是结构与数值检查，不声称完成全球多边形拓扑或测绘审核。
- 单一 `BufferGeometry` 的 `lineSegments`，微弱暖白透明材质，不填充、不添加 pin，不参与点击命中；背面由现有地球的深度测试遮挡。
- `visible=false` 不绘制，并取消本次加载、释放几何；下次显示重新加载同源资产。卸载同样 Abort 与 dispose，迟到的结果不会更新组件。错误通过 `onStatus` 与控制台明确报告，不替换为虚构轮廓。
- `onStatus` 的 `featureCount` 是国家/地区要素数，`lineCount` 是闭合边界环数，不是分段后的 GPU 线段数。

局部测试：`tests/country-outlines.test.ts` 共 8 项通过，覆盖 Polygon/MultiPolygon/内环、非法数据、坐标对齐、反子午线、长边贴球、重复点、对跖点与固定文件 SHA-256/覆盖计数。真实 R3F 画面、深度遮挡、原手势、Fire TV 和实际性能由主任务集成后验证；这些不以纯几何单测冒充已通过。
