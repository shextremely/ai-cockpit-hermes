<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import {
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NMenu,
  NButton,
  NSpace,
  type MenuOption,
} from 'naive-ui';
import HermesStatus from '@/components/HermesStatus.vue';
import ChatDrawer from '@/components/ChatDrawer.vue';
import { useCapabilitiesStore } from '@/stores/capabilities';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const router = useRouter();
const caps = useCapabilitiesStore();
const ui = useUiStore();

const menuOptions: MenuOption[] = [
  { label: '驾驶舱', key: 'dashboard' },
  { label: 'TFS 工作台', key: 'tfs' },
  { label: '事项管理', key: 'tasks' },
  { label: '知识库', key: 'knowledge' },
  { label: '日程待办', key: 'jobs' },
  { label: '能力面板', key: 'capabilities' },
];

const activeKey = computed(() => (route.name as string) ?? 'dashboard');

function onMenu(key: string): void {
  router.push({ name: key });
}

function onKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    ui.chatOpen = !ui.chatOpen;
  }
}

onMounted(() => {
  caps.load();
  window.addEventListener('keydown', onKeydown);
  // 每 30s 刷新一次健康灯
  setInterval(() => caps.refreshHealth(), 30000);
});
</script>

<template>
  <NLayout style="height: 100vh">
    <NLayoutHeader bordered style="height: 56px; display: flex; align-items: center; padding: 0 16px">
      <div style="font-weight: 700; font-size: 18px">个人 AI 驾驶舱</div>
      <div style="flex: 1" />
      <NSpace align="center">
        <HermesStatus />
        <NButton type="primary" size="small" @click="ui.openChat()">
          对话 (Ctrl/Cmd+K)
        </NButton>
      </NSpace>
    </NLayoutHeader>
    <NLayout has-sider style="height: calc(100vh - 56px)">
      <NLayoutSider bordered :width="200" :native-scrollbar="false">
        <NMenu :value="activeKey" :options="menuOptions" @update:value="onMenu" />
      </NLayoutSider>
      <NLayoutContent :native-scrollbar="false" content-style="padding: 20px;">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>

  <ChatDrawer v-model:show="ui.chatOpen" />
</template>
