# SOLARIS 手机控制配对与中转

此模块复用已有 SOLARIS 场景和输入层，不运行第二套手机 Three.js 场景。手机仅本地执行 MediaPipe，网络只发送经过校验的控制动作和少量场景状态；不发送摄像头视频、图片或原始手部关键点。

## 本地启动

需要 Node.js >= 22.12（建议 24）、npm、TLS 证书和私钥。证书、私钥放在仓库外，不提交，不把管理员令牌交给开发者。

```sh
cd services/relay
npm ci
npm run check
npm test
RELAY_TLS_CERT=/absolute/private/fullchain.pem \
RELAY_TLS_KEY=/absolute/private/private-key.pem \
RELAY_ALLOWED_ORIGINS=https://appassets.androidplatform.net,https://alzat007.github.io \
npm start
```

默认仅监听 `127.0.0.1:8443`，严格 HTTPS/WSS，普通 HTTP 不支持。`services/relay/.env.example` 是变量模板；Node 启动不会自动读取 `.env`，用 shell 设置环境变量。TLS 证书的主机名必须匹配应用配置的服务地址。

本地自动化测试临时生成自签证书，仅测试客户端显式信任该 CA，不禁用系统 TLS 校验。浏览器不会因此自动信任证书。手机与电视的局域网实测需要双方可以访问的主机名、受双方信任的证书和 HTTPS 手机网页；没有这些条件不宣称真实配对已通过。

## 应用配置与路径

服务地址只接受预先配置的 HTTPS **origin**，例如 `https://relay.example:8443`。不接受用户名、密码、URL 参数、fragment 或路径，不从二维码或任意 query 参数获得服务地址。

- TV 角色：`POST /v1/sessions`，请求体 `{}`，获取随机 sessionId、一次性 TV 连接令牌和短时 claim 令牌。
- 两端实时连接：`wss://<same authority>/v1/ws`，地址中不得包含令牌。第一帧为 `{"type":"auth","role":"tv|controller","sessionId":"…","token":"…"}`。
- 健康检查：`GET /health`。此路径不返回会话信息、凭据或控制状态。
- 手机网页：现有构建的 `/solaris/controller/` 独立入口。二维码格式为该**已配置** HTTPS 页面加 `#session=…&claim=…`。fragment 不发给网页 HTTP 服务，解析后应立即从地址栏移除。
- Android 本地资源 origin：`https://appassets.androidplatform.net`，必须显式加入服务白名单；浏览器手机号的实际 HTTPS origin 也必须加入。
- Android WebView 仅允许预配置服务的精确 HTTPS authority 和上述两个通信路径；不能把任意外部网页设为可信。

TV 手机控制入口和手机页面配置变量由应用接入文档定义，Android 壳通过 `window.__SOLARIS_REMOTE_CONFIG` 提供 `relayUrl` 和已配置的 `phoneUrl`。中转本身不要求 Amazon、AWS、Cesium 或 Google Maps 的任何密钥。

GitHub Pages 只负责静态手机页面，不能托管这个有状态 Node WebSocket 中转。公网部署、收费资源、DNS/证书配置和报名提交都需要用户另外确认。本轮未公开部署此服务。

## 安全会话生命周期

1. TV 创建会话，再以一次性 TV 令牌连接。claim 默认两分钟有效，会话默认最多三十分钟。
2. 手机扫描并以 claim 首帧认证。成功 claim 后令牌立即消耗；第二个手机和重复 claim 都被拒绝。
3. TV 收到 `pair-request`，必须明确确认或拒绝。未确认前手机任何控制消息都被拒绝；确认默认三十秒超时。
4. 确认后两端收到 `connected`。TV 随时可 `revoke`，关闭配对/应用进入后台也应撤销；手机退出也结束会话。
5. 每秒心跳，六秒无心跳结束连接。任一认证方断线使整个会话及所有旧凭据失效。不会凭旧二维码或旧令牌偷偷重新控制，必须重新配对。
6. 输入层另设短连续控制 watchdog，以便不等连接心跳超时就停止旧旋转；关闭/断线/撤销事件必须立即结束抓取，遥控器继续可用。

默认限制：同 IP 每分钟最多十个会话、三十个新 WSS 连接；服务最多 1000 个会话、1024 个连接，单连接每秒最多五十个协议包。连续 POINTER/ROTATE/ZOOM 共用约 15Hz 上限，离散操作同动作至少 150ms，普通离散动作每秒最多六个。STOP/BACK/ROTATE_END 允许优先停止，但仍受连接总限频。浏览器客户端更早做限频与去抖。

所有消息最大 2KB，不允许未知字段、额外 payload、二进制消息。控制指令必须 version=1、同 sessionId、sequence 单调增长，timestamp 不早于两秒、不晚于一秒。迟到/重放/乱序消息拒绝；设备时钟差距较大时应校准时钟，不能放宽到无限接受旧消息。

