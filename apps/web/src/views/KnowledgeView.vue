<script setup lang="ts">
import { ref } from 'vue';
import { NInputGroup, NInput, NButton, NList, NListItem, NCard, NText, NEmpty, NSpin, useMessage } from 'naive-ui';
import { api } from '@/api/client';

interface NoteResult {
  title: string;
  path: string;
  excerpt: string;
}

const query = ref('');
const results = ref<NoteResult[]>([]);
const loading = ref(false);
const opening = ref<string | null>(null);
const searched = ref(false);
const message = useMessage();

async function search(): Promise<void> {
  if (!query.value.trim()) return;
  loading.value = true;
  searched.value = true;
  results.value = [];
  try {
    const d = await api.post<{ results: NoteResult[] }>('/knowledge/search', { query: query.value });
    results.value = d.results ?? [];
  } catch (e) {
    message.error('搜索失败：' + (e as Error).message);
  } finally {
    loading.value = false;
  }
}

async function openNote(note: NoteResult): Promise<void> {
  if (opening.value) return;
  opening.value = note.path;
  try {
    const res = await api.post<{ ok: boolean; opened: string; path: string }>('/knowledge/open', {
      path: note.path,
    });
    const via = res.opened === 'typora' ? 'Typora' : '系统默认程序';
    message.success(`已用 ${via} 打开`);
  } catch (e) {
    message.error('打开失败：' + (e as Error).message);
  } finally {
    opening.value = null;
  }
}
</script>

<template>
  <div>
    <h2 style="margin-top: 0">知识库(Obsidian)</h2>
    <NInputGroup style="max-width: 600px">
      <NInput v-model:value="query" placeholder="检索 SecondBrain Vault（标题/路径/正文）…" @keydown.enter="search" />
      <NButton type="primary" :loading="loading" @click="search">搜索</NButton>
    </NInputGroup>

    <NSpin :show="loading" style="margin-top: 16px">
      <NList v-if="results.length" hoverable clickable style="margin-top: 16px">
        <NListItem
          v-for="(r, i) in results"
          :key="i"
          :class="{ 'note-opening': opening === r.path }"
          @click="openNote(r)"
        >
          <NCard size="small" :title="r.title" style="cursor: pointer">
            <template #header-extra>
              <NText depth="3" style="font-size: 12px">{{ r.path }}</NText>
            </template>
            <NText depth="2">{{ r.excerpt }}</NText>
          </NCard>
        </NListItem>
      </NList>
      <NEmpty v-else-if="searched" description="无匹配笔记" style="margin-top: 24px" />
    </NSpin>
    <NText depth="3" style="display: block; margin-top: 12px; font-size: 12px">
      点击结果用 Typora 打开笔记（未安装时回退系统默认程序）。
    </NText>
  </div>
</template>

<style scoped>
.note-opening {
  opacity: 0.6;
}
</style>
