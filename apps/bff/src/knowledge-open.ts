import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from './config.js';

/** 将 Vault 内相对路径解析为绝对路径，并校验不越界 */
export function resolveVaultFile(relativePath: string): string {
  const vault = config.obsidian.vaultPath;
  if (!vault) {
    throw new Error('未配置 OBSIDIAN_VAULT_PATH');
  }
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.resolve(vault, normalized);
  const vaultRoot = path.resolve(vault);
  if (full !== vaultRoot && !full.startsWith(vaultRoot + path.sep)) {
    throw new Error('非法路径');
  }
  if (!fs.existsSync(full)) {
    throw new Error(`文件不存在: ${normalized}`);
  }
  return full;
}

function findTyporaExe(): string | null {
  const candidates = [
    config.obsidian.typoraPath,
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Typora', 'Typora.exe'),
    'D:\\Typora\\Typora.exe',
    'C:\\Program Files\\Typora\\Typora.exe',
  ].filter((p): p is string => Boolean(p));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function spawnDetached(command: string, args: string[]): void {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', shell: false });
  child.unref();
}

/** 用 Typora 或系统默认程序打开本地 Markdown */
export function openVaultFile(fullPath: string): 'typora' | 'default' {
  if (process.platform === 'win32') {
    const mode = config.obsidian.openMode;
    if (mode === 'typora') {
      const typora = findTyporaExe();
      if (typora) {
        spawnDetached(typora, [fullPath]);
        return 'typora';
      }
    }
    if (mode === 'typora' || mode === 'default') {
      spawnDetached('cmd', ['/c', 'start', '', fullPath]);
      return 'default';
    }
    spawnDetached(mode, [fullPath]);
    return 'default';
  }
  if (process.platform === 'darwin') {
    const typora = '/Applications/Typora.app/Contents/MacOS/Typora';
    if (config.obsidian.openMode === 'typora' && fs.existsSync(typora)) {
      spawnDetached(typora, [fullPath]);
      return 'typora';
    }
    spawnDetached('open', [fullPath]);
    return 'default';
  }
  spawnDetached('xdg-open', [fullPath]);
  return 'default';
}
