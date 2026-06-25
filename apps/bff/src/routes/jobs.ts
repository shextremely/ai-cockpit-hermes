import { Router } from 'express';
import { hermesJson } from '../hermes.js';

export const jobsRouter = Router();

// 定时任务 CRUD + 控制,透传到 Hermes /api/jobs
jobsRouter.get('/jobs', async (_req, res, next) => {
  try {
    res.json(await hermesJson('/api/jobs'));
  } catch (e) {
    next(e);
  }
});

jobsRouter.post('/jobs', async (req, res, next) => {
  try {
    res.json(await hermesJson('/api/jobs', { method: 'POST', body: req.body }));
  } catch (e) {
    next(e);
  }
});

jobsRouter.get('/jobs/:id', async (req, res, next) => {
  try {
    res.json(await hermesJson(`/api/jobs/${encodeURIComponent(req.params.id)}`));
  } catch (e) {
    next(e);
  }
});

jobsRouter.patch('/jobs/:id', async (req, res, next) => {
  try {
    res.json(await hermesJson(`/api/jobs/${encodeURIComponent(req.params.id)}`, { method: 'PATCH', body: req.body }));
  } catch (e) {
    next(e);
  }
});

jobsRouter.delete('/jobs/:id', async (req, res, next) => {
  try {
    res.json(await hermesJson(`/api/jobs/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' }));
  } catch (e) {
    next(e);
  }
});

for (const action of ['pause', 'resume', 'run'] as const) {
  jobsRouter.post(`/jobs/:id/${action}`, async (req, res, next) => {
    try {
      res.json(await hermesJson(`/api/jobs/${encodeURIComponent(req.params.id)}/${action}`, { method: 'POST' }));
    } catch (e) {
      next(e);
    }
  });
}
