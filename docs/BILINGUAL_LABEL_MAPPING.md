# Bilingual Label Mapping Audit

日期：2026-10-06。仅审核两份外部候选文件的名称与实体对应关系；这是名称映射审计，不是全量内容导入、事实再审核或公开发布。

## 输入与边界

- 候选：`SOLARIS_BILINGUAL_LABELS.md`、`SOLARIS_BILINGUAL_LABELS.json`。审计 JSON 保留授权纠正前的输入 SHA-256；后续按用户要求仅纠正原文件的 scope 和执行边界，名称与实体目录不作整包替换。最终输入指纹及接入结果见 `artifacts/bilingual-merge-result.json` 和 `docs/BILINGUAL_MERGE_ACCEPTANCE_2026-10-06.md`。
- 当前实体：`firstBatchEarth.ts`、`cityLandmarks.ts`、`planetAtlasCatalog.ts`、`earthDirectory.ts`、`src/data/planets.ts`，以及 HUD 中太阳的既有逻辑标识。
- 当前首批 52 城、58 地标、24 非地球故事；旧目录实际为 **248** 城。目录记录不等于可用故事。
- 候选 81 城、59 地标、22 非地球主题、9 天体，另外 58 个导航组、6 个大洲 section。全部逐项记录，不按数组顺序或同星球匹配。
- `confirmed` 仅表示对象名称对应明确。所有既有事实、照片署名、许可、坐标、审核状态保持；**不代表 human review 已通过**。
- 附件中的 `classic-lightweight-annotations` scope 不采纳。现有 `build-classic.mjs` 固定构建旧提交 `2353680`；不得因此把本轮资源接入或迁移到旧版路由。
- 未重新访问每条历史事实或图片许可页面，`factAndImageRightsReverified=false`；本轮核验依据为当前实体名称、既有目录与已记录的 entity/source links。

## 可执行契约

审计 JSON 顶层为 `mappings`，包含 `cities`、`landmarks`、`planetaryFeatures`、`bodies`、`navigationGroups`、`sections`。每条记录至少含：

```json
{
  "externalId": "earth-city-beijing",
  "currentId": "city-beijing",
  "status": "confirmed",
  "currentScope": "first-batch-city",
  "runtimeEligible": true,
  "candidateName": { "zh": "北京", "en": "Beijing" },
  "candidateAliases": ["北京", "Beijing"],
  "currentName": { "zh": "北京", "en": "Beijing" },
  "nameDecisions": { "zh": "same", "en": "same" },
  "identityBasis": "Explicit same-city identity check."
}
```

- 仅 `confirmed` 可进入名称/alias 合并。既有非空名称逐语言保留；`retain_current` 绝不覆盖当前译名。
- `candidateAliases` 去重收录候选 name、shortName、aliases；追加 alias 不创建内容或入口。
- `runtimeEligible=false` 的目录项可储存确认的别名，但不能变成 story-ready、marker 或新可点击项。
- `new`、`ambiguous`、`not_adopted` 的 `currentId=null`；`candidateCurrentIds` 或 `comparisonCurrentIds` 只是审计参考，不是合并目标。
- 天体、资料来源、分类组属于不同命名空间。同名 ID 跨命名空间重用不等于重复实体；只在各集合内检查唯一性。
- 太阳 `sun` 是现有场景 sentinel，不应加入八行星 `PlanetId` 类型。当前 HUD 的中文名为“太阳”，未找到既有英文 display-name 字段，因此其英文记录为 null；八行星英文按 `PlanetData.name` 实际大写值保留。
- 本审计不改变导航组、国别归属、首都职能、轮廓或大陆分类；不把候选 group 的名称当作当前 country 的 alias。

## 实际数量

| 集合              | 总数 | confirmed | new | ambiguous | not_adopted | 既有入口可用 |
| ----------------- | ---: | --------: | --: | --------: | ----------: | -----------: |
| cities            |   81 |        77 |   2 |         2 |           0 |           52 |
| landmarks         |   59 |        57 |   1 |         1 |           0 |           57 |
| planetaryFeatures |   22 |        16 |   5 |         1 |           0 |           16 |
| bodies            |    9 |         9 |   0 |         0 |           0 |            9 |
| navigationGroups  |   58 |         0 |   0 |         0 |          58 |            0 |
| sections          |    6 |         0 |   0 |         0 |           6 |            0 |

