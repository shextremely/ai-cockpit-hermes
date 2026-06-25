import { Router } from 'express';
import { hermesJson } from '../hermes.js';

export const capabilitiesRouter = Router();

// 能力探测:供前端做功能降级
capabilitiesRouter.get('/capabilities', async (_req, res, next) => {
  try {
    res.json(await hermesJson('/v1/capabilities'));
  } catch (e) {
    next(e);
  }
});

capabilitiesRouter.get('/skills', async (_req, res, next) => {
  try {
    res.json(await hermesJson('/v1/skills'));
  } catch (e) {
    next(e);
  }
});

capabilitiesRouter.get('/toolsets', async (_req, res, next) => {
  try {
    res.json(await hermesJson('/v1/toolsets'));
  } catch (e) {
    next(e);
  }
});
