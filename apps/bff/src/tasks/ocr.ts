import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { refineExtractedItems } from './ocr-postprocess.js';

export interface ImageExtractResult {
  scene?: string;
  rawText: string;
  items: string[];
}

const OCR_PROMPT = (imagePath: string) =>
  `请用 Read 工具读取图片文件: ${imagePath}

识别截图中的待办/工作事项，严格只输出 JSON（不要 markdown 代码块）：
{"scene":"chat|tfs|todo_list|other","rawText":"原文","items":["待办1","待办2"]}

分场景规则：
1. scene=chat（微信/钉钉等聊天截图）
   - rawText：每条聊天气泡单独一行，格式「昵称：内容」，保留换行
   - items：仅提取需要跟进的行动项（会议、培训、提交、准备材料、截止日期等）
   - 忽略：群名、纯确认语（好的/收到/嗯/表情）、无行动价值的寒暄
   - 每条 item 是一句完整待办，可合并上下文（如「明天9点 会议室3 开会」）

2. scene=tfs（TFS/Azure DevOps/需求管理系统截图）
   - items：仅「#工作项ID 标题」，如 "#1670467 门诊医技确认查询性能优化"
   - 不要放入状态、区域、说明正文、字段标签
   - 若聊天里提到截止日期（如「30号」），追加到 item 末尾

3. scene=todo_list：items 与列表每行一一对应

4. 禁止把整段 OCR 原文作为单个 item；items 通常 1~5 条；若无明确待办则 items 为空数组`;

/** 通过 Claude Read 工具 OCR 截图并提取待办条目 */
export function extractTasksFromImage(imagePath: string): Promise<ImageExtractResult> {
  const args = [
    '-p',
    '--output-format',
    'text',
    '--permission-mode',
    config.claude.permissionMode,
    '--max-turns',
    '8',
    '--allowedTools',
    'Read',
  ];
  if (config.claude.model) args.push('--model', config.claude.model);

  const prompt = OCR_PROMPT(imagePath.replace(/\\/g, '/'));

  return new Promise((resolve, reject) => {
    const child = spawn(config.claude.bin, args, {
      cwd: config.claude.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString('utf-8');
    });
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString('utf-8');
    });
    child.stdin?.write(prompt);
    child.stdin?.end();

    child.on('error', (err) => reject(new Error(`无法启动 Claude OCR: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Claude OCR 退出码 ${code}`));
        return;
      }
      try {
        resolve(refineExtractedItems(parseOcrOutput(stdout)));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}

function parseOcrOutput(stdout: string): ImageExtractResult {
  const trimmed = stdout.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as {
        scene?: string;
        rawText?: string;
        items?: unknown;
      };
      const rawText = String(obj.rawText ?? '').trim();
      const items = Array.isArray(obj.items)
        ? obj.items.map((s) => String(s).trim()).filter(Boolean)
        : [];
      if (rawText || items.length) {
        return { scene: obj.scene, rawText, items };
      }
    } catch {
      /* fall through */
    }
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^[{[\]"]/.test(l));
  if (lines.length) {
    return { rawText: trimmed, items: lines.length > 1 ? lines : [lines[0]!] };
  }
  throw new Error('未能从截图中识别文字，请换一张更清晰的图片重试');
}
