import { Router } from 'express';
import { hermesJson } from '../hermes.js';
import { config } from '../config.js';
import { scanClaudeSkills } from '../skills-scan.js';
import { buildSkillCatalog } from '../skill-catalog.js';

export const capabilitiesRouter = Router();

// 能力探测:供全局健康/降级(能力面板不再展示)
capabilitiesRouter.get('/capabilities', async (_req, res, next) => {
  try {
    res.json(await hermesJson('/v1/capabilities'));
  } catch (e) {
    next(e);
  }
});

capabilitiesRouter.get('/skills', async (_req, res) => {
  try {
    const scanned = scanClaudeSkills(config.claude.skillsPath);
    const data = buildSkillCatalog(scanned);
    res.json({ object: 'list', source: 'claude', path: config.claude.skillsPath, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: 'skills_scan_failed', message, data: [] });
  }
});

capabilitiesRouter.get('/toolsets', async (_req, res, next) => {
  try {
    res.json(await hermesJson('/v1/toolsets'));
  } catch (e) {
    next(e);
  }
});
