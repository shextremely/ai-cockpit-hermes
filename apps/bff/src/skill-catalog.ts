import type { ScannedSkill } from './skills-scan.js';
import { config } from './config.js';

export const ALLOWED_SKILL_NAMES = [
  'auto-dev-finance-workflow',
  'process-daily-work',
  'tfs-weekly-report',
  'tfs-workitem-support-form-quick',
  'winning_trace_analysis',
] as const;

export type AllowedSkillName = (typeof ALLOWED_SKILL_NAMES)[number];

export type SkillTriggerMode = 'chat' | 'cursor';
export type SkillInputType = 'none' | 'single' | 'trace';

export interface SkillInputField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface SkillCatalogItem {
  name: string;
  label: string;
  description: string;
  needInput: boolean;
  inputType: SkillInputType;
  inputFields?: SkillInputField[];
  inputLabel?: string;
  inputPlaceholder?: string;
  /** 触发对话时发送的消息（Claude 原生 /slash 命令，{input} 会被替换） */
  defaultMessage: string;
  /** 执行引擎：技能默认走 Claude Code（原生技能体验更佳） */
  engine: 'claude' | 'hermes';
  /** 触发方式：chat=驾驶舱对话抽屉，cursor=打开 Cursor 并新建 Agent 会话 */
  triggerMode: SkillTriggerMode;
  /** cursor 模式打开的工程目录（缺省用 CURSOR_SKILLS_REPO） */
  cursorRepo?: string;
}

interface SkillMeta extends Omit<SkillCatalogItem, 'name' | 'description'> {
  /** 能力面板展示说明；优先于 SKILL.md 扫描结果 */
  description?: string;
  buildMessage?: (input: Record<string, string>) => string;
}

const CATALOG: Record<AllowedSkillName, SkillMeta> = {
  'auto-dev-finance-workflow': {
    label: '财务半自动开发',
    description: '需求半自动开发',
    needInput: true,
    inputType: 'single',
    inputLabel: '需求号',
    inputPlaceholder: '例如 1566926',
    defaultMessage: '/auto-dev-finance-workflow 需求开发 {input}',
    engine: 'claude',
    triggerMode: 'cursor',
    cursorRepo: config.cursor.skillsRepo,
  },
  'process-daily-work': {
    label: '需求分配',
    needInput: false,
    inputType: 'none',
    defaultMessage: '/process-daily-work 需求分配（收件箱批量分派）',
    engine: 'claude',
    triggerMode: 'chat',
  },
  'tfs-weekly-report': {
    label: '团队周报',
    needInput: true,
    inputType: 'single',
    inputLabel: '周报内容',
    inputPlaceholder: '例如：生成研发一部周报',
    defaultMessage: '/tfs-weekly-report {input}',
    engine: 'claude',
    triggerMode: 'chat',
  },
  'tfs-workitem-support-form-quick': {
    label: '支持单快关',
    needInput: true,
    inputType: 'single',
    inputLabel: '需求号',
    inputPlaceholder: '例如 1577458',
    defaultMessage: '/tfs-workitem-support-form-quick {input}',
    engine: 'claude',
    triggerMode: 'chat',
  },
  winning_trace_analysis: {
    label: '链路分析',
    needInput: true,
    inputType: 'trace',
    inputFields: [
      { key: 'traceId', label: 'TraceId', placeholder: '链路 ID', required: true },
      { key: 'platform', label: '运维平台', placeholder: 'https://host:port', required: true },
      { key: 'api', label: '接口', placeholder: '可选，如 /api/v1/log/trace/raw' },
      { key: 'problem', label: '问题', placeholder: '可选，如循环调用、超时' },
    ],
    defaultMessage: '/trace-analysis {input}',
    engine: 'claude',
    triggerMode: 'cursor',
    cursorRepo: config.cursor.skillsRepo,
    buildMessage(input) {
      const parts = [`链路分析 traceId=${input.traceId}`, `运维平台=${input.platform}`];
      if (input.api?.trim()) parts.push(`接口=${input.api.trim()}`);
      if (input.problem?.trim()) parts.push(`问题=${input.problem.trim()}`);
      return `/trace-analysis ${parts.join(' ')}`;
    },
  },
};

export function buildSkillCatalog(scanned: ScannedSkill[]): SkillCatalogItem[] {
  const byName = new Map(scanned.map((s) => [s.name, s]));
  return ALLOWED_SKILL_NAMES.map((name) => {
    const meta = CATALOG[name];
    const found = byName.get(name);
    return {
      name,
      label: meta.label,
      description: meta.description ?? found?.description ?? meta.label,
      needInput: meta.needInput,
      inputType: meta.inputType,
      inputFields: meta.inputFields,
      inputLabel: meta.inputLabel,
      inputPlaceholder: meta.inputPlaceholder,
      defaultMessage: meta.defaultMessage,
      engine: meta.engine,
      triggerMode: meta.triggerMode,
      cursorRepo: meta.cursorRepo,
    };
  });
}

export function getSkillMeta(name: string): (SkillMeta & { name: AllowedSkillName }) | null {
  if (!(ALLOWED_SKILL_NAMES as readonly string[]).includes(name)) return null;
  return { name: name as AllowedSkillName, ...CATALOG[name as AllowedSkillName] };
}

export function buildSkillMessage(name: string, input: Record<string, string>): string {
  const meta = getSkillMeta(name);
  if (!meta) throw new Error(`未知技能: ${name}`);

  if (meta.inputType === 'none') {
    return meta.defaultMessage.trim();
  }

  if (meta.buildMessage) {
    return meta.buildMessage(input).trim();
  }

  const single = (input.input ?? input.value ?? Object.values(input)[0] ?? '').trim();
  if (!single) throw new Error(`请填写${meta.inputLabel ?? '参数'}`);
  return meta.defaultMessage.replace('{input}', single).trim();
}

export function validateSkillInput(name: string, input: Record<string, string>): string | null {
  const meta = getSkillMeta(name);
  if (!meta) return `未知技能: ${name}`;

  if (meta.inputType === 'none') return null;

  if (meta.inputType === 'trace' && meta.inputFields) {
    for (const field of meta.inputFields) {
      if (field.required && !input[field.key]?.trim()) {
        return `请填写${field.label}`;
      }
    }
    return null;
  }

  const single = (input.input ?? input.value ?? Object.values(input)[0] ?? '').trim();
  if (!single) return `请填写${meta.inputLabel ?? '参数'}`;
  return null;
}
