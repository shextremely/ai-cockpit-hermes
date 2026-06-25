export interface SseEvent {
  event: string;
  data: string;
}

/**
 * 用 fetch 读取 SSE 流(支持 GET/POST + 自定义头,弥补 EventSource 局限)。
 * onEvent 收到逐条解析后的事件;返回一个可调用的中止函数。
 */
export function streamSse(
  url: string,
  onEvent: (e: SseEvent) => void,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<void> {
  return (async () => {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`SSE 连接失败: ${res.status} ${res.statusText}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 帧以空行分隔
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseFrame(raw);
        if (parsed) onEvent(parsed);
      }
    }
  })();
}

function parseFrame(raw: string): SseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) continue; // 注释/心跳
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0 && event === 'message') return null;
  return { event, data: dataLines.join('\n') };
}
