<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NButton, NSpace } from 'naive-ui';
import { useChatStore } from '@/stores/chat';

const chat = useChatStore();
const visible = computed(() => Boolean(chat.pendingApproval));
const summary = computed(() => {
  const p = chat.pendingApproval?.payload as Record<string, unknown> | undefined;
  if (!p) return '';
  return (p.summary as string) ?? (p.detail as string) ?? JSON.stringify(p);
});
</script>

<template>
  <NAlert v-if="visible" type="warning" title="需要你确认" style="margin: 8px 0">
    <div style="margin-bottom: 8px; word-break: break-word">{{ summary }}</div>
    <NSpace justify="end">
      <NButton size="small" @click="chat.resolveApproval('reject')">取消</NButton>
      <NButton size="small" type="primary" @click="chat.resolveApproval('approve')">确认执行</NButton>
    </NSpace>
  </NAlert>
</template>