共 235 条审计记录：159 confirmed、8 new、4 ambiguous、64 not_adopted。其中 52 条记录至少一种语言与当前字符串不同，所有这种语言冲突均保留当前值；该数字不是“补齐翻译”的数量。

## 需要保留或跳过的关键项

- 城市 77 confirmed = 52 首批可用 + 25 仅目录对应；25 项没有首批完整图库与故事，禁止放出空入口。
- 纽约：`earth-city-new-york-city` 明确对应 `city-new-york`，不能简单生成 `city-new-york-city`。
- `Nay Pyi Taw` 与目录 `Naypyidaw`、`Ulaanbaatar` 与目录 `Ulan Bator` 尚无当前互相 alias 或本轮来源核验，列 ambiguous，暂不凭相似拼写合并。
- Zurich、Johannesburg 为 new；不从其他城市借坐标、照片或事件。
- 北京天安门记录的 Q83973 和既有 topic 指城楼而非广场；Merlion 的既有 source 指 Merlion Park。名称对应可确认，但照片主体、图注和既有代表范围不变。
- Neva River Embankments 是较宽泛的河岸集合；当前只以 Palace Embankment 为代表锚点。该候选列 ambiguous，不扩大当前对象的名称范围。
- Flower Dome 是 new，不能把 Gardens by the Bay 的图库自动当作花穹图片已核验。
- Rembrandt 为 new，**不是 Raditladi**。保留 `region-mercury-raditladi`。
- Mars 3 为新任务级主题，不能对应 Viking 1、推测着陆位置或生成球面热点。
- Equatorial Zone 与当前泛云带/赤道云带范围不同，列 ambiguous；Encke Gap 不是现有 C-ring 观测区。
- 天王星北极亮区、海王星环为 new。天王星环虽名称对象可对应，但仍保留当前 `phenomenon` 锚点，不采用候选 `ring` 或改几何。
- 1989 年大暗斑保留历史时间与当前中文译名，不声称是现时固定地理地点。
- CN / 香港 / 台北及周边三候选组全部 not_adopted；保留当前“ 中国组 / China group ”、城市关系及首都 flags，不借本轮名称资源裁定政治或行政关系。
- 首都字段、countryIds 和大陆归属不采用候选 null 或候选顺序覆盖。俄罗斯城市位于欧洲，不推出整个俄罗斯仅属于欧洲。
- 当前图库是完整故事 + 可切换图片。附件“每图对应事件正文同步切换”不是名称资源功能，本轮不重构 slide、隐藏整篇事件或编造图片/事件绑定。

## 保留的既有非地球条目

以下 8 条在候选中无安全一对一名称对应，仍原样保留：

- `region-mercury-raditladi`
- `region-venus-maat-mons`
- `region-venus-alpha-regio`
- `region-jupiter-cloud-belts`
- `region-uranus-clouds`
- `region-jupiter-equatorial-belts`
- `region-saturn-ring-observation`
- `region-neptune-storm-activity`

## 逐项映射

### 城市