服务使用内存会话，重启全失效。无数据库、无摄像头传输、无会话历史日志、无账号。Origin 白名单是浏览器边界，不替代不可猜测令牌及 TV 授权。

## 共用协议与客户端

`src/remote/controlProtocol.ts` 是服务与浏览器共用的严格协议校验器。动作：

- `SELECT`：确认当前有效目标，可携带安全 `expectedTargetId`；TV 必须检查与当前命中/焦点相同，不按任意 selector 查找。
- `POINTER {x,y}`：归一化屏幕位置 0..1。
- `ROTATE_START`、`ROTATE {dx,dy}`、`ROTATE_END`：旋转位移均在 -1..1。
- `ZOOM {delta}`：-1..1 的增量，由原输入层沿用当前缩放规则。
- `FOCUS {direction}`：仅 left/right/up/down。
- `BACK`、`NEXT_IMAGE`、`PREVIOUS_IMAGE`、`STOP`：无 payload。

`RemoteViewState` 仅允许 mode、selected、available 和 TV 发送的 focusTarget（稳定 ID、可选名称、body/ui 分类，以及可选来源 `source: "pointer" | "focus"`），不允许整份 store、图片或未经处理的传感器数据。来源只描述现有共享输入层的目标获取方式，不扩大控制权限，不传输传感器原始数据。

2026-10-12 的目标来源扩展保持协议 version=1。新校验器允许省略来源，拒绝未知来源和额外字段；旧严格校验器则会拒绝新增字段。因此部署时必须同步更新 TV、relay 和控制器，不支持把新 TV 与旧 relay 混装。新控制器面对缺少来源的旧 TV 状态保留原有保守 UI 捏合守卫，不能宣称旧 APK 已解决陈旧焦点问题。

`RelayClient` 接口：

```ts
const client = new RelayClient({ role: "tv", serviceUrl, onEvent });
await client.createSession();
client.confirm(requestId, true);
client.publishState({
  mode: "PLANET_OVERVIEW",
  selected: "earth",
  available: ["BACK", "SELECT"],
});
client.revoke();

const phone = new RelayClient({ role: "controller", serviceUrl, onEvent });
await phone.pair(sessionId, claimToken);
phone.sendAction("ROTATE", { dx: 0.2, dy: 0 });
phone.sendAction("STOP");
phone.disconnect();
```

事件为 pair-code、pair-request、waiting-approval、connected、action、state、acknowledged、error、closed。`sendAction` 返回 true 只表示已本地发送；`acknowledged` 只表示中转已验证转发，**不是**三维场景成功执行的证明。

## 验证与范围

独立模块的 `npm test` 真正启动 HTTPS/WSS 服务并以显式 CA 信任进行端到端通信，包括授权、ROTATE/SELECT/BACK、状态、撤销、断连、超时、重复配对、Origin/URL/协议拒绝和限频。`client.test.ts` 通过 Node TLS 适配浏览器 WebSocket/fetch API 验证 RelayClient 生命周期；不是 iPhone Safari、Android Chrome 或 Fire TV 运行证据。

测试中临时证书自动清理。独立模块锁定 `ws@8.22.0`；开发时的 npm audit 发现旧版本的内存泄露与分片 DoS 公告，因此已升级后重新测试。安全扫描通过只表示当前注册表未报告该依赖树的已知漏洞，不是永久无漏洞保证。没有真实 TLS 证书、手机、电视和 LAN 网络配置时，相应真实运行项仍为未验证。公开服务没有创建，任何网站当前已有运行结果不等于此新手机通信功能已部署。

## 获批后的最小局域网/部署步骤

1. 为双方能访问的固定服务地址配置可信证书，独立验证浏览器可访问 HTTPS，不能忽略证书警告或开启 Android 全局 cleartext。
2. 设置真实的 TV 与手机 HTTPS origin 白名单；前端/Android 配置同一个精确服务 origin 和手机页面地址。
3. 用户批准监听 LAN 后，显式设置 `RELAY_HOST` 与 `RELAY_ALLOW_NON_LOOPBACK=1`，按需开放防火墙端口，不默认监听公网。
4. 先以手机触控按钮验证 ROTATE/SELECT/BACK；通过后启用手机摄像头本地推理。相机必须由用户主动点击开启。
5. 实测断网、锁屏、摄像头停止、撤销、重新配对，记录真实设备延迟。不要把桌面移动模式或 Node WSS 数据称为手机真机性能。
6. 公网部署还需资源预算、证书续期、服务进程管理、防火墙及单实例路由决策；没有用户确认不执行。多实例不能直接共享当前内存会话，需要独立设计后再扩展。
