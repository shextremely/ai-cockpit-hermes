import { Router } from 'express';
import { hermesJson, HermesError } from '../hermes.js';

export const healthRouter = Router();

async function probeHermes(): Promise<{ data: unknown | null; authOk: boolean; error?: string }> {
  try {
    const health = await hermesJson('/health');
    try {
      await hermesJson('/v1/models');
      return { data: health, authOk: true };
    } catch (e) {
      const msg = e instanceof HermesError ? e.message : String(e);
      return { data: health, authOk: false, error: msg };
    }
  } catch (e) {
    return { data: null, authOk: false, error: String(e) };
  }
}

// 简单健康:连通 Hermes /health,并校验 API Key(/v1/models)
healthRouter.get('/health', async (_req, res) => {
  const probe = await probeHermes();
  res.json({
    bff: 'ok',
    hermes: probe.data,
    authOk: probe.authOk,
    error: probe.error,
  });
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
