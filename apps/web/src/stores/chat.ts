import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';
import { streamSse } from '@/api/sse';
import { useUiStore } from '@/stores/ui';

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
  /** 流式更新序号，用于驱动子组件重渲染 */
  rev?: number;
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

  function patchMessage(id: string, updater: (m: ChatMessage) => Partial<ChatMessage>): void {
    const idx = messages.value.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const cur = messages.value[idx];
    messages.value[idx] = {
      ...cur,
      ...updater(cur),
      rev: (cur.rev ?? 0) + 1,
    };
  }

  function appendAssistantContent(id: string, delta: string): void {
    if (!delta) return;
    patchMessage(id, (m) => ({ content: m.content + delta }));
  }

  function pushAssistantTool(id: string, tool: ToolProgress): void {
    patchMessage(id, (m) => ({ tools: [...m.tools, tool] }));
  }

  function setAssistantStreaming(id: string, streaming: boolean): void {
    patchMessage(id, () => ({ streaming }));
  }

  async function send(
    input: string,
    opts?: { instructions?: string; openDrawer?: boolean; backend?: 'claude' | 'hermes' },
  ): Promise<void> {
    if (!input.trim() || sending.value) return;
    if (opts?.openDrawer) useUiStore().openChat();
    sending.value = true;
    messages.value.push({ id: uid(), role: 'user', content: input, tools: [] });
    const assistantId = uid();
    messages.value.push({ id: assistantId, role: 'assistant', content: '', tools: [], streaming: true });

    try {
      const run = await api.post<CreateRunResp>('/chat', {
        input,
        ...(opts?.instructions ? { instructions: opts.instructions } : {}),
        ...(opts?.backend ? { backend: opts.backend } : {}),
      });
      const runId = run.run_id ?? run.id;
      if (!runId) throw new Error('未获得 run_id');
      currentRunId.value = runId;
      abort = new AbortController();

      await streamSse(
        `${api.base}/runs/${encodeURIComponent(runId)}/events`,
        (e) => handleEvent(e, assistantId, runId),
        { signal: abort.signal },
      );
    } catch (err) {
      appendAssistantContent(assistantId, `\n\n> [错误] ${(err as Error).message}`);
    } finally {
      setAssistantStreaming(assistantId, false);
      sending.value = false;
      currentRunId.value = null;
      abort = null;
    }
  }

  function handleEvent(e: { event: string; data: string }, assistantId: string, runId: string): void {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(e.data) as Record<string, unknown>;
    } catch {
      // 非 JSON data,直接当文本增量
      if (e.data && e.data !== '[DONE]') appendAssistantContent(assistantId, e.data);
      return;
    }

    if (e.event === 'hermes.tool.progress' || e.event === 'tool.started') {
      pushAssistantTool(assistantId, {
        tool: String(payload.tool ?? payload.name ?? '工具'),
        detail: typeof payload.detail === 'string' ? payload.detail : undefined,
        at: Date.now(),
      });
      return;
    }

    if (e.event === 'error') {
      const errText = typeof payload.message === 'string' ? payload.message : '执行出错';
      appendAssistantContent(assistantId, `\n\n> [错误] ${errText}`);
      return;
    }

    if (e.event === 'done') {
      return;
    }

    if (e.event.includes('approval') || payload.status === 'pending_approval') {
      pendingApproval.value = { runId, payload };
      return;
    }

    // token / 文本增量:兼容多种字段
    const delta = extractDelta(payload);
    if (delta) appendAssistantContent(assistantId, delta);
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
