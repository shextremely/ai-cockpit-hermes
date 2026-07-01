import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_SETTINGS,
  type TaskFilters,
  type TaskItem,
  type TaskPriority,
  type TaskSettings,
  type TaskStats,
  type TaskStatus,
  type TaskStore,
} from './types.js';

function dataPath(): string {
  const base =
    process.env.COCKPIT_TASKS_PATH ??
    path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'hermes', 'cockpit');
  return path.join(base, 'tasks.json');
}

function ensureDir(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function loadRaw(): TaskStore {
  const file = dataPath();
  if (!fs.existsSync(file)) {
    return { tasks: [], settings: { ...DEFAULT_SETTINGS } };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as TaskStore;
    return {
      tasks: parsed.tasks ?? [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch {
    return { tasks: [], settings: { ...DEFAULT_SETTINGS } };
  }
}

function save(store: TaskStore): void {
  const file = dataPath();
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf8');
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function syncOverdue(task: TaskItem): TaskItem {
  if (task.status === 'done' || !task.dueAt) return task;
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return task;
  if (due.getTime() < Date.now()) {
    return { ...task, status: 'overdue' };
  }
  return task;
}

function sortTasks(tasks: TaskItem[], sortBy: TaskSettings['sortBy']): TaskItem[] {
  return [...tasks].sort((a, b) => {
    if (sortBy === 'priority') {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
    }
    if (sortBy === 'createdAt') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return ad - bd;
  });
}

function applyFilters(tasks: TaskItem[], filters?: TaskFilters): TaskItem[] {
  if (!filters) return tasks;
  let result = tasks;
  if (filters.status?.length) {
    result = result.filter((t) => filters.status!.includes(t.status));
  }
  if (filters.priority?.length) {
    result = result.filter((t) => filters.priority!.includes(t.priority));
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.category?.toLowerCase().includes(q) ?? false),
    );
  }
  if (filters.dueFrom) {
    const from = new Date(filters.dueFrom).getTime();
    result = result.filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= from);
  }
  if (filters.dueTo) {
    const to = new Date(filters.dueTo).getTime();
    result = result.filter((t) => t.dueAt && new Date(t.dueAt).getTime() <= to);
  }
  return result;
}

export function listTasks(filters?: TaskFilters): { tasks: TaskItem[]; settings: TaskSettings } {
  const store = loadRaw();
  const synced = store.tasks.map(syncOverdue);
  const changed = synced.some((t, i) => t.status !== store.tasks[i]?.status);
  if (changed) {
    store.tasks = synced;
    save(store);
  }
  const filtered = applyFilters(synced, filters);
  return { tasks: sortTasks(filtered, store.settings.sortBy), settings: store.settings };
}

export function getTask(id: string): TaskItem | null {
  const { tasks } = listTasks();
  return tasks.find((t) => t.id === id) ?? null;
}

export function createTask(input: Partial<TaskItem> & { title: string }): TaskItem {
  const store = loadRaw();
  const now = new Date().toISOString();
  const task: TaskItem = syncOverdue({
    id: randomUUID(),
    title: input.title.trim(),
    description: input.description?.trim(),
    priority: input.priority ?? 'medium',
    status: input.status ?? 'todo',
    dueAt: input.dueAt,
    category: input.category,
    subtasks: input.subtasks ?? [],
    remindBefore: input.remindBefore ?? store.settings.defaultRemindBefore,
    remindEnabled: input.remindEnabled ?? true,
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
    completedAt: input.status === 'done' ? now : undefined,
  });
  store.tasks.push(task);
  save(store);
  return task;
}

export function updateTask(id: string, patch: Partial<TaskItem>): TaskItem | null {
  const store = loadRaw();
  const idx = store.tasks.findIndex((t) => t.id === id);
  if (idx < 0) return null;

  const prev = store.tasks[idx]!;
  const next: TaskItem = syncOverdue({
    ...prev,
    ...patch,
    id: prev.id,
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString(),
  });

  if (patch.status === 'done' && prev.status !== 'done') {
    next.completedAt = new Date().toISOString();
  } else if (patch.status && patch.status !== 'done') {
    next.completedAt = undefined;
  }

  if (next.subtasks.length && next.subtasks.every((s) => s.done) && next.status !== 'done') {
    next.status = 'done';
    next.completedAt = new Date().toISOString();
  }

  store.tasks[idx] = next;
  save(store);
  return next;
}

export function deleteTask(id: string): boolean {
  const store = loadRaw();
  const before = store.tasks.length;
  store.tasks = store.tasks.filter((t) => t.id !== id);
  if (store.tasks.length === before) return false;
  save(store);
  return true;
}

export function updateSettings(patch: Partial<TaskSettings>): TaskSettings {
  const store = loadRaw();
  store.settings = { ...store.settings, ...patch };
  save(store);
  return store.settings;
}

export function computeStats(periodDays = 7): TaskStats {
  const { tasks } = listTasks();
  const since = Date.now() - periodDays * 86400000;
  const recent = tasks.filter((t) => new Date(t.createdAt).getTime() >= since);

  const byPriority: Record<TaskPriority, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
  const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0, overdue: 0 };

  for (const t of recent) {
    byPriority[t.priority]++;
    byStatus[t.status]++;
  }

  const done = recent.filter((t) => t.status === 'done').length;
  const total = recent.length;

  return {
    total,
    done,
    overdue: recent.filter((t) => t.status === 'overdue').length,
    inProgress: recent.filter((t) => t.status === 'in_progress').length,
    todo: recent.filter((t) => t.status === 'todo').length,
    completionRate: total ? Math.round((done / total) * 100) : 0,
    byPriority,
    byStatus,
    topOverdue: recent.filter((t) => t.status === 'overdue').slice(0, 5),
  };
}