| 外部 ID                          | 当前 ID                    | 状态      | 当前范围                     | 入口边界   |
| -------------------------------- | -------------------------- | --------- | ---------------------------- | ---------- |
| `earth-city-beijing`             | `city-beijing`             | confirmed | first-batch-city             | 既有入口   |
| `earth-city-shanghai`            | `city-shanghai`            | confirmed | first-batch-city             | 既有入口   |
| `earth-city-shenzhen`            | `city-shenzhen`            | confirmed | first-batch-city             | 既有入口   |
| `earth-city-hangzhou`            | `city-hangzhou`            | confirmed | first-batch-city             | 既有入口   |
| `earth-city-hong-kong`           | `city-hong-kong`           | confirmed | first-batch-city             | 既有入口   |
| `earth-city-taipei`              | `city-taipei`              | confirmed | first-batch-city             | 既有入口   |
| `earth-city-tokyo`               | `city-tokyo`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-kyoto`               | `city-kyoto`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-sapporo`             | `city-sapporo`             | confirmed | first-batch-city             | 既有入口   |
| `earth-city-seoul`               | `city-seoul`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-pyongyang`           | `city-pyongyang`           | confirmed | first-batch-city             | 既有入口   |
| `earth-city-singapore`           | `city-singapore`           | confirmed | first-batch-city             | 既有入口   |
| `earth-city-kuala-lumpur`        | `city-kuala-lumpur`        | confirmed | first-batch-city             | 既有入口   |
| `earth-city-bangkok`             | `city-bangkok`             | confirmed | first-batch-city             | 既有入口   |
| `earth-city-hanoi`               | `city-hanoi`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-manila`              | `city-manila`              | confirmed | first-batch-city             | 既有入口   |
| `earth-city-jakarta`             | `city-jakarta`             | confirmed | first-batch-city             | 既有入口   |
| `earth-city-phnom-penh`          | `city-phnom-penh`          | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-vientiane`           | `city-vientiane`           | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-nay-pyi-taw`         | -                          | ambiguous | directory-spelling-candidate | 不新增入口 |
| `earth-city-bandar-seri-begawan` | `city-bandar-seri-begawan` | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-dili`                | `city-dili`                | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-new-delhi`           | `city-new-delhi`           | confirmed | first-batch-city             | 既有入口   |
| `earth-city-islamabad`           | `city-islamabad`           | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-ulaanbaatar`         | -                          | ambiguous | directory-spelling-candidate | 不新增入口 |
| `earth-city-astana`              | `city-astana`              | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-tashkent`            | `city-tashkent`            | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-london`              | `city-london`              | confirmed | first-batch-city             | 既有入口   |
| `earth-city-manchester`          | `city-manchester`          | confirmed | first-batch-city             | 既有入口   |
| `earth-city-paris`               | `city-paris`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-berlin`              | `city-berlin`              | confirmed | first-batch-city             | 既有入口   |
| `earth-city-rome`                | `city-rome`                | confirmed | first-batch-city             | 既有入口   |
| `earth-city-madrid`              | `city-madrid`              | confirmed | first-batch-city             | 既有入口   |
| `earth-city-barcelona`           | `city-barcelona`           | confirmed | first-batch-city             | 既有入口   |
| `earth-city-moscow`              | `city-moscow`              | confirmed | first-batch-city             | 既有入口   |
| `earth-city-saint-petersburg`    | `city-saint-petersburg`    | confirmed | first-batch-city             | 既有入口   |
| `earth-city-amsterdam`           | `city-amsterdam`           | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-brussels`            | `city-brussels`            | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-lisbon`              | `city-lisbon`              | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-athens`              | `city-athens`              | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-vienna`              | `city-vienna`              | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-bern`                | `city-bern`                | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-zurich`              | -                          | new       | unmapped-city-seed           | 不新增入口 |
| `earth-city-prague`              | `city-prague`              | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-budapest`            | `city-budapest`            | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-warsaw`              | `city-warsaw`              | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-washington-dc`       | `city-washington-dc`       | confirmed | first-batch-city             | 既有入口   |
| `earth-city-new-york-city`       | `city-new-york`            | confirmed | first-batch-city             | 既有入口   |
| `earth-city-los-angeles`         | `city-los-angeles`         | confirmed | first-batch-city             | 既有入口   |
| `earth-city-san-francisco`       | `city-san-francisco`       | confirmed | first-batch-city             | 既有入口   |
| `earth-city-chicago`             | `city-chicago`             | confirmed | first-batch-city             | 既有入口   |
| `earth-city-ottawa`              | `city-ottawa`              | confirmed | first-batch-city             | 既有入口   |
| `earth-city-toronto`             | `city-toronto`             | confirmed | first-batch-city             | 既有入口   |
| `earth-city-vancouver`           | `city-vancouver`           | confirmed | first-batch-city             | 既有入口   |
| `earth-city-mexico-city`         | `city-mexico-city`         | confirmed | first-batch-city             | 既有入口   |
| `earth-city-brasilia`            | `city-brasilia`            | confirmed | first-batch-city             | 既有入口   |
| `earth-city-rio-de-janeiro`      | `city-rio-de-janeiro`      | confirmed | first-batch-city             | 既有入口   |
| `earth-city-sao-paulo`           | `city-sao-paulo`           | confirmed | first-batch-city             | 既有入口   |
| `earth-city-buenos-aires`        | `city-buenos-aires`        | confirmed | first-batch-city             | 既有入口   |
| `earth-city-santiago`            | `city-santiago`            | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-lima`                | `city-lima`                | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-bogota`              | `city-bogota`              | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-montevideo`          | `city-montevideo`          | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-cairo`               | `city-cairo`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-algiers`             | `city-algiers`             | confirmed | first-batch-city             | 既有入口   |
| `earth-city-rabat`               | `city-rabat`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-accra`               | `city-accra`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-abuja`               | `city-abuja`               | confirmed | first-batch-city             | 既有入口   |
| `earth-city-nairobi`             | `city-nairobi`             | confirmed | first-batch-city             | 既有入口   |
| `earth-city-addis-ababa`         | `city-addis-ababa`         | confirmed | first-batch-city             | 既有入口   |
| `earth-city-kampala`             | `city-kampala`             | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-dodoma`              | `city-dodoma`              | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-pretoria`            | `city-pretoria`            | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-cape-town`           | `city-cape-town`           | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-bloemfontein`        | `city-bloemfontein`        | confirmed | directory-only-city          | 不新增入口 |
| `earth-city-johannesburg`        | -                          | new       | unmapped-city-seed           | 不新增入口 |
| `earth-city-canberra`            | `city-canberra`            | confirmed | first-batch-city             | 既有入口   |
| `earth-city-sydney`              | `city-sydney`              | confirmed | first-batch-city             | 既有入口   |
| `earth-city-melbourne`           | `city-melbourne`           | confirmed | first-batch-city             | 既有入口   |
| `earth-city-wellington`          | `city-wellington`          | confirmed | first-batch-city             | 既有入口   |
| `earth-city-auckland`            | `city-auckland`            | confirmed | first-batch-city             | 既有入口   |

