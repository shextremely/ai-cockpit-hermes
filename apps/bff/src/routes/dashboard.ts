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

/** 直接执行 Hermes 侧 cockpit-dashboard 脚本（WIQL 聚合，约 3s） */
function runDashboardScript(): Promise<unknown> {
  const cwd = skillDir();
  const script = path.join(cwd, 'tools', 'run-dashboard.mjs');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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
        reject(new Error(stderr.trim() || `run-dashboard.mjs exited with ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error('run-dashboard.mjs returned invalid JSON'));
      }
    });
  });
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
