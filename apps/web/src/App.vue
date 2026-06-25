<script setup lang="ts">
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, zhCN, dateZhCN } from 'naive-ui';
import AppLayout from '@/layouts/AppLayout.vue';
</script>

<template>
  <NConfigProvider :theme="darkTheme" :locale="zhCN" :date-locale="dateZhCN">
    <NMessageProvider>
      <NDialogProvider>
        <AppLayout />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
