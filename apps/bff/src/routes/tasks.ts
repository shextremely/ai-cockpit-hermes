import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { parseTaskText } from '../tasks/parse.js';
import { extractTasksFromImage } from '../tasks/ocr.js';
import { scoreExtractedItems, splitRawTextToItems } from '../tasks/ocr-postprocess.js';
import { parseImagePayload, removeTempFile, saveTempImage } from '../tasks/image-io.js';
import {
  computeStats,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateSettings,
  updateTask,
} from '../tasks/store.js';
import type { TaskFilters, TaskPriority, TaskStatus } from '../tasks/types.js';

export const tasksRouter = Router();

function parseListQuery(q: Record<string, unknown>): TaskFilters {
  const filters: TaskFilters = {};
  if (typeof q.q === 'string' && q.q) filters.q = q.q;
  if (typeof q.status === 'string' && q.status) {
    filters.status = q.status.split(',') as TaskStatus[];
  }
  if (typeof q.priority === 'string' && q.priority) {
    filters.priority = q.priority.split(',') as TaskPriority[];
  }
  if (typeof q.dueFrom === 'string') filters.dueFrom = q.dueFrom;
  if (typeof q.dueTo === 'string') filters.dueTo = q.dueTo;
  return filters;
}

tasksRouter.get('/tasks', (req, res) => {
  const result = listTasks(parseListQuery(req.query as Record<string, unknown>));
  res.json(result);
});

tasksRouter.get('/tasks/stats', (req, res) => {
  const days = Number(req.query.days ?? 7);
  res.json(computeStats(Number.isFinite(days) ? days : 7));
});

tasksRouter.get('/tasks/settings', (_req, res) => {
  res.json(listTasks().settings);
});

tasksRouter.patch('/tasks/settings', (req, res) => {
  res.json(updateSettings(req.body ?? {}));
});

tasksRouter.post('/tasks/parse', (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'bad_request', message: 'text 不能为空' });
    return;
  }
  res.json(parseTaskText(text));
});

tasksRouter.get('/tasks/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'not_found', message: '事项不存在' });
    return;
  }
  res.json(task);
});

tasksRouter.post('/tasks', (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) {
    res.status(400).json({ error: 'bad_request', message: 'title 不能为空' });
    return;
  }
  const subtasks = Array.isArray(req.body?.subtasks)
    ? req.body.subtasks.map((s: { title?: string; done?: boolean }) => ({
        id: randomUUID(),
        title: String(s.title ?? '').trim(),
        done: Boolean(s.done),
      }))
    : undefined;
  res.status(201).json(
    createTask({
      title,
      description: req.body?.description,
      priority: req.body?.priority,
      status: req.body?.status,
      dueAt: req.body?.dueAt,
      category: req.body?.category,
      subtasks,
      remindBefore: req.body?.remindBefore,
      remindEnabled: req.body?.remindEnabled,
      source: req.body?.source ?? 'manual',
    }),
  );
});

tasksRouter.post('/tasks/from-text', (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'bad_request', message: 'text 不能为空' });
    return;
  }
  const parsed = parseTaskText(text);
  res.status(201).json(
    createTask({
      ...parsed,
      description: req.body?.description,
      source: 'text',
    }),
  );
});

tasksRouter.post('/tasks/from-image', async (req, res, next) => {
  let tempPath: string | undefined;
  try {
    const raw = String(req.body?.image ?? '').trim();
    if (!raw) {
      res.status(400).json({ error: 'bad_request', message: 'image 不能为空' });
      return;
    }
    const { base64, mimeType } = parseImagePayload(raw);
    if (!base64 || base64.length < 32) {
      res.status(400).json({ error: 'bad_request', message: '图片数据无效' });
      return;
    }
    tempPath = saveTempImage(base64, req.body?.mimeType ?? mimeType);
    const extracted = await extractTasksFromImage(tempPath);
    const lines =
      extracted.items.length > 0
        ? extracted.items
        : splitRawTextToItems(extracted.rawText);
    if (!lines.length) {
      res.status(422).json({
        error: 'no_content',
        message: '未识别到可执行的待办事项，请尝试更清晰的截图或改用手动录入',
        extracted,
      });
      return;
    }
    const suggestions = scoreExtractedItems(lines, extracted.rawText, extracted.scene);
    res.json({
      extracted,
      suggestions,
      count: suggestions.length,
    });
  } catch (e) {
    next(e);
  } finally {
    if (tempPath) removeTempFile(tempPath);
  }
});

tasksRouter.patch('/tasks/:id', (req, res) => {
  const task = updateTask(req.params.id, req.body ?? {});
  if (!task) {
    res.status(404).json({ error: 'not_found', message: '事项不存在' });
    return;
  }
  res.json(task);
});

tasksRouter.delete('/tasks/:id', (req, res) => {
  if (!deleteTask(req.params.id)) {
    res.status(404).json({ error: 'not_found', message: '事项不存在' });
    return;
  }
  res.json({ ok: true });
});

tasksRouter.post('/tasks/:id/subtasks', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'not_found', message: '事项不存在' });
    return;
  }
  const title = String(req.body?.title ?? '').trim();
  if (!title) {
    res.status(400).json({ error: 'bad_request', message: '子任务标题不能为空' });
    return;
  }
  const subtasks = [...task.subtasks, { id: randomUUID(), title, done: false }];
  res.json(updateTask(task.id, { subtasks }));
});

tasksRouter.patch('/tasks/:id/subtasks/:subId', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'not_found', message: '事项不存在' });
    return;
  }
  const subtasks = task.subtasks.map((s) =>
    s.id === req.params.subId ? { ...s, ...req.body, id: s.id } : s,
  );
  res.json(updateTask(task.id, { subtasks }));
});

tasksRouter.delete('/tasks/:id/subtasks/:subId', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'not_found', message: '事项不存在' });
    return;
  }
  const subtasks = task.subtasks.filter((s) => s.id !== req.params.subId);
  res.json(updateTask(task.id, { subtasks }));
});
