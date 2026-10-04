# V3 Content Batch 1 / 内容核验记录

核验日期：2026-10-04（Asia/Shanghai）。执行者：Codex source review。

这是基于公开一手资料进行的来源检查，不是人工编辑批准、法律意见或机构背书。所有记录的 `humanReview` 仍为 `pending`，没有自动生成 `approved=true`。当前 `ready` 表示有可读图文且已做来源核验，不等于最终编辑批准。经参赛者确认，可作为明确标注的公开测试版展示：品牌区与探索工具栏显示测试版状态，地点页保留人工复核提示、事实来源、图片署名和许可入口。正式内容版本、比赛演示使用及署名方式仍需参赛者复核；公开测试版不表示 Amazon Appstore 上架或比赛正式提交。

This is a source-reviewed public-beta batch, not human editorial approval. Every record retains `humanReview: "pending"`. Publishing this explicitly labeled beta requires the participant's confirmation; it is not an Amazon Appstore release or a competition submission. NASA, JPL, UNESCO, and the photographer do not endorse this project. The participant must complete content and attribution review before presenting an editorially approved release or the competition demo.

## Scope And Status

`src/exploration/content.ts` 导出 `destinations`、`stories`、`assets`、`sources`、`contentPack`、`contentPacks` 和带版本的 `explorationContent`。稳定关联键不依赖中文/英文显示名称。这个批次不定义最终产品范围，不代表全球首都或所有行星内容已经完成。

| 类别             | 本轮实际数量 | 说明                                                       |
| ---------------- | -----------: | ---------------------------------------------------------- |
| 行星目录覆盖     |            8 | 水、金、地、火、木、土、天王、海王；不把太阳或月球算作行星 |
| 地点/观察主题    |            9 | 每颗行星至少一个真实、有来源的候选                         |
| `ready` 图文地点 |            3 | 奥林帕斯山、维京 1 号着陆点、北京中轴线                    |
| `draft` 目录候选 |            6 | 资料/图片包未完整，不能进入正式图文页                      |
| 故事             |            3 | 自然区域的远程观测、无人探测里程碑、文化遗产保护           |
| 本地真实 JPEG    |            3 | 已下载、逐张查看、检查 JPEG 文件头与尺寸                   |
| 事实/元数据来源  |           12 | NASA/JPL、USGS、UNESCO、Commons 原文件页面；图片许可另列   |

草稿候选：水星卡洛里盆地、金星麦克斯韦山脉、木星大红斑、土星环、天王星环、海王星 1989 年大暗斑。候选名称与简短说明已有对应机构资料，但没有把缺图、缺故事的条目设置为 `ready`。大暗斑明确采用历史时间；NASA 记载该 1989 年风暴后来消失，不能冒称当前实时固定地标。

地球地点使用 `cityId: "city-beijing"`，供国家/城市目录关联。内容校验检查 ID 格式，城市目录的实际外键由目录集成层另外核验；此文件不生成或宣称完整首都目录。

## Facts And Location Relationships

### Olympus Mons

