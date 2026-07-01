<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  NButton,
  NCard,
  NCheckbox,
  NDatePicker,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGi,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NStatistic,
  NSwitch,
  NTag,
  NText,
  NTabs,
  NTabPane,
  NProgress,
  useMessage,
} from 'naive-ui';
import { api } from '@/api/client';
import { useChatStore } from '@/stores/chat';

type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue';

interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt?: string;
  category?: string;
  subtasks: SubTask[];
  remindBefore: number;
  remindEnabled: boolean;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskStats {
  total: number;
  done: number;
  overdue: number;
  inProgress: number;
  todo: number;
  completionRate: number;
  byPriority: Record<TaskPriority, number>;
  byStatus: Record<TaskStatus, number>;
}

const PRIORITY_OPTIONS = [
  { label: '紧急', value: 'urgent' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

const STATUS_OPTIONS = [
  { label: '待办', value: 'todo' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'done' },
  { label: '已逾期', value: 'overdue' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: '#d03050',
  high: '#f0a020',
  medium: '#2080f0',
  low: '#909399',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  overdue: '已逾期',
};

const tasks = ref<TaskItem[]>([]);
const stats = ref<TaskStats | null>(null);
const loading = ref(false);
const viewMode = ref<'list' | 'chart'>('chart');
const quickText = ref('');
const imageParsing = ref(false);
const imagePreview = ref('');
const dragOver = ref(false);
const lastExtracted = ref('');
const ocrSuggestions = ref<{ text: string; confidence: number; reasons: string[] }[]>([]);
const showRawOcr = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const filterStatus = ref<TaskStatus[]>([]);
const filterPriority = ref<TaskPriority[]>([]);
const filterQ = ref('');
const showForm = ref(false);
const showSettings = ref(false);
const editing = ref<TaskItem | null>(null);
const newSubtask = ref('');
const message = useMessage();
const chat = useChatStore();

const form = reactive({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  status: 'todo' as TaskStatus,
  dueAt: null as number | null,
  category: '',
  remindEnabled: true,
  remindBefore: 60,
  subtasks: [] as SubTask[],
});

const settings = reactive({
  defaultRemindBefore: 60,
  sortBy: 'dueAt' as 'dueAt' | 'priority' | 'createdAt',
});

const filteredTasks = computed(() => {
  let list = tasks.value;
  if (filterStatus.value.length) {
    list = list.filter((t) => filterStatus.value.includes(t.status));
  }
  if (filterPriority.value.length) {
    list = list.filter((t) => filterPriority.value.includes(t.priority));
  }
  if (filterQ.value.trim()) {
    const q = filterQ.value.toLowerCase();
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }
  return list;
});

const priorityChartData = computed(() => {
  const data = stats.value?.byPriority ?? { urgent: 0, high: 0, medium: 0, low: 0 };
  const max = Math.max(...Object.values(data), 1);
  return (Object.keys(data) as TaskPriority[]).map((k) => ({
    key: k,
    label: PRIORITY_LABELS[k],
    value: data[k],
    pct: Math.round((data[k] / max) * 100),
    color: PRIORITY_COLORS[k],
  }));
});

const statusChartData = computed(() => {
  const data = stats.value?.byStatus ?? { todo: 0, in_progress: 0, done: 0, overdue: 0 };
  const max = Math.max(...Object.values(data), 1);
  const colors: Record<TaskStatus, string> = {
    todo: '#909399',
    in_progress: '#2080f0',
    done: '#18a058',
    overdue: '#d03050',
  };
  return (Object.keys(data) as TaskStatus[]).map((k) => ({
    key: k,
    label: STATUS_LABELS[k],
    value: data[k],
    pct: Math.round((data[k] / max) * 100),
    color: colors[k],
  }));
});

const upcomingTasks = computed(() =>
  [...tasks.value]
    .filter((t) => t.status !== 'done' && t.dueAt)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
    .slice(0, 8),
);

const hasQuickEntryContent = computed(
  () =>
    Boolean(quickText.value.trim()) ||
    Boolean(imagePreview.value) ||
    Boolean(lastExtracted.value) ||
    ocrSuggestions.value.length > 0,
);

function statusType(s: TaskStatus): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (s === 'overdue') return 'error';
  if (s === 'in_progress') return 'info';
  if (s === 'done') return 'success';
  return 'default';
}

function formatDue(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterStatus.value.length) params.set('status', filterStatus.value.join(','));
    if (filterPriority.value.length) params.set('priority', filterPriority.value.join(','));
    if (filterQ.value.trim()) params.set('q', filterQ.value.trim());
    const qs = params.toString();
    const [listRes, statsRes, settingsRes] = await Promise.all([
      api.get<{ tasks: TaskItem[] }>(`/tasks${qs ? `?${qs}` : ''}`),
      api.get<TaskStats>('/tasks/stats?days=30'),
      api.get<typeof settings>('/tasks/settings'),
    ]);
    tasks.value = listRes.tasks;
    stats.value = statsRes;
    Object.assign(settings, settingsRes);
  } catch (e) {
    message.error('加载失败：' + (e as Error).message);
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  form.title = '';
  form.description = '';
  form.priority = 'medium';
  form.status = 'todo';
  form.dueAt = null;
  form.category = '';
  form.remindEnabled = true;
  form.remindBefore = settings.defaultRemindBefore;
  form.subtasks = [];
  newSubtask.value = '';
  editing.value = null;
}

function openCreate(): void {
  resetForm();
  showForm.value = true;
}

function openEdit(task: TaskItem): void {
  editing.value = task;
  form.title = task.title;
  form.description = task.description ?? '';
  form.priority = task.priority;
  form.status = task.status;
  form.dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null;
  form.category = task.category ?? '';
  form.remindEnabled = task.remindEnabled;
  form.remindBefore = task.remindBefore;
  form.subtasks = [...task.subtasks];
  showForm.value = true;
}

async function saveForm(): Promise<void> {
  if (!form.title.trim()) {
    message.warning('请填写事项标题');
    return;
  }
  const body = {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    priority: form.priority,
    status: form.status,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
    category: form.category.trim() || undefined,
    remindEnabled: form.remindEnabled,
    remindBefore: form.remindBefore,
    subtasks: form.subtasks,
  };
  try {
    if (editing.value) {
      await api.patch(`/tasks/${editing.value.id}`, body);
      message.success('已更新');
    } else {
      await api.post('/tasks', body);
      message.success('已创建');
    }
    showForm.value = false;
    resetForm();
    await load();
  } catch (e) {
    message.error('保存失败：' + (e as Error).message);
  }
}

async function quickAdd(): Promise<void> {
  const text = quickText.value.trim();
  if (!text) return;
  try {
    await api.post('/tasks/from-text', { text });
    quickText.value = '';
    message.success('已从文本识别并创建事项');
    await load();
  } catch (e) {
    message.error('录入失败：' + (e as Error).message);
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

async function handleImageFile(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) {
    message.warning('请粘贴或上传图片文件');
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    message.warning('图片过大，请使用 6MB 以内的截图');
    return;
  }
  imageParsing.value = true;
  lastExtracted.value = '';
  ocrSuggestions.value = [];
  try {
    const dataUrl = await readFileAsDataUrl(file);
    imagePreview.value = dataUrl;
    const res = await api.post<{
      count: number;
      extracted: { rawText: string; items: string[]; scene?: string };
      suggestions: { text: string; confidence: number; reasons: string[] }[];
    }>('/tasks/from-image', { image: dataUrl, mimeType: file.type });
    lastExtracted.value = res.extracted.rawText;
    ocrSuggestions.value = res.suggestions?.length
      ? res.suggestions
      : (res.extracted.items?.length ? res.extracted.items : res.extracted.rawText.split(/\n+/).filter(Boolean)).map(
          (text) => ({ text, confidence: 50, reasons: [] as string[] }),
        );
    if (ocrSuggestions.value.length) {
      message.success(`识别到 ${ocrSuggestions.value.length} 条候选，请点击选择后手动提交`);
    } else {
      message.warning('未识别到有效待办，请改用手动输入');
    }
  } catch (e) {
    message.error('图片识别失败：' + (e as Error).message);
  } finally {
    imageParsing.value = false;
  }
}

function applyOcrSuggestion(text: string): void {
  quickText.value = text;
  message.info('已填入录入框，确认后点击「文本录入」');
}

function onPaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) void handleImageFile(file);
      return;
    }
  }
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleImageFile(file);
}

