<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
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

interface SkillInputField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

interface SkillRow {
  name: string;
  label: string;
  description: string;
  needInput: boolean;
  inputType: 'none' | 'single' | 'trace';
  inputFields?: SkillInputField[];
  inputLabel?: string;
  inputPlaceholder?: string;
  defaultMessage: string;
  engine: 'claude' | 'hermes';
  triggerMode: 'chat' | 'cursor';
  cursorRepo?: string;
}

interface ListResp {
  data?: SkillRow[];
  path?: string;
}

interface TriggerResp {
  mode: 'chat' | 'cursor';
  ok: boolean;
  message: string;
  engine?: 'claude' | 'hermes';
  repo?: string;
  hint?: string;
}

const skills = ref<SkillRow[]>([]);
const skillsPath = ref('');
const loading = ref(false);
const triggering = ref(false);
const showInput = ref(false);
const inputValue = ref('');
const traceInput = reactive<Record<string, string>>({});
const activeSkill = ref<SkillRow | null>(null);
const chat = useChatStore();
const message = useMessage();

const isTraceForm = computed(() => activeSkill.value?.inputType === 'trace');

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

function resetForm(): void {
  inputValue.value = '';
  for (const key of Object.keys(traceInput)) {
    delete traceInput[key];
  }
}

function onTrigger(row: SkillRow): void {
  if (triggering.value) {
    message.info('已有任务执行中，请稍候');
    return;
  }
  if (row.triggerMode === 'chat' && chat.sending) {
    message.info('已有任务执行中，请稍候');
    return;
  }
  activeSkill.value = row;
  resetForm();
  if (row.needInput) {
    if (row.inputType === 'trace' && row.inputFields) {
      for (const field of row.inputFields) {
        traceInput[field.key] = '';
      }
    }
    showInput.value = true;
    return;
  }
  void executeTrigger(row, {});
}

function collectInput(): Record<string, string> {
  const row = activeSkill.value;
  if (!row) return {};
  if (row.inputType === 'trace') {
    return { ...traceInput };
  }
  return { input: inputValue.value.trim() };
}

function validateLocalInput(): boolean {
  const row = activeSkill.value;
  if (!row?.needInput) return true;

  if (row.inputType === 'trace' && row.inputFields) {
    for (const field of row.inputFields) {
      if (field.required && !traceInput[field.key]?.trim()) {
        message.warning(`请填写${field.label}`);
        return false;
      }
    }
    return true;
  }

  if (!inputValue.value.trim()) {
    message.warning(`请填写${row.inputLabel ?? '参数'}`);
    return false;
  }
  return true;
}

async function confirmInput(): Promise<boolean> {
  if (!activeSkill.value || !validateLocalInput()) return false;
  showInput.value = false;
  await executeTrigger(activeSkill.value, collectInput());
  return true;
}

async function executeTrigger(row: SkillRow, input: Record<string, string>): Promise<void> {
  triggering.value = true;
  try {
    const result = await api.post<TriggerResp>('/skills/trigger', { name: row.name, input });
    if (result.mode === 'cursor') {
      message.success(result.hint ?? `已在 Cursor 打开 ${result.repo ?? ''}`);
      return;
    }
    if (chat.sending) {
      message.info('已有任务执行中，请稍候');
      return;
    }
    await chat.send(result.message, { backend: result.engine ?? row.engine, openDrawer: true });
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
        />
        <NEmpty v-else description="无可用技能" />
      </NCard>
    </NSpin>
    <NText depth="3" style="display: block; margin-top: 12px; font-size: 12px">
      点击「触发」按钮执行技能。部分技能会在 Cursor 中打开并新建 Agent 会话；其余在对话抽屉中执行。
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
        <template v-if="isTraceForm">
          <NFormItem
            v-for="field in activeSkill.inputFields"
            :key="field.key"
            :label="field.label + (field.required ? '' : '（可选）')"
          >
            <NInput
              v-model:value="traceInput[field.key]"
              :placeholder="field.placeholder"
              @keydown.enter.prevent="confirmInput"
            />
          </NFormItem>
        </template>
        <NFormItem v-else :label="activeSkill.inputLabel ?? '参数'">
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
