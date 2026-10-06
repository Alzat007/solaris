# 首批地球城市内容与来源

源核验日期：2026-10-06。核验者：Codex source review。**全部人工复核仍为 pending**；source-checked 不表示人工批准、官方背书或所有潜在第三方权利已获授权。

## 范围与契约

- 用户清单实际为 **52 城**，不是 58 城；亚洲 18、欧洲 9、北美洲 9、南美洲 4、大洋洲 5、非洲 7。
- `firstBatchCities` 提供中英名称、国家／地区导航关系、城市级坐标、来源和首都目录标签；`firstBatchContinents` 与 `firstBatchCountries` 提供 6 大洲、31 个国家／地区导航组。
- `firstBatchCityStories` 有 52 个可读图文故事：原 10 城原样复用，新增 42 城。每城至少 2 张不同真实照片，中英简介、一个有日期和来源的文化／科学／教育主题，及主题与照片的明确关系。
- 36 个新增城市下载 72 张 JPEG，合计 **15,748,813 字节**；另外 6 个新增城市复用 12 张独立源核验通过的地标照。原 10 城图库共 22 张，当前 52 城图库合计 106 个照片条目。
- 新文件下载、原始尺寸、缩略图尺寸、完整 Commons 元数据、作者、许可、拍摄日期、下载 URL、字节数及 SHA-256 均保存在 [`source-records.json`](../public/exploration/first-batch/cities/source-records.json)。失败列表为空。72 张新照片未重新编码，采用 Commons 提供的约 960px 尺寸版本。
- `firstBatchPendingCityIds` 诚实暴露未满足图文门槛的城市；当前为空。新城市在没有至少两张已核验图片时，不生成空故事或假入口。
- 这些资源可随网站打包，不表示浏览器首次离线冷启动可用。本任务没有更新 PWA、增加云服务或承诺离线缓存完整。

## 分组与坐标口径

按用户指定的国家／地区导航关系组织。中国组包含北京、上海、深圳、杭州、香港、台北；这只是编辑导航分组，不是行政、政治地位或边界判断。香港、台北不标为中国组首都。莫斯科和圣彼得堡按城市位置置于欧洲，不把俄罗斯整个国家描述为仅位于欧洲。

