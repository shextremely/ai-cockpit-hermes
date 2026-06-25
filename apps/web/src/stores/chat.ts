import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import { streamSse } from '@/api/sse';

export interface ToolProgress {
  tool: string;
  detail?: string;
  at: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools: ToolProgress[];
  streaming?: boolean;
}

interface CreateRunResp {
  run_id?: string;
  id?: string;
  status?: string;
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([]);
  const sending = ref(false);
  const currentRunId = ref<string | null>(null);
  const pendingApproval = ref<{ runId: string; payload: unknown } | null>(null);
  let abort: AbortController | null = null;

  function uid(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function send(input: string): Promise<void> {
    if (!input.trim() || sending.value) return;
    sending.value = true;
    messages.value.push({ id: uid(), role: 'user', content: input, tools: [] });
    const assistant: ChatMessage = { id: uid(), role: 'assistant', content: '', tools: [], streaming: true };
    messages.value.push(assistant);

    try {
      const run = await api.post<CreateRunResp>('/chat', { input });
      const runId = run.run_id ?? run.id;
      if (!runId) throw new Error('未获得 run_id');
      currentRunId.value = runId;
      abort = new AbortController();

      await streamSse(
        `${api.base}/runs/${encodeURIComponent(runId)}/events`,
        (e) => handleEvent(e, assistant, runId),
        { signal: abort.signal },
      );
    } catch (err) {
      assistant.content += `\n\n> [错误] ${(err as Error).message}`;
    } finally {
      assistant.streaming = false;
      sending.value = false;
      currentRunId.value = null;
      abort = null;
    }
  }

  function handleEvent(e: { event: string; data: string }, assistant: ChatMessage, runId: string): void {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(e.data) as Record<string, unknown>;
    } catch {
      // 非 JSON data,直接当文本增量
      if (e.data && e.data !== '[DONE]') assistant.content += e.data;
      return;
    }

    if (e.event === 'hermes.tool.progress' || e.event === 'tool.started') {
      assistant.tools.push({
        tool: String(payload.tool ?? payload.name ?? '工具'),
        detail: typeof payload.detail === 'string' ? payload.detail : undefined,
        at: Date.now(),
      });
      return;
    }

    if (e.event.includes('approval') || payload.status === 'pending_approval') {
      pendingApproval.value = { runId, payload };
      return;
    }

    // token / 文本增量:兼容多种字段
    const delta = extractDelta(payload);
    if (delta) assistant.content += delta;
  }

  function extractDelta(p: Record<string, unknown>): string {
    if (typeof p.delta === 'string') return p.delta;
    if (typeof p.text === 'string') return p.text;
    if (typeof p.output === 'string') return p.output;
    const choices = p.choices as Array<{ delta?: { content?: string } }> | undefined;
    if (choices?.[0]?.delta?.content) return choices[0].delta.content as string;
    return '';
  }

  async function stop(): Promise<void> {
    if (currentRunId.value) {
      try {
        await api.post(`/runs/${encodeURIComponent(currentRunId.value)}/stop`);
      } catch {
        /* ignore */
      }
    }
    abort?.abort();
  }

  async function resolveApproval(decision: 'approve' | 'reject'): Promise<void> {
    if (!pendingApproval.value) return;
    const { runId } = pendingApproval.value;
    pendingApproval.value = null;
    await api.post(`/runs/${encodeURIComponent(runId)}/approval`, { decision, approved: decision === 'approve' });
  }

  function clear(): void {
    messages.value = [];
  }

  return { messages, sending, currentRunId, pendingApproval, send, stop, resolveApproval, clear };
});
