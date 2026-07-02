<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import {
  NModal,
  NTag,
  NText,
  NDataTable,
  NButton,
  NSpace,
  NSpin,
  NEmpty,
  NStatistic,
  NGrid,
  NGi,
  type DataTableColumns,
} from 'naive-ui';
import { api } from '@/api/client';

interface PriorityRow {
  level: string;
  label: string;
  total: number;
  fulfilled: number;
  notFulfilled: number;
  rate: number;
}

interface AssigneeRow {
  assignee: string;
  displayName: string;
  total: number;
  fulfilled: number;
  notFulfilled: number;
  rate: number;
}

interface BaselineItem {
  id: string;
  title: string;
  created: string;
  deadline: string;
  overdueDays: number;
  priorityLabel: string;
  priority: string;
  assignee: string;
  assigneeDisplay: string;
  status: string;
}

interface BaselineData {
  team?: string;
  project?: string;
  rate?: number;
  fulfilled?: number;
  notFulfilled?: number;
  evaluable?: number;
  pending?: number;
  excludedL4?: number;
  lookbackDays?: number;
  startDate?: string;
  byPriority?: PriorityRow[];
  byAssignee?: AssigneeRow[];
  notFulfilledItems?: BaselineItem[];
}

const TFS_ITEM_URL =
  'http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0/WiNEX-BasicInfoService/_workitems/edit/';

const show = defineModel<boolean>('show', { default: false });

const loading = ref(false);
const error = ref('');
const data = ref<BaselineData | null>(null);
const selectedAssignee = ref<string | null>(null);
const detailCollapsed = ref(false);

const assigneeRows = computed(() => data.value?.byAssignee ?? []);

const selectedAssigneeRow = computed(() =>
  assigneeRows.value.find((r) => r.assignee === selectedAssignee.value),
);

const detailItems = computed(() => {
  const items = data.value?.notFulfilledItems ?? [];
  if (!selectedAssignee.value) return items;
  return items.filter((it) => it.assignee === selectedAssignee.value);
});

const priorityColumns: DataTableColumns<PriorityRow> = [
  { title: '优先级', key: 'label', width: 80 },
  { title: '样本数', key: 'total', width: 80 },
  { title: '履约', key: 'fulfilled', width: 70 },
  { title: '未履约', key: 'notFulfilled', width: 80 },
  {
    title: '履约率',
    key: 'rate',
    width: 90,
    render: (row) => `${row.rate}%`,
  },
];

const assigneeColumns: DataTableColumns<AssigneeRow> = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    render: (_row, index) => index + 1,
  },
  { title: '指派人', key: 'displayName', ellipsis: { tooltip: true } },
  { title: '样本', key: 'total', width: 70 },
  {
    title: '履约率',
    key: 'rate',
    width: 90,
    sorter: (a, b) => a.rate - b.rate,
    render(row) {
      const color = row.rate >= 80 ? undefined : row.rate >= 60 ? '#f0a020' : '#d03050';
      return h('span', { style: color ? `color: ${color}` : undefined }, `${row.rate}%`);
    },
  },
  { title: '未履约', key: 'notFulfilled', width: 80 },
];

const detailColumns: DataTableColumns<BaselineItem> = [
  {
    title: '需求ID',
    key: 'id',
    width: 100,
    render(row) {
      return h(
        'a',
        {
          href: `${TFS_ITEM_URL}${row.id}`,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: 'color: #f0a020; text-decoration: none;',
        },
        row.id,
      );
    },
  },
  { title: '标题', key: 'title', ellipsis: { tooltip: true } },
  {
    title: '创建日期',
    key: 'created',
    width: 110,
    render: (row) => formatDisplayDate(row.created),
  },
  {
    title: '基线截止',
    key: 'deadline',
    width: 110,
    render: (row) => formatDisplayDate(row.deadline),
  },
  {
    title: '超基线天数',
    key: 'overdueDays',
    width: 100,
    render(row) {
      return h(NText, { type: 'error' }, () => `${row.overdueDays} 天`);
    },
  },
  {
    title: '优先级',
    key: 'priorityLabel',
    width: 80,
    render(row) {
      return h(NTag, { size: 'small', type: 'info', bordered: false }, () => row.priorityLabel);
    },
  },
];

function formatDisplayDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${y}/${m}/${d}`;
}

function rowProps(row: AssigneeRow) {
  return {
    style:
      row.assignee === selectedAssignee.value
        ? 'cursor: pointer; background: rgba(32, 128, 240, 0.1);'
        : 'cursor: pointer;',
    onClick: () => {
      selectedAssignee.value = row.assignee;
      detailCollapsed.value = false;
    },
  };
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    data.value = await api.get<BaselineData>('/dashboard/team-stats/baseline');
    selectedAssignee.value = null;
  } catch (e) {
    error.value = (e as Error).message;
    data.value = null;
  } finally {
    loading.value = false;
  }
}

function exportCsv(): void {
  const rows = data.value?.notFulfilledItems ?? [];
  if (!rows.length) return;
  const header = ['需求ID', '标题', '创建日期', '基线截止', '超基线天数', '优先级', '指派人', '状态'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.id,
        `"${r.title.replace(/"/g, '""')}"`,
        r.created,
        r.deadline,
        r.overdueDays,
        r.priorityLabel,
        r.assigneeDisplay,
        r.status,
      ].join(','),
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '基线未履约需求.csv';
  a.click();
  URL.revokeObjectURL(url);
}

watch(show, (visible) => {
  if (visible) void load();
});
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :style="{ width: '920px', maxWidth: '96vw' }"
    :bordered="false"
    :segmented="{ content: true, footer: 'soft' }"
    closable
  >
    <template #header>
      <div>
        <NSpace align="center" size="small">
          <NTag type="info" size="small" :bordered="false">基线</NTag>
          <NText strong style="font-size: 16px">基线履约率</NText>
        </NSpace>
        <NText depth="3" style="display: block; margin-top: 6px; font-size: 13px">
          按需求创建日期 + 优先级排期（L1=12天 · L2=21天 · L3=40天 · L4 不计）
          <template v-if="data?.startDate"> · {{ data.startDate }} 起样本</template>
        </NText>
      </div>
    </template>

    <NSpin :show="loading">
      <NEmpty v-if="error" :description="error" />
      <template v-else-if="data">
        <NGrid :cols="4" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
          <NGi span="2 m:1">
            <NStatistic label="团队履约率" :value="data.rate ?? 0">
              <template #suffix>%</template>
            </NStatistic>
          </NGi>
          <NGi span="2 m:1">
            <NStatistic label="已履约 / 未履约" :value="`${data.fulfilled ?? 0} / ${data.notFulfilled ?? 0}`" />
          </NGi>
          <NGi span="2 m:1">
            <NStatistic label="待评估（未到期）" :value="data.pending ?? 0" />
          </NGi>
          <NGi span="2 m:1">
            <NStatistic label="L4 排除" :value="data.excludedL4 ?? 0" />
          </NGi>
        </NGrid>

        <NText strong style="display: block; margin: 16px 0 8px">按优先级</NText>
        <NDataTable
          size="small"
          :columns="priorityColumns"
          :data="data.byPriority ?? []"
          :bordered="true"
          :pagination="false"
        />

        <NText depth="3" style="display: block; margin: 16px 0 8px; font-size: 12px">
          按指派人 · 点击行筛选下方未履约明细
        </NText>
        <NDataTable
          v-if="assigneeRows.length"
          size="small"
          :columns="assigneeColumns"
          :data="assigneeRows"
          :row-key="(row) => row.assignee"
          :max-height="200"
          :row-props="rowProps"
          :bordered="true"
        />

        <div style="margin-top: 16px">
          <NSpace justify="space-between" align="center" style="margin-bottom: 8px">
            <NText strong>
              未履约明细
              <template v-if="selectedAssigneeRow"> · {{ selectedAssigneeRow.displayName }}</template>
              · {{ (selectedAssignee ? detailItems : data.notFulfilledItems)?.length ?? 0 }} 条
            </NText>
            <NSpace size="small">
              <NButton v-if="selectedAssignee" text size="tiny" @click="selectedAssignee = null">
                清除筛选
              </NButton>
              <NButton text size="tiny" @click="detailCollapsed = !detailCollapsed">
                {{ detailCollapsed ? '展开' : '收起' }}
              </NButton>
            </NSpace>
          </NSpace>
          <NDataTable
            v-show="!detailCollapsed"
            size="small"
            :columns="detailColumns"
            :data="selectedAssignee ? detailItems : (data.notFulfilledItems ?? [])"
            :row-key="(row) => row.id"
            :max-height="240"
            :bordered="true"
          />
        </div>
      </template>
      <NEmpty v-else description="暂无数据" />
    </NSpin>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="!(data?.notFulfilledItems?.length)" @click="exportCsv">导出明细</NButton>
        <NButton @click="show = false">关闭</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