### 地标

| 外部 ID                                           | 当前 ID                                        | 状态      | 当前范围               | 入口边界   |
| ------------------------------------------------- | ---------------------------------------------- | --------- | ---------------------- | ---------- |
| `earth-city-beijing-tiananmen-gate`               | `city-landmark-beijing-tiananmen`              | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-beijing-forbidden-city`               | `city-landmark-beijing-forbidden-city`         | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-beijing-badaling-great-wall`          | `city-landmark-beijing-great-wall`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-beijing-national-stadium`             | `city-landmark-beijing-birds-nest`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-beijing-temple-of-heaven`             | `city-landmark-beijing-temple-heaven`          | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-shanghai-bund`                        | `city-landmark-shanghai-bund`                  | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-shanghai-oriental-pearl`              | `city-landmark-shanghai-oriental-pearl`        | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-shanghai-shanghai-tower`              | `city-landmark-shanghai-tower`                 | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-shanghai-yu-garden`                   | `city-landmark-shanghai-yu-garden`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-shenzhen-ping-an-finance-centre`      | `city-landmark-shenzhen-ping-an`               | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-shenzhen-shenzhen-bay`                | `city-landmark-shenzhen-bay`                   | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-shenzhen-huaqiangbei`                 | `city-landmark-shenzhen-huaqiangbei`           | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-shenzhen-qianhai`                     | `city-landmark-shenzhen-qianhai`               | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-hangzhou-west-lake`                   | `city-landmark-hangzhou-west-lake`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-hangzhou-lingyin-temple`              | `city-landmark-hangzhou-lingyin`               | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-hangzhou-olympic-sports-centre`       | `city-landmark-hangzhou-asian-games`           | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-hong-kong-victoria-harbour`           | `city-landmark-hong-kong-victoria-harbour`     | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-hong-kong-victoria-peak`              | `city-landmark-hong-kong-victoria-peak`        | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-hong-kong-central`                    | `city-landmark-hong-kong-central`              | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-hong-kong-convention-centre`          | `city-landmark-hong-kong-convention-centre`    | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-taipei-taipei-101`                    | `city-landmark-taipei-101`                     | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-taipei-national-palace-museum`        | `city-landmark-taipei-palace-museum`           | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-taipei-chiang-kai-shek-memorial`      | `city-landmark-taipei-chiang-kai-shek`         | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-tokyo-tokyo-tower`                    | `city-landmark-tokyo-tower`                    | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-tokyo-senso-ji`                       | `city-landmark-tokyo-sensoji`                  | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-tokyo-shibuya-crossing`               | `city-landmark-tokyo-shibuya`                  | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-tokyo-tokyo-station`                  | `city-landmark-tokyo-station`                  | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-kyoto-kiyomizu-dera`                  | `city-landmark-kyoto-kiyomizu`                 | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-kyoto-kinkaku-ji`                     | `city-landmark-kyoto-kinkakuji`                | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-kyoto-fushimi-inari`                  | `city-landmark-kyoto-fushimi-inari`            | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-seoul-gyeongbokgung`                  | `city-landmark-seoul-gyeongbokgung`            | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-seoul-n-seoul-tower`                  | `city-landmark-seoul-namsan-tower`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-seoul-gwanghwamun`                    | `city-landmark-seoul-gwanghwamun`              | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-singapore-merlion-park`               | `city-landmark-singapore-merlion`              | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-singapore-marina-bay-sands`           | `city-landmark-singapore-marina-bay-sands`     | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-singapore-gardens-by-the-bay`         | `city-landmark-singapore-gardens-bay`          | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-singapore-flower-dome`                | -                                              | new       | unmapped-landmark-seed | 不新增入口 |
| `earth-city-new-york-city-statue-of-liberty`      | `city-landmark-new-york-liberty`               | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-new-york-city-times-square`           | `city-landmark-new-york-times-square`          | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-new-york-city-central-park`           | `city-landmark-new-york-central-park`          | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-new-york-city-empire-state-building`  | `city-landmark-new-york-empire-state`          | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-washington-dc-white-house`            | `city-landmark-washington-white-house`         | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-washington-dc-us-capitol`             | `city-landmark-washington-capitol`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-washington-dc-lincoln-memorial`       | `city-landmark-washington-lincoln`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-washington-dc-washington-monument`    | `city-landmark-washington-monument`            | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-paris-eiffel-tower`                   | `city-landmark-paris-eiffel`                   | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-paris-louvre`                         | `city-landmark-paris-louvre`                   | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-paris-arc-de-triomphe`                | `city-landmark-paris-arc-triomphe`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-paris-notre-dame`                     | `city-landmark-paris-notre-dame`               | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-london-elizabeth-tower`               | `city-landmark-london-big-ben`                 | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-london-buckingham-palace`             | `city-landmark-london-buckingham`              | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-london-london-eye`                    | `city-landmark-london-eye`                     | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-london-tower-bridge`                  | `city-landmark-london-tower-bridge`            | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-moscow-red-square`                    | `city-landmark-moscow-red-square`              | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-moscow-kremlin`                       | `city-landmark-moscow-kremlin`                 | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-moscow-st-basils`                     | `city-landmark-moscow-saint-basil`             | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-saint-petersburg-winter-palace`       | `city-landmark-saint-petersburg-winter-palace` | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-saint-petersburg-peter-paul-fortress` | `city-landmark-saint-petersburg-peter-paul`    | confirmed | first-batch-landmark   | 既有入口   |
| `earth-city-saint-petersburg-neva-embankments`    | -                                              | ambiguous | landmark-region-scope  | 不新增入口 |

