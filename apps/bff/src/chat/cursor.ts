import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { config } from '../config.js';

/** 在 Cursor 中打开指定工程目录，供代码修复/开发使用 */
export function openCursor(
  repo?: string,
  opts?: { reuseWindow?: boolean },
): { ok: boolean; repo: string; message?: string } {
  const target = repo && repo.trim() ? repo.trim() : config.cursor.defaultRepo;
  if (!target) {
    return { ok: false, repo: '', message: '未配置 CURSOR_DEFAULT_REPO' };
  }
  if (!fs.existsSync(target)) {
    return { ok: false, repo: target, message: `路径不存在: ${target}` };
  }
  try {
    const args = opts?.reuseWindow ? ['-r', target] : [target];
    const child = spawn(config.cursor.bin, args, {
      detached: true,
      stdio: 'ignore',
      shell: true,
      windowsHide: true,
    });
    child.unref();
    return { ok: true, repo: target };
  } catch (e) {
    return { ok: false, repo: target, message: e instanceof Error ? e.message : String(e) };
  }
}

function openCursorDeeplink(url: string): void {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return;
  }
  spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
}

/**
 * 在 Cursor 中打开工程并新建 Agent 会话，预填技能指令。
 * 若 Cursor 已打开该目录，复用窗口并创建新的 AI 调用。
 */
export function triggerCursorSkill(
  repo: string,
  prompt: string,
): { ok: boolean; repo: string; message?: string } {
  const opened = openCursor(repo, { reuseWindow: true });
  if (!opened.ok) return opened;

  // 新建聊天会话，再预填 Agent 模式提示词
  setTimeout(() => openCursorDeeplink('cursor://anysphere.cursor-deeplink/createchat'), 400);
  setTimeout(() => {
    const params = new URLSearchParams({ text: prompt, mode: 'agent' });
    openCursorDeeplink(`cursor://anysphere.cursor-deeplink/prompt?${params.toString()}`);
  }, 900);

  return { ok: true, repo: opened.repo };
}
