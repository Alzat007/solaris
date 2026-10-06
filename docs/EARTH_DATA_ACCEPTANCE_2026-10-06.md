# Earth data diagnosis and acceptance (2026-10-06)

## Status and Version Evidence

This is a local repair and diagnosis, not a publication or a completed real-map acceptance. No paid service, account setting, token, commit, push or deployment was created in this round.

- At the start, the worktree was clean and HEAD was `dae7b5032b1e6dbf7af08146c8f6ae2eaca5fe42`.
- Remote main and the latest successful Pages deployment used the same SHA. [Deployment evidence](https://github.com/Alzat007/solaris/actions/runs/37309821816).
- HTTPS requests without `?v` returned 200. The public HTML and nine generated resources matched the existing local `dist` byte for byte, including the main-to-embeddedEarth-to-GlobeLab dependency chain. This establishes actual asset identity, not just a query-string label.
- Baseline SHA-256: index `7d1292eee5843b0306d56cf6da909f708c497dcc0ee3aa6031ee6041ab7c0dcf`; main `8188fbfc15f557b430af50a137b728232529de267234d309471065082836a997`; GlobeLab `04324629c3d40bec78af9cf3b8212fec1f5e61c483a3fa10a7ae3dc9bc9bbec1`.
- Local repairs are uncommitted. The next local build records HEAD **and dirty=true**, mode/base, non-secret configuration and actual JS/CSS/HTML SHA-256 in `build-info.json`. A HEAD claim alone is not proof of asset identity. Production remains the old deployment until separately authorized.

## Root Cause

`earthProviderConfig()` defaults to `mode: local`, even when a token exists. Only an explicit `data=ion` request enables the existing real-data route; `qa=1&data=ion` is deliberately rejected. The baseline public URL did not opt in.

Local mode uses `SingleTileImageryProvider`, `textures/earth-day.jpg` (2048 x 1024), `EllipsoidTerrainProvider`, and a 250,000 m minimum camera height. There is no imagery pyramid, measured terrain or building mesh in that mode. Continued zoom cannot reveal additional source detail.

No `.env.local` or other credential configuration exists at audit time. The shell and both Vite development/production modes have no configured `VITE_CESIUM_ION_READ_TOKEN`. The repository/environment Secrets and Variables are empty; the Pages workflow only injects `VITE_BASE_PATH`. The public GlobeLab token binding is `undefined`, independently confirmed by byte identity.

The participant also confirmed that the ion resources and token have not been prepared. Therefore no authenticated asset endpoint or map tile was requested. **There is no observed 401/403/CORS/quota response to report, and no evidence of a previously successful connection that silently degraded.** Do not diagnose a particular permission failure without an actual response.

The existing ion route uses Terrain 1 then Imagery 3830183; provider failures do not substitute the local texture. This round adds separate sanitized terrain/imagery error metadata, optional validated resource IDs and transparent tile-receipt monitoring. An initialized provider or a completed globe frame is not proof of city coverage.

## Account Preparation (Chinese)

1. 在 [Cesium ion](https://ion.cesium.com/) 使用你自己的账户登录。在 My Assets / Asset Depot 中核对并准备 **Cesium World Terrain** 和 **Google Maps 2D Satellite with Labels**。默认 ID 分别为 **1**、**3830183**；记录账户实际显示的名称、类型和 ID。后者是 IMAGERY，不是建筑 3D Tiles。
2. 查看账户的套餐、当前用量、资源条款和收费提示。Community 当前有非商业个人/教育评估条件以及用量额度，不是无限免费。看到要求升级、添加付款方式或额外计费的流程时先停止并确认，不为了本项目开通付费服务。
3. 在 Access Tokens 创建独立开发用客户端令牌。只开 **assets:read**，Selected assets 只选上述两个资源；不要开启 assets:list/write、tokens:* 或其他管理权限。不开 geocoder，不需要 geocode 权限。
4. Allowed URLs 与实际开发服务器来源一致。本轮本地入口预计为 **http://127.0.0.1:5176**；若端口改变，按实际 URL 更新。`localhost` 与 `127.0.0.1`、不同端口是不同来源，不要无约束放开所有 URL。默认跨域 Referer 通常只包含 origin，所以不假定 `/solaris/` 路径限制一定有效。
5. 仅在本机 `.env.local` 中填写 `VITE_CESIUM_ION_READ_TOKEN`。同时可设置 `VITE_CESIUM_TERRAIN_ASSET_ID=1`、`VITE_CESIUM_IMAGERY_ASSET_ID=3830183`，按实际已授权资源更改。不要把令牌、密码、完整请求 URL 或带密钥的截图发到聊天；可以提供遮住令牌后的权限/资源/URL限制/用量截图。
6. 重启开发服务器，让 Vite 重新读取配置。正常入口仍只加载本地预览；打开 **`/?data=ion`**（不要带 `qa=1`），在太阳系点击地球，才会进行真实数据请求。
7. 本轮不配置公开生产令牌。未来如确认发布真实地图，要另建最小权限、限制来源 `https://alzat007.github.io` 的生产客户端令牌，并明确提供构建时配置，再构建/部署/实测。仅配置本机 `.env.local` 不会自动配置 GitHub Actions。

Client tokens are visible to the browser; ignoring `.env.local` is repository protection, not secrecy. Do not extract third-party credentials returned by ion to create an additional direct Google route.

### Official References and Cost Conditions

- [Google 2D imagery asset 3830183 and SDK usage](https://cesium.com/learn/cesiumjs-learn/cesiumjs-imagery/).
- [Google Maps 2D availability through ion Asset Depot](https://cesium.com/blog/2025/10/02/introducing-google-maps-2d-tiles/).
- [Token scopes, selected assets and allowed URLs](https://cesium.com/learn/ion/cesium-ion-access-tokens/).
- [Current plans](https://cesium.com/platform/cesium-ion/pricing/): at review time, Community lists 10 GB storage, 15 GB/month streaming and 1,000 monthly Global Imagery sessions, with eligibility restrictions. Terms can permit overage charges; this is not a zero-charge guarantee. [Terms](https://cesium.com/legal/terms-of-service/), [third-party terms](https://cesium.com/legal/third-party-terms/).
- [Cross-origin referrer policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).

## Four Independent Acceptance Layers

| Layer | Current implementation | Real-data acceptance |
| --- | --- | --- |
| Progressive imagery | Existing IonImageryProvider plus receipt counts and successful provider levels; local single-image mode remains explicitly identified | Not connected. Need successful city-scale requests, visible detail and actual local coverage/resolution; an SDK max level is not native source resolution |
| Terrain | Existing CesiumTerrainProvider / World Terrain, independent safe layer errors and receipt counts | Not connected. Need Beijing/Badaling ground heights and clearance tests. [World Terrain specifications](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/) describe global coverage, not measured local acceptance |
| Buildings | No building mesh layer | Not implemented or validated. Satellite imagery does not establish 3D building coverage. [Google coverage](https://developers.google.com/maps/coverage) does not prove complete Beijing 3D availability |
| Labels | Google labels belong to the real imagery asset; project city labels reuse existing sourced city coordinates, pixel-scale hysteresis and geographic projection; story markers reuse the same dot/line/name template | Country borders/names and provider POIs not connected. City/marker geometry can be tested locally, but not against real city imagery yet |
| Glass stories | Existing immediate-click panel, real bundled photos, attribution, close-with-pose-preservation; no dependency on a building layer | Beijing local interaction test only. Human review pending; real-map alignment still unverified |

## Second City and Scope

The existing Earth story catalog contains Beijing only (three story hotspots). Paris, London, New York, Rome and Tokyo have existing directory coordinates but no prepared story/photos in this implementation. They are not six completed content cities.

The repair derives Earth story hotspots from all Earth sites rather than a Beijing constant; city navigation and projected city labels use existing directory records and the one authoritative camera controller. A second catalog city can verify independent navigation and absence of leaked Beijing stories, but **cannot satisfy the second-city story acceptance yet**. Synthetic unit-test sites are never shipped as content.

The final all-planets / capitals / selected-cities product scope is unchanged. No new empty directories or generated stories were added.

## Reproducible Checks

1. Without credentials, use the normal local page, enter Earth, rotate/zoom manually, select Beijing, fly/skip and approach to the explicit 250 km boundary. Only the same low-resolution image is available; this is not city-scale acceptance.
2. At Beijing story-marker scale, hover/focus a marker: it only highlights. Click a story marker: the complete panel opens immediately with its own photo/text/loading state. Close it: camera position/orientation/scale are unchanged.
3. Select Paris and fly/skip. The camera moves to Paris coordinates in the same Earth instance; Beijing story markers are not shown as Paris stories. No Paris story is fabricated.
4. After approved local configuration, use `/?data=ion`, perform manual globe-to-city zoom, and separately record imagery/terrain received levels, safe failures and actual rendered city details. Keep provider attribution visible. Do not save tile responses/HAR files with credentials or cache map tiles for offline reuse.
5. Repeat complete real-data interaction in another actually prepared content city. Currently blocked by both account data access and a second city's story content.

Test results are recorded in the accompanying local QA update and final report. Automated factory tests validate error/cancel/instrumentation contracts, not an authenticated map connection.
