<script setup lang="ts">
import { NTag, NSpace } from 'naive-ui';
import type { ToolProgress } from '@/stores/chat';

defineProps<{ tools: ToolProgress[] }>();
</script>

<template>
  <NSpace v-if="tools.length" size="small" style="margin: 4px 0">
    <NTag v-for="(t, i) in tools" :key="i" size="small" type="info" :bordered="false">
      调用 {{ t.tool }}<span v-if="t.detail">:{{ t.detail }}</span>
    </NTag>
  </NSpace>
</template>
