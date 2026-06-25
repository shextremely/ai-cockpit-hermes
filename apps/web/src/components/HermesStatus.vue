<script setup lang="ts">
import { computed } from 'vue';
import { NBadge, NText, NTooltip } from 'naive-ui';
import { useCapabilitiesStore } from '@/stores/capabilities';

const caps = useCapabilitiesStore();
const status = computed(() => (caps.online ? 'success' : 'error'));
const label = computed(() => (caps.online ? 'Hermes 在线' : 'Hermes 离线'));
</script>

<template>
  <NTooltip>
    <template #trigger>
      <span style="display: inline-flex; align-items: center; gap: 6px">
        <NBadge dot :type="status" />
        <NText depth="2" style="font-size: 12px">{{ label }}</NText>
      </span>
    </template>
    引擎健康状态(每 30 秒刷新)
  </NTooltip>
</template>
