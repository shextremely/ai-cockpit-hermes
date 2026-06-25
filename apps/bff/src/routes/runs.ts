import { Router } from 'express';
import { hermesJson, hermesStream } from '../hermes.js';
import { initSse, pipeUpstreamSse } from '../sse.js';

export const runsRouter = Router();

interface CreateRunBody {
  input: string;
  sessionId?: string;
  instructions?: string;
  previous_response_id?: string;
}

/**
 * 创建一次对话运行(对话抽屉主链路)。
 * 返回 run_id,前端随后订阅 /api/runs/:id/events 获取 SSE。
 */
runsRouter.post('/chat', async (req, res, next) => {
  try {
    const body = req.body as CreateRunBody;
    if (!body?.input || typeof body.input !== 'string') {
      res.status(400).json({ error: 'bad_request', message: 'input 必填' });
      return;
    }
    const data = await hermesJson('/v1/runs', {
      method: 'POST',
      body: {
        input: body.input,
        ...(body.instructions ? { instructions: body.instructions } : {}),
        ...(body.previous_response_id ? { previous_response_id: body.previous_response_id } : {}),
        ...(body.sessionId ? { session_id: body.sessionId } : {}),
      },
      headers: { sessionId: body.sessionId },
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/** 订阅运行事件(SSE 透传) */
runsRouter.get('/runs/:id/events', async (req, res) => {
  initSse(res);
  try {
    const upstream = await hermesStream(`/v1/runs/${encodeURIComponent(req.params.id)}/events`);
    await pipeUpstreamSse(upstream, res);
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: String(e) })}\n\n`);
    res.end();
  }
});

/** 轮询运行状态 */
runsRouter.get('/runs/:id', async (req, res, next) => {
  try {
    res.json(await hermesJson(`/v1/runs/${encodeURIComponent(req.params.id)}`));
  } catch (e) {
    next(e);
  }
});

/** 中断运行 */
runsRouter.post('/runs/:id/stop', async (req, res, next) => {
  try {
    res.json(await hermesJson(`/v1/runs/${encodeURIComponent(req.params.id)}/stop`, { method: 'POST' }));
  } catch (e) {
    next(e);
  }
});

/** 解决审批门禁 */
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
