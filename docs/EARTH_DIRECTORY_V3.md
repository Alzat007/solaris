# 地球目录 V3

版本：`earth-directory-v3-2026-10-04`。目录不是城市故事完成报告，也不是当前首都法律状态数据库。

## 范围与来源

本轮保留 REST Countries 旧版开源 `countriesV3.1.json` 的全部国家与地区条目，固定 revision 为 `bfadee4f951682c29970e53677707bc558e80b74`，读取日期为 2026-10-04。

- [固定原始文件](https://github.com/restcountries/restcountries/blob/bfadee4f951682c29970e53677707bc558e80b74/src/main/resources/countriesV3.1.json)
- 原文件 SHA-256：`8209daa9fd26e842e84992739dfbfb272566b60357a6ee760955bb4e9f2cc18e`。
- [来源字段说明](https://github.com/restcountries/restcountries/blob/bfadee4f951682c29970e53677707bc558e80b74/FIELDS.md)
- [来源仓库 MPL-2.0 许可](https://github.com/restcountries/restcountries/blob/bfadee4f951682c29970e53677707bc558e80b74/LICENSE)
- 原国家资料的上游来源还包括 [mledoze/countries](https://github.com/mledoze/countries)，保留其 [ODbL-1.0 许可通知](https://github.com/mledoze/countries/blob/c2ac0049c14edcf2436c7aa1b2493222a020b462/LICENSE)。衍生的 SOLARIS Earth Directory 数据库按 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)公开分发，JSON 内的 `databaseLicense`记录署名、许可 URI、固定上游通知和完整数据下载地址。此数据库许可不改变 SOLARIS 应用代码或独立图片的许可。
- [完整机器可读衍生 JSON（固定公开测试版本，无需注册）](https://raw.githubusercontent.com/Alzat007/solaris/v3-public-preview-2026-10-04/data/earth-directory-source.json)。导入脚本和编辑词表也在同版本公开仓库内；原 MPL 来源通知保留在 `sources`与第三方通知中。界面地球目录的范围说明提供署名、许可及下载链接。

这个基线有 250 个 source entries，而不是“250 个主权国家”。其范围含依属地区和不同表述的地理条目，例如 `XK` 是来源中的 `user-assigned` 代码，并非将所有代码一律认证为现行 ISO 正式分配。`sourceStatus`、`independent`、`unMember`按来源保留，应用不据此作政治判断。界面应写“国家与地区”。

原资料已经被冻结，而当前 REST Countries 官网走新的 API 版本与 token。本应用不注册 API、不放凭证、不运行时请求该 API；目录在构建中本地打包。冻结数据可再现，但不能据此声称 2026 年全部首都的角色与现行状态已经逐条核验。

## 独立计数

导入校验实际得出：

| 项目                     | 数量 | 含义                                                                 |
| ------------------------ | ---: | -------------------------------------------------------------------- |
| 国家与地区来源条目       |  250 | 全部固定源条目                                                       |
| 来源中有首都名称的条目   |  246 | `AQ/BV/HM/MO`未列首都，不补造                                        |
| 来源列出的首都关系       |  249 | 一条城市可关联多个来源条目                                           |
| 多首都来源条目           |    2 | `PS`与`ZA`，不推断法律角色                                           |
| 去重后的首都城市记录     |  247 | 同一 Jerusalem 与 Washington DC 异写合并关系；两处 Kingston 保持独立 |
| 所有城市记录             |  248 | 首都记录加首批纽约选录                                               |
| 首批人工精选城市         |    6 | 北京、纽约、巴黎、东京、伦敦、罗马；非排名、非最终全部名城           |
| 有城市定位坐标的记录     |  244 | 只使用城市坐标，不使用国家中心点                                     |
| 有首批中文编辑别名的城市 |   61 | 其余城市显示来源英文，中文国家名仍可检索                             |
| 目录城市图文待编审       |  248 | 目录不能代替独立故事审核                                             |

首都城市与精选名城标签可重叠，同一北京/巴黎/东京不生成两条城市。纽约只有 `featured` 标签，不被程序标成当前首都。精选原则是支持文化、公共遗产和地点科普模板的少量可扩展样板，不是算法排名。

纽约名称与城市定位点参考 [Wikidata Q60](https://www.wikidata.org/wiki/Q60) 的结构数据（页面读取日期 2026-10-04；坐标 40°42′46″N、74°00′22″W），遵循 [结构数据 CC0 说明](https://www.wikidata.org/wiki/Wikidata:Copyright)。本次不使用其图片或文章正文。城市定位点不能当作具体事件发生坐标。

## 已知限制

- `CapitalRelation`使用数组：`cityId/roles/effectiveFrom/effectiveTo/notes/sourceRefs`。本源不区分各城的行政、立法、司法或宪法角色，统一保留 `source-listed`；未知生效日期为 `null`，不是“永久”。
- 南非三城与巴勒斯坦两城保留源关系。来源仅提供一个 `capitalInfo.latlng`，不能将其复制给每一个城市；未能明确对应的四个城市坐标为 `null`。Jerusalem 的位置来自另一条单城源记录，仍分别保存来源关系，不判定其法律归属。
- 源数据如玻利维亚只列 Sucre、荷兰只列 Amsterdam、印度尼西亚列 Jakarta；这反映固定文件，不表示行政所在地/多角色现行首都资料已经完整。后续应添加带单独来源、角色和日期的关系，而不是覆盖旧记录。
- 中国名称优先读取源 native zho；其他条目读取 translations.zho。城市中文别名是首批界面编辑词表，不是已完成的全量双语科普；`translationStatus`明确区分编辑别名与待译。
- 所有目录 `contentStatus`为 `pending`。UI 必须独立关联已审核的 Destination/Story 内容，只有目录信息的城市不能提供虚假的可读故事入口。已有北京内容的就绪状态由内容包决定，不能据目录计数作推断。

## 接口与扩展

`src/exploration/earthDirectory.ts`导出：`earthDirectory`、`countries`、`cities`、`getEarthCity(id)`、`getCountryEntry(id)`、`searchEarthCities(query, {countryId?, tag?})`、`earthDirectoryStats()`和`validateEarthDirectory(directory)`。

城市 ID 是独立稳定标识，如 `city-beijing/city-new-york/city-paris/city-tokyo`；国家与地区 ID 采用 source code 的小写，例如 `cn/us/fr/jp`。后续改译名、添加别名或首都角色时保留旧 ID。新增同名城市必须由坐标和关联资料确认，不能仅按名字合并；导入器将两个 Kingston 分别识别为 `city-kingston-jm`与`city-kingston-nf`。

使用项目现有 tsx 运行（无需安装新包）：

```sh
node --import tsx scripts/import-earth-directory.mjs --check
node --import tsx --test tests/earth-directory.test.ts
```

重新生成同一个已审核基线：下载或检出固定原始文件，再运行：

```sh
node --import tsx scripts/import-earth-directory.mjs --from /path/to/countriesV3.1.json
node --import tsx scripts/import-earth-directory.mjs --check
```

导入器先核对源 SHA-256，再构建并校验输出，失败时不写目录。另一版本必须先复核范围、变动、许可与 stable IDs，再更新 revision/校验值和相关测试；不能让任意新数据继承旧版来源元数据。人工增补城市/关系可先在 JSON 中批量录入，填独立来源和明确审核状态，`--check`验证 ID、关系、去重、坐标、日期、来源、标签与基线计数。不得自动批准故事或图片。

## 本轮验证

本轮仅针对该目录执行 focused 测试与导入校验，未把结果算作 Fire TV、真实手势或全项目构建通过。完整测试和目标平台回归由主任务统一执行并报告。
