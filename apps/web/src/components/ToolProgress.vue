<script setup lang="ts">
import { computed } from 'vue';
import { NTag, NText } from 'naive-ui';
import type { ToolProgress } from '@/stores/chat';

const props = defineProps<{ tools: ToolProgress[]; streaming?: boolean }>();

const latestAt = computed(() => props.tools[props.tools.length - 1]?.at ?? 0);
</script>

<template>
  <div v-if="tools.length" class="tool-feed">
    <div v-for="t in tools" :key="t.at" class="tool-line">
      <NTag
        size="small"
        :type="streaming && t.at === latestAt ? 'warning' : 'info'"
        :bordered="false"
      >
        调用 {{ t.tool }}
      </NTag>
      <NText v-if="t.detail" depth="3" class="tool-detail">{{ t.detail }}</NText>
    </div>
    <NText v-if="streaming" depth="3" class="tool-running">执行中…</NText>
  </div>
</template>

<style scoped>
.tool-feed {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 8px;
  max-height: 240px;
  overflow-y: auto;
}

.tool-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}

.tool-detail {
  font-size: 11px;
  line-height: 1.35;
  word-break: break-all;
  padding-left: 2px;
}

.tool-running {
  font-size: 11px;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}
</style>
