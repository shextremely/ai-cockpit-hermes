import { Router } from 'express';
import { hermesJson } from '../hermes.js';
import { config } from '../config.js';

export const dashboardRouter = Router();

const DASHBOARD_INSTRUCTION = `你是「个人AI驾驶舱」的数据聚合器。请调用可用的 TFS 工具,获取当前用户的研发待处理项,并\
严格只返回如下结构的 JSON(不要任何额外说明、不要 markdown 代码块):
{
  "tfs": { "todo": <数字>, "bug": <数字>, "overdue": <数字>,
           "items": [ { "id": "<工作项号>", "title": "<标题>", "status": "<状态>", "due": "<截止或空字符串>" } ] }
}
items 最多 8 条,优先超期与进行中。如无法获取真实数据,返回各计数为 0、items 为空数组的合法 JSON。`;

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

/** 从模型文本中尽力提取 JSON 对象 */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('未能从响应中解析出 JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/** 首页聚合卡片数据 */
dashboardRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const completion = await hermesJson<ChatCompletion>('/v1/chat/completions', {
      method: 'POST',
      body: {
        model: config.hermes.model,
        messages: [
          { role: 'system', content: DASHBOARD_INSTRUCTION },
          { role: 'user', content: '生成今天的驾驶舱首页数据' },
        ],
        stream: false,
      },
    });
    const content = completion.choices?.[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = extractJson(content);
    } catch {
      // 解析失败回退为安全空结构,并把原始文本作为简报附带
      parsed = { tfs: { todo: 0, bug: 0, overdue: 0, items: [] }, raw: content };
    }
    res.json(parsed);
  } catch (e) {
    next(e);
  }
});
