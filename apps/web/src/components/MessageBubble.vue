<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import { NSpin } from 'naive-ui';
import ToolProgress from './ToolProgress.vue';
import type { ChatMessage } from '@/stores/chat';

const props = defineProps<{ message: ChatMessage }>();

const md = new MarkdownIt({ linkify: true, breaks: true });
const html = computed(() => md.render(props.message.content || ''));
const isUser = computed(() => props.message.role === 'user');
const toolCount = computed(() => props.message.tools.length);
</script>

<template>
  <div :style="{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', margin: '10px 0' }">
    <div
      :style="{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: '12px',
        background: isUser ? 'var(--n-color-primary, #2a6df4)' : 'rgba(255,255,255,0.06)',
      }"
    >
      <ToolProgress v-if="!isUser && toolCount" :tools="message.tools" :streaming="message.streaming" />
      <div class="markdown-body" v-html="html" />
      <NSpin v-if="message.streaming && !message.content && !toolCount" size="small" />
    </div>
  </div>
</template>
