# SOLARIS 名称与国际化安全合并验收

日期：2026-10-06。本轮只合并确认匹配对象的名称、搜索别名及已有组件所需的界面翻译，不导入内容，不重构交互。

## 基线与执行边界

- 以当前 `/solaris/` 标注版的未提交工作树为基线，分支为 `codex/solaris-talk-text-control`，HEAD 为 `f8e37aee019a0b1033a83c89739c0e333802d8c2`。
- 没有重置、覆盖原有修改、迁移 ID、切换路由、提交、推送或公开发布。`/classic/` 原始手势版保持不变，本轮没有重新打包 classic。
- 两份 Downloads 名称文件只作为候选资源。已纠正其 `/classic/` 适用入口描述；交互建议明确降为待评估事项。
- 不新增语言切换按钮，不移动地标入口，不改变图片与正文的切换规则，不修改相机、手势、旋转和玻璃样式。
- 合并边界只允许 `name` 和 `aliases`，非空当前值优先。空值、占位文本、整条外部记录和新增候选不能覆盖现有内容。

## 显式匹配结果

完整逐项映射见 `data/bilingual-label-mapping.json` 和 `docs/BILINGUAL_LABEL_MAPPING.md`。

| 候选集合     | 总数 | 同一对象已确认 | 新增候选 | 歧义跳过 | 本轮不采用 |
| ------------ | ---: | -------------: | -------: | -------: | ---------: |
| 城市         |   81 |             77 |        2 |        2 |          0 |
| 地标         |   59 |             57 |        1 |        1 |          0 |
| 非地球主题   |   22 |             16 |        5 |        1 |          0 |
| 天体名称     |    9 |              9 |        0 |        0 |          0 |
| 导航组       |   58 |              0 |        0 |        0 |         58 |
| 大洲 section |    6 |              0 |        0 |        0 |          6 |
| 合计         |  235 |            159 |        8 |        4 |         64 |

- 77 个城市匹配包含 52 个首批城市及 25 个仅目录对象；后者不会因此出现空故事入口。旧目录实际有 248 个城市记录。
- 纽约明确映射为 `earth-city-new-york-city` → `city-new-york`，保留当前 ID。
- 导航组、大洲、国家关系和首都身份未导入或调整。
- 太阳英文名用于已有 HUD 逻辑对象，没有新增 `PlanetId`。

## 实际补齐数量

- **新增英文文案 2 个**：已有 HUD 太阳标题 `Sun`；已有返回太阳系按钮的英文可访问性/手势标签 `Back to Solar System`。按钮两个属性使用同一译文，计为一个文案。
- **城市、地标和行星区域名称补齐 0 个**：现有名称字段非空，全部保留。
- **新增去重搜索别名 71 个，涉及 53 个当前 ID**。目录层新增 18 个，标注层新增 55 个，其中有 2 个同 ID、同别名的跨层重复，统计时只计一次。
- 31 个界面资源键作为候选参考保存，不等于实际新增 62 个翻译值；已有组件仍保留现有非空文案。
- **保留名称冲突 70 个字段值**：逐项映射阶段 65 个，加上实际目录层检查发现的 5 个原始字段差异。另有 **3 个界面英文冲突**，也保留原值。
- 目录额外 5 个差异为 Brasília、Algiers、Rabat、Accra、Abuja 的既有中文字段当前使用英文字符串；本轮保留这些字段，仅补充候选中文搜索别名。
- 精确新增别名、冲突当前值/候选值、待补项和输入文件指纹记录于 `artifacts/bilingual-merge-result.json`。

## 待补与跳过

新增候选 8 个：Zurich、Johannesburg、Flower Dome、Rembrandt Basin、Mars 3 mission、Encke Gap、Uranus North Polar Cap、Neptune Rings。仅进入待补清单，没有坐标、图文或可点击入口自动生成。

歧义条目 4 个：Nay Pyi Taw、Ulaanbaatar、Neva River Embankments、Jupiter Equatorial Zone。本轮跳过，不凭相近拼写或同类地貌合并。

`region-mercury-raditladi` 保留原名、原 ID、坐标、素材和审核记录。伦勃朗盆地独立列为新增候选，不替换或借用拉迪特拉迪。现有木星云带、土星代表性环带、天王星大气及海王星风暴条目也保持原范围。

## 本轮修改文件

现有运行模块只修改以下 4 个文件：

