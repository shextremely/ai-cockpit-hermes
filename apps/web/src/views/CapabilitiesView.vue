<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NGrid, NGi, NTag, NSpace, NText, NEmpty, NSpin } from 'naive-ui';
import { api } from '@/api/client';
import { useCapabilitiesStore } from '@/stores/capabilities';

interface Skill {
  name: string;
  description?: string;
  category?: string;
}
interface Toolset {
  name: string;
  label?: string;
  enabled?: boolean;
  tools?: string[];
}

const caps = useCapabilitiesStore();
const skills = ref<Skill[]>([]);
const toolsets = ref<Toolset[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  await caps.load();
  try {
    skills.value = await api.get<Skill[]>('/skills');
  } catch {
    skills.value = [];
  }
  try {
    toolsets.value = await api.get<Toolset[]>('/toolsets');
  } catch {
    toolsets.value = [];
  }
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <div>
    <h2 style="margin-top: 0">能力面板</h2>
    <NSpin :show="loading">
      <NGrid :cols="2" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
        <NGi span="2 m:1">
          <NCard title="特性(/v1/capabilities)" size="small">
            <NSpace v-if="caps.caps?.features">
              <NTag
                v-for="(v, k) in caps.caps.features"
                :key="k"
                size="small"
                :type="v ? 'success' : 'default'"
              >
                {{ k }}: {{ v ? '是' : '否' }}
              </NTag>
            </NSpace>
            <NEmpty v-else description="未获取到能力信息" />
          </NCard>
        </NGi>
        <NGi span="2 m:1">
          <NCard title="工具集(/v1/toolsets)" size="small">
            <NSpace v-if="toolsets.length" vertical>
              <div v-for="t in toolsets" :key="t.name">
                <NTag size="small" :type="t.enabled ? 'success' : 'default'">{{ t.label || t.name }}</NTag>
                <NText depth="3" style="font-size: 12px; margin-left: 8px">
                  {{ (t.tools || []).slice(0, 6).join(', ') }}
                </NText>
              </div>
            </NSpace>
            <NEmpty v-else description="无" />
          </NCard>
        </NGi>
        <NGi span="2">
          <NCard title="技能(/v1/skills)" size="small">
            <NSpace v-if="skills.length" vertical>
              <div v-for="s in skills" :key="s.name">
                <NTag size="small" type="info">{{ s.name }}</NTag>
                <NText depth="3" style="font-size: 12px; margin-left: 8px">{{ s.description }}</NText>
              </div>
            </NSpace>
            <NEmpty v-else description="无" />
          </NCard>
        </NGi>
      </NGrid>
    </NSpin>
  </div>
</template>