- [NASA/JPL PIA00993 原页面](https://www.jpl.nasa.gov/images/pia00993-olympus-mons-in-color/)：MOC 影像采集时间为 1997-10-20，页面发布于 1998-04-23；不是 1998 年现场活动。
- 内容只引用该 1998 图注的水平尺度：东西向火山范围约 550 km，山顶复合破火山口约 66 × 83 km。明确这不是山高，不把不同高度基准或控制网的直径数值混在一起。
- 故事关系为 `remote-observation`，不编造登山、考察或载人登陆。
- [IAU/USGS Olympus Mons 4453](https://planetarynames.wr.usgs.gov/Feature/4453)：页面提供多个控制网结果；本批次选其列出的一组行星中心纬度/+East 区域中心 18.65°N、226.20°E，统一换为 -133.80°经度。`exact:false`，不解释为着陆点、山顶精确点或区域边界。

### Viking 1

- [NASA Viking 1 任务记录](https://science.nasa.gov/mission/viking-1/)：1976-07-20 安全着陆、成像与后续土壤/环境研究；1971 年 Mars 3 的短暂着陆通信与 Viking 的持续成功探测分开说明，不使用含混“人类首次登陆”标题。
- 未声称载人火星登陆或确证火星生命。实验与生命结论之间保留边界。
- NASA 该任务页面坐标为 22.483°N、47.94°W；东经正值约定转为 -47.94°。原页面没有明确纬度基准，故记 `source-unspecified-east`、`exact:false`，只用于示意。其他 NASA 页面可能采用行星中心纬度并给出不同数值；不得混称同一精确控制网。
- 故事关系为 `event-at-site`；照片与无人着陆/成像在该点相关，但地球任务控制中心不被标成位于火星。

### Beijing Central Axis

- [UNESCO 遗产条目 1714](https://whc.unesco.org/en/list/1714/)：2024 年列入名录；南北向城市遗产区域与规划/保护主题。当前正文为短篇改写，不复制 UNESCO 说明全文。
- 时间仅记 `2024`，不编造资料中未独立核验的具体日期。
- 地点采用 UNESCO 列出的 39°54′26″N、116°23′29″E 对应代表点，以应用 WGS84 经纬度约定显示；`exact:false`，不称城市边界、摄影位置或决议会场。
- 关系为 `topic-related`：列名认可与这个遗产地相关，不把某张永定门照片解释成委员会决定发生的现场。
- 选录的是文化保护主题，不声称描述全部城市历史。

## Image Rights Are Separate From Facts

| 本地文件                                           | 原始记录与日期                                                                                                                                                                             | 权利入口及署名                                                                                               | 素材角色/处理                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `public/exploration/olympus-mons-pia00993.jpg`     | [JPL PIA00993](https://www.jpl.nasa.gov/images/pia00993-olympus-mons-in-color/)，采集 1997-10-20                                                                                           | [JPL image-use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/)；NASA/JPL/Malin Space Science Systems | 轨道彩色合成；实测红蓝波段，绿色由两者合成；未本地裁剪或重新着色                   |
| `public/exploration/viking-1-pia00381.jpg`         | [NASA PIA00381](https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/)，拍摄 1976-07-20；条目添加时间 1996 年不是拍摄时间                                          | [NASA media-use guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)；NASA/JPL              | 历史地面黑白照片；NASA 提供 JPEG 尺寸版本，未本地着色；普通宽幅照片，不拉伸为 360° |
| `public/exploration/beijing-central-axis-2012.jpg` | [Commons 原文件页面](https://commons.wikimedia.org/wiki/File:%E5%8C%97%E4%BA%AC%E4%B8%AD%E8%BD%B4%E7%BA%BF_-_Central_Axis_of_Beijing_-_2012.05_-_panoramio.jpg)，摄影者 rheins，2012-05-08 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)；rheins / Wikimedia Commons / CC BY 3.0            | 地标配图；Commons 960px 缩略图，未本地裁剪/调色，不是 2024 活动现场或当前实时影像  |

原始资源 URL、原网页、许可网页、credit、拍摄时间、地点、角色、处理情况、`aiGenerated:false`、projection 分别保存在 `Asset` 中。署名、日期和许可链接必须在页面保留，不能只有仓库文档有署名。

NASA/JPL 并非“一切网页图片都无版权”：逐张页面署名与 NASA/JPL 通用政策一起核验。本轮 NASA/JPL 图未见单独版权禁用标识，按教育/事实展示用途记录；MSSS 等第三方材料的商业用途仍须另询权利方，不能从一般页面使用推导商业广告许可。不使用 NASA/JPL 标志，不暗示机构认可。

Commons 文件页面明确记录 CC BY 3.0 与作者。使用其提供的缩略版本，需保持作者、许可链接并说明缩略处理；拍摄位置与 UNESCO 遗产代表位置不混用。许可不等于对所有潜在肖像/商标使用的无条件担保，后续商业宣传须另行核验。

三张实际文件：834 × 834 / 35,045 bytes；1439 × 512 / 166,273 bytes；960 × 720 / 128,445 bytes；总计 329,763 bytes。使用标准照片/轨道图模式，不伪装全景。终端直连 Commons CDN 超时后，下载使用机器原已配置的本地 HTTP 代理；未更改系统设置或图像像素。

## Validation And Publication Gate

`validateContent(explorationContent)` 返回错误字符串数组，空数组表示当前编译内置数据在结构、关联与 source-reviewed 预览规则下通过。校验包括：稳定 ID/重复、天体和类型、引用/双向多对多关系、日期精度和合法性、中英文非空、坐标范围/基准、素材路径、HTTPS 来源、许可/署名、事实和素材审核状态、AI 素材标注、故事资产预加载清单。自动校验不能证明语义事实或权利本身准确。

`validateContent(explorationContent, { requireHumanReview: true })` 是更严格的正式发布检查；本批次会因人工复核未完成而报告错误。这是预期结果，不能自动改批准位“解决”错误。

公开测试版使用结构与来源核验的预览检查，并持续披露人工复核未完成；这与上述正式内容检查是两种状态，不得将测试版校验成功写成正式内容审核通过。线上部署完成也不等于 APK 平台验证、Appstore 上架或比赛提交。

测试检查本地资源实际存在、JPEG 文件头与单图 < 500,000 bytes，不进行运行时远端请求；未来从 JSON 导入内容时，还应先做输入结构检查再调用此类型化校验器。本批次不是任意不可信 JSON 解析器。

本地资源已随构建打包，不等同已实现 Service Worker 离线缓存或整站离线安装。未缓存/未打包的草稿候选没有虚假的可进入入口。

### ContentPack Manifest

`public/exploration/content-pack.json` 是首批包的单一清单，内容模块直接导入，不维护另一套手写镜像。清单包含版本、三个 ready 地点的稳定 ID、资产 ID、相对路径、每文件字节数、SHA-256 与总字节数。它不把六个 draft 候选当作包内可用图文。

`offlineStatus: "bundled-assets-only"` 与 `browserColdStartVerified: false` 分别明确本地图已随工程分发、浏览器离线冷启动未实现/未验证。目录校验拒绝包内 draft 地点、缺失文件条目、跨版本引用、错路径、错误校验值格式/总字节数与不一致的离线声明。

`node scripts/verify-content-pack.mjs` 只读 JSON 与本地图，检查实际字节数和 SHA-256，不依赖 TypeScript 内容模块、不联网、不写缓存或批准位。此命令成功只能证明这个本地包文件完整，不能证明浏览器已缓存或可离线启动。

| Asset ID             |   Bytes | SHA-256                                                            |
| -------------------- | ------: | ------------------------------------------------------------------ |
| `asset-olympus-mons` |  35,045 | `a190196034d30c33e91be67c3dd23358b2ee46b8fa816d6e6448330a30fb0726` |
| `asset-viking-1`     | 166,273 | `cf33909637a4028ff3902a6b2d701c17eeb77829d543968d9b742a35c73d8874` |
| `asset-beijing-axis` | 128,445 | `715c92d074f018400b81239580f27d09491a576b2cf9b3cebb2a7bfcb917483d` |

## Verification

已运行：`node node_modules/tsx/dist/cli.mjs --test tests/exploration-content.test.ts`（使用已有 Codex Node 24 运行时）。结果：26 tests passed，0 failed。三张图片均已通过本地图片查看工具检查。`node scripts/verify-content-pack.mjs` 通过：3 local files、329,763 bytes、全部 SHA-256 匹配。

全量 `npm test`、生产 build、浏览器/Fire TV 实际展示与交互由集成阶段另行记录，不能用本次数据单测冒充已完成整站或目标平台验收。

## Next Content Batch

先逐项完成六个 draft 候选的可信故事、时间与图片权利，再通过同一模板扩展。城市目录有候选不表示其故事完成；新增城市以稳定 ID 去重，人工名城选录、首都角色/日期与来源仍须保留。不要批量编故事、自动批准素材或将这三个样板固化为最终范围。
