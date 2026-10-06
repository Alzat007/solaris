# 首批城市地标来源审核：北京至京都

核验日期：2026-10-06。范围：`data/first-batch-landmarks.json` 前 29 个入口、58 张候选素材。第 30 个伏见稻荷及后续入口不在本次审核范围。下文先保留初始导入快照的审核记录，再单列替换图复核结果；不能把初始换图问题误当成最新已修复素材的状态。

本次为机器辅助来源与读图检查，不代表用户本人审核或全球商业发行法律许可。所有 `humanReview` 继续保留 `pending`。审核只新增本文件，没有改动 UI、控制器、目录或素材。

## 初始快照核验方法与结果

- 对全部 58 张本地 JPEG 解码、检查尺寸，生成 5 张联系表并逐张读图，结合 Commons 源页的作者、日期、许可、描述及原始元数据核对地点。
- 当前前 29 条均有 2 张不同 source SHA1；早期天坛、平安的下划线／空格重复已由导入器修正。上海中心早期来自 Pxfuel、作者与拍摄日期不明确的候选也已剔除。
- 纬度／经度未见倒置或明显城市范围错误；来源为各 Wikidata 实体的地球坐标。这些是轻量地球上的示意锚点，不是测绘精度的入口坐标，也不等于每张照片的机位。
- 日期应区分拍摄、上传、作品创作与后期处理。EXIF 相机时钟本身并非独立时间证明。历史建设图可以展示工程历程，但不能冒充完工建筑、现状或赛事现场。
- CC BY／BY-SA 的作者、许可链接与修改披露不能省略；编辑者、拼接与 HDR 信息也需保留。Commons 标签不自动解决建筑／雕塑、人物、商标和不同司法辖区的其他权利。
- 当前五张竖图长边超过 1600：东方明珠 #1（2007）、上海中心 #1（1973）、平安 #1（1706）、台北 101 #1（1705）、东京塔 #2（2254）。这些括号为像素，不是年份；建议改用官方更小等比例缩略版本并更新尺寸与哈希。

证据临时文件位于 `/tmp/solaris-landmark-audit-{0..4}.json`，读图联系表位于 `/tmp/solaris-landmark-contact-{0..4}.jpg`。它们是开发审核证据，不是产品素材。

## 初始快照可以纳入的入口

下面 23 个入口的当前两张图片未发现主体或来源门禁阻断问题；仍须落实下一节图注，不能把此名单当成人工审核完成或商业权利保证：

```text
beijing-tiananmen
beijing-forbidden-city
beijing-great-wall
beijing-birds-nest
beijing-temple-heaven
shanghai-bund
shanghai-oriental-pearl
shanghai-tower
shenzhen-bay
shenzhen-huaqiangbei
shenzhen-qianhai
hangzhou-west-lake
hangzhou-lingyin
hangzhou-asian-games
hong-kong-victoria-peak
hong-kong-central
hong-kong-convention-centre
taipei-101
taipei-chiang-kai-shek
tokyo-tower
tokyo-station
kyoto-kiyomizu
kyoto-kinkakuji
```

## 初始快照优先换图的 6 个入口

| 入口                            | 当前素材问题                                                                                                                            | 纳入条件                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `shanghai-yu-garden`            | 两张均拍湖心亭茶楼及九曲桥附近水面，而不是经典园林内部。#1 文件说明写听涛阁，但分类与读图指向湖心亭；#2 明确列入 Hu Xin Ting Teahouse。 | 换真实园内实拍；如保留现图，必须明确为毗邻园区的茶楼上下文，不证明内部园林图文已齐。               |
| `shenzhen-ping-an` #2           | PAFC 商场室内，跑车展示占据主体，不能说明塔楼结构。                                                                                     | 换清晰塔楼外部建筑图。原图只能作为有明确关系的附属商业空间。                                       |
| `hong-kong-victoria-harbour` #1 | 1957 年英国 War Office 地图，不是港湾照片或当前海岸线。                                                                                 | 换港湾实拍。原地图如单独用作历史资料，需注明制图年代、当时岸线及过期 Crown copyright 的依据。      |
| `taipei-palace-museum` #2       | 1301 年赵孟頫册本的平面作品复现，不是建筑照片；源页 Source/Photographer 为 Not stated by uploader。                                     | 优先换建筑实拍。藏品另用时须有正确作品标识、馆藏来源和扫描来源限定，不声称作者是现代摄影者。       |
| `tokyo-shibuya` #2              | 2023-10-31 万圣节期间加强警力的路口照片。                                                                                               | 按本批正向建筑／城市空间主题换普通路口实拍；不能编成成功庆典或典型日常人流。                       |
| `tokyo-sensoji` #2              | 2004-02-08 淡岛堂针供养器物特写，不是寺院建筑。                                                                                         | 优先换寺院实拍；原图可作另有官方事实来源、明确日期的传统文化附属图，不能把宗教祈愿描述为科学效果。 |

