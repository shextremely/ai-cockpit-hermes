import { config } from './config.js';

export interface HermesHeaderOpts {
  /** transcript 级会话 id(切话题轮换) */
  sessionId?: string;
  /** 长期记忆稳定作用域;默认用配置中的全局 key */
  sessionKey?: string;
  /** 透传 Accept(SSE 场景为 text/event-stream) */
  accept?: string;
}

function buildHeaders(opts: HermesHeaderOpts = {}, json = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${config.hermes.apiKey}`,
    'X-Hermes-Session-Key': opts.sessionKey ?? config.hermes.sessionKey,
  };
  if (json) h['Content-Type'] = 'application/json';
  if (opts.sessionId) h['X-Hermes-Session-Id'] = opts.sessionId;
  if (opts.accept) h['Accept'] = opts.accept;
  return h;
}

/** 通用 JSON 请求 */
export async function hermesJson<T = unknown>(
  pathname: string,
  init: { method?: string; body?: unknown; headers?: HermesHeaderOpts } = {},
): Promise<T> {
  const res = await fetch(`${config.hermes.baseUrl}${pathname}`, {
    method: init.method ?? 'GET',
    headers: buildHeaders(init.headers),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new HermesError(res.status, text || res.statusText);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** 返回原始 fetch Response,用于 SSE 流式透传 */
export async function hermesStream(
  pathname: string,
  init: { method?: string; body?: unknown; headers?: HermesHeaderOpts } = {},
): Promise<Response> {
  return fetch(`${config.hermes.baseUrl}${pathname}`, {
    method: init.method ?? 'GET',
    headers: buildHeaders(init.headers ? { ...init.headers, accept: 'text/event-stream' } : { accept: 'text/event-stream' }),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export class HermesError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HermesError';
    this.status = status;
  }
}
