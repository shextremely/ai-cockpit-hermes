import type { TaskPriority } from './types.js';
import { DEFAULT_SETTINGS } from './types.js';

export interface ParsedTaskInput {
  title: string;
  dueAt?: string;
  priority: TaskPriority;
  category?: string;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return endOfDay(d);
}

function nextWeekday(targetDow: number, from = new Date()): Date {
  const d = new Date(from);
  const diff = (targetDow - d.getDay() + 7) % 7 || 7;
  return endOfDay(addDays(d, diff === 7 && d.getDay() === targetDow ? 0 : diff));
}

/** 从自然语言文本中提取事项关键信息 */
export function parseTaskText(text: string, rules = DEFAULT_SETTINGS.priorityRules): ParsedTaskInput {
  let remaining = text.trim();
  let dueAt: string | undefined;
  let priority: TaskPriority = 'medium';
  let category: string | undefined;

  const now = new Date();

  const datePatterns: Array<{ re: RegExp; resolve: () => Date }> = [
    { re: /今天|今日/, resolve: () => endOfDay(now) },
    { re: /明天|明日/, resolve: () => endOfDay(addDays(now, 1)) },
    { re: /后天/, resolve: () => endOfDay(addDays(now, 2)) },
    { re: /下(?:个)?周([一二三四五六日天])/, resolve: () => {
      const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
      const m = remaining.match(/下(?:个)?周([一二三四五六日天])/);
      return nextWeekday(map[m?.[1] ?? '一'] ?? 1);
    }},
    { re: /本周([一二三四五六日天])|周([一二三四五六日天])/, resolve: () => {
      const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
      const m = remaining.match(/(?:本周|周)([一二三四五六日天])/);
      const dow = map[m?.[1] ?? '五'] ?? 5;
      const d = new Date(now);
      const diff = (dow - d.getDay() + 7) % 7;
      return endOfDay(addDays(d, diff || (d.getDay() === dow ? 0 : diff)));
    }},
    { re: /(\d{1,2})月(\d{1,2})[日号]?/, resolve: () => {
      const m = remaining.match(/(\d{1,2})月(\d{1,2})/);
      const month = Number(m?.[1] ?? 1) - 1;
      const day = Number(m?.[2] ?? 1);
      const d = new Date(now.getFullYear(), month, day);
      if (d.getTime() < now.getTime()) d.setFullYear(d.getFullYear() + 1);
      return endOfDay(d);
    }},
    { re: /(\d{4})-(\d{1,2})-(\d{1,2})/, resolve: () => {
      const m = remaining.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      return endOfDay(new Date(Number(m?.[1]), Number(m?.[2]) - 1, Number(m?.[3])));
    }},
  ];

  for (const { re, resolve } of datePatterns) {
    if (re.test(remaining)) {
      dueAt = resolve().toISOString();
      remaining = remaining.replace(re, '').trim();
      break;
    }
  }

  const priorityPatterns: Array<{ re: RegExp; p: TaskPriority }> = [
    { re: /紧急|urgent|P0|最高优先级/, p: 'urgent' },
    { re: /高优先级|重要|P1/, p: 'high' },
    { re: /低优先级|不急|P3/, p: 'low' },
  ];
  for (const { re, p } of priorityPatterns) {
    if (re.test(remaining)) {
      priority = p;
      remaining = remaining.replace(re, '').trim();
      break;
    }
  }

  const catMatch = remaining.match(/\[([^\]]+)\]/);
  if (catMatch) {
    category = catMatch[1];
    remaining = remaining.replace(catMatch[0], '').trim();
  }

  remaining = remaining.replace(/^(请|帮我|记得|提醒|待办[:：]?|todo[:：]?)\s*/i, '').trim();
  remaining = remaining.replace(/[，,。.!！?？]+$/g, '').trim();

  if (dueAt && !priorityPatterns.some(({ re }) => re.test(text))) {
    const daysLeft = (new Date(dueAt).getTime() - now.getTime()) / 86400000;
    if (daysLeft <= rules.urgentDays) priority = 'urgent';
    else if (daysLeft <= rules.highDays) priority = 'high';
    else if (daysLeft <= rules.mediumDays) priority = 'medium';
    else priority = 'low';
  }

  return {
    title: remaining || text.trim(),
    dueAt,
    priority,
    category,
  };
}