以上是图片筛选，不应删除真实地点入口。替换图片必须重新读图及核对许可；旧入口 ID 通过不意味着任意新图片都自动通过。

## 替换图复核快照

复核同日导入器替换后的 6 组本地图片及 `source-records.json`。12 张本地图片均已解码读图，实际 SHA256 与清单一致。核验对象以以下 source SHA1 固定，不以入口名称或文件名自动授权未来变更。临时联系表为 `/tmp/solaris-replacement-contact.jpg`，元数据快照为 `/tmp/solaris-replacement-audit.json`。

### 已通过主体与照片来源门禁的 4 组

| 入口                         | #1 source SHA1                             | #2 source SHA1                             | 图片许可与准确图注                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hong-kong-victoria-harbour` | `da37518d52e3230c5479b439e909c4ac16454401` | `18e53c07ee1381a7923a7e3fb72c3935da00a31a` | #1：维多利亚港夜景与九龙侧环球贸易广场，2013-06-16，Wilfredor，CC0。#2：从西九龙文化区 M+ 屋顶花园望向维多利亚港与香港岛岸线，2022-07-13，Bkemaoe HOMA，CC BY-SA 4.0。不可把环球贸易广场误放在香港岛。                |
| `taipei-palace-museum`       | `8ac75bddf1d7cf3e80a5210c3c60d36261f8494e` | `aa1a7ad22c135f4f357cc4ba8d905540f83e3526` | #1：台北故宫博物院北部院区建筑全景，2007-12-16，Peellden，CC BY 3.0。#2：台北故宫博物院北部院区主建筑与前阶，2024-02-24，Suicasmo，CC0。两者均为后期建筑实拍，不是 1925 年机构创办或 1965 年开院现场。                |
| `tokyo-sensoji`              | `ea7d6feac8ecee3e4fb88420f8bed56f2fd0e836` | `f1aa973753eac44874d21cf1e5e2c91c8c4ef059` | #1：浅草寺本堂及参拜前庭，2023-11-04，Akonnchiroll，CC0。#2：浅草寺境内五重塔及周边园景，2024-08-21，Jakub Hałun，CC BY 4.0。不是 628 年起源或 1958 年重建现场。                                                      |
| `tokyo-shibuya`              | `3abb12c212e38c662a406c48dd9a526c881404f3` | `34345c4afafe22c20716f5f6946d88fa7a8a6190` | #1：从邻近建筑俯瞰涩谷步行交叉口与周围街区，2023-12-04，David Kernan，CC BY 4.0。#2：从八公广场方向拍摄涩谷步行交叉口，2018-10-09，Benh LIEU SONG，CC BY-SA 2.0；2.5 秒长曝光产生行人动态模糊。不是万圣节或庆典现场。 |

替换源页：