- `src/exploration/earthDirectory.ts`：仅为现有城市追加确认别名。
- `src/exploration/planetAtlasCatalog.ts`：为现有标注接入名称/别名及搜索查询；原故事对象与关联保留。
- `src/exploration/EarthAtlasUI.tsx`：已有按钮使用界面翻译资源，保留当前文案和行为。
- `src/ui/HUD.tsx`：补充太阳英文标题及已有返回按钮英文标签，不增加控件或状态变化。

新增名称资源、映射、保护测试与记录：

- `src/exploration/bilingualLabels.ts`
- `data/bilingual-label-mapping.json`
- `data/bilingual-ui-candidates.json`
- `data/bilingual-content-baseline.json`
- `tests/bilingual-labels.test.ts`
- `tests/bilingual-content-preservation.test.ts`
- `docs/BILINGUAL_LABEL_MAPPING.md`
- `docs/BILINGUAL_MERGE_ACCEPTANCE_2026-10-06.md`

外部输入修改：`/Users/zhatiaili/Downloads/SOLARIS_BILINGUAL_LABELS.md` 和 `.json`。只纠正 scope 和执行边界，不填入坐标、素材或故事。映射文件中的原输入指纹注明为授权纠正前的审计阶段；最终输入指纹另存于结果记录。

QA 证据：`artifacts/qa-bilingual-labels.mjs`、`artifacts/bilingual-labels-production-qa.json`、`artifacts/bilingual-merge-result.json` 及 6 张生产预览截图。

## 自动化验收

- `npm test`：**604/604 通过，0 失败，0 跳过**。含新增 28 项内容保护测试和 15 项名称合并测试。
- `npm run build`：TypeScript 和 Vite 生产构建通过，base 为 `/solaris/`；原有大型 Cesium chunk 警告仍存在，未在本轮优化。
- `node scripts/verify-static-export.mjs dist /solaris/`：通过；另行核对全部 **249 张图片**，public 与 dist 的字节、路径及 SHA-256 与基线一致。
- 保护测试覆盖 22 个语义数据域、13 个原始来源/审核 JSON、57 个 classic/手势/相机/旋转/样式等文件和 1,316 个已有非空名称值。
- 地点、故事关联、坐标、锚点、正文、图集、来源、许可及审核数据保持；52 城、58 地标、24 非地球故事及 134 个故事总量未因本轮增加或减少。
- 重复合并不重复追加条目；不需要补齐的对象保持原对象引用。原有故事对象身份断言也通过。
- 语言状态 zh/en 切换及标注 SSR 验证通过：ID、当前选择、状态、标注位置和引导线不变。本轮没有可供浏览器点击的新语言按钮，因此不将此项声称为浏览器语言切换验收。
- 开发中出现过原故事对象引用回归和测试 fixture 类型错误，均已修正；没有放宽既有断言，最终完整测试及构建通过。

## 本地生产浏览器验收

地址：<http://127.0.0.1:5179/solaris/>，桌面视口 1440 × 960。

- 8 项浏览器检查通过，5 个真实图集全部通过：北京、天安门、巴黎、埃菲尔铁塔、拉迪特拉迪。
- 实际点击打开玻璃面板，真实图片加载及下一张/上一张切换通过，没有注入业务状态或 mock 素材。
- 地球、水星画布非空；手动旋转、缩放、热点聚焦和点击通过。关闭面板保持相机视图，实测最大数值差异约 `6.08e-7`，低于 `1e-6` 浮点容差。
- 北京仍为 5 个地标，巴黎仍为 4 个地标，水星仍为 2 个区域。伦勃朗没有变成可点击选项或标注。
- 0 页面异常、0 失败资源；生成 6 张截图。实际结果见 `artifacts/bilingual-labels-production-qa.json`。
- `GlobeStoryPanel.tsx` 和既有玻璃/旋转样式本轮未修改。构建后 chunk 名称变化不等于源文件行为改动。

## 版本与剩余验证边界

本地生产预览的 `build-info.json` SHA-256 为 `b878442577e6a8f7280576bfd65d1a601b9938b265d5f65af4b2c72befeee4eb`。主脚本为 `assets/main-D4493mK5.js`，SHA-256 为 `a4ffc678f3e19a7f2f58b31f64e1f8c50d5ba22b24f217165cfa43496f95ed1c`。这是当前 dirty 工作树的本地构建，不声称已公开部署。

本轮未重新验证 Fire TV 实机、摄像头手势、Safari/Firefox 或离线冷启动。原审核状态保持，名称匹配不表示历史事实或图片权利重新审核通过。未配置 ion 凭据、开通服务或改变账户权限。
