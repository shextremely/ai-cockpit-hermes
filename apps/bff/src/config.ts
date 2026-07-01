import dotenv from 'dotenv';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 优先读取仓库根目录的 .env(monorepo 共用),再读 BFF 本地 .env 兜底
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`[config] 缺少必需环境变量: ${name}`);
  }
  return v;
}

export const config = {
  hermes: {
    baseUrl: (process.env.HERMES_BASE_URL ?? 'http://127.0.0.1:8642').replace(/\/$/, ''),
    apiKey: required('HERMES_API_KEY'),
    sessionKey: process.env.HERMES_SESSION_KEY ?? 'agent:main:cockpit:user-self',
    model: process.env.HERMES_MODEL ?? 'hermes-agent',
  },
  bff: {
    port: Number(process.env.BFF_PORT ?? 5180),
    allowOrigin: process.env.BFF_ALLOW_ORIGIN ?? '',
    authToken: process.env.BFF_AUTH_TOKEN ?? '',
  },
  obsidian: {
    vaultPath: process.env.OBSIDIAN_VAULT_PATH ?? '',
    /** typora | default | 可执行文件绝对路径 */
    openMode: process.env.KNOWLEDGE_OPEN_MODE ?? 'typora',
    typoraPath: process.env.TYPORA_PATH ?? '',
  },
  claude: {
    skillsPath: process.env.CLAUDE_SKILLS_PATH ?? path.join(os.homedir(), '.claude', 'skills'),
    /** Claude Code CLI 可执行名/路径 */
    bin: process.env.CLAUDE_BIN ?? 'claude',
    /** Claude 运行的默认工作目录 */
    cwd: process.env.CLAUDE_CWD ?? path.resolve(__dirname, '../../..'),
    allowedTools:
      process.env.CLAUDE_ALLOWED_TOOLS ??
      'Read,Edit,Write,Bash,Glob,Grep,Skill,Task,WebSearch,WebFetch',
    permissionMode: process.env.CLAUDE_PERMISSION_MODE ?? 'bypassPermissions',
    maxTurns: Number(process.env.CLAUDE_MAX_TURNS ?? 30),
    model: process.env.CLAUDE_MODEL ?? '',
  },
  cursor: {
    /** Cursor CLI 可执行名/路径 */
    bin: process.env.CURSOR_BIN ?? 'cursor',
    /** 代码修复默认打开的工程目录 */
    defaultRepo: process.env.CURSOR_DEFAULT_REPO ?? path.resolve(__dirname, '../../..'),
    /** 能力面板技能在 Cursor 中执行时打开的工程目录 */
    skillsRepo: process.env.CURSOR_SKILLS_REPO ?? 'E:\\winning-repos',
  },
  chat: {
    /** 默认对话引擎: claude | hermes */
    backend: (process.env.CHAT_BACKEND ?? 'claude') as 'claude' | 'hermes',
  },
  // 生产模式下托管的前端静态产物目录(npm run build 后存在)
  webDist: path.resolve(__dirname, '../../web/dist'),
} as const;