- [维多利亚港／环球贸易广场](https://commons.wikimedia.org/wiki/File:International_Commerce_Centre_on_Victoria_Harbour.jpg)。
- [故宫北部院区主建筑](https://commons.wikimedia.org/wiki/File:Main_Building,_National_Palace_Museum_20240224.jpg)。
- [浅草寺五重塔](https://commons.wikimedia.org/wiki/File:Five-storied_Pagoda_of_Sensoji_Temple_in_Tokyo,_20240821_1616_5263.jpg)。
- [涩谷交叉口 2018 长曝光](https://commons.wikimedia.org/wiki/File:Tokyo_Shibuya_Scramble_Crossing_2018-10-09.jpg)；其 [Flickr 原摄影页](https://www.flickr.com/photos/blieusong/31915927208/) 经 Commons FlickreviewR 确認为 CC BY-SA 2.0。源页显示的照片日期与 EXIF 钟点有差异，文案只写一致的日期，不写钟点。EXIF 的版权文字为 CC BY-SA 4.0，公开源页许可与已核验的 Flickr 授权为 CC BY-SA 2.0，产品使用后者，不据 EXIF 猜测变更许可。

### 第一轮替换中仍不通过、现已剔除的 2 组

| 入口                        | 当前替换图 SHA1                                                                        | 不通过原因                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shenzhen-ping-an` #2       | `4007026ce1ad94775eed30efe7562a10d974ee09`                                             | 文件 `PING AN FINANCE CENTER, SHENZHEN (31).jpg` 实际是竹蒸笼中的餐点，不是塔楼外部。不要按文件名批准。#1 `500a65f020b7a41158a32d956e146bc1f8421910` 仍为有效外部图。                                           |
| `shanghai-yu-garden` #1／#2 | `cb199848958acc0d892d2e5250041a660d10813d`／`f367462a85de5cb318ad16e79f3ca5263313c089` | 两张仍显示宝顶亭楼、外侧商城立面与九曲桥荷花池一带，主体高度符合湖心亭区域，而不是足以证明豫园古典园林内部的照片。源页只有笼统 Yu Garden 名称／分类，无精确机位或园内景点说明。CC0 摄影授权不消除主体关系问题。 |

### 已实际预览并核对正式落盘的第二轮替代图

以下已经从 Commons 官方缩略接口获取临时预览并读图，随后根任务重新导入。再次打开正式 `public/exploration/first-batch/landmarks/` 下的三张本地图片逐张核对，均与候选画面一致；实际尺寸及 SHA256 与最新清单一致。本审核未直接覆盖素材。

| 入口／候选      | source SHA1                                | 源页及许可                                                                                                                                                      | 建议图注与官方缩略尺寸                                                                                                                                    |
| --------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 平安外部替代 #2 | `771700470371176d069a5616fa4e7f601c4b6874` | [PING AN FINANCE CENTER, SHENZHEN.jpg](https://commons.wikimedia.org/wiki/File:PING_AN_FINANCE_CENTER,_SHENZHEN.jpg)，Dinkun Chen 自摄，CC BY-SA 4.0            | 2023-03-24 从福田街区仰望平安金融中心塔楼外立面。官方 960×1439 等比例缩略，原图 5464×8192。不带 `(31)` 的文件确为完整塔楼外部，与已保留 #1 不同。         |
| 豫园园内替代 #1 | `619458ff091c7b18fd838e31504690fa24e37b17` | [Yu Garden Shanghai November 2017 006.jpg](https://commons.wikimedia.org/wiki/File:Yu_Garden_Shanghai_November_2017_006.jpg)，King of Hearts 自摄，CC BY-SA 4.0 | 2017-11-20 豫园园内池水、假山小桥、亭廊与花窗。官方 1280×853 等比例缩略，原图 5820×3880。源机位 31.227265 N／121.491688 E，不将其自动当成热点的测绘坐标。 |
| 豫园园内替代 #2 | `7da817d5b44f7b04a3372e994dc83e1a5d5625db` | [Yu Garden Shanghai November 2017 010.jpg](https://commons.wikimedia.org/wiki/File:Yu_Garden_Shanghai_November_2017_010.jpg)，King of Hearts 自摄，CC BY-SA 4.0 | 2017-11-20 豫园内园古戏台与两侧看廊。官方 1280×960 等比例缩略，原图 5280×3960。不是湖心亭茶楼，也不是某场历史演出的现场照。                               |

[园方内园景区说明](https://www.yugarden.com.cn/Page/WxyGarden/introduce-detail6.html) 明确古戏台属于内园；[园方三穗堂景区说明](https://www.yugarden.com.cn/Page/WxyGarden/introduce-detail1.html) 列明园内假山、亭廊与铁狮。园内与外围商城、茶楼的关系仍分开表述，不把“豫园”旅游商圈泛称直接等同于古典园林内部。

若补文化事件，可依据[园方 2014-09-20 公告](https://www.yugarden.com.cn/Page/ArticleView/articleDetail1011.html) 描述古戏台举办景德镇青花瓷乐坊演奏交流。上表 2017 建筑照仅为事件发生地的后期配图，不冒充 2014 演出现场，也不复制源文中未另核验的“世界首创”表述。

最终落盘门禁补充：

| 本地图片                   | source SHA1                                | 已重新计算的本地 SHA256                                            | 实际尺寸 |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | -------- |
| `shanghai-yu-garden-1.jpg` | `619458ff091c7b18fd838e31504690fa24e37b17` | `0908e17333d82d365eb0bd53cb18e74f53b0c601cf816b6a5463aa35d9b3358f` | 1280×853 |
| `shanghai-yu-garden-2.jpg` | `7da817d5b44f7b04a3372e994dc83e1a5d5625db` | `bcd9a39453e0cddc0458b22a302dae69eb20327d87933ac418474bab4241ad3f` | 1280×960 |
| `shenzhen-ping-an-2.jpg`   | `771700470371176d069a5616fa4e7f601c4b6874` | `aea92fe51bfa02e63a4c2c1724baf16bb60f2efe6ae126c8a287494e6db046f0` | 960×1439 |

最终这 6 组均通过本次机器辅助的主体与照片来源检查；豫园 pair 为 `619458ff091c7b18fd838e31504690fa24e37b17`／`7da817d5b44f7b04a3372e994dc83e1a5d5625db`，平安 pair 为 `500a65f020b7a41158a32d956e146bc1f8421910`／`771700470371176d069a5616fa4e7f601c4b6874`，其余四组使用上表 pair。前 29 个入口当前共 58 张不同摄影素材，原历史地图及藏品平面复现已不在这 29 组中。全部 `humanReview` 仍为 `pending`，没有宣布全球商业发行权利审查完成。

## 必须保留的图注限定

| 入口        | 限定                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| 故宫 #1     | 景山视角，原作者明确为 HDR 处理照片，披露处理；#2 为太和殿，不把局部叫全景。                                         |
| 八达岭 #2   | 文件描述为 DF08 的 2002 年照片，DateTimeOriginal 实际写 2004-10-30 原上传日期；不写成 2004 年拍摄。                  |
| 鸟巢        | 两图分别是 2009 和 2022 年建筑现状，不能配成 2008 奥运开幕式现场。                                                   |
| 天坛 #2     | Maros Mraz 摄影、Thegreenj 编辑的 2007 全景；不能仅保留摄影作者而漏编辑者。                                          |
| 东方明珠 #1 | 显示署名可简化为 Supanut Arunoprayote，原模板段落留作来源证据，不能当作者姓名全文显示。                              |
| 上海中心 #2 | 2011 年施工现场，可作工程历程，不能展示成现状或已完工塔楼。                                                          |
| 平安 #1     | 文件名含 2020，但源拍摄日期为 2021-01-01，使用来源日期而不是文件名推断。                                             |
| 深圳湾      | 后海湾横跨深圳与香港，不能将所有湾景照片声称为深圳湾公园或某一精确岸边机位。                                         |
| 前海 #2     | 2014 年前海车辆段上盖保障房的区域上下文；不是当代前海核心商务区全景。                                                |
| 灵隐寺      | #1 为药师殿，#2 为大雄宝殿。传统创寺年代不代表当前全部殿宇保持 326 年原构。                                          |
| 杭州奥体    | #1 为 2021 年体育博览中心建设阶段，#2 为 2012 年体育场施工；保留工程历程日期，不冒充 2023 年赛事现场或今日完工状态。 |
| 太平山 #1   | 同框包含西高山与太平山，不混淆两座山。                                                                               |
| 太平山 #2   | 2007 年从山顶拍的城市景观，署名 U.S. Navy / Ensign Chad Dulac，不把军事部署宣传文字引入地点故事。                    |
| 中环        | 两图是城区天际线和 AIA Central 所在建筑街景，不将个别建筑的竣工年写成整个中环的建立年。                              |
| 会展中心    | 2008 年外部轮廓与 2009 年扩建区域，是建筑后期照片，不虚构某一历史活动现场。                                          |
| 台北 101 #2 | 2004-12-31 夜景。源描述中的当时世界高度排名不作为当前排名。                                                          |
| 台北故宫    | 1925 年机构设立与 1965 年台北外双溪新院落开放分别表述。                                                              |
| 中正纪念堂  | 只介绍建筑、文化与公共空间，不编造政治人物的“正面事件”，也不作人物价值评价。                                         |
| 东京塔 #2   | 原作者明确为 5 帧拼接的竖向全景，披露拼接；不是单张未处理镜头。                                                      |
| 东京站 #2   | 2005 年东海道新干线 16／17 站台，与丸之内站房属于同站不同子区域，不用站台照证明 2012 年立面修复。                    |
| 清水寺      | 官方英文页有 UNESCO 年份 1944 的错误；日文官方历史及 UNESCO 均为 1994，不传播错误。                                  |
| 金阁寺      | 1397 年山庄起源不等于今日楼阁的原构年代；现楼阁 1955 年重建，1987 年修复漆面与金箔。                                 |

## 第一方事实来源映射

以下支持简洁原创教育文案，不授权复制来源中的官方图片。事实、照片版权与锚点坐标分别核验，不用 Wikipedia 简介当作最终事实审定。

| 入口 ID                       | 可支持的知识主题                                                                                    | 第一方来源                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beijing-tiananmen`           | 北京中轴线的城门、布局与城市空间，避免人物政治评价。                                                | [UNESCO 中轴线文件](https://whc.unesco.org/document/204904)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `beijing-forbidden-city`      | 1406 年开始建造、1420 年完成的宫殿建筑群；布局与文化保护。                                          | [故宫博物院](https://www.dpm.org.cn/subject_600/index.html)、[午门](https://www.dpm.org.cn/explore/building/236454.html)                                                                                                                                                                                                                                                                                                                                                              |
| `beijing-great-wall`          | 长城因地制宜的建筑与保护，1987 年入选世界遗产。UNESCO 陈旧 Criteria(i) 的“从月球可见”说法不可照录。 | [UNESCO 长城](https://whc.unesco.org/en/list/438)、[八达岭保护报告](https://whc.unesco.org/document/162535)                                                                                                                                                                                                                                                                                                                                                                           |
| `beijing-birds-nest`          | 国家体育场 2003-12-24 开工、2008-06-28 完工，钢结构与国际体育交流。                                 | [国家体育场官网](https://www.n-s.cn/aboutindex.html)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `beijing-temple-heaven`       | 1420 年坛庙起源及后世改建；轴线、圆形建筑，1998 年入选遗产。                                        | [UNESCO 天坛](https://whc.unesco.org/en/list/881)、[北京市](https://www.beijing.gov.cn/renwen/rwzyd/qgzdwwbhdw/tt/202210/t20221027_2845910.html)                                                                                                                                                                                                                                                                                                                                      |
| `shanghai-bund`               | 黄浦江滨水历史建筑与公共空间。                                                                      | [上海市黄浦区简介](https://www.shanghai.gov.cn/huangpu/index.html)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `shanghai-oriental-pearl`     | 浦东广播电视塔，468 米及球体造型。                                                                  | [上海官方景点资料](https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html)                                                                                                                                                                                                                                                                                                                                                                     |
| `shanghai-tower`              | 陆家嘴 632 米高层建筑、扭转外形；不用过时世界纪录营销句。                                           | [上海中心](https://www.shanghaitower.com/news_2/33.html)、[上海市新闻办](https://en.shio.gov.cn/TrueCMS/shxwbgs/wxdtt/content/e3fad178-4821-4ba3-a7c4-c96fb91b8e99.htm)                                                                                                                                                                                                                                                                                                               |
| `shanghai-yu-garden`          | 豫园 1559 年起建，与商城／城隍庙毗邻；古戏台属于内园，湖心亭则另作周边上下文。                      | [上海市豫园介绍](https://www.shanghai.gov.cn/citywalk/20260625/3a8ac74e088f4d468d9c3434b0b43d94.html)、[园方内园与古戏台](https://www.yugarden.com.cn/Page/WxyGarden/introduce-detail6.html)、[园方 2014 瓷乐交流公告](https://www.yugarden.com.cn/Page/ArticleView/articleDetail1011.html)、[上海档案馆湖心亭](https://www.shda.gov.cn/dawh/csjy/202509/t20250919_75917.html)、[运营方保护性修缮记录](https://www.fosun.com/Upload/File/202509/5564a0b3e9634004964bddc7f753027d.pdf) |
| `shenzhen-ping-an`            | 福田约 600 米建筑、办公与商业空间、公共交通连接；2019 年建筑奖项。                                  | [设计方 KPF](https://www.kpf.com/project/ping-an-finance-centre)、[KPF 2019 获奖记录](https://www.kpf.com/news/ping-an-finance-centre-ctbuh-awards-2019)                                                                                                                                                                                                                                                                                                                              |
| `shenzhen-bay`                | 滨海湿地与红树林；不能把修复提案／规划写成已完成的成果。                                            | [深圳规划自然资源局红树林资料](https://pnr.sz.gov.cn/xxgk/ztzl/rdzt/lmsz/szxd/hdxw/content/post_10705453.html)、[2025 年提案办理资料](https://pnr.sz.gov.cn/gkmlpt/content/12/12270/post_12270862.html)                                                                                                                                                                                                                                                                               |
| `shenzhen-huaqiangbei`        | 电子商业街区、元件供应链与创新，不用无依据“全球首次”。                                              | [深圳规划自然资源局地区资料](https://pnr.sz.gov.cn/luohu/zwdt/content/post_11381407.html)                                                                                                                                                                                                                                                                                                                                                                                             |
| `shenzhen-qianhai`            | 现代服务业合作与城市空间；2010 年委员会成立不等于所有前海政策同一天获批。                           | [前海管理局](https://qh.sz.gov.cn/sygnan/qhzx/zthd_1/sghz/hzdt/content/post_11092341.html)、[深圳市 2010 年公报](https://www.sz.gov.cn/zfgb/2010/gb696/content/post_4985677.html)                                                                                                                                                                                                                                                                                                     |
| `hangzhou-west-lake`          | 湖泊、堤岸、园林文化景观，2011-06-24 入选遗产。                                                     | [UNESCO 西湖](https://whc.unesco.org/en/list/1334)、[2011 年入选记录](https://whc.unesco.org/en/news/767)                                                                                                                                                                                                                                                                                                                                                                             |
| `hangzhou-lingyin`            | 寺院传统起源于 326 年，山地建筑与文化传承；寺院与飞来峰分清。                                       | [杭州文旅局](https://wgly.hangzhou.gov.cn/art/2023/12/1/art_1229734028_58951314.html)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `hangzhou-asian-games`        | 赛事品牌 Hangzhou 2022 实际在 2023-09-23 至 10-08 举行；场馆与公共体育。                            | [组委会改期与场馆开放资料](https://www.hangzhou2022.cn/En/presscenter/spotnews/latestnews/202208/t20220815_51696.shtml)、[组委会 2023-09-23 日报](https://www.hangzhou2022.cn/shipin/202309/P020230923303193986151.pdf)                                                                                                                                                                                                                                                               |
| `hong-kong-victoria-harbour`  | 香港岛与九龙之间的港湾、岸线与航运，不使用未核验“全球第三大”排名。                                  | [香港旅游发展局](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-victoria-harbour.html)                                                                                                                                                                                                                                                                                                                                                                                 |
| `hong-kong-victoria-peak`     | 香港岛地形与港湾观察；太平山、西高山与山顶凌霄阁分清。                                              | [香港旅游发展局](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-the-peak.html)                                                                                                                                                                                                                                                                                                                                                                                         |
| `hong-kong-central`           | 城区空间及文化保护；大馆 2018 年开放是个别保育案例，不是整个中环的起源年。                          | [香港旅游发展局大馆资料](https://www.discoverhongkong.com/uk/explore/culture/tai-kwun-heritage-and-art.html)                                                                                                                                                                                                                                                                                                                                                                          |
| `hong-kong-convention-centre` | 1988 年开放、1997／2009 年扩建的展览会议建筑；不将建筑照编成历史活动现场。                          | [香港会展中心官网建筑历史](https://www.hkcec.com/en/image-gallery)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `taipei-101`                  | 508 米及 2004 年完工、结构与环境工程；避免源图中的过时高度排名。                                    | [台北 101 官方学习单](https://www.taipei-101.com.tw/asset/files/101%E4%B8%AD%E9%AB%98%E5%B9%B4%E7%B4%9A%E5%AD%B8%E7%BF%92%E5%96%AE_new.pdf)、[官方 ESG 资料](https://ws.taipei-101.com.tw/upload/charity/20240108/ad62ac5bd03445a0a2c87cfa2b9a2515/ad62ac5bd03445a0a2c87cfa2b9a2515.pdf)                                                                                                                                                                                              |
| `taipei-palace-museum`        | 1925 年机构起源、1965 年台北院区；馆藏保护。候选图为 1301 年册本，不是另一件 1299 年卷本。          | [馆方院史](https://www.npm.gov.tw/Articles.aspx?l=1&sno=03012532)、[赵孟頫册本原始藏品目录](https://digitalarchive.npm.gov.tw/Collection/Detail/425?dep=P)                                                                                                                                                                                                                                                                                                                            |
| `taipei-chiang-kai-shek`      | 70 米建筑与公共广场，1987 年剧院／音乐厅阶段；不评价政治人物。                                      | [管理方建筑资料](https://www.cksmh.gov.tw/cp.aspx?Create=1&n=5882)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tokyo-tower`                 | 333 米广播通信塔，1958-12-23 开放。                                                                 | [东京塔官方资料](https://gallery.tokyotower.co.jp/en/index.html)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tokyo-sensoji`               | 628 年是传统起源叙事，现本堂 1958 年重建；针供养为 2 月 8 日传统活动。                              | [浅草寺官方历史](https://www.senso-ji.jp/english/)、[本堂资料](https://www.senso-ji.jp/guide/guide04.html)、[针供养说明](https://www.senso-ji.jp/annual_event/06.html)                                                                                                                                                                                                                                                                                                                |
| `tokyo-shibuya`               | 多方向步行交叉口、交通与城市空间，不编造庆典史。                                                    | [东京观光官方](https://www.gotokyo.org/en/spot/78/index.html)、[官方涩谷地图](https://www.gotokyo.org/book/wp-content/uploads/2024/03/2403_shibuydaymap_low_EN.pdf)                                                                                                                                                                                                                                                                                                                   |
| `tokyo-station`               | 1914 年开站，丸之内站房 2012 年 10 月保存修复完成；站房与站台分别介绍。                             | [JR East 2013 年报](https://www.jreast.co.jp/e/investor/ar/2013/pdf/ar_2013_all.pdf)、[JR East 环境报告](https://www.jreast.co.jp/e/environment/pdf_2013/all.pdf)                                                                                                                                                                                                                                                                                                                     |
| `kyoto-kiyomizu`              | 778 年传统起源、主要现存建筑 1633 年，1994 年 UNESCO 入选。                                         | [清水寺日文官方历史](https://www.kiyomizudera.or.jp/history.php)、[UNESCO 京都遗产](https://whc.unesco.org/en/list/688)                                                                                                                                                                                                                                                                                                                                                               |
| `kyoto-kinkakuji`             | 正式名鹿苑寺，1397 年山庄起源、现楼阁 1955 年重建、1987 年金箔修复、1994 年遗产入选。               | [金阁寺官方历史](https://www.shokoku-ji.jp/en/kinkakuji/about/)、[官方楼阁与园林资料](https://www.shokoku-ji.jp/en/kinkakuji/guide/)、[京都市官方重建资料](https://ja.kyoto.travel/tourism/single02.php?category_id=9&tourism_id=2251)                                                                                                                                                                                                                                                |

## 权利与完成度门禁

每张图库应展示对应作者、图片源页、许可链接、拍摄／创作日期的适当说明；后期地点图与历史现场图分别标明。不用自动生成的故事为缺失材料充数。

当前主体通过仅针对本次已读的照片及 SHA1 快照。对需要换图的入口，不应仅按入口 ID 为新照片开放门禁。原始素材许可证明、图片主体、地点关系和事实支持全部满足后，再纳入机器核验通过列表；用户人工审核另行记录。

初始 58 张中曾含 1 张历史地图及 1 件平面藏品复现，因此初始导入不能直接称为“58 张地标照片”；本次最终替换后两者已剔除。这里也没有对所有国家／城市／事件宣布图文完成，照片门禁通过不等于所有历史故事均已审核或用户本人审核完成。
