<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  NButton,
  NCard,
  NList,
  NListItem,
  NSpace,
  NTag,
  NText,
  NEmpty,
  NSpin,
  NModal,
  NForm,
  NFormItem,
  NInput,
  useMessage,
} from 'naive-ui';
import { api } from '@/api/client';

interface Job {
  id?: string;
  job_id?: string;
  prompt?: string;
  schedule?: string;
  status?: string;
  paused?: boolean;
}

const jobs = ref<Job[]>([]);
const loading = ref(false);
const showCreate = ref(false);
const form = ref({ prompt: '', schedule: '' });
const message = useMessage();

function jid(j: Job): string {
  return j.id ?? j.job_id ?? '';
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const d = await api.get<Job[] | { jobs: Job[] }>('/jobs');
    jobs.value = Array.isArray(d) ? d : (d.jobs ?? []);
  } catch (e) {
    message.error('加载失败:' + (e as Error).message);
  } finally {
    loading.value = false;
  }
}

async function create(): Promise<void> {
  if (!form.value.prompt || !form.value.schedule) {
    message.warning('请填写提示词与计划(cron)');
    return;
  }
  try {
    await api.post('/jobs', { prompt: form.value.prompt, schedule: form.value.schedule });
    showCreate.value = false;
    form.value = { prompt: '', schedule: '' };
    await load();
    message.success('已创建定时任务');
  } catch (e) {
    message.error('创建失败:' + (e as Error).message);
  }
}

async function act(j: Job, action: 'pause' | 'resume' | 'run' | 'delete'): Promise<void> {
  try {
    if (action === 'delete') await api.del(`/jobs/${encodeURIComponent(jid(j))}`);
    else await api.post(`/jobs/${encodeURIComponent(jid(j))}/${action}`);
    await load();
  } catch (e) {
    message.error('操作失败:' + (e as Error).message);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <NSpace justify="space-between" align="center">
      <h2 style="margin: 0">日程待办 / 定时任务</h2>
      <NButton type="primary" size="small" @click="showCreate = true">新建定时任务</NButton>
    </NSpace>

    <NSpin :show="loading" style="margin-top: 16px">
      <NCard size="small" title="定时任务(Hermes Jobs)" style="margin-top: 16px">
        <NList v-if="jobs.length" hoverable>
          <NListItem v-for="j in jobs" :key="jid(j)">
            <NSpace vertical size="small" style="width: 100%">
              <NText>{{ j.prompt || '(无提示词)' }}</NText>
              <NSpace align="center">
                <NTag size="small" :bordered="false">{{ j.schedule || '—' }}</NTag>
                <NTag size="small" :type="j.paused ? 'warning' : 'success'">
                  {{ j.paused ? '已暂停' : (j.status || '启用') }}
                </NTag>
                <NButton text size="tiny" @click="act(j, 'run')">立即执行</NButton>
                <NButton text size="tiny" @click="act(j, j.paused ? 'resume' : 'pause')">
                  {{ j.paused ? '恢复' : '暂停' }}
                </NButton>
                <NButton text size="tiny" type="error" @click="act(j, 'delete')">删除</NButton>
              </NSpace>
            </NSpace>
          </NListItem>
        </NList>
        <NEmpty v-else description="暂无定时任务(或 Hermes Jobs 不可用)" />
      </NCard>
    </NSpin>

    <NModal v-model:show="showCreate" preset="card" title="新建定时任务" style="max-width: 520px">
      <NForm>
        <NFormItem label="提示词(让 Hermes 做什么)">
          <NInput
            v-model:value="form.prompt"
            type="textarea"
            placeholder="例:拉取我今天的超期 TFS 需求并生成提醒摘要"
          />
        </NFormItem>
        <NFormItem label="计划(cron 表达式)">
          <NInput v-model:value="form.schedule" placeholder="例:0 9 * * 1-5(工作日 9 点)" />
        </NFormItem>
      </NForm>
      <NSpace justify="end">
        <NButton @click="showCreate = false">取消</NButton>
        <NButton type="primary" @click="create">创建</NButton>
      </NSpace>
    </NModal>
  </div>
</template>
