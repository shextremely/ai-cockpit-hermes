import type { Response as ExpressResponse } from 'express';

/** 初始化 SSE 响应头(关闭缓冲/压缩) */
export function initSse(res: ExpressResponse): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

/** 把上游 Hermes 的 SSE 响应体逐块透传到下游浏览器 */
export async function pipeUpstreamSse(upstream: Response, res: ExpressResponse): Promise<void> {
  if (!upstream.body) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'upstream has no body' })}\n\n`);
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
      // express 默认无压缩;若挂了 compression 中间件需在此 flush
      (res as unknown as { flush?: () => void }).flush?.();
    }
  } finally {
    res.end();
  }
}

/** 发送单条 SSE 事件 */
export function sendSse(res: ExpressResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
