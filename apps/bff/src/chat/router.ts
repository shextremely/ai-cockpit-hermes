import { config } from '../config.js';

export type ChatEngine = 'claude' | 'hermes';

export interface ChatDecision {
  engine: ChatEngine;
  /** code-fix 流程：在 Cursor 中打开工程供开发 */
  openCursor: boolean;
  cursorRepo?: string;
  /** 引擎附加的 system 提示 */
  systemPrompt?: string;
}

/** 代码修复 / 开发意图关键词 */
const CODE_FIX_RE =
  /(修复|修\s*bug|改\s*bug|改代码|改一下代码|代码修改|代码改|报错|抛错|异常堆栈|堆栈|debug|调试|重构|打开\s*cursor|用\s*cursor|在\s*cursor|开发这个|实现这个功能|跑一下代码|本地改)/i;

/** 从输入中提取 Windows/Unix 风格的工程路径 */
function extractRepo(input: string): string | undefined {
  const win = input.match(/[A-Za-z]:[\\/][^\s"'，。、]+/);
  if (win) return win[0];
  const unix = input.match(/(?:^|\s)(\/[^\s"'，。、]+)/);
  if (unix) return unix[1];
  return undefined;
}

const CODE_FIX_SYSTEM_PROMPT = [
  '用户需要修复或开发代码，Cursor 已自动为其打开目标工程。',
  '请：1) 用 code-locator 或 MCP 定位相关代码工程与入口；',
  '2) 给出根因分析、修复/开发方案与涉及的具体文件、函数；',
  '3) 必要时说明在 Cursor 中的操作步骤。',
  '不要自行大规模改写代码，由用户在 Cursor 中完成实际编辑。',
].join('\n');

/**
 * 决定本次对话由哪个引擎处理。
 * - 显式 backend 覆盖优先
 * - code-fix/开发意图 → Hermes（其强项：MCP 定位/编排）+ 打开 Cursor
 * - 其余 → 默认引擎（Claude Code，技能执行体验更好）
 */
export function routeChat(input: string, backendOverride?: string): ChatDecision {
  if (backendOverride === 'claude' || backendOverride === 'hermes') {
    return { engine: backendOverride, openCursor: false };
  }
  if (CODE_FIX_RE.test(input)) {
    return {
      engine: 'hermes',
      openCursor: true,
      cursorRepo: extractRepo(input),
      systemPrompt: CODE_FIX_SYSTEM_PROMPT,
    };
  }
  return { engine: config.chat.backend, openCursor: false };
}
