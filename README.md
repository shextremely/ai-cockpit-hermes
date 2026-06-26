# 个人 AI 驾驶舱（Hermes Cockpit）

采用**双引擎**架构：**Claude Code**（对话与技能执行主引擎，原生 `/技能` 体验）+ **Hermes Agent**（定时 Job、MCP 编排、代码修复时打开 Cursor）。前端用 **Vue 3** 构建「仪表盘 + 对话式驾驶舱」，通过轻量 **BFF** 统一代理两引擎，辅助 TFS 研发、知识管理(Obsidian)、个人日程三大日常工作。

## 双引擎路由

| 场景 | 引擎 | 说明 |
| --- | --- | --- |
| 通用对话 / 能力面板技能 | Claude Code | 经 `claude -p --output-format stream-json` 流式，技能走原生 `/slash` 命令 |
| 代码修复 / 开发(含「修bug、报错、重构」等意图) | Hermes + Cursor | BFF 自动 `cursor <工程>` 打开，Hermes 负责定位与方案编排 |
| 定时 Job / MCP 编排 | Hermes | 维持 Hermes 既有强项 |

引擎可由 `CHAT_BACKEND` 设默认，或在 `/chat` 请求 `backend` 字段显式指定；命中代码修复意图会自动切到 Hermes 并打开 Cursor。

## 文档

| 文档 | 路径 |
| --- | --- |
| 文档中心 | [docs/README.md](docs/README.md) |
| 设计文档 | [docs/01-设计文档.md](docs/01-设计文档.md) |
| 开发文档 | [docs/02-开发文档.md](docs/02-开发文档.md) |
| 使用文档 | [docs/03-使用文档.md](docs/03-使用文档.md) |
| Hermes 启动与自启 | [docs/04-Hermes启动与自启.md](docs/04-Hermes启动与自启.md) |

## 快速开始

```bash
# 1. 配置 Hermes（WSL2 ~/.hermes/.env）并启动 hermes gateway
# 2. 复制并编辑环境变量
copy .env.example .env

# 3. 安装与开发
npm install
npm run dev
# 前端 http://localhost:5174  |  BFF http://localhost:5180
```

详细步骤见 **[使用文档](docs/03-使用文档.md)**。

## 端口（当前环境）

| 服务 | 端口 |
| --- | --- |
| Hermes API | 5173 |
| 前端(Vite 开发) | 5174 |
| BFF | 5180 |

## 目录结构

```
e:/ai-cockpit-hermes/
├─ docs/                 # 设计 / 开发 / 使用文档
├─ apps/bff/             # Express BFF 安全代理
├─ apps/web/             # Vue3 前端
├─ .env.example
└─ package.json          # npm workspaces
```

## 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 并行启动 BFF + 前端 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build` | 构建前后端 |
| `npm start` | 生产模式（BFF 托管前端，访问 :5180） |

## 安全红线

- `HERMES_API_KEY` 只在 BFF `.env`，**绝不**进浏览器
- Hermes 绑定 `127.0.0.1`，仅 BFF 可访问
- 写/高危操作经审批门禁 + 前端确认

## 技术栈

Vue 3 · Vite · TypeScript · Pinia · Naive UI · Express · Claude Code CLI · Hermes Agent · MCP · Cursor CLI
