# Hermes Gateway 启动与登录自启文档

> Windows 原生 Hermes 环境下，如何启动 Gateway、配置 API Server，以及实现**登录 Windows 后自动后台运行**。

| 项 | 内容 |
| --- | --- |
| 文档版本 | v1.0 |
| 适用环境 | **Windows 原生** Hermes Agent |
| 本机 HERMES_HOME | `C:\Users\ThinkBook\AppData\Local\hermes` |
| API 端口 | **5173** |
| 最后更新 | 2026-06-25 |

---

## 1. 先分清两件事

| 你打开的 | 驾驶舱需要的 |
| --- | --- |
| Hermes **对话终端**（TUI，`Welcome to Hermes Agent!`、`>` 输入框） | **Gateway + API Server**（HTTP 服务） |
| 用于和 Agent 聊天 | 用于驾驶舱 BFF 调用 `/health`、`/v1/runs` 等 |

**TUI 开着 ≠ API 在线。** 驾驶舱顶栏「Hermes 在线/离线」只检测 HTTP：

```powershell
curl http://127.0.0.1:5173/health
# 期望: {"status":"ok", ...}
```

---

## 2. API Server 配置

编辑 Hermes 环境变量文件（本机路径）：

```
C:\Users\ThinkBook\AppData\Local\hermes\.env
```

