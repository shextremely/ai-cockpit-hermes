<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NGrid, NGi, NList, NListItem, NTag, NSpace, NText, NEmpty, NSpin } from 'naive-ui';
import { api } from '@/api/client';

interface TfsItem {
  id: string;
  title: string;
  status: string;
  due: string;
}
interface DashboardData {
  tfs?: { items: TfsItem[] };
}

const items = ref<TfsItem[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const d = await api.get<DashboardData>('/dashboard');
    items.value = d.tfs?.items ?? [];
  } finally {
    loading.value = false;
  }
}

function bucket(kind: 'req' | 'bug' | 'doing'): TfsItem[] {
  if (kind === 'bug') return items.value.filter((i) => /bug|缺陷/i.test(i.status) || /bug|缺陷/i.test(i.title));
  if (kind === 'doing') return items.value.filter((i) => /进行|开发/.test(i.status));
  return items.value.filter((i) => !/进行|开发|bug|缺陷/i.test(i.status));
}

onMounted(load);
</script>

<template>
  <div>
    <h2 style="margin-top: 0">TFS 研发工作台</h2>
    <NSpin :show="loading">
      <NGrid :cols="3" :x-gap="16" responsive="screen" item-responsive>
        <NGi v-for="col in [
          { key: 'req', title: '我的需求' },
          { key: 'doing', title: '进行中' },
          { key: 'bug', title: '我的 BUG' },
        ]" :key="col.key" span="3 m:1">
          <NCard :title="col.title" size="small">
            <NList v-if="bucket(col.key as 'req' | 'bug' | 'doing').length" hoverable>
              <NListItem v-for="it in bucket(col.key as 'req' | 'bug' | 'doing')" :key="it.id">
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
      提示:写操作(改状态等)请在对话抽屉用自然语言下达,危险操作会触发审批确认。
    </NText>
  </div>
</template>
