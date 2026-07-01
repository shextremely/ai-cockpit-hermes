import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function tempDir(): string {
  const base =
    process.env.COCKPIT_TASKS_PATH ??
    path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'hermes', 'cockpit');
  return path.join(base, 'temp');
}

/** 将 base64 图片写入临时文件，返回绝对路径 */
export function saveTempImage(base64: string, mimeType?: string): string {
  const dir = tempDir();
  fs.mkdirSync(dir, { recursive: true });
  const ext = MIME_EXT[mimeType ?? ''] ?? '.png';
  const file = path.join(dir, `${randomUUID()}${ext}`);
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
  return file;
}

export function removeTempFile(file: string): void {
  try {
    fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

/** 从 data URL 或纯 base64 解析 */
export function parseImagePayload(input: string): { base64: string; mimeType?: string } {
  const dataUrl = input.match(/^data:(image\/[\w+.-]+);base64,(.+)$/s);
  if (dataUrl) {
    return { mimeType: dataUrl[1], base64: dataUrl[2]!.replace(/\s/g, '') };
  }
  return { base64: input.replace(/\s/g, '') };
}
