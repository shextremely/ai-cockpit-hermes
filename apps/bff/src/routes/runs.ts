import { Router } from 'express';
import { hermesJson, hermesStream } from '../hermes.js';
import { initSse, pipeUpstreamSse, sendSse } from '../sse.js';
import { routeChat, type ChatEngine } from '../chat/router.js';
import { startClaudeRun, subscribeClaudeRun, stopClaudeRun } from '../chat/claude-runner.js';
import { openCursor } from '../chat/cursor.js';

export const runsRouter = Router();

interface CreateRunBody {
  input: string;
  sessionId?: string;
  instructions?: string;
  previous_response_id?: string;
  /** 显式指定引擎: claude | hermes */
  backend?: string;
}

interface RunMeta {
  engine: ChatEngine;
  /** events 首帧展示给用户的提示（引擎/Cursor 状态） */
  note?: string;
}

const runMeta = new Map<string, RunMeta>();

/**
 * 创建一次对话运行（对话抽屉主链路，双引擎）。
 * 返回 run_id，前端随后订阅 /api/runs/:id/events 获取 SSE。
 */
runsRouter.post('/chat', async (req, res, next) => {
  try {
    const body = req.body as CreateRunBody;
    if (!body?.input || typeof body.input !== 'string') {
      res.status(400).json({ error: 'bad_request', message: 'input 必填' });
      return;
    }

    const decision = routeChat(body.input, body.backend);
    let cursorNote = '';
    if (decision.openCursor) {
      const opened = openCursor(decision.cursorRepo);
      cursorNote = opened.ok ? ` · 已在 Cursor 打开 ${opened.repo}` : ` · Cursor 打开失败(${opened.message})`;
    }

    // Claude Code 引擎
    if (decision.engine === 'claude') {
      const systemPrompt = body.instructions ?? decision.systemPrompt;
      const runId = startClaudeRun(body.input, { systemPrompt });
      runMeta.set(runId, { engine: 'claude' });
      res.json({ run_id: runId, engine: 'claude' });
      return;
    }

    // Hermes 引擎（含 code-fix 编排）
    try {
      const instructions = body.instructions ?? decision.systemPrompt;
      const data = (await hermesJson('/v1/runs', {
        method: 'POST',
        body: {
          input: body.input,
          ...(instructions ? { instructions } : {}),
          ...(body.previous_response_id ? { previous_response_id: body.previous_response_id } : {}),
          ...(body.sessionId ? { session_id: body.sessionId } : {}),
        },
        headers: { sessionId: body.sessionId },
      })) as { run_id?: string; id?: string };
      const runId = data.run_id ?? data.id;
      if (!runId) throw new Error('Hermes 未返回 run_id');
      runMeta.set(runId, { engine: 'hermes', note: `Hermes${cursorNote}` });
      res.json({ run_id: runId, engine: 'hermes' });
    } catch (hermesErr) {
      // Hermes 不可用时回退 Claude，保证对话可用
      const fallbackPrompt = decision.systemPrompt
        ? `${decision.systemPrompt}\n(注意：Hermes 不可用，已回退至 Claude)`
        : undefined;
      const runId = startClaudeRun(body.input, { systemPrompt: body.instructions ?? fallbackPrompt });
      runMeta.set(runId, { engine: 'claude', note: `Claude(回退)${cursorNote}` });
      res.json({ run_id: runId, engine: 'claude', fallback: String(hermesErr) });
    }
  } catch (e) {
    next(e);
  }
});

/** 订阅运行事件（按引擎分发 SSE） */
runsRouter.get('/runs/:id/events', async (req, res) => {
  const id = req.params.id;
  const meta = runMeta.get(id);
  initSse(res);
  if (meta?.note) sendSse(res, 'tool.started', { tool: '引擎', detail: meta.note });

  if (meta?.engine === 'claude') {
    subscribeClaudeRun(id, res);
    return;
  }

  // Hermes：SSE 透传
  try {
    const upstream = await hermesStream(`/v1/runs/${encodeURIComponent(id)}/events`);
    await pipeUpstreamSse(upstream, res);
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: String(e) })}\n\n`);
    res.end();
  }
});

/** 轮询运行状态（仅 Hermes） */
runsRouter.get('/runs/:id', async (req, res, next) => {
  try {
    res.json(await hermesJson(`/v1/runs/${encodeURIComponent(req.params.id)}`));
  } catch (e) {
    next(e);
  }
});

/** 中断运行 */
runsRouter.post('/runs/:id/stop', async (req, res, next) => {
  const id = req.params.id;
  const meta = runMeta.get(id);
  if (meta?.engine === 'claude') {
    res.json({ ok: stopClaudeRun(id) });
    return;
  }
  try {
    res.json(await hermesJson(`/v1/runs/${encodeURIComponent(id)}/stop`, { method: 'POST' }));
  } catch (e) {
    next(e);
  }
});

/** 解决审批门禁（仅 Hermes） */
runsRouter.post('/runs/:id/approval', async (req, res, next) => {
  try {
    res.json(
      await hermesJson(`/v1/runs/${encodeURIComponent(req.params.id)}/approval`, {
        method: 'POST',
        body: req.body,
      }),
    );
  } catch (e) {
    next(e);
  }
});
