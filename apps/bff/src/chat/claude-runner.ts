import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Response as ExpressResponse } from 'express';
import { config } from '../config.js';

interface SseMsg {
  event: string;
  data: string;
}

interface RunState {
  id: string;
  child: ChildProcess;
  buffer: SseMsg[];
  subscribers: Array<(m: SseMsg) => void>;
  endHandlers: Array<() => void>;
  seen: Set<string>;
  done: boolean;
  sessionId?: string;
}

const runs = new Map<string, RunState>();
/** 默认会话的最近 Claude session_id，用于 --resume 维持多轮 */
let lastSessionId: string | undefined;

export interface StartClaudeOpts {
  systemPrompt?: string;
  cwd?: string;
  /** 默认 true：复用上一个会话以保持多轮上下文 */
  resume?: boolean;
}

function emit(state: RunState, event: string, dataObj: unknown): void {
  const msg: SseMsg = { event, data: JSON.stringify(dataObj) };
  state.buffer.push(msg);
  for (const s of state.subscribers) s(msg);
}

function summarizeToolInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  const key = ['command', 'file_path', 'path', 'query', 'pattern', 'description', 'prompt'].find(
    (k) => typeof obj[k] === 'string',
  );
  const val = key ? String(obj[key]) : JSON.stringify(obj);
  return val.length > 120 ? val.slice(0, 117) + '…' : val;
}

function handleLine(state: RunState, line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return;
  }

  const type = obj.type as string;

  if (type === 'system') {
    const subtype = obj.subtype as string;
    if (subtype === 'init') {
      state.sessionId = obj.session_id as string;
      lastSessionId = state.sessionId;
      const model = (obj.model as string) ?? '';
      emit(state, 'tool.started', { tool: '引擎', detail: `Claude Code${model ? ' · ' + model : ''}` });
    }
    return; // thinking_tokens 等噪声忽略
  }

  if (type === 'assistant') {
    const message = obj.message as { content?: Array<Record<string, unknown>> } | undefined;
    const uuid = (obj.uuid as string) ?? '';
    const content = message?.content ?? [];
    content.forEach((block, idx) => {
      const blockType = block.type as string;
      const dedupeKey = `${uuid}:${idx}`;
      if (state.seen.has(dedupeKey)) return;
      state.seen.add(dedupeKey);
      if (blockType === 'text' && typeof block.text === 'string' && block.text) {
        emit(state, 'message', { delta: block.text });
      } else if (blockType === 'tool_use') {
        emit(state, 'tool.started', {
          tool: String(block.name ?? '工具'),
          detail: summarizeToolInput(block.input),
        });
      }
    });
    return;
  }

  if (type === 'result') {
    state.sessionId = (obj.session_id as string) ?? state.sessionId;
    lastSessionId = state.sessionId ?? lastSessionId;
    if (obj.is_error) {
      const msg = (obj.result as string) ?? (obj.api_error_status as string) ?? 'Claude 执行失败';
      emit(state, 'error', { message: String(msg) });
    }
    return;
  }
}

/** 启动一次 Claude Code 运行，返回 BFF 侧 runId */
export function startClaudeRun(prompt: string, opts: StartClaudeOpts = {}): string {
  const id = randomUUID();
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    config.claude.permissionMode,
    '--max-turns',
    String(config.claude.maxTurns),
  ];
  if (config.claude.allowedTools) {
    args.push('--allowedTools', config.claude.allowedTools);
  }
  if (config.claude.model) {
    args.push('--model', config.claude.model);
  }
  if (opts.systemPrompt) {
    args.push('--append-system-prompt', opts.systemPrompt);
  }
  const resumeId = opts.resume === false ? undefined : lastSessionId;
  if (resumeId) {
    args.push('--resume', resumeId);
  }

  // 动态内容（用户输入）经 stdin 传入，固定 flag 走 args，避免 shell 注入
  const child = spawn(config.claude.bin, args, {
    cwd: opts.cwd ?? config.claude.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    windowsHide: true,
  });

  const state: RunState = {
    id,
    child,
    buffer: [],
    subscribers: [],
    endHandlers: [],
    seen: new Set(),
    done: false,
  };
  runs.set(id, state);

  child.stdin?.write(prompt);
  child.stdin?.end();

  let stdoutBuf = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf-8');
    let nl: number;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl);
      stdoutBuf = stdoutBuf.slice(nl + 1);
      handleLine(state, line);
    }
  });

  let stderrBuf = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString('utf-8');
  });

  const finish = (errMsg?: string): void => {
    if (state.done) return;
    if (stdoutBuf.trim()) handleLine(state, stdoutBuf);
    if (errMsg) emit(state, 'error', { message: errMsg });
    state.done = true;
    for (const end of state.endHandlers) end();
    // 保留一段时间供延迟订阅者读取缓冲，随后清理
    setTimeout(() => runs.delete(id), 5 * 60 * 1000);
  };

  child.on('error', (err) => {
    finish(`无法启动 Claude CLI: ${err.message}`);
  });
  child.on('close', (code) => {
    finish(code === 0 ? undefined : stderrBuf.trim() || `Claude 退出码 ${code}`);
  });

  return id;
}

/** 订阅某次 Claude 运行的事件流，回放缓冲并续传 */
export function subscribeClaudeRun(runId: string, res: ExpressResponse): void {
  const state = runs.get(runId);
  const write = (m: SseMsg): void => {
    res.write(`event: ${m.event}\ndata: ${m.data}\n\n`);
    (res as unknown as { flush?: () => void }).flush?.();
  };
  const end = (): void => {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  };

  if (!state) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'run 不存在或已过期' })}\n\n`);
    res.end();
    return;
  }

  state.buffer.forEach(write);
  if (state.done) {
    end();
    return;
  }

  const onMsg = (m: SseMsg): void => write(m);
  state.subscribers.push(onMsg);
  state.endHandlers.push(end);

  res.on('close', () => {
    state.subscribers = state.subscribers.filter((s) => s !== onMsg);
    state.endHandlers = state.endHandlers.filter((e) => e !== end);
  });
}

/** 中断某次 Claude 运行 */
export function stopClaudeRun(runId: string): boolean {
  const state = runs.get(runId);
  if (!state) return false;
  state.child.kill();
  return true;
}

/** 重置默认会话（清空多轮上下文） */
export function resetClaudeSession(): void {
  lastSessionId = undefined;
}
