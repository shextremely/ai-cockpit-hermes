<script setup lang="ts">
import { NCard, NButton, NSpace, NSpin } from 'naive-ui';

defineProps<{ title: string; loading?: boolean }>();
const emit = defineEmits<{ refresh: []; ask: [] }>();
</script>

<template>
  <NCard :title="title" size="small" hoverable style="height: 100%">
    <template #header-extra>
      <NSpace size="small">
        <NButton text size="tiny" @click="emit('ask')">追问</NButton>
        <NButton text size="tiny" @click="emit('refresh')">刷新</NButton>
      </NSpace>
    </template>
    <NSpin :show="loading">
      <slot />
    </NSpin>
  </NCard>
</template>
