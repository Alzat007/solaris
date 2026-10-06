# SOLARIS 轻量地球：城市图文来源与审核边界

核验日期：2026-10-06。此批次只增加城市故事，不替换地球目录，不依赖地图服务令牌。

## 实际完成范围

- `src/exploration/cityStories.ts`：10 个重点城市、11 个教育事件、22 张本地图库图片。
- 北京复用 4 张已存在图片；其他 9 城各下载 2 张真实照片，共 18 张新 JPEG。
- 每城包含双语基本介绍、历史事件、图库、图像日期/许可/署名、事实来源和地点关系。
- `humanReview` 全部仍为 `pending`。来源机器核验不冒充参赛者的人工审核。
- 只有这 10 城属于本轮图文覆盖；地球目录中的其他城市是目录数据，不因出现标注就自动拥有故事。
- 既有目录包含 250 个国家/地区条目、248 个城市、247 个首都标签、244 个有坐标城市。它是固定数据库快照，不是“250 个主权国家”或实时法律首都清单。

## 事实、坐标与图片分别核验

下面文案是简短原创介绍与事实归纳，不直接复制来源描述。世界遗产事件是文化保护里程碑，不声称委员会在照片所示地标开会。城市锚点不冒充每张照片机位或每个事件会场的精确位置。

