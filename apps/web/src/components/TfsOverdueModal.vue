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
  type DataTableColumns,
} from 'naive-ui';
import { api } from '@/api/client';

export interface OverdueSummaryRow {
  assignee: string;
  displayName: string;
  count: number;
}

export interface OverdueItem {
  id: string;
  title: string;
  created: string;
  expectedDate: string;
  deliveryDate: string;
  overdueDays: number;
  priority: string;
  priorityLabel: string;
  assignee: string;
  assigneeDisplay: string;
  status: string;
}

export interface OverdueData {
  team?: string;
  project?: string;
  total?: number;
  assigneeCount?: number;
  summary?: OverdueSummaryRow[];
  details?: Record<string, OverdueItem[]>;
}

const TFS_ITEM_URL =
  'http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0/WiNEX-BasicInfoService/_workitems/edit/';

const show = defineModel<boolean>('show', { default: false });

const loading = ref(false);
const error = ref('');
const data = ref<OverdueData | null>(null);
const selectedAssignee = ref<string | null>(null);
const detailCollapsed = ref(false);

const summaryRows = computed(() => data.value?.summary ?? []);

const selectedSummary = computed(() =>
  summaryRows.value.find((r) => r.assignee === selectedAssignee.value),
);

const detailItems = computed(() => {
  if (!selectedAssignee.value || !data.value?.details) return [];
  return data.value.details[selectedAssignee.value] ?? [];
});

const summaryColumns: DataTableColumns<OverdueSummaryRow> = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    render: (_row, index) => index + 1,
  },
  { title: '指派人', key: 'displayName', ellipsis: { tooltip: true } },
  {
    title: '超期需求数',
    key: 'count',
    width: 120,
    sorter: (a, b) => a.count - b.count,
    defaultSortOrder: 'descend',
  },
];

const detailColumns: DataTableColumns<OverdueItem> = [
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
    title: '交付日期',
    key: 'deliveryDate',
    width: 110,
    render: (row) => formatDisplayDate(row.deliveryDate || row.expectedDate),
  },
  {
    title: '超期天数',
    key: 'overdueDays',
    width: 90,
    render(row) {
      return h(NText, { type: 'error' }, () => `${row.overdueDays} 天`);
    },
  },
  {
    title: '优先级',
    key: 'priorityLabel',
    width: 80,
    render(row) {
      const type = priorityTagType(row.priority);
      return h(NTag, { size: 'small', type, bordered: false }, () => row.priorityLabel);
    },
  },
];

function formatDisplayDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${y}/${m}/${d}`;
}

function priorityTagType(priority: string): 'error' | 'warning' | 'info' | 'default' {
  if (priority === 'L1') return 'error';
  if (priority === 'L2') return 'warning';
  if (priority === 'L3') return 'info';
  return 'default';
}

function rowProps(row: OverdueSummaryRow) {
  return {
    style:
      row.assignee === selectedAssignee.value
        ? 'cursor: pointer; background: rgba(240, 160, 32, 0.12);'
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
    data.value = await api.get<OverdueData>('/dashboard/team-stats/overdue');
    const first = data.value.summary?.[0];
    selectedAssignee.value = first?.assignee ?? null;
  } catch (e) {
    error.value = (e as Error).message;
    data.value = null;
  } finally {
    loading.value = false;
  }
}

function exportCsv(): void {
  const rows = detailItems.value;
  if (!rows.length) return;
  const header = ['需求ID', '标题', '创建日期', '交付日期', '超期天数', '优先级', '状态'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.id,
        `"${r.title.replace(/"/g, '""')}"`,
        r.created,
        r.deliveryDate || r.expectedDate,
        r.overdueDays,
        r.priorityLabel,
        r.status,
      ].join(','),
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `超期需求_${selectedSummary.value?.displayName ?? '明细'}.csv`;
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
          <NTag type="warning" size="small" :bordered="false">超期</NTag>
          <NText strong style="font-size: 16px">超期需求</NText>
        </NSpace>
        <NText depth="3" style="display: block; margin-top: 6px; font-size: 13px">
          共 {{ data?.total ?? 0 }} 条超期需求，{{ data?.assigneeCount ?? 0 }} 位指派人（按指派人汇总）
        </NText>
      </div>
    </template>

    <NSpin :show="loading">
      <NEmpty v-if="error" :description="error" />
      <template v-else>
        <NText depth="3" style="display: block; margin-bottom: 8px; font-size: 12px">
          按指派人汇总 · 点击行查看下方明细
        </NText>
        <NDataTable
          v-if="summaryRows.length"
          size="small"
          :columns="summaryColumns"
          :data="summaryRows"
          :row-key="(row) => row.assignee"
          :max-height="220"
          :row-props="rowProps"
          :bordered="true"
        />
        <NEmpty v-else description="暂无超期需求" style="margin: 16px 0" />

        <div v-if="selectedSummary" style="margin-top: 16px">
          <NSpace justify="space-between" align="center" style="margin-bottom: 8px">
            <NText strong>
              需求明细 {{ selectedSummary.displayName }} · {{ selectedSummary.count }} 条超期需求
            </NText>
            <NButton text size="tiny" @click="detailCollapsed = !detailCollapsed">
              {{ detailCollapsed ? '展开' : '收起' }}
            </NButton>
          </NSpace>
          <NDataTable
            v-show="!detailCollapsed"
            size="small"
            :columns="detailColumns"
            :data="detailItems"
            :row-key="(row) => row.id"
            :max-height="260"
            :bordered="true"
          />
        </div>
      </template>
    </NSpin>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="!detailItems.length" @click="exportCsv">导出明细</NButton>
        <NButton @click="show = false">关闭</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