### 非地球主题

| 外部 ID                        | 当前 ID                          | 状态      | 当前范围               | 入口边界   |
| ------------------------------ | -------------------------------- | --------- | ---------------------- | ---------- |
| `mercury-caloris-basin`        | `region-mercury-caloris`         | confirmed | planet-story           | 既有入口   |
| `mercury-rembrandt-basin`      | -                                | new       | unmapped-planet-topic  | 不新增入口 |
| `venus-ishtar-terra`           | `region-venus-ishtar-terra`      | confirmed | planet-story           | 既有入口   |
| `venus-aphrodite-terra`        | `region-venus-aphrodite-terra`   | confirmed | planet-story           | 既有入口   |
| `venus-maxwell-montes`         | `region-venus-maxwell-montes`    | confirmed | planet-story           | 既有入口   |
| `mars-olympus-mons`            | `region-mars-olympus-mons`       | confirmed | planet-story           | 既有入口   |
| `mars-jezero-crater`           | `region-mars-jezero`             | confirmed | planet-story           | 既有入口   |
| `mars-viking-1-landing-site`   | `region-mars-viking-1`           | confirmed | planet-story           | 既有入口   |
| `mars-valles-marineris`        | `region-mars-valles-marineris`   | confirmed | planet-story           | 既有入口   |
| `mars-mars-3-mission`          | -                                | new       | unmapped-planet-topic  | 不新增入口 |
| `jupiter-great-red-spot`       | `region-jupiter-great-red-spot`  | confirmed | planet-story           | 既有入口   |
| `jupiter-equatorial-zone`      | -                                | ambiguous | atmospheric-band-scope | 不新增入口 |
| `jupiter-polar-cyclones`       | `region-jupiter-polar-cyclones`  | confirmed | planet-story           | 既有入口   |
| `saturn-rings`                 | `region-saturn-rings`            | confirmed | planet-story           | 既有入口   |
| `saturn-cassini-division`      | `region-saturn-cassini-division` | confirmed | planet-story           | 既有入口   |
| `saturn-north-polar-hexagon`   | `region-saturn-north-hexagon`    | confirmed | planet-story           | 既有入口   |
| `saturn-encke-gap`             | -                                | new       | unmapped-planet-topic  | 不新增入口 |
| `uranus-rings`                 | `region-uranus-rings`            | confirmed | planet-story           | 既有入口   |
| `uranus-north-polar-cap`       | -                                | new       | unmapped-planet-topic  | 不新增入口 |
| `neptune-great-dark-spot-1989` | `region-neptune-great-dark-spot` | confirmed | planet-story           | 既有入口   |
| `neptune-high-altitude-clouds` | `region-neptune-high-clouds`     | confirmed | planet-story           | 既有入口   |
| `neptune-rings`                | -                                | new       | unmapped-planet-topic  | 不新增入口 |