有既有城市记录时优先保留原目录坐标。目录来源包括 REST Countries 与 [mledoze/countries（ODbL 1.0）](https://github.com/mledoze/countries/blob/c2ac0049c14edcf2436c7aa1b2493222a020b462/LICENSE)，派生数据库为 [`earth-directory-source.json`](https://raw.githubusercontent.com/Alzat007/solaris/v3-public-preview-2026-10-04/data/earth-directory-source.json)。实际目录的来源 URL、下载 URL 与数据库归属以 `earthDirectory.databaseLicense` 为准；本文件不改变原数据库许可。开放数据许可不是事实准确性或现行法律状态保证。

新增锚点读取对应 Wikidata 项目的 P625。所有图文的坐标均为**城市级示意锚点**，不是照片机位、地标中心或历史活动现场；首都标签只沿用来源目录，不是当日法律身份核验。下表的“目录”指保留原目录；Q 编号直接链接坐标来源。

## 亚洲

| 城市   | 坐标                                           | 文化／科学／教育主题及事实源                                                                                                               | 照片来源                                                          |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 北京   | 目录                                           | 复用原 `cityStories` 中北京中轴线图文与原始事实链接                                                                                        | 原图库 4 张                                                       |
| 上海   | [Q8686](https://www.wikidata.org/wiki/Q8686)   | 复用原上海城市故事、世博建筑事实和来源                                                                                                     | 原图库 2 张                                                       |
| 深圳   | [Q15174](https://www.wikidata.org/wiki/Q15174) | [UNESCO 设计之都，2008](https://www.unesco.org/en/creative-cities/shenzhen)                                                                | 深圳湾／华强北已核验地标照各 1 张                                 |
| 杭州   | [Q4970](https://www.wikidata.org/wiki/Q4970)   | [西湖文化景观，2011](https://whc.unesco.org/en/list/1334/)                                                                                 | 西湖／灵隐寺各 1 张；灵隐寺不据此判定遗产边界                     |
| 香港 | [Q8646](https://www.wikidata.org/wiki/Q8646) | [香港会展中心开放，1988；扩建 1997／2009](https://www.hkcec.com/en/image-gallery) | 会展中心两张不同真实照片；不冒充开放或扩建施工现场 |
| 台北 | 目录 | [故宫博物院对公众开放，1965-11-13](https://www.npm.gov.tw/Articles.aspx?l=2&sno=03012532) | 已核验故宫台北院区两张外观照，不冒充馆内文物或开馆现场 |
| 东京   | 目录                                           | 复用原东京奥运体育建筑城市故事及来源                                                                                                       | 原图库 2 张                                                       |
| 京都   | [Q34600](https://www.wikidata.org/wiki/Q34600) | [古京都遗产系列，1994](https://whc.unesco.org/en/list/688/)                                                                                | 清水寺／金阁寺已核验地标照各 1 张                                 |
| 札幌   | [Q37951](https://www.wikidata.org/wiki/Q37951) | [钟楼建筑原为农学校演武场，1878](https://www.sapporo.travel/en/spot/facility/clock_tower/)                                                 | `sapporo-1/2.jpg`，同一建筑不同年份照片                           |
| 首尔   | 目录                                           | 复用原首尔城市故事、宫殿文化保护事实和来源                                                                                                 | 原图库 2 张                                                       |
| 平壤   | 目录                                           | [高句丽古墓群壁画研究与列名，2004](https://whc.unesco.org/en/list/1091/)                                                                   | `pyongyang-1/2.jpg`，城市及大同江背景，不是墓室壁画               |
| 新加坡 | 目录                                           | 复用原植物园城市故事及来源                                                                                                                 | 原图库 2 张                                                       |
| 吉隆坡 | 目录                                           | [PETRONAS 双塔正式开放，1999；官方年报](https://www.petronas.com/sites/default/files/uploads/content/2022/petronas-annual-report-2017.pdf) | `kuala-lumpur-1/2.jpg`，不同作者与角度                            |
| 曼谷   | 目录                                           | [卧佛寺石刻档案世界记忆登记，2011](https://www.unesco.org/en/memory-world/epigraphic-archives-wat-pho)                                     | `bangkok-1/2.jpg`，寺院建筑，不冒充石刻全文                       |
| 河内   | 目录                                           | [升龙皇城中心区，2010](https://whc.unesco.org/en/list/1328/)                                                                               | `hanoi-1/2.jpg`                                                   |
| 马尼拉 | 目录                                           | [菲律宾巴洛克教堂系列，1993](https://whc.unesco.org/en/list/677/)                                                                          | `manila-1/2.jpg`，圣奥古斯丁／黎刹纪念碑分别标名                  |
| 雅加达 | 目录                                           | [历史博物馆于 1974 年开放；市政府](https://www.jakarta.go.id/museum)                                                                       | `jakarta-1/2.jpg`，同一馆舍两个不同机位                           |
| 新德里 | 目录                                           | [胡马雍陵文化与保护，1993](https://whc.unesco.org/en/list/232/)                                                                            | `new-delhi-1/2.jpg`，胡马雍陵／顾特卜塔；两处为德里地区的不同遗产 |

## 欧洲

| 城市     | 坐标                                           | 主题及事实源                                                                                                                         | 照片来源                                                        |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 伦敦     | 目录                                           | 复用原伦敦皇家植物园城市故事及来源                                                                                                   | 原图库 2 张                                                     |
| 曼彻斯特 | [Q18125](https://www.wikidata.org/wiki/Q18125) | [Liverpool Road 铁路车站，1830；科学与工业博物馆](https://blog.scienceandindustrymuseum.org.uk/transforming-liverpool-road-station/) | `manchester-1/2.jpg`，博物馆标识／赖兰兹图书馆                  |
| 巴黎     | 目录                                           | 复用原巴黎塞纳河城市故事及来源                                                                                                       | 原图库 2 张                                                     |
| 柏林     | 目录                                           | [博物馆岛系列，1999](https://whc.unesco.org/en/list/896/)                                                                            | `berlin-1/2.jpg`，老博物馆／旧国家美术馆                        |
| 罗马     | 目录                                           | [罗马历史中心，1980](https://whc.unesco.org/en/list/91/)                                                                             | `rome-1/2.jpg`，斗兽场／古罗马广场；见意大利文化遗产附注        |
| 马德里 | 目录 | [普拉多与丽池公园艺术科学景观，2021](https://whc.unesco.org/en/list/1618/) | `madrid-1/2.jpg`，普拉多／丽池公园 |
| 巴塞罗那 | [Q1492](https://www.wikidata.org/wiki/Q1492)   | [高迪作品系列，1984 及 2005 扩展](https://whc.unesco.org/en/list/320/)                                                               | `barcelona-1/2.jpg`，古埃尔公园／巴特罗之家                     |
| 莫斯科   | 目录                                           | 复用原莫斯科大学教育城市故事及来源                                                                                                   | 原图库 2 张                                                     |
| 圣彼得堡 | [Q656](https://www.wikidata.org/wiki/Q656)     | [历史中心与相关建筑群，1990](https://whc.unesco.org/en/list/540/)                                                                    | 冬宫／彼得保罗要塞，各 1 张；指定 Andrew Shiva / Wikipedia 署名 |

## 北美洲

| 城市     | 坐标                                           | 主题及事实源                                                                                                                                                                   | 照片来源                                                  |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 华盛顿   | 目录                                           | 复用原 Smithsonian 城市故事及来源                                                                                                                                              | 原图库 2 张                                               |
| 纽约     | 目录                                           | 复用原自由女神城市故事及来源                                                                                                                                                   | 原图库 2 张                                               |
| 洛杉矶   | [Q65](https://www.wikidata.org/wiki/Q65)       | [格里菲斯天文台开放，1935；市属天文台](https://griffithobservatory.lacity.gov/about/observatory-history/)                                                                      | `los-angeles-1/2.jpg`，天文台／Ferndell 林径              |
| 旧金山   | [Q62](https://www.wikidata.org/wiki/Q62)       | [金门大桥行人开放，1937-05-27；桥梁管理机构](https://www.goldengate.org/bridge/history-research/moments-events/key-dates/)                                                     | `san-francisco-1/2.jpg`，2017／2018 不同地点拍摄          |
| 芝加哥   | [Q1297](https://www.wikidata.org/wiki/Q1297)   | [中央图书馆开放，1897](https://www.chipublib.org/cpl-history/)；[1977 年改造更名为文化中心](https://www.chipublib.org/chicago-cultural-center-opening-day-digital-collection/) | `chicago-1/2.jpg`，文化中心两个不同机位，不使用云门雕塑照 |
| 渥太华   | 目录                                           | [丽都运河，2007](https://whc.unesco.org/en/list/1221/)                                                                                                                         | `ottawa-1/2.jpg`，运河／议会山城市背景                    |
| 多伦多   | [Q172](https://www.wikidata.org/wiki/Q172)     | [加拿大国家电视塔开放，1976-06-26；加拿大皇家造币厂](https://www.mint.ca/en-us/blog/2026-04-history-of-the-cn-tower)                                                           | `toronto-1/2.jpg`，CN Tower／皇家安大略博物馆             |
| 温哥华   | [Q24639](https://www.wikidata.org/wiki/Q24639) | [斯坦利公园开放，1888；市政府](https://vancouver.ca/parks-recreation-culture/stanley-park-story.aspx?mgid=18083)                                                               | `vancouver-1/2.jpg`，公园不同景观，未选图腾柱近景         |
| 墨西哥城 | 目录                                           | [历史中心与索奇米尔科，1987](https://whc.unesco.org/en/list/412/)                                                                                                              | `mexico-city-1/2.jpg`，大教堂／宪法广场，不冒充索奇米尔科 |

## 南美洲

| 城市           | 坐标                                         | 主题及事实源                                                                  | 照片来源                                             |
| -------------- | -------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| 巴西利亚       | 目录                                         | [规划城市与建筑设计，1987](https://whc.unesco.org/en/list/445/)               | `brasilia-1/2.jpg`，国会／主教座堂                   |
| 里约热内卢     | [Q8678](https://www.wikidata.org/wiki/Q8678) | [山与海之间的文化景观，2012](https://whc.unesco.org/en/list/1100/)            | `rio-de-janeiro-1/2.jpg`，糖面包山／基督像           |
| 圣保罗         | [Q174](https://www.wikidata.org/wiki/Q174)   | [MASP 保利斯塔大道馆舍，1968；博物馆](https://masp.org.br/en/about)           | `sao-paulo-1/2.jpg`，MASP 周边／州立美术馆，机构分开 |
| 布宜诺斯艾利斯 | 目录                                         | [今天的科隆剧院开幕，1908-05-25；剧院](https://teatrocolon.org.ar/el-teatro/) | `buenos-aires-1/2.jpg`，科隆剧院／五月广场           |

## 大洋洲

| 城市   | 坐标                                           | 主题及事实源                                                                                                                                                                         | 照片来源                                         |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 堪培拉 | 目录                                           | [永久国会大厦开放，1988-05-09；议会图书馆](https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/parliament_house_chronology/The_official_opening) | `canberra-1/2.jpg`，国会大厦／国家博物馆         |
| 悉尼   | [Q3130](https://www.wikidata.org/wiki/Q3130)   | [歌剧院落成，1973；建筑与结构工程](https://whc.unesco.org/en/list/166/)                                                                                                              | `sydney-1/2.jpg`，歌剧院港湾／海港大桥           |
| 墨尔本 | [Q3141](https://www.wikidata.org/wiki/Q3141)   | [皇家展览馆与卡尔顿花园，2004](https://whc.unesco.org/en/list/1131/)                                                                                                                 | `melbourne-1/2.jpg`，正面／空中图                |
| 惠灵顿 | 目录                                           | [Te Papa 开馆，1998-02-14；博物馆](https://www.tepapa.govt.nz/about/what-we-do/our-history)                                                                                          | `wellington-1/2.jpg`，Te Papa／旧圣保罗教堂      |
| 奥克兰 | [Q37100](https://www.wikidata.org/wiki/Q37100) | [博物馆现址开放，1929-11-28；博物馆](https://www.aucklandmuseum.com/your-museum/about/the-history-of-auckland-museum)                                                                | `auckland-1/2.jpg`，博物馆正面／背后环境及艺术品 |

## 非洲

| 城市         | 坐标 | 主题及事实源                                                                                                                                                             | 照片来源                                                                  |
| ------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 开罗         | 目录 | [历史开罗，1979](https://whc.unesco.org/en/list/89/)                                                                                                                     | `cairo-1/2.jpg`，苏丹哈桑清真寺学校／爱资哈尔清真寺                       |
| 阿布贾       | 目录 | [NASRDA 设立，1999](https://www.nasrda.gov.ng/faqs/)；[法定总部位于阿布贾联邦首都区](https://spacereg.nasrda.gov.ng/wp-content/uploads/2025/04/Authentic-NASRDA-Act.pdf) | `abuja-1/2.jpg`，国家清真寺两个机位，仅同城背景，不是航天设施             |
| 内罗毕       | 目录 | [博物馆山馆舍开放，1930-09-22；国家博物馆](https://museums.or.ke/museum-story/)                                                                                          | `nairobi-1/2.jpg`，2025／2005 馆舍照                                      |
| 亚的斯亚贝巴 | 目录 | [露西 AL 288-1 发现，1974；Smithsonian](https://humanorigins.si.edu/evidence/human-fossils/fossils/al-288-1)                                                             | `addis-ababa-1/2.jpg`，国家博物馆／城市建筑；化石发现地哈达尔不在这座城市 |
| 拉巴特       | 目录 | [现代首都与历史城市共享遗产，2012](https://whc.unesco.org/en/list/1401/)                                                                                                 | `rabat-1/2.jpg`，哈桑塔／乌达雅堡外墙                                     |
| 阿尔及尔     | 目录 | [阿尔及尔卡斯巴，1992](https://whc.unesco.org/en/list/565/)                                                                                                              | `algiers-1/2.jpg`，卡斯巴巷道／老大清真寺，不使用新大清真寺近景           |
| 阿克拉       | 目录 | [独立广场建成，1961；加纳旅游机构](https://visitghana.com/independence-square/)                                                                                          | `accra-1/2.jpg`，独立广场／恩克鲁玛纪念公园                               |

`*-1/2.jpg` 是文件名简写，均位于 `public/exploration/first-batch/cities/`。每张原始文件页与许可 URL 在可下载的 `source-records.json` 中逐一列出；不是把城市事实网页当作图片授权证据。

## 图像许可与处理边界

1. 各 Commons 原始文件页的作者、许可短名与许可链接独立核验；只有 CC、CC0 或公有领域可用候选进入这批目录。未使用只有 GFDL 的候选。许可不是按网站品牌或上传昵称推测。
2. 图像不在本地裁剪、调色、拼接或生成；缩略尺寸来自 Commons。原图可能已做裁剪、HDR、全景拼接或透视修正，这些是原作者处理，不可称为“原始相机直出”。原始记录全部保存。
3. 署名显示完整作者及许可。马德里 `madrid-2.jpg` 按源要求保留 **©PromoMadrid, author Max Alexander**，不是只写 Max Alexander。里约两图保留 **Arne Müseler** 和 **CC BY-SA 3.0 de**，不混用通用版本。墨尔本展览馆正面保留 **Diliff (photograph); Ian Fieggen (straightening)**。
4. 圣彼得堡复用照片使用源指定 **Andrew Shiva / Wikipedia**，不把上传账号 Godot13 误当指定署名。地标包另一个 Andrew/Florstein 来源的署名不由本城市文件改写；只复用对应源核验门禁已准入的照片。
5. 许可只针对相应作品。网站代码许可不改变摄影许可；CC BY-SA 图像仍保留各自相同方式共享条件。若后续把图像做适用的改编，应在改编版本中履行原许可要求，不能把整个图库宣称为 CC0。
6. **额外权利提示：** `rome-1.jpg` 的 Commons 原记录含 `Restrictions: ita-mibac` 意大利文化遗产提示。CC BY-SA 摄影许可不是对所有文化遗产使用、商业宣传或机构许可的全面清权。当前仅作注明出处的文化教育预览候选；商业化、广告素材或要求全面清权的正式发布前需要人工确认这些附加条件，或替换。奥克兰背后环境照片包含 Fred Graham 的 Kaitiaki 艺术品；公有领域摄影声明不把艺术品本身改为公有领域。人物、建筑、艺术品、商标及场地规则也不因 Commons 托管自动消失。

## 日期、主题与照片关系

- 拍摄日期优先 `DateTimeOriginal` 与原始文件说明，而不是上传时间；只知道年月或年份时不捏造日。
- `accra-2.jpg` 原说明明确写 **1995 年**，与元数据 2008 时间不一致。此处记录 1995，并在中英图注保留冲突说明；不是擅自把 2008 当拍摄日。
- 6 城复用地标照片的源时间戳仅在城市故事中缩为已有 ISO 日期，未增加日期精度，原始地标记录保留。
- 后期地标照片不是建成、开放、机构成立或 UNESCO 列名事件现场。每个新增图库图注均明确“地点／城市背景”；与主题不在同一具体机构的图片在主题描述中单独说明。
- 墙刻世界记忆登记不是世界遗产列名；单个世界遗产或跨城系列不等于整座城市。札幌建筑建成与安装时钟、博物馆机构起源与现址馆舍开放、双塔建成与正式开放、剧院旧址与现址、国会临时与永久馆舍分别处理。
- 阿布贾清真寺不冒充 NASRDA 总部；平壤城市照不冒充高句丽墓室壁画；故宫现今馆舍照片不冒充 1965 年建筑原貌；露西在哈达尔的发现不挪到亚的斯亚贝巴。凡为同城／关联地区背景，均在故事里解释。

## 测试与后续人工复核

`tests/first-batch-earth.test.ts` 检查完整 52 城名单、分组、坐标保留、双语字段、52 故事与 106 图库条目、每城图片内容哈希不同、72 JPEG 的格式／尺寸／字节数／SHA-256／来源权利记录、地标图片源核验门禁及主要时间地理易混淆点。

自动检查只证明记录契约与本地资源的一致性；不能替代人工逐张看图、翻译复核、完整权利判断或屏幕效果验收。人工复核前始终保持 `humanReview: pending`。这批文件没有提交、推送或公开部署。
