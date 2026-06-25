import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 优先读取仓库根目录的 .env(monorepo 共用),再读 BFF 本地 .env 兜底
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`[config] 缺少必需环境变量: ${name}`);
  }
  return v;
}

export const config = {
  hermes: {
    baseUrl: (process.env.HERMES_BASE_URL ?? 'http://127.0.0.1:8642').replace(/\/$/, ''),
    apiKey: required('HERMES_API_KEY'),
    sessionKey: process.env.HERMES_SESSION_KEY ?? 'agent:main:cockpit:user-self',
    model: process.env.HERMES_MODEL ?? 'hermes-agent',
  },
  bff: {
    port: Number(process.env.BFF_PORT ?? 5180),
    allowOrigin: process.env.BFF_ALLOW_ORIGIN ?? '',
    authToken: process.env.BFF_AUTH_TOKEN ?? '',
  },
  // 生产模式下托管的前端静态产物目录(npm run build 后存在)
  webDist: path.resolve(__dirname, '../../web/dist'),
} as const;
