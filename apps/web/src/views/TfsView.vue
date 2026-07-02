<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  NCard,
  NGrid,
  NGi,
  NList,
  NListItem,
  NTag,
  NSpace,
  NText,
  NEmpty,
  NSpin,
  NButton,
  NStatistic,
  useMessage,
} from 'naive-ui';
import { api } from '@/api/client';
import { useChatStore } from '@/stores/chat';

interface TfsItem {
  id: string;
  title: string;
  status: string;
  due: string;
  type?: string;
  tags?: string;
  pool?: boolean;
}

interface DashboardData {
  tfs?: {
    todo?: number;
    bug?: number;
    pool?: number;
    overdue?: number;
    requirements?: TfsItem[];
    poolItems?: TfsItem[];
    bugs?: TfsItem[];
    inProgress?: TfsItem[];
  };
}

const data = ref<DashboardData['tfs'] | null>(null);
const loading = ref(false);
const assigning = ref(false);
const chat = useChatStore();
const message = useMessage();

const columns = [
  { key: 'requirements', title: '我的需求' },
  { key: 'poolItems', title: '公共池' },
  { key: 'bugs', title: '我的 BUG' },
] as const;

async function load(): Promise<void> {
  loading.value = true;
  try {
    const d = await api.get<DashboardData>('/dashboard');
    data.value = d.tfs ?? null;
  } finally {
    loading.value = false;
  }
}

function listFor(key: (typeof columns)[number]['key']): TfsItem[] {
  return data.value?.[key] ?? [];
}

function countFor(key: (typeof columns)[number]['key']): number {
  return listFor(key).length;
}

async function assignPool(): Promise<void> {
  const pool = listFor('poolItems');
  if (!pool.length) {
    message.warning('公共池暂无待指派需求');
    return;
  }
  if (chat.sending) {
    message.info('已有任务执行中，请稍候');
    return;
  }

  const ids = pool.map((it) => it.id).join(', ');
  assigning.value = true;
  try {
    await chat.send(`/process-daily-work 指派以下公共池需求，工作项 ID：${ids}`, {
      backend: 'claude',
      openDrawer: true,
    });
    await load();
  } catch (e) {
    message.error('指派触发失败：' + (e as Error).message);
  } finally {
    assigning.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <NSpace justify="space-between" align="center" style="margin-bottom: 12px">
      <h2 style="margin: 0">TFS 研发工作台</h2>
      <NButton text size="small" :loading="loading" @click="load">刷新</NButton>
    </NSpace>
    <NSpin :show="loading">
      <NCard size="small" style="margin-bottom: 16px">
        <NGrid :cols="5" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
          <NGi span="5 s:2 m:1">
            <NStatistic label="我的需求" :value="countFor('requirements')" />
          </NGi>
          <NGi span="5 s:2 m:1">
            <NStatistic label="公共池" :value="countFor('poolItems')" />
          </NGi>
          <NGi span="5 s:2 m:1">
            <NStatistic label="BUG" :value="countFor('bugs')" />
          </NGi>
          <NGi span="5 s:2 m:1">
            <NStatistic label="进行中" :value="data?.inProgress?.length ?? 0" />
          </NGi>
          <NGi span="5 s:2 m:1">
            <NStatistic label="超期" :value="data?.overdue ?? 0">
              <template v-if="(data?.overdue ?? 0) > 0" #prefix>
                <span style="color: #d03050">⚠ </span>
              </template>
            </NStatistic>
          </NGi>
        </NGrid>
      </NCard>
      <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
        <NGi v-for="col in columns" :key="col.key" span="3 m:1">
          <NCard :title="`${col.title} · ${countFor(col.key)}`" size="small">
            <template v-if="col.key === 'poolItems'" #header-extra>
              <NButton
                size="tiny"
                type="primary"
                :loading="assigning || chat.sending"
                :disabled="!listFor('poolItems').length"
                @click="assignPool"
              >
                指派
              </NButton>
            </template>
            <NList v-if="listFor(col.key).length" hoverable>
              <NListItem v-for="it in listFor(col.key)" :key="it.id">
                <NSpace vertical size="small" style="width: 100%">
                  <NText>{{ it.title }}</NText>
                  <NSpace align="center">
                    <NTag size="small" :bordered="false">#{{ it.id }}</NTag>
                    <NTag size="small" type="info">{{ it.status }}</NTag>
                  </NSpace>
                </NSpace>
              </NListItem>
            </NList>
            <NEmpty v-else description="无" />
          </NCard>
        </NGi>
      </NGrid>
    </NSpin>
    <NText depth="3" style="display: block; margin-top: 12px; font-size: 12px">
      公共池「指派」将通过 process-daily-work 技能对列表中的需求逐条执行负载均衡分派。
    </NText>
  </div>
</template>
