import type { ImageExtractResult } from './ocr.js';

/** 无行动意义的确认/寒暄，不应生成待办 */
const NOISE_LINE =
  /^(好的|收到|嗯+|哦+|ok|okay|知道了|明白|没问题|可以|行|谢谢|感谢|哈哈|👌|👍)[，。！!?？~\s]*$/i;

/** 聊天：张三：内容 */
const CHAT_SPEAKER = /^[\u4e00-\u9fa5a-zA-Z0-9_.-]{1,16}[：:]\s*(.+)$/;

/** TFS / 需求系统工作项 */
const TFS_HEAD = /^#?(\d{6,8})\s*[【\[]?(\d+)[】\]]?\s*(.+)$/;
const TFS_SIMPLE = /^#?(\d{6,8})\s+(.{4,})$/;

/** 含行动语义的关键词 */
const ACTION_HINT =
  /会议|培训|提交|完成|准备|截止|安排|修复|优化|开发|需求|bug|记得|别忘了|前提交|前完成|号|明天|后天|周[一二三四五六日天]|日内|之前/;

function formatRawText(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').trim();
  if (!text.includes('\n') && text.length > 30) {
    text = text
      .replace(/\s+(?=[\u4e00-\u9fa5a-zA-Z0-9_.-]{1,16}[：:])/g, '\n')
      .replace(/\s+(?=#?\d{6,8}\s)/g, '\n');
  }
  return text;
}

function cleanItem(line: string): string {
  let s = line.trim();
  s = s.replace(/^(待办[:：]?|todo[:：]?)\s*/i, '');
  const chat = s.match(CHAT_SPEAKER);
  if (chat) s = chat[1]!.trim();
  const tfs = s.match(TFS_HEAD) ?? s.match(TFS_SIMPLE);
  if (tfs) {
    const id = tfs[1];
    const title = (tfs[3] ?? tfs[2] ?? '').trim();
    return title ? `#${id} ${title}` : `#${id}`;
  }
  return s.replace(/\s{2,}/g, ' ');
}

function isActionable(text: string): boolean {
  if (text.length < 4) return false;
  if (NOISE_LINE.test(text)) return false;
  if (/^[\u4e00-\u9fa5a-zA-Z0-9_-]+(?:群|Group)$/i.test(text)) return false;
  if (/^\d{1,2}[:：]\d{2}$/.test(text)) return false;
  return ACTION_HINT.test(text) || /^#\d{6,}/.test(text) || text.length >= 8;
}

/** 从挤成一行的原文中拆出候选条目 */
export function splitRawTextToItems(rawText: string): string[] {
  const formatted = formatRawText(rawText);
  const segments = formatted
    .split(/\n+/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      if (trimmed.includes('：') || trimmed.includes(':')) {
        const parts = trimmed.split(/\s+(?=[\u4e00-\u9fa5a-zA-Z0-9_.-]{1,16}[：:])/).filter(Boolean);
        if (parts.length > 1) return parts;
      }
      return [trimmed];
    })
    .map(cleanItem)
    .filter(Boolean);

  const actionable = segments.filter(isActionable);
  if (actionable.length) return actionable;

  return segments.filter((s) => s.length >= 6 && !NOISE_LINE.test(s));
}

function isBlobItem(items: string[]): boolean {
  if (items.length !== 1) return false;
  const one = items[0]!;
  return one.length > 60 || (one.match(/[：:]/g)?.length ?? 0) > 2;
}

/** 校正 OCR 结果：拆分、去噪、去重 */
export function refineExtractedItems(result: ImageExtractResult): ImageExtractResult {
  const rawText = formatRawText(result.rawText);
  let items = result.items.map(cleanItem).filter(Boolean);

  if (!items.length || isBlobItem(items)) {
    items = splitRawTextToItems(rawText);
  }

  items = items.filter((item) => isActionable(item) && !NOISE_LINE.test(item));
  items = [...new Set(items)];

  if (!items.length) {
    const fallback = splitRawTextToItems(rawText);
    items = fallback.filter(isActionable);
  }

  return { rawText, items };
}

export interface ScoredSuggestion {
  text: string;
  /** 0–100，越高越可能是有效待办 */
  confidence: number;
  reasons: string[];
}

function scoreTfsTitle(title: string): number {
  let score = 0;
  if (title.length >= 4 && title.length <= 48) score += 20;
  if (title.length > 60) score -= 15;
  if (/^(需求|查询|批量|添加|导致|无需)/.test(title) && title.length > 20) score -= 10;
  if (/优化|修复|不正确|异常|bug/i.test(title)) score += 8;
  return score;
}

/** 按置信度排序，供前端展示可选项（不自动建待办） */
export function scoreExtractedItems(
  items: string[],
  rawText: string,
  scene?: string,
): ScoredSuggestion[] {
  const scored = items.map((text) => {
    let confidence = 45;
    const reasons: string[] = [];

    if (/^#\d{6,8}\s+.{3,}/.test(text)) {
      confidence += 30;
      reasons.push('TFS 工作项格式');
      confidence += scoreTfsTitle(text.replace(/^#\d{6,8}\s+/, ''));
    }
    if (ACTION_HINT.test(text)) {
      confidence += 12;
      reasons.push('含行动/任务语义');
    }
    if (text.length >= 6 && text.length <= 80) {
      confidence += 8;
    }
    if (text.length > 100) {
      confidence -= 20;
      reasons.push('文本过长');
    }
    if (NOISE_LINE.test(text)) {
      confidence -= 40;
    }
    if (scene === 'tfs' && /^#\d{6,8}/.test(text)) {
      confidence += 10;
      reasons.push('TFS 场景');
    }
    if (rawText.includes(text)) {
      confidence += 5;
    }

    return {
      text,
      confidence: Math.min(100, Math.max(0, Math.round(confidence))),
      reasons,
    };
  });

  // 同一工作项 ID 的多条候选：标题型条目加分，疑似描述正文降分
  const bestByWorkItemId = new Map<string, ScoredSuggestion>();
  for (const item of scored) {
    const m = item.text.match(/^#(\d{6,8})\s+(.+)$/);
    if (!m) continue;
    const id = m[1]!;
    const prev = bestByWorkItemId.get(id);
    if (!prev || item.confidence > prev.confidence) {
      bestByWorkItemId.set(id, item);
    }
  }
  for (const item of scored) {
    const m = item.text.match(/^#(\d{6,8})\s+(.+)$/);
    if (!m) continue;
    const best = bestByWorkItemId.get(m[1]!);
    if (best && best.text !== item.text) {
      item.confidence = Math.max(0, item.confidence - 22);
      item.reasons.push('同 ID 下更可能是描述正文');
    }
  }

  return scored.sort((a, b) => b.confidence - a.confidence || a.text.localeCompare(b.text, 'zh-CN'));
}