| 城市       | 本轮教育事件                                       | 第一手事实依据                                                                                                                                                                     |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 北京       | 2024-07-27 中轴线列名；2008 国家体育场奥运开闭幕式 | [UNESCO 中轴线](https://whc.unesco.org/en/list/1714/)、[列名决议](https://whc.unesco.org/en/decisions/8607/)、复用 `immersiveCatalog.ts` 中 IOC/设计方的已记录来源                 |
| 上海       | 2010-05-01 至 2010-10-31 世博会、城市生活主题      | [BIE 官方 Expo 2010 条目](https://www.bie-paris.org/site/en/2010-shanghai)                                                                                                         |
| 纽约       | 1886 自由女神像落成、艺术工程合作与国际友谊        | [UNESCO 自由女神像](https://whc.unesco.org/en/list/307/)                                                                                                                           |
| 华盛顿特区 | 1846-08-10 史密森学会成立、知识传播                | [Smithsonian Archives](https://siarchives.si.edu/history/general-history)、[机构历史](https://www.si.edu/about/history)                                                            |
| 巴黎       | 1991 塞纳河畔世界遗产列名、城市文化保护            | [UNESCO 塞纳河畔](https://whc.unesco.org/en/list/600/)                                                                                                                             |
| 伦敦       | 1988 伦敦塔世界遗产列名、建筑保护                  | [UNESCO 伦敦塔](https://whc.unesco.org/en/list/488/)                                                                                                                               |
| 东京       | 1964 代代木体育馆与奥运体育建筑                    | [日本体育振兴中心年表](https://www.jpnsport.go.jp/yoyogi/sisetu/tabid/104/Default.aspx)、[设施英文介绍](https://www.jpnsport.go.jp/corp/english/activities/tabid/391/default.aspx) |
| 首尔       | 1997 昌德宫列名、宫殿与地形保护                    | [UNESCO 昌德宫](https://whc.unesco.org/en/list/816/)                                                                                                                               |
| 莫斯科     | 1990 克里姆林宫和红场列名、城市建筑保护            | [UNESCO 条目](https://whc.unesco.org/en/list/545/)                                                                                                                                 |
| 新加坡     | 2015 植物园列名、植物研究与公共教育                | [UNESCO 植物园](https://whc.unesco.org/en/list/1483/)                                                                                                                              |

9 城继续使用既有 `earthDirectory` 坐标，数据库归属与 ODbL 许可保留不变。上海尚不在既有目录，本轮单独故事锚点采用 [Wikidata Q8686](https://www.wikidata.org/wiki/Q8686) 的 31°13′57″N、121°28′9″E，换算为 31.2325°、121.469167°。该页面记录源自 OpenStreetMap 节点；只作为城市示意锚点，不冒充世博中国馆坐标或导航测绘数据。

## 图片清单

每张新图均从 Wikimedia Commons 官方 `imageinfo` API 读取图片原记录、原作者、许可、拍摄日期和实际下载地址，再一次性下载入 `public/exploration/cities/`。网页运行只读本地文件，不热链。`source-records.json` 保留当次 API 元数据、原图/缩略图 URL、尺寸、字节数及 SHA-256。

日期采用图像来源记录，不采用上传日期；原记录只精确到月份时保留月份。未本地裁剪、调色或合成，不将 AI 图、占位图或模糊背景当真实照片。下载的 18 张图已检查 JPEG 头并制作联系表做目视核验。

| 本地文件                        | 图像/作者                         | 拍摄日期   | 许可                            | 与事件关系                           |
| ------------------------------- | --------------------------------- | ---------- | ------------------------------- | ------------------------------------ |
| `beijing-tiananmen-2008.jpg`    | 天安门 / Rabs003                  | 2008-10-12 | CC BY-SA 3.0                    | 中轴线主题地点配图，非 2024 列名现场 |
| `beijing-badaling-2006.jpg`     | 八达岭 / Robysan                  | 2006-08-05 | CC BY-SA 3.0                    | 北京文化遗产地点配图，非某次修复记录 |
| `beijing-birds-nest-2020.jpg`   | 国家体育场 / Balon Greyjoy        | 2020-01-09 | CC0 1.0                         | 2008 赛事的后期场馆配图，非赛事照片  |
| `beijing-central-axis-2012.jpg` | 中轴线 / rheins                   | 2012-05-08 | CC BY 3.0                       | 2024 列名主题的较早地点配图          |
| `cities/shanghai-1.jpg`         | 世博中国馆 / Gary Lee Todd, Ph.D. | 2010-09-17 | CC0 1.0                         | 展期场馆记录，非开幕式               |
| `cities/shanghai-2.jpg`         | 中国馆外观 / Windtrain            | 2010-12-25 | CC BY-SA 3.0                    | 世博闭幕后场馆配图                   |
| `cities/new-york-1.jpg`         | 自由女神像 / Daniel Schwen        | 2008-05-28 | 作者明确放弃版权、Public domain | 1886 落成的后期地标配图              |
| `cities/new-york-2.jpg`         | 自由岛 / Don Ramey Logan          | 2014-12-14 | CC BY 4.0                       | 港口地标位置背景，非典礼现场         |
| `cities/washington-dc-1.jpg`    | 史密森城堡 / Jorgebellatin        | 2012-09-04 | CC BY-SA 3.0                    | 1846 机构成立的后期地点配图          |
| `cities/washington-dc-2.jpg`    | 史密森城堡 / Alvesgaspar          | 2016-10-05 | CC BY-SA 4.0                    | 机构成立非建筑竣工，后期地点配图     |
| `cities/paris-1.jpg`            | 塞纳河与远处圣母院 / Nadiantara   | 2018-11-18 | CC BY-SA 3.0                    | 1991 列名主题的后期地点配图          |
| `cities/paris-2.jpg`            | 塞纳河 / Kabusa16                 | 2018-04-15 | CC BY-SA 4.0                    | 河流城市景观，非列名现场             |
| `cities/london-1.jpg`           | 从河上看伦敦塔 / Bob Collowan     | 2013-07-22 | CC BY-SA 3.0                    | 1988 列名的后期地点配图              |
| `cities/london-2.jpg`           | 伦敦塔白塔局部 / Dietmar Rabich   | 2016-10-09 | CC BY-SA 4.0                    | 建筑细节配图，非决议现场             |
| `cities/tokyo-1.jpg`            | 代代木第一体育馆 / Rs1421         | 2010-05-22 | CC BY-SA 3.0                    | 1964 赛事的后期场馆配图              |
| `cities/tokyo-2.jpg`            | 代代木涩谷侧入口 / Rs1421         | 2012-11    | CC BY-SA 3.0                    | 精确到月份，非赛事现场               |
| `cities/seoul-1.jpg`            | 昌德宫仁政殿 / Bernard Gagnon     | 2022-09-27 | CC0 1.0                         | 1997 列名的后期地点配图              |
| `cities/seoul-2.jpg`            | 仁政殿庭院品阶石 / Bernard Gagnon | 2022-09-27 | CC0 1.0                         | 空间细节配图，非列名现场             |
| `cities/moscow-1.jpg`           | 红场 / Vyacheslav Argenberg       | 2012-05-25 | CC BY 4.0                       | 可见当时活动布置，非 1990 列名现场   |
| `cities/moscow-2.jpg`           | 红场全景 / Юрий Д.К.              | 2025-09-15 | CC BY 4.0                       | 后期地点配图，非 1990 活动           |
| `cities/singapore-1.jpg`        | 植物园音乐亭 / Basile Morin       | 2018-06-11 | CC BY-SA 4.0                    | 2015 列名的后期景观配图              |
| `cities/singapore-2.jpg`        | 天鹅湖树枝倒影 / Basile Morin     | 2018-06-11 | CC BY-SA 4.0                    | 植物及景观配图，非 2015 活动         |

完整图片原始来源链接与许可链接在 `cityStories.ts` 的图库对象、面板图片署名及 `source-records.json` 中分别保留。Public domain 自由女神像图以作者文件页作为权利说明，不把它误标为 CC0。各 Creative Commons 图片各自保留原许可，不以应用源码许可取代图片许可；同类分享要求适用于对应图像及其衍生图像。整体图库没有声称所有图像都 public domain。

## 已修正的目视问题

首次搜索得到的 `China Pavilion 01` 实际主要显示园区旗帜，与准备的“中国馆外观”图注不相符，已在开发目录中换为 `China Pavilion 03` 并同步原始记录和校验值。文件名/搜索结果不能替代图像目视核验。白塔第二张是塔楼局部，保持其来源位置说明，不称作完整伦敦塔全景。

## 尚未完成

- 所有文字和图片仍需参赛者逐条人工审核；不宣称已经人工批准。
- 北京以外每城当前只有一个精选教育事件，并非完整城市历史或完整地标目录。
- 大部分图库是历史主题对应地点的后期照片，不是当年活动现场。进一步加入真正现场档案图必须再次核验独立图片权利。
- 更多首都与名城仍待逐批添加基本介绍、事件、图库及人工审核，不能自动编造补齐。
- 图片包含长宽比差异，面板应使用真实图片适配，不用裁切把所有图都伪装成横幅。

## 国家轮廓数据建议

本轮核验 [Natural Earth 官方条款](https://www.naturalearthdata.com/about/terms-of-use/)：发布的栅格/矢量地图数据为 public domain，无需令牌，可本地打包。官方维护仓库 [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) 提供 `geojson/ne_110m_admin_0_countries.geojson`。`110m` 是 1:110,000,000 制图比例尺，不是 110 米地面分辨率；适合整球示意，不适合街道或精确边界。边界争议、小岛省略和时间快照应说明，不能包装成官方法律边界判断。
