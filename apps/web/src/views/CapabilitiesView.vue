<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import {
  NCard,
  NDataTable,
  NButton,
  NModal,
  NInput,
  NForm,
  NFormItem,
  NEmpty,
  NSpin,
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import { api } from '@/api/client';
import { useChatStore } from '@/stores/chat';

interface SkillRow {
  name: string;
  label: string;
  description: string;
  needInput: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  defaultMessage: string;
  engine: 'claude' | 'hermes';
}

interface ListResp {
  data?: SkillRow[];
  path?: string;
}

const skills = ref<SkillRow[]>([]);
const skillsPath = ref('');
const loading = ref(false);
const triggering = ref(false);
const showInput = ref(false);
const inputValue = ref('');
const activeSkill = ref<SkillRow | null>(null);
const chat = useChatStore();
const message = useMessage();

const columns: DataTableColumns<SkillRow> = [
  { title: '技能', key: 'label', width: 160 },
  { title: '标识', key: 'name', width: 220, ellipsis: { tooltip: true } },
  {
    title: '说明',
    key: 'description',
    ellipsis: { tooltip: true },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      return h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          loading: triggering.value && activeSkill.value?.name === row.name,
          onClick: (e: Event) => {
            e.stopPropagation();
            onTrigger(row);
          },
        },
        () => '触发',
      );
    },
  },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const raw = await api.get<ListResp>('/skills');
    skills.value = raw.data ?? [];
    skillsPath.value = raw.path ?? '';
  } catch (e) {
    skills.value = [];
    message.error('加载技能失败：' + (e as Error).message);
  } finally {
    loading.value = false;
  }
}

function onTrigger(row: SkillRow): void {
  if (chat.sending) {
    message.info('已有任务执行中，请稍候');
    return;
  }
  activeSkill.value = row;
  if (row.needInput) {
    inputValue.value = '';
    showInput.value = true;
    return;
  }
  void runSkill(row);
}

async function confirmInput(): Promise<boolean> {
  if (!activeSkill.value) return false;
  const text = inputValue.value.trim();
  if (!text) {
    message.warning(`请填写${activeSkill.value.inputLabel ?? '参数'}`);
    return false;
  }
  showInput.value = false;
  await runSkill(activeSkill.value, text);
  return true;
}

async function runSkill(row: SkillRow, input?: string): Promise<void> {
  if (chat.sending) return;
  const userMsg = row.defaultMessage.replace('{input}', input ?? '').trim();
  triggering.value = true;
  try {
    await chat.send(userMsg, { backend: row.engine, openDrawer: true });
  } catch (e) {
    message.error('触发失败：' + (e as Error).message);
  } finally {
    triggering.value = false;
    activeSkill.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h2 style="margin-top: 0">能力面板</h2>
    <NSpin :show="loading">
      <NCard title="技能" size="small">
        <NText v-if="skillsPath" depth="3" style="display: block; font-size: 12px; margin-bottom: 12px">
          来源：{{ skillsPath }}
        </NText>
        <NDataTable
          v-if="skills.length"
          :columns="columns"
          :data="skills"
          :bordered="false"
          :row-key="(row: SkillRow) => row.name"
          size="small"
          :row-props="(row: SkillRow) => ({ style: 'cursor: pointer', onClick: () => onTrigger(row) })"
        />
        <NEmpty v-else description="无可用技能" />
      </NCard>
    </NSpin>
    <NText depth="3" style="display: block; margin-top: 12px; font-size: 12px">
      点击行或「触发」按钮，将在对话抽屉中通过 Claude Code 加载对应技能并执行。
    </NText>

    <NModal
      v-model:show="showInput"
      preset="dialog"
      :title="activeSkill ? `触发：${activeSkill.label}` : '触发技能'"
      positive-text="开始"
      negative-text="取消"
      @positive-click="confirmInput"
    >
      <NForm v-if="activeSkill" label-placement="top">
        <NFormItem :label="activeSkill.inputLabel ?? '参数'">
          <NInput
            v-model:value="inputValue"
            :placeholder="activeSkill.inputPlaceholder"
            @keydown.enter.prevent="confirmInput"
          />
        </NFormItem>
      </NForm>
    </NModal>
  </div>
</template>
