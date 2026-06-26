import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { config } from '../config.js';

/** 在 Cursor 中打开指定工程目录，供代码修复/开发使用 */
export function openCursor(repo?: string): { ok: boolean; repo: string; message?: string } {
  const target = repo && repo.trim() ? repo.trim() : config.cursor.defaultRepo;
  if (!target) {
    return { ok: false, repo: '', message: '未配置 CURSOR_DEFAULT_REPO' };
  }
  if (!fs.existsSync(target)) {
    return { ok: false, repo: target, message: `路径不存在: ${target}` };
  }
  try {
    const child = spawn(config.cursor.bin, [target], {
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
