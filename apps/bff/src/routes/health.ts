import { Router } from 'express';
import { hermesJson, HermesError } from '../hermes.js';

export const healthRouter = Router();

// 简单健康:连通 Hermes /health
healthRouter.get('/health', async (_req, res) => {
  try {
    const data = await hermesJson('/health');
    res.json({ bff: 'ok', hermes: data });
  } catch (e) {
    const status = e instanceof HermesError ? e.status : 502;
    res.status(status === 0 ? 502 : 200).json({ bff: 'ok', hermes: null, error: String(e) });
  }
});

// 详细健康:活跃会话/运行/资源
healthRouter.get('/health/detailed', async (_req, res) => {
  try {
    const data = await hermesJson('/health/detailed');
    res.json({ bff: 'ok', hermes: data });
  } catch (e) {
    res.status(200).json({ bff: 'ok', hermes: null, error: String(e) });
  }
});