需包含：

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=shextremely
API_SERVER_PORT=5173
API_SERVER_HOST=127.0.0.1
```

| 变量 | 说明 |
| --- | --- |
| `API_SERVER_KEY` | **自行设定**的本地 API 口令，不是网上申请的 Key |
| `API_SERVER_PORT` | HTTP 监听端口，驾驶舱 `.env` 中 `HERMES_BASE_URL` 须一致 |

驾驶舱项目 `E:\ai-cockpit-hermes\.env` 对应项：

```bash
HERMES_BASE_URL=http://127.0.0.1:5173
HERMES_API_KEY=shextremely    # 与 API_SERVER_KEY 相同
```

> 大模型 Key（Nous Portal / OpenRouter）在 Hermes 里单独配置，与 `API_SERVER_KEY` 无关。

修改 `.env` 后需**重启 Gateway** 才生效。

---

## 3. 手动启动 Gateway

```powershell
hermes gateway run          # 前台运行（关窗口即停）
hermes gateway start        # 启动已安装的后台服务
hermes gateway status       # 查看状态
hermes gateway stop         # 停止
hermes gateway restart      # 重启
```

验证：

```powershell
hermes gateway status
curl http://127.0.0.1:5173/health
curl -H "Authorization: Bearer shextremely" http://127.0.0.1:5173/v1/models
```

---

## 4. 登录自启（已在本机配置）

### 4.1 「登录」指什么？

指 **登录 Windows 系统**（当前用户 `ThinkBook` 输入密码/PIN 进入桌面），**不是**：

- Hermes 里对话
- 打开驾驶舱网页
- 某个网站账号登录

### 4.2 实际行为

| 时机 | 发生什么 |
| --- | --- |
| 你登录 Windows | 系统自动执行启动文件夹里的脚本 |
| 脚本后台运行 | `hermes gateway run`（无控制台窗口） |
| API 就绪 | `127.0.0.1:5173` 可访问 |
| 你打开驾驶舱 | BFF 检测到 Hermes 在线 |

**不会自动发生：** 不会自动打开浏览器或驾驶舱页面。

### 4.3 本机安装方式（启动文件夹）

因创建「计划任务」需 UAC 管理员批准，已采用 Hermes 官方**回退方案**：Windows **启动文件夹**。

| 文件 | 路径 |
| --- | --- |
| 登录时触发的入口 | `C:\Users\ThinkBook\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Hermes_Gateway.cmd` |
| 实际执行的 Gateway 脚本 | `C:\Users\ThinkBook\AppData\Local\hermes\gateway-service\Hermes_Gateway.cmd` |

`gateway-service\Hermes_Gateway.cmd` 内容要点：

- `cd` 到 `HERMES_HOME`
- 使用 `pythonw.exe` 无窗口运行 `gateway run`
- 读取 `C:\Users\ThinkBook\AppData\Local\hermes\.env` 中的 API 配置

### 4.4 登录自启 vs 开机自启

| 方式 | 触发时机 | 本机现状 |
| --- | --- | --- |
| **登录自启**（启动文件夹） | 进入 Windows 桌面后 | ✅ 已配置 |
| **开机自启**（系统计划任务） | 电脑开机，甚至无人登录 | ❌ 未配置（需管理员 UAC） |

---

## 5. 安装 / 重装登录自启

### 5.1 推荐：官方命令（非交互）

在 PowerShell 中：

```powershell
$env:HERMES_GATEWAY_INSTALL_START_NOW='true'
$env:HERMES_GATEWAY_INSTALL_START_ON_LOGIN='true'
echo n | hermes gateway install --force
```

说明：

- `START_NOW=true`：安装后立即启动 Gateway
- `START_ON_LOGIN=true`：写入登录自启
- `echo n`：跳过 UAC 时回退到**启动文件夹**（无需管理员）

成功输出示例：

```text
✓ Installed Windows login item: ...\Startup\Hermes_Gateway.cmd
✓ Gateway started via direct spawn (PID xxxxx)
```

### 5.2 可选：计划任务（需 UAC「是」）

在**管理员 PowerShell** 中执行，UAC 提示选「是」：

```powershell
$env:HERMES_GATEWAY_INSTALL_START_NOW='true'
$env:HERMES_GATEWAY_INSTALL_START_ON_LOGIN='true'
hermes gateway install --force
```

计划任务名称：`Hermes_Gateway`（`ONLOGON` 触发）。

### 5.3 卸载自启

```powershell
hermes gateway uninstall
```

会同时移除计划任务（若有）和启动文件夹入口。

---

## 6. 驾驶舱启动（配合 Hermes）

Hermes Gateway 自启后，驾驶舱仍需单独启动（或另行配置自启）。

### 6.1 开发模式

```powershell
cd E:\ai-cockpit-hermes
npm run dev
```

| 服务 | 地址 |
| --- | --- |
| 前端 | http://localhost:5174 |
| BFF | http://localhost:5180 |

### 6.2 生产模式

```powershell
cd E:\ai-cockpit-hermes
npm run build
npm start
# 访问 http://localhost:5180
```

### 6.3 验证驾驶舱 ↔ Hermes 连通

```powershell
curl http://localhost:5180/api/health
```

期望：

```json
{"bff":"ok","hermes":{"status":"ok","platform":"hermes-agent","version":"0.16.0"}}
```

若 `hermes: null`，说明 Gateway/API 未运行或端口不对。

---

## 7. 端口对照

| 服务 | 端口 | 配置文件 |
| --- | --- | --- |
| Hermes API | **5173** | `%HERMES_HOME%\.env` → `API_SERVER_PORT` |
| 驾驶舱前端（开发） | **5174** | `apps/web/vite.config.ts` |
| 驾驶舱 BFF | **5180** | `E:\ai-cockpit-hermes\.env` → `BFF_PORT` |

Hermes 与 Vite **不可共用同一端口**。

---

## 8. 日志与排障

### 8.1 查看 Gateway 日志

```powershell
type C:\Users\ThinkBook\AppData\Local\hermes\logs\gateway.log
type C:\Users\ThinkBook\AppData\Local\hermes\logs\gateway-stdio.log
```

### 8.2 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 驾驶舱显示 Hermes 离线 | Gateway 未运行或 API 未启用 | `hermes gateway status`；确认 `.env` 中 `API_SERVER_ENABLED=true` |
| 只有 TUI 开着，API 不通 | TUI ≠ Gateway | 执行 `hermes gateway start` 或重装自启 |
| 重启后 Hermes 未自启 | 未登录 Windows，或启动项被删 | 检查 `Startup\Hermes_Gateway.cmd` 是否存在；重新 `gateway install` |
| 改了密钥仍 401 | 驾驶舱与 Hermes 密钥不一致 | 两边 `API_SERVER_KEY` / `HERMES_API_KEY` 保持一致并重启 |
| `install` 卡住问 Y/n | 交互式安装 | 使用第 5.1 节环境变量 + `echo n` 非交互安装 |

### 8.3 检查启动项是否存在

```powershell
Test-Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Hermes_Gateway.cmd"
hermes gateway status
```

---

## 9. 相关文档

- [03-使用文档.md](03-使用文档.md) — 驾驶舱整体使用与排障
- [02-开发文档.md](02-开发文档.md) — BFF API 与 Hermes 集成
- [文档中心 README](README.md) — 端口速查

## 10. 外部参考

- [Hermes Messaging Gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/)
- [Hermes API Server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)
