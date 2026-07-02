<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import {
  NModal,
  NTag,
  NText,
  NDataTable,
  NSpin,
  NEmpty,
  NStatistic,
  NGrid,
  NGi,
  NSpace,
  type DataTableColumns,
} from 'naive-ui';
import { api } from '@/api/client';

interface DemandModule {
  moduleName: string;
  repo: string;
  sort: number;
  canMerge: boolean;
  preceding: number;
  branch: string;
}

interface DemandRow {
  demandId: string;
  title: string;
  assignor: string;
  moduleCount: number;
  priority: number;
  maxSort: number;
  canMergeAll: boolean;
  blockedCount: number;
  recommendation: string;
  recommendationLabel: string;
  modules?: DemandModule[];
}

interface OpsQueueData {
  asOf?: string;
  totals?: {
    repos: number;
    modules: number;
    demands: number;
    readyToMerge: number;
    blocked: number;
  };
  demands?: DemandRow[];
  cutInCandidates?: DemandRow[];
  error?: string;
}

const TFS_ITEM_URL =
  'http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0/WiNEX-BasicInfoService/_workitems/edit/';

const show = defineModel<boolean>('show', { default: false });

const loading = ref(false);
const error = ref('');
const data = ref<OpsQueueData | null>(null);
const selectedDemandId = ref<string | null>(null);

const selectedDemand = computed(() =>
  (data.value?.demands ?? []).find((r) => r.demandId === selectedDemandId.value),
);

const demandColumns: DataTableColumns<DemandRow> = [
  { title: '优先级', key: 'priority', width: 64, sorter: (a, b) => a.priority - b.priority },
  {
    title: '需求',
    key: 'demandId',
    width: 88,
    render(row) {
      return h(
        'a',
        { href: `${TFS_ITEM_URL}${row.demandId}`, target: '_blank', rel: 'noopener' },
        row.demandId,
      );
    },
  },
  { title: '标题', key: 'title', ellipsis: { tooltip: true } },
  { title: '改动人', key: 'assignor', width: 80, ellipsis: { tooltip: true } },
  { title: '模块', key: 'moduleCount', width: 52 },
  {
    title: '可合并',
    key: 'canMergeAll',
    width: 64,
    render(row) {
      return h(
        NTag,
        { size: 'small', type: row.canMergeAll ? 'success' : 'warning', bordered: false },
        () => (row.canMergeAll ? '是' : '否'),
      );
    },
  },
  {
    title: '插队建议',
    key: 'recommendationLabel',
    width: 88,
    render(row) {
      const type =
        row.recommendation === 'ready'
          ? 'success'
          : row.recommendation === 'near'
            ? 'info'
            : row.recommendation === 'blocked'
              ? 'error'
              : 'default';
      return h(NTag, { size: 'small', type, bordered: false }, () => row.recommendationLabel);
    },
  },
];

const moduleColumns: DataTableColumns<DemandModule> = [
  { title: '仓库', key: 'repo', ellipsis: { tooltip: true } },
  { title: '模块', key: 'moduleName', width: 130, ellipsis: { tooltip: true } },
  { title: '分支', key: 'branch', width: 110, ellipsis: { tooltip: true } },
  { title: '优先级', key: 'sort', width: 64 },
  { title: '前面', key: 'preceding', width: 52 },
  {
    title: '合并',
    key: 'canMerge',
    width: 56,
    render(row) {
      return row.canMerge ? '能' : '不能';
    },
  },
];

function demandRowProps(row: DemandRow) {
  return {
    style: 'cursor:pointer',
    onClick: () => {
      selectedDemandId.value = selectedDemandId.value === row.demandId ? null : row.demandId;
    },
  };
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  selectedDemandId.value = null;
  try {
    data.value = await api.get<OpsQueueData>('/dashboard/ops-queue');
    if (data.value?.error) error.value = data.value.error;
  } catch (e) {
    error.value = (e as Error).message;
    data.value = null;
  } finally {
    loading.value = false;
  }
}

watch(show, (v) => {
  if (v) load();
});
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :style="{ width: '980px', maxWidth: '96vw' }"
    :bordered="false"
    :segmented="{ content: true, footer: 'soft' }"
    closable
  >
    <template #header>
      <div>
        <NText strong style="font-size: 16px">前端仓库排队</NText>
        <NText depth="3" style="display: block; margin-top: 6px; font-size: 13px">
          以需求为维度汇总各模块 · 按瓶颈优先级排序（数字越小越靠前）
        </NText>
      </div>
    </template>

    <NSpin :show="loading">
      <NEmpty v-if="error" :description="error" />
      <template v-else-if="data">
        <template v-if="data.cutInCandidates?.length">
          <NText strong style="display: block; margin-bottom: 6px">可插队推荐</NText>
          <NSpace :size="8" :wrap="true" style="margin-bottom: 12px">
            <NTag
              v-for="item in data.cutInCandidates.slice(0, 5)"
              :key="item.demandId"
              size="small"
              :type="item.canMergeAll ? 'success' : 'info'"
              :bordered="false"
              style="cursor: pointer"
              @click="selectedDemandId = item.demandId"
            >
              #{{ item.demandId }} · P{{ item.priority }} · {{ item.recommendationLabel }}
            </NTag>
          </NSpace>
        </template>

        <NGrid :cols="5" :x-gap="12" :y-gap="8" responsive="screen" item-responsive>
          <NGi span="5 s:1">
            <NStatistic label="前端仓库" :value="data.totals?.repos ?? 0" />
          </NGi>
          <NGi span="5 s:1">
            <NStatistic label="排队需求" :value="data.totals?.demands ?? 0" />
          </NGi>
          <NGi span="5 s:1">
            <NStatistic label="模块记录" :value="data.totals?.modules ?? 0" />
          </NGi>
          <NGi span="5 s:1">
            <NStatistic label="可合并" :value="data.totals?.readyToMerge ?? 0" />
          </NGi>
          <NGi span="5 s:1">
            <NStatistic label="阻塞中" :value="data.totals?.blocked ?? 0" />
          </NGi>
        </NGrid>

        <NText strong style="display: block; margin: 16px 0 8px">需求排队（按优先级）</NText>
        <NText depth="3" style="display: block; margin-bottom: 8px; font-size: 12px">
          点击行展开该需求下所有前端模块的排队明细
        </NText>
        <NDataTable
          size="small"
          :columns="demandColumns"
          :data="data.demands ?? []"
          :row-key="(row) => row.demandId"
          :row-props="demandRowProps"
          :default-sort="{ columnKey: 'priority', order: 'ascend' }"
          :bordered="true"
          :pagination="{ pageSize: 15 }"
        />

        <template v-if="selectedDemand?.modules?.length">
          <NText strong style="display: block; margin: 16px 0 8px">
            需求 {{ selectedDemand.demandId }} · {{ selectedDemand.moduleCount }} 个模块
          </NText>
          <NDataTable
            size="small"
            :columns="moduleColumns"
            :data="selectedDemand.modules"
            :bordered="true"
            :pagination="false"
          />
        </template>

      </template>
    </NSpin>
  </NModal>
</template>
