import { Router } from 'express';
import { hermesJson } from '../hermes.js';
import { config } from '../config.js';

export const knowledgeRouter = Router();

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no json');
  return JSON.parse(candidate.slice(start, end + 1));
}

/** 知识库语义检索:让 Hermes 调 Obsidian MCP 搜索 Vault */
knowledgeRouter.post('/knowledge/search', async (req, res, next) => {
  try {
    const query = String((req.body as { query?: string })?.query ?? '').trim();
    if (!query) {
      res.status(400).json({ error: 'bad_request', message: 'query 必填' });
      return;
    }
    const instruction = `你是知识库检索助手。请使用 Obsidian 工具在 Vault 中搜索与用户查询相关的笔记,\
严格只返回 JSON(无 markdown):{ "results": [ { "title": "<标题>", "path": "<相对路径>", "excerpt": "<摘要>" } ] },最多 10 条。\
若无法检索返回 { "results": [] }。`;
    const completion = await hermesJson<ChatCompletion>('/v1/chat/completions', {
      method: 'POST',
      body: {
        model: config.hermes.model,
        messages: [
          { role: 'system', content: instruction },
          { role: 'user', content: query },
        ],
        stream: false,
      },
    });
    const content = completion.choices?.[0]?.message?.content ?? '';
    try {
      res.json(extractJson(content));
    } catch {
      res.json({ results: [], raw: content });
    }
  } catch (e) {
    next(e);
  }
});
