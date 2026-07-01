import { Router } from 'express';
import { hermesJson } from '../hermes.js';
import { config } from '../config.js';
import { scanClaudeSkills } from '../skills-scan.js';
import { buildSkillCatalog, buildSkillMessage, getSkillMeta, validateSkillInput } from '../skill-catalog.js';
import { triggerCursorSkill } from '../chat/cursor.js';

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

interface TriggerSkillBody {
  name: string;
  input?: Record<string, string>;
}

capabilitiesRouter.post('/skills/trigger', (req, res) => {
  const body = req.body as TriggerSkillBody;
  if (!body?.name || typeof body.name !== 'string') {
    res.status(400).json({ error: 'bad_request', message: 'name 必填' });
    return;
  }

  const meta = getSkillMeta(body.name);
  if (!meta) {
    res.status(404).json({ error: 'not_found', message: `未知技能: ${body.name}` });
    return;
  }

  const input = body.input ?? {};
  const validationError = validateSkillInput(body.name, input);
  if (validationError) {
    res.status(400).json({ error: 'bad_request', message: validationError });
    return;
  }

  let message: string;
  try {
    message = buildSkillMessage(body.name, input);
  } catch (e) {
    res.status(400).json({ error: 'bad_request', message: e instanceof Error ? e.message : String(e) });
    return;
  }

  if (meta.triggerMode === 'cursor') {
    const repo = meta.cursorRepo ?? config.cursor.skillsRepo;
    const result = triggerCursorSkill(repo, message);
    if (!result.ok) {
      res.status(500).json({ error: 'cursor_failed', message: result.message ?? 'Cursor 打开失败' });
      return;
    }
    res.json({
      mode: 'cursor',
      ok: true,
      repo: result.repo,
      message,
      hint: '已在 Cursor 中打开工程并新建 Agent 会话，请确认后执行',
    });
    return;
  }

  res.json({
    mode: 'chat',
    ok: true,
    message,
    engine: meta.engine,
  });
});

capabilitiesRouter.get('/toolsets', async (_req, res, next) => {
  try {
    res.json(await hermesJson('/v1/toolsets'));
  } catch (e) {
    next(e);
  }
});
