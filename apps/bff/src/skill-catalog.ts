import type { ScannedSkill } from './skills-scan.js';

export const ALLOWED_SKILL_NAMES = [
  'auto-dev-finance-workflow',
  'process-daily-work',
  'tfs-weekly-report',
  'tfs-workitem-support-form-quick',
  'winning_trace_analysis',
] as const;

export type AllowedSkillName = (typeof ALLOWED_SKILL_NAMES)[number];

export interface SkillCatalogItem {
  name: string;
  label: string;
  description: string;
  needInput: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  /** 触发对话时发送的消息（Claude 原生 /slash 命令，{input} 会被替换） */
  defaultMessage: string;
  /** 执行引擎：技能默认走 Claude Code（原生技能体验更佳） */
  engine: 'claude' | 'hermes';
}

const CATALOG: Record<AllowedSkillName, Omit<SkillCatalogItem, 'name' | 'description'>> = {
  'auto-dev-finance-workflow': {
    label: '财务半自动开发',
    needInput: true,
    inputLabel: '需求号',
    inputPlaceholder: '例如 1566926',
    defaultMessage: '/auto-dev-finance-workflow 需求开发 {input}',
    engine: 'claude',
  },
  'process-daily-work': {
    label: '需求分配',
    needInput: false,
    defaultMessage: '/process-daily-work 需求分配（收件箱批量分派）',
    engine: 'claude',
  },
  'tfs-weekly-report': {
    label: '团队周报',
    needInput: false,
    defaultMessage: '/tfs-weekly-report 生成本周团队周报',
    engine: 'claude',
  },
  'tfs-workitem-support-form-quick': {
    label: '支持单快关',
    needInput: false,
    defaultMessage: '/tfs-workitem-support-form-quick 处理并快速关闭支持单',
    engine: 'claude',
  },
  winning_trace_analysis: {
    label: '链路分析',
    needInput: true,
    inputLabel: 'TraceId 或分析描述',
    inputPlaceholder: 'traceId 或「分析 xxx 链路」',
    // 技能目录名为 winning_trace_analysis，但 Claude 注册的 slash 命令为 trace-analysis
    defaultMessage: '/trace-analysis {input}',
    engine: 'claude',
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
      description: found?.description || meta.label,
      needInput: meta.needInput,
      inputLabel: meta.inputLabel,
      inputPlaceholder: meta.inputPlaceholder,
      defaultMessage: meta.defaultMessage,
      engine: meta.engine,
    };
  });
}