function onDragOver(e: DragEvent): void {
  e.preventDefault();
  dragOver.value = true;
}

function onDragLeave(): void {
  dragOver.value = false;
}

function pickImage(): void {
  fileInputRef.value?.click();
}

function onFileChange(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) void handleImageFile(file);
  (e.target as HTMLInputElement).value = '';
}

function clearQuickEntry(): void {
  quickText.value = '';
  imagePreview.value = '';
  lastExtracted.value = '';
  ocrSuggestions.value = [];
  showRawOcr.value = false;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

async function changeStatus(task: TaskItem, status: TaskStatus): Promise<void> {
  try {
    await api.patch(`/tasks/${task.id}`, { status });
    await load();
  } catch (e) {
    message.error('更新失败：' + (e as Error).message);
  }
}

async function removeTask(task: TaskItem): Promise<void> {
  try {
    await api.del(`/tasks/${task.id}`);
    message.success('已删除');
    await load();
  } catch (e) {
    message.error('删除失败：' + (e as Error).message);
  }
}

function addSubtaskToForm(): void {
  const title = newSubtask.value.trim();
  if (!title) return;
  form.subtasks.push({ id: crypto.randomUUID(), title, done: false });
  newSubtask.value = '';
}

async function saveSettings(): Promise<void> {
  try {
    await api.patch('/tasks/settings', { ...settings });
    message.success('设置已保存');
    showSettings.value = false;
    await load();
  } catch (e) {
    message.error('保存失败：' + (e as Error).message);
  }
}

async function askInChat(): Promise<void> {
  const summary = tasks.value
    .filter((t) => t.status !== 'done')
    .slice(0, 10)
    .map((t) => `- [${PRIORITY_LABELS[t.priority]}] ${t.title}（${STATUS_LABELS[t.status]}）`)
    .join('\n');
  await chat.send(
    `以下是我的待办事项，请帮我分析优先级并给出今日工作建议：\n${summary || '（暂无待办）'}`,
    { backend: 'claude', openDrawer: true },
  );
}

onMounted(load);
</script>

<template>
  <div>
    <h2 style="margin-top: 0">事项管理</h2>
    <NSpace justify="space-between" align="center" style="margin-bottom: 16px">
      <NText depth="3" style="font-size: 13px">
        多形式录入 · 优先级/状态管控 · 子任务 · 可视化 · AI 辅助（对话抽屉）
      </NText>
      <NSpace>
        <NButton size="small" @click="showSettings = true">提醒设置</NButton>
        <NButton size="small" @click="askInChat">AI 工作规划</NButton>
        <NButton type="primary" size="small" @click="openCreate">手动录入</NButton>
      </NSpace>
    </NSpace>

    <NSpin :show="loading">
      <NGrid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" item-responsive style="margin-bottom: 16px">
        <NGi span="4 m:1">
          <NCard size="small"><NStatistic label="近30天事项" :value="stats?.total ?? 0" /></NCard>
        </NGi>
        <NGi span="4 m:1">
          <NCard size="small"><NStatistic label="完成率" :value="`${stats?.completionRate ?? 0}%`" /></NCard>
        </NGi>
        <NGi span="4 m:1">
          <NCard size="small"><NStatistic label="进行中" :value="stats?.inProgress ?? 0" /></NCard>
        </NGi>
        <NGi span="4 m:1">
          <NCard size="small">
            <NStatistic label="已逾期" :value="stats?.overdue ?? 0">
              <template #prefix>
                <span v-if="(stats?.overdue ?? 0) > 0" style="color: #d03050">⚠ </span>
              </template>
            </NStatistic>
          </NCard>
        </NGi>
      </NGrid>

      <NCard size="small" title="快速录入（自然语言 / 截图）" style="margin-bottom: 16px">
        <div
          class="quick-entry-zone"
          :class="{ 'quick-entry-zone--drag': dragOver, 'quick-entry-zone--busy': imageParsing }"
          @paste="onPaste"
          @drop="onDrop"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
        >
          <NSpace vertical size="small">
            <NInput
              v-model:value="quickText"
              type="textarea"
              placeholder="输入自然语言，或直接 Ctrl+V 粘贴截图、拖拽图片到此处"
              :autosize="{ minRows: 2, maxRows: 4 }"
              :disabled="imageParsing"
              @keydown.ctrl.enter="quickAdd"
            />
            <div v-if="imagePreview" class="image-preview">
              <img :src="imagePreview" alt="粘贴的截图" />
            </div>
            <div v-if="ocrSuggestions.length" class="ocr-result">
              <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                识别候选（按置信度排序，点击填入录入框，需手动提交）：
              </NText>
              <div class="ocr-suggestion-list">
                <button
                  v-for="(item, idx) in ocrSuggestions"
                  :key="idx"
                  type="button"
                  class="ocr-suggestion-item"
                  :class="{ 'ocr-suggestion-item--top': idx === 0 }"
                  @click="applyOcrSuggestion(item.text)"
                >
                  <span class="ocr-suggestion-confidence">{{ item.confidence }}%</span>
                  <span class="ocr-suggestion-text">{{ item.text }}</span>
                </button>
              </div>
            </div>
            <NButton
              v-if="lastExtracted"
              text
              size="tiny"
              style="font-size: 12px"
              @click="showRawOcr = !showRawOcr"
            >
              {{ showRawOcr ? '收起' : '查看' }} OCR 原文
            </NButton>
            <pre v-if="showRawOcr && lastExtracted" class="ocr-raw">{{ lastExtracted }}</pre>
            <NSpace justify="space-between" align="center">
              <NText depth="3" style="font-size: 12px">
                截图仅识别候选，不自动建待办 · 文本支持截止时间、优先级、[分类] · Ctrl+Enter 提交
              </NText>
              <NSpace>
                <input ref="fileInputRef" type="file" accept="image/*" hidden @change="onFileChange" />
                <NButton
                  size="small"
                  :disabled="!hasQuickEntryContent || imageParsing"
                  @click="clearQuickEntry"
                >
                  清空
                </NButton>
                <NButton size="small" :loading="imageParsing" :disabled="imageParsing" @click="pickImage">
                  上传截图
                </NButton>
                <NButton type="primary" size="small" :disabled="!quickText.trim() || imageParsing" @click="quickAdd">
                  文本录入
                </NButton>
              </NSpace>
            </NSpace>
          </NSpace>
        </div>
      </NCard>

      <NSpace align="center" style="margin-bottom: 12px" :wrap="true">
        <NInput v-model:value="filterQ" placeholder="搜索事项…" size="small" style="width: 180px" clearable @keyup.enter="load" />
        <NSelect
          v-model:value="filterStatus"
          :options="STATUS_OPTIONS"
          placeholder="状态筛选"
          size="small"
          style="width: 140px"
          multiple
          clearable
          @update:value="load"
        />
        <NSelect
          v-model:value="filterPriority"
          :options="PRIORITY_OPTIONS"
          placeholder="优先级筛选"
          size="small"
          style="width: 140px"
          multiple
          clearable
          @update:value="load"
        />
        <NButton size="small" @click="load">刷新</NButton>
        <div style="flex: 1" />
        <NTabs v-model:value="viewMode" type="segment" size="small" style="width: 160px">
          <NTabPane name="chart" tab="图表" />
          <NTabPane name="list" tab="列表" />
        </NTabs>
      </NSpace>

      <NGrid v-if="viewMode === 'chart'" :cols="2" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
        <NGi span="2 m:1">
          <NCard size="small" title="优先级分布">
            <div v-for="row in priorityChartData" :key="row.key" style="margin-bottom: 10px">
              <NSpace justify="space-between" style="margin-bottom: 4px">
                <NTag size="small" :color="{ color: row.color + '22', textColor: row.color, borderColor: row.color }">
                  {{ row.label }}
                </NTag>
                <NText depth="3" style="font-size: 12px">{{ row.value }}</NText>
              </NSpace>
              <NProgress type="line" :percentage="row.pct" :color="row.color" :show-indicator="false" />
            </div>
          </NCard>
        </NGi>
        <NGi span="2 m:1">
          <NCard size="small" title="状态分布">
            <div v-for="row in statusChartData" :key="row.key" style="margin-bottom: 10px">
              <NSpace justify="space-between" style="margin-bottom: 4px">
                <NText>{{ row.label }}</NText>
                <NText depth="3" style="font-size: 12px">{{ row.value }}</NText>
              </NSpace>
              <NProgress type="line" :percentage="row.pct" :color="row.color" :show-indicator="false" />
            </div>
          </NCard>
        </NGi>
        <NGi span="2">
          <NCard size="small" title="时间轴（即将到期）">
            <div v-if="upcomingTasks.length" class="timeline">
              <div v-for="t in upcomingTasks" :key="t.id" class="timeline-item">
                <div class="timeline-dot" :style="{ background: PRIORITY_COLORS[t.priority] }" />
                <div class="timeline-body">
                  <NText>{{ t.title }}</NText>
                  <NSpace size="small" style="margin-top: 4px">
                    <NTag size="tiny" :type="statusType(t.status)">{{ STATUS_LABELS[t.status] }}</NTag>
                    <NText depth="3" style="font-size: 12px">{{ formatDue(t.dueAt) }}</NText>
                  </NSpace>
                </div>
              </div>
            </div>
            <NEmpty v-else description="暂无即将到期事项" />
          </NCard>
        </NGi>
      </NGrid>

      <NCard v-else size="small" title="事项列表">
        <div v-if="filteredTasks.length" class="task-list">
          <div v-for="task in filteredTasks" :key="task.id" class="task-row">
            <NSpace align="center" :wrap="false" style="width: 100%">
              <NTag
                size="small"
                :color="{ color: PRIORITY_COLORS[task.priority] + '22', textColor: PRIORITY_COLORS[task.priority], borderColor: PRIORITY_COLORS[task.priority] }"
              >
                {{ PRIORITY_LABELS[task.priority] }}
              </NTag>
              <div style="flex: 1; min-width: 0">
                <NText>{{ task.title }}</NText>
                <NText v-if="task.description" depth="3" style="display: block; font-size: 12px; margin-top: 2px">
                  {{ task.description }}
                </NText>
                <NSpace v-if="task.subtasks.length" size="small" style="margin-top: 6px">
                  <NTag v-for="st in task.subtasks" :key="st.id" size="tiny" :type="st.done ? 'success' : 'default'">
                    {{ st.done ? '✓' : '○' }} {{ st.title }}
                  </NTag>
                </NSpace>
              </div>
              <NTag size="small" :type="statusType(task.status)">{{ STATUS_LABELS[task.status] }}</NTag>
              <NText depth="3" style="font-size: 12px; white-space: nowrap">{{ formatDue(task.dueAt) }}</NText>
              <NSpace size="small">
                <NButton v-if="task.status === 'todo'" text size="tiny" @click="changeStatus(task, 'in_progress')">开始</NButton>
                <NButton v-if="task.status !== 'done'" text size="tiny" type="success" @click="changeStatus(task, 'done')">完成</NButton>
                <NButton text size="tiny" @click="openEdit(task)">编辑</NButton>
                <NButton text size="tiny" type="error" @click="removeTask(task)">删除</NButton>
              </NSpace>
            </NSpace>
          </div>
        </div>
        <NEmpty v-else description="暂无事项，试试上方快速录入" />
      </NCard>
    </NSpin>

    <NModal v-model:show="showForm" preset="card" :title="editing ? '编辑事项' : '手动录入'" style="max-width: 560px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="标题" required>
          <NInput v-model:value="form.title" placeholder="事项标题" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="form.description" type="textarea" placeholder="补充说明（可选）" />
        </NFormItem>
        <NFormItem label="优先级">
          <NSelect v-model:value="form.priority" :options="PRIORITY_OPTIONS" />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect v-model:value="form.status" :options="STATUS_OPTIONS" />
        </NFormItem>
        <NFormItem label="截止时间">
          <NDatePicker v-model:value="form.dueAt" type="datetime" clearable style="width: 100%" />
        </NFormItem>
        <NFormItem label="分类">
          <NInput v-model:value="form.category" placeholder="如：工作、学习" />
        </NFormItem>
        <NFormItem label="提醒">
          <NSpace align="center">
            <NSwitch v-model:value="form.remindEnabled" />
            <NText depth="3" style="font-size: 12px">提前 {{ form.remindBefore }} 分钟</NText>
            <NInputNumber v-model:value="form.remindBefore" size="small" style="width: 100px" :min="0" />
          </NSpace>
        </NFormItem>
        <NFormItem label="子任务">
          <NSpace vertical style="width: 100%">
            <div v-for="(st, idx) in form.subtasks" :key="st.id">
              <NSpace align="center">
                <NCheckbox v-model:checked="st.done" />
                <NInput v-model:value="st.title" size="small" style="flex: 1" />
                <NButton text type="error" size="tiny" @click="form.subtasks.splice(idx, 1)">删</NButton>
              </NSpace>
            </div>
            <NSpace>
              <NInput v-model:value="newSubtask" size="small" placeholder="子任务标题" style="width: 200px" @keyup.enter="addSubtaskToForm" />
              <NButton size="small" @click="addSubtaskToForm">添加</NButton>
            </NSpace>
          </NSpace>
        </NFormItem>
      </NForm>
      <NSpace justify="end">
        <NButton @click="showForm = false">取消</NButton>
        <NButton type="primary" @click="saveForm">保存</NButton>
      </NSpace>
    </NModal>

    <NModal v-model:show="showSettings" preset="card" title="提醒与显示设置" style="max-width: 420px">
      <NForm label-placement="left" label-width="120">
        <NFormItem label="默认提前提醒">
          <NInputNumber v-model:value="settings.defaultRemindBefore" :min="0" style="width: 100%">
            <template #suffix>分钟</template>
          </NInputNumber>
        </NFormItem>
        <NFormItem label="列表排序">
          <NSelect
            v-model:value="settings.sortBy"
            :options="[
              { label: '按截止时间', value: 'dueAt' },
              { label: '按优先级', value: 'priority' },
              { label: '按创建时间', value: 'createdAt' },
            ]"
          />
        </NFormItem>
      </NForm>
      <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 12px">
        系统通知、微信提醒等通道将在后续版本对接；当前逾期事项会在列表中自动标记并高亮。
      </NText>
      <NSpace justify="end">
        <NButton @click="showSettings = false">取消</NButton>
        <NButton type="primary" @click="saveSettings">保存</NButton>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-row {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: background 0.15s;
}
.task-row:hover {
  background: rgba(255, 255, 255, 0.04);
}
.timeline {
  position: relative;
  padding-left: 20px;
}
.timeline-item {
  position: relative;
  padding-bottom: 16px;
  padding-left: 16px;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
}
.timeline-item:last-child {
  border-left-color: transparent;
  padding-bottom: 0;
}
.timeline-dot {
  position: absolute;
  left: -7px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.timeline-body {
  margin-top: -2px;
}
.quick-entry-zone {
  border-radius: 8px;
  padding: 4px;
  transition: background 0.15s, outline 0.15s;
}
.quick-entry-zone--drag {
  background: rgba(32, 128, 240, 0.08);
  outline: 2px dashed rgba(32, 128, 240, 0.5);
}
.quick-entry-zone--busy {
  opacity: 0.85;
  pointer-events: none;
}
.image-preview {
  position: relative;
  display: inline-block;
  max-width: 100%;
}
.image-preview img {
  max-height: 160px;
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.ocr-result {
  padding: 8px 0 4px;
}
.ocr-suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ocr-suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.ocr-suggestion-item:hover {
  background: rgba(32, 128, 240, 0.12);
  border-color: rgba(32, 128, 240, 0.35);
}
.ocr-suggestion-item--top {
  border-color: rgba(24, 160, 88, 0.35);
  background: rgba(24, 160, 88, 0.08);
}
.ocr-suggestion-confidence {
  flex-shrink: 0;
  min-width: 36px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
}
.ocr-suggestion-text {
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}
.ocr-raw {
  margin: 6px 0 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  max-height: 160px;
  overflow: auto;
}
</style>
