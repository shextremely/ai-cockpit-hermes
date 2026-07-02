import { Router } from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

export const dashboardRouter = Router();

const EMPTY_TFS = {
  tfs: {
    todo: 0,
    bug: 0,
    pool: 0,
    overdue: 0,
    items: [],
    requirements: [],
    poolItems: [],
    bugs: [],
    inProgress: [],
  },
};

function skillDir(): string {
  if (process.env.COCKPIT_DASHBOARD_SKILL_DIR) {
    return process.env.COCKPIT_DASHBOARD_SKILL_DIR;
  }
  const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
  return path.join(localAppData, 'hermes', 'skills', 'devops', 'cockpit-dashboard');
}

const EMPTY_TEAM_OVERDUE = {
  mode: 'overdue',
  team: '',
  project: '',
  total: 0,
  assigneeCount: 0,
  summary: [],
  details: {},
  items: [],
};

const EMPTY_TEAM_BASELINE = {
  mode: 'baseline',
  team: '',
  project: '',
  rate: 0,
  fulfilled: 0,
  notFulfilled: 0,
  evaluable: 0,
  pending: 0,
  excludedL4: 0,
  startDate: '',
  byPriority: [],
  byAssignee: [],
  notFulfilledItems: [],
};

const EMPTY_TEAM_LOAD = {
  mode: 'load',
  team: '',
  project: '',
  memberCount: 0,
  members: [],
  thresholds: { score: 15, imminent: 3 },
};

const EMPTY_TEAM_RESOLVED = {
  mode: 'resolved',
  team: '',
  project: '',
  days: 7,
  totals: { requirements: 0, tasks: 0, bugs: 0, queued: 0, total: 0 },
  members: [],
};

const EMPTY_OPS_QUEUE = {
  mode: 'ops-queue',
  totals: { repos: 0, modules: 0, demands: 0, readyToMerge: 0, blocked: 0 },
  demands: [],
  cutInCandidates: [],
};

/** 执行 cockpit-dashboard skill 下的 Node 脚本，stdout 须为 JSON */
function runSkillScript(scriptName: string, args: string[] = []): Promise<unknown> {
  const cwd = skillDir();
  const script = path.join(cwd, 'tools', scriptName);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${scriptName} exited with ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`${scriptName} returned invalid JSON`));
      }
    });
  });
}

/** 直接执行 Hermes 侧 cockpit-dashboard 脚本（WIQL 聚合，约 3s） */
function runDashboardScript(): Promise<unknown> {
  return runSkillScript('run-dashboard.mjs');
}

function teamStatsArgs(
  req: { query: Record<string, unknown> },
  mode: 'overdue' | 'baseline' | 'load' | 'resolved',
): string[] {
  const args = ['--mode', mode];
  const team = typeof req.query.team === 'string' ? req.query.team.trim() : '';
  const project = typeof req.query.project === 'string' ? req.query.project.trim() : '';
  const daysRaw = req.query.days;
  if (team) args.push('--team', team);
  if (project) args.push('--project', project);
  if (mode === 'resolved' && daysRaw != null && String(daysRaw).trim()) {
    args.push('--days', String(daysRaw).trim());
  }
  return args;
}

/** 首页聚合卡片数据 */
dashboardRouter.get('/dashboard', async (_req, res) => {
  try {
    const parsed = await runDashboardScript();
    res.json(parsed);
  } catch (e) {
    console.warn('[dashboard] script failed:', e);
    res.json(EMPTY_TFS);
  }
});

/** 团队超期需求（按指派人汇总 + 明细） */
dashboardRouter.get('/dashboard/team-stats/overdue', async (req, res) => {
  try {
    const parsed = await runSkillScript('team-stats.mjs', teamStatsArgs(req, 'overdue'));
    res.json(parsed);
  } catch (e) {
    console.warn('[dashboard] team overdue failed:', e);
    res.json(EMPTY_TEAM_OVERDUE);
  }
});

/** 团队基线履约率（按创建日期 + 优先级排期） */
dashboardRouter.get('/dashboard/team-stats/baseline', async (req, res) => {
  try {
    const parsed = await runSkillScript('team-stats.mjs', teamStatsArgs(req, 'baseline'));
    res.json(parsed);
  } catch (e) {
    console.warn('[dashboard] team baseline failed:', e);
    res.json(EMPTY_TEAM_BASELINE);
  }
});

/** 团队当前负载（按指派人） */
dashboardRouter.get('/dashboard/team-stats/load', async (req, res) => {
  try {
    const parsed = await runSkillScript('team-stats.mjs', teamStatsArgs(req, 'load'));
    res.json(parsed);
  } catch (e) {
    console.warn('[dashboard] team load failed:', e);
    res.json(EMPTY_TEAM_LOAD);
  }
});

/** 团队近 N 天已解决工作汇总 */
dashboardRouter.get('/dashboard/team-stats/resolved', async (req, res) => {
  try {
    const parsed = await runSkillScript('team-stats.mjs', teamStatsArgs(req, 'resolved'));
    res.json(parsed);
  } catch (e) {
    console.warn('[dashboard] team resolved failed:', e);
    res.json(EMPTY_TEAM_RESOLVED);
  }
});

/** 运营平台前端仓库排队 + 可插队分析 */
dashboardRouter.get('/dashboard/ops-queue', async (_req, res) => {
  try {
    const parsed = await runSkillScript('ops-queue-stats.mjs');
    res.json(parsed);
  } catch (e) {
    console.warn('[dashboard] ops queue failed:', e);
    res.json(EMPTY_OPS_QUEUE);
  }
});
