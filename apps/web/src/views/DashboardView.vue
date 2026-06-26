<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NGrid, NGi, NStatistic, NList, NListItem, NTag, NSpace, NEmpty, NText } from 'naive-ui';
import DashboardCard from '@/components/DashboardCard.vue';
import { api } from '@/api/client';

interface TfsItem {
  id: string;
  title: string;
  status: string;
  due: string;
  type?: string;
}
interface DashboardData {
  tfs?: { todo: number; bug: number; pool: number; overdue: number; items: TfsItem[] };
  raw?: string;
}

const data = ref<DashboardData | null>(null);
const loading = ref(false);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    data.value = await api.get<DashboardData>('/dashboard');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function statusType(s: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (/超期|逾期/.test(s)) return 'error';
  if (/进行|开发/.test(s)) return 'info';
  if (/完成|关闭/.test(s)) return 'success';
  return 'default';
}

onMounted(load);
</script>

<template>
  <div>
    <h2 style="margin-top: 0">驾驶舱</h2>
    <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="3 m:1">
        <DashboardCard title="今日 TFS 概览" :loading="loading" @refresh="load">
          <NSpace v-if="data?.tfs" justify="space-between" :wrap="true">
            <NStatistic label="待处理" :value="data.tfs.todo" />
            <NStatistic label="BUG" :value="data.tfs.bug" />
            <NStatistic label="公共池" :value="data.tfs.pool" />
            <NStatistic label="超期" :value="data.tfs.overdue" />
          </NSpace>
          <NEmpty v-else description="暂无数据" />
        </DashboardCard>
      </NGi>

      <NGi span="3 m:2">
        <DashboardCard title="我的研发任务" :loading="loading" @refresh="load">
          <NList v-if="data?.tfs?.items?.length" hoverable clickable>
            <NListItem v-for="it in data.tfs.items" :key="it.id">
              <NSpace align="center" :wrap="false" style="width: 100%">
                <NTag size="small" :bordered="false">#{{ it.id }}</NTag>
                <NText style="flex: 1">{{ it.title }}</NText>
                <NTag size="small" :type="statusType(it.status)">{{ it.status }}</NTag>
                <NText v-if="it.due" depth="3" style="font-size: 12px">{{ it.due }}</NText>
              </NSpace>
            </NListItem>
          </NList>
          <NEmpty v-else :description="error || '暂无任务(或 Hermes/TFS MCP 未就绪)'" />
        </DashboardCard>
      </NGi>
    </NGrid>

    <NText v-if="data?.raw" depth="3" style="display: block; margin-top: 12px; font-size: 12px">
      引擎返回了非结构化内容,已回退展示:{{ data.raw.slice(0, 200) }}…
    </NText>
  </div>
</template>
