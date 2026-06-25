<script setup lang="ts">
import { ref } from 'vue';
import { NInputGroup, NInput, NButton, NList, NListItem, NCard, NText, NEmpty, NSpin } from 'naive-ui';
import { api } from '@/api/client';

interface NoteResult {
  title: string;
  path: string;
  excerpt: string;
}

const query = ref('');
const results = ref<NoteResult[]>([]);
const loading = ref(false);
const searched = ref(false);

async function search(): Promise<void> {
  if (!query.value.trim()) return;
  loading.value = true;
  searched.value = true;
  try {
    const d = await api.post<{ results: NoteResult[] }>('/knowledge/search', { query: query.value });
    results.value = d.results ?? [];
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <h2 style="margin-top: 0">知识库(Obsidian)</h2>
    <NInputGroup style="max-width: 600px">
      <NInput v-model:value="query" placeholder="语义检索 SecondBrain Vault…" @keydown.enter="search" />
      <NButton type="primary" :loading="loading" @click="search">搜索</NButton>
    </NInputGroup>

    <NSpin :show="loading" style="margin-top: 16px">
      <NList v-if="results.length" hoverable clickable style="margin-top: 16px">
        <NListItem v-for="(r, i) in results" :key="i">
          <NCard size="small" :title="r.title">
            <template #header-extra>
              <NText depth="3" style="font-size: 12px">{{ r.path }}</NText>
            </template>
            <NText depth="2">{{ r.excerpt }}</NText>
          </NCard>
        </NListItem>
      </NList>
      <NEmpty v-else-if="searched" description="无结果(或 Obsidian MCP 未就绪)" style="margin-top: 24px" />
    </NSpin>
  </div>
</template>