### 天体

| 外部 ID   | 当前 ID   | 状态      | 当前范围           | 入口边界 |
| --------- | --------- | --------- | ------------------ | -------- |
| `sun`     | `sun`     | confirmed | scene-sun-sentinel | 既有入口 |
| `mercury` | `mercury` | confirmed | planet-data        | 既有入口 |
| `venus`   | `venus`   | confirmed | planet-data        | 既有入口 |
| `earth`   | `earth`   | confirmed | planet-data        | 既有入口 |
| `mars`    | `mars`    | confirmed | planet-data        | 既有入口 |
| `jupiter` | `jupiter` | confirmed | planet-data        | 既有入口 |
| `saturn`  | `saturn`  | confirmed | planet-data        | 既有入口 |
| `uranus`  | `uranus`  | confirmed | planet-data        | 既有入口 |
| `neptune` | `neptune` | confirmed | planet-data        | 既有入口 |

58 个 navigation groups 和 6 个 sections 的逐项比较均在 JSON 中记录为 `not_adopted`，不自动改变现有分类。语言冲突的逐语言决策、名称原值与候选值也在 JSON 对应记录中完整保留。

## 验证边界

落盘前对 235 条记录做集合内 externalId 唯一、confirmed 目标存在、同城/同星球关系、数量统计与非 confirmed 禁用检查。未运行开发构建、长浏览器验收或发布。本审计不修改任何 runtime 文件。
