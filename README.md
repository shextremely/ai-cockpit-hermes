# 个人 AI 驾驶舱（Hermes Cockpit）

以本地 **Hermes Agent** 为统一 AI 引擎与工具编排中枢，前端用 **Vue 3** 构建「仪表盘 + 对话式驾驶舱」，通过轻量 **BFF** 安全代理 Hermes 的 OpenAI 兼容 API，辅助 TFS 研发、知识管理(Obsidian)、个人日程三大日常工作。

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

Vue 3 · Vite · TypeScript · Pinia · Naive UI · Express · Hermes Agent · MCP
