<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import {
  NStatistic,
  NSpace,
  NEmpty,
  NText,
  NButton,
  NDataTable,
  NTag,
  NProgress,
  type DataTableColumns,
} from 'naive-ui';
import DashboardCard from '@/components/DashboardCard.vue';
import TfsOverdueModal from '@/components/TfsOverdueModal.vue';
import TfsBaselineModal from '@/components/TfsBaselineModal.vue';
import OpsQueueModal from '@/components/OpsQueueModal.vue';
import { api } from '@/api/client';

interface DashboardData {
  tfs?: { todo: number; bug: number; pool: number; overdue: number };
  raw?: string;
}

interface TeamStatsPreview {
  overdueTotal?: number;
  baselineRate?: number;
  team?: string;
}

interface LoadMember {
  assignee: string;
  displayName: string;
  items: number;
  score: number;
  imminentCount: number;
  loadRate: number;
  threshold: number;
  status: 'normal' | 'low' | 'overload';
  statusLabel: string;
}

interface LoadData {
  team?: string;
  memberCount?: number;
  members?: LoadMember[];
  thresholds?: { score: number; imminent: number };
}

interface ResolvedMember {
  assignee: string;
  displayName: string;
  requirements: number;
  tasks: number;
  bugs: number;
  queued: number;
  total: number;
}

interface ResolvedData {
  team?: string;
  days?: number;
  startDate?: string;
  endDate?: string;
  totals?: {
    requirements: number;
    tasks: number;
    bugs: number;
    queued: number;
    total: number;
  };
  members?: ResolvedMember[];
}

interface OpsDemandRow {
  demandId: string;
  title: string;
  assignor: string;
  moduleCount: number;
  priority: number;
  canMergeAll: boolean;
  recommendationLabel: string;
  modules?: Array<{ moduleName: string; repo: string; sort: number; canMerge: boolean }>;
}

interface OpsQueuePreview {
  demands?: number;
  readyToMerge?: number;
  modules?: number;
  list?: OpsDemandRow[];
  cutInCandidates?: OpsDemandRow[];
}

const data = ref<DashboardData | null>(null);
const teamPreview = ref<TeamStatsPreview>({});
const teamLoad = ref<LoadData | null>(null);
const teamResolved = ref<ResolvedData | null>(null);
const opsQueue = ref<OpsQueuePreview>({});
const loading = ref(false);
const teamLoading = ref(false);
const opsLoading = ref(false);
const error = ref('');
const showOverdue = ref(false);
const showBaseline = ref(false);
const showOpsQueue = ref(false);
const selectedOpsDemandId = ref<string | null>(null);

const TFS_ITEM_URL =
  'http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0/WiNEX-BasicInfoService/_workitems/edit/';

const selectedOpsDemand = computed(() =>
  opsQueue.value.list?.find((r) => r.demandId === selectedOpsDemandId.value),
);

const opsDemandColumns: DataTableColumns<OpsDemandRow> = [
  { title: 'P', key: 'priority', width: 40 },
  {
    title: '需求',
    key: 'demandId',
    width: 72,
    render(row) {
      return h(
        'a',
        { href: `${TFS_ITEM_URL}${row.demandId}`, target: '_blank', rel: 'noopener', style: 'font-size:12px' },
        row.demandId,
      );
    },
  },
  { title: '标题', key: 'title', ellipsis: { tooltip: true } },
  { title: '改动人', key: 'assignor', width: 72, ellipsis: { tooltip: true } },
  { title: '模块', key: 'moduleCount', width: 44 },
  {
    title: '合并',
    key: 'canMergeAll',
    width: 48,
    render(row) {
      return h(
        NTag,
        { size: 'small', type: row.canMergeAll ? 'success' : 'warning', bordered: false },
        () => (row.canMergeAll ? '能' : '否'),
      );
    },
  },
  { title: '建议', key: 'recommendationLabel', width: 72, ellipsis: { tooltip: true } },
];

const loadColumns: DataTableColumns<LoadMember> = [
  { title: '成员', key: 'displayName', width: 72, ellipsis: { tooltip: true } },
  { title: '未完成', key: 'items', width: 56 },
  { title: '积分', key: 'score', width: 48 },
  { title: '即将', key: 'imminentCount', width: 48 },
  {
    title: '负载',
    key: 'loadRate',
    width: 100,
    sorter: (a, b) => a.loadRate - b.loadRate,
    defaultSortOrder: 'descend',
    render(row) {
      const type =
        row.status === 'overload' ? 'error' : row.status === 'low' ? 'warning' : 'success';
      return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
        h(NProgress, {
          type: 'line',
          percentage: Math.min(row.loadRate, 200),
          indicatorPlacement: 'inside',
          status: type,
          style: 'flex:1',
        }),
        h(NText, { depth: 3, style: 'font-size:12px;min-width:36px' }, () => `${row.loadRate}%`),
      ]);
    },
  },
  {
    title: '状态',
    key: 'statusLabel',
    width: 56,
    render(row) {
      const type =
        row.status === 'overload' ? 'error' : row.status === 'low' ? 'warning' : 'success';
      return h(NTag, { size: 'small', type, bordered: false }, () => row.statusLabel);
    },
  },
];

const resolvedColumns: DataTableColumns<ResolvedMember> = [
  { title: '成员', key: 'displayName', width: 72, ellipsis: { tooltip: true } },
  { title: '需求', key: 'requirements', width: 48 },
  { title: '任务', key: 'tasks', width: 48 },
  { title: 'BUG', key: 'bugs', width: 44 },
  { title: '排队', key: 'queued', width: 48 },
  {
    title: '计',
    key: 'total',
    width: 44,
    sorter: (a, b) => a.total - b.total,
    defaultSortOrder: 'descend',
  },
];

const teamLabel = computed(
  () => teamPreview.value.team || teamLoad.value?.team || teamResolved.value?.team || '',
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    data.value = await api.get<DashboardData>('/dashboard');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadTeamMetrics(): Promise<void> {
  teamLoading.value = true;
  try {
    const [overdue, baseline, load, resolved] = await Promise.all([
      api.get<{ total?: number; team?: string }>('/dashboard/team-stats/overdue'),
      api.get<{ rate?: number; team?: string }>('/dashboard/team-stats/baseline'),
      api.get<LoadData>('/dashboard/team-stats/load'),
      api.get<ResolvedData>('/dashboard/team-stats/resolved?days=7'),
    ]);
    teamPreview.value = {
      overdueTotal: overdue.total ?? 0,
      baselineRate: baseline.rate ?? 0,
      team: overdue.team || baseline.team || load.team || resolved.team,
    };
    teamLoad.value = load;
    teamResolved.value = resolved;
  } catch {
    teamPreview.value = {};
    teamLoad.value = null;
    teamResolved.value = null;
  } finally {
    teamLoading.value = false;
  }
}

async function loadOpsQueue(): Promise<void> {
  opsLoading.value = true;
  selectedOpsDemandId.value = null;
  try {
    const res = await api.get<{
      totals?: { demands?: number; readyToMerge?: number; modules?: number };
      demands?: OpsDemandRow[];
      cutInCandidates?: OpsDemandRow[];
    }>('/dashboard/ops-queue');
    opsQueue.value = {
      demands: res.totals?.demands ?? 0,
      readyToMerge: res.totals?.readyToMerge ?? 0,
      modules: res.totals?.modules ?? 0,
      list: res.demands ?? [],
      cutInCandidates: res.cutInCandidates ?? [],
    };
  } catch {
    opsQueue.value = {};
  } finally {
    opsLoading.value = false;
  }
}

function opsDemandRowProps(row: OpsDemandRow) {
  return {
    style: 'cursor:pointer',
    onClick: () => {
      selectedOpsDemandId.value = selectedOpsDemandId.value === row.demandId ? null : row.demandId;
    },
  };
}

async function refreshAll(): Promise<void> {
  await Promise.all([load(), loadTeamMetrics(), loadOpsQueue()]);
}

onMounted(refreshAll);
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h2 class="dashboard-title">驾驶舱</h2>
      <NText v-if="teamLabel" depth="3" class="dashboard-team">{{ teamLabel }}</NText>
    </div>
    <div class="dashboard-grid">
      <DashboardCard title="今日 TFS 概览" :loading="loading" class="dash-cell dash-row-1" @refresh="refreshAll">
        <NSpace v-if="data?.tfs" justify="space-around" :size="4" :wrap="false" class="stat-row stat-row--inline">
          <NStatistic label="待处理" :value="data.tfs.todo" />
          <NStatistic label="BUG" :value="data.tfs.bug" />
          <NStatistic label="公共池" :value="data.tfs.pool" />
          <NStatistic label="超期" :value="data.tfs.overdue" />
        </NSpace>
        <NEmpty v-else description="暂无数据" size="small" />
      </DashboardCard>

      <DashboardCard title="TFS 团队统计" :loading="teamLoading" class="dash-cell dash-row-1" @refresh="loadTeamMetrics">
        <div class="metric-pair">
          <div class="metric-chip metric-chip--click" @click="showOverdue = true">
            <NText depth="3" class="metric-label">超期</NText>
            <span class="metric-value metric-value--danger">{{ teamPreview.overdueTotal ?? '—' }}</span>
          </div>
          <div class="metric-chip metric-chip--click" @click="showBaseline = true">
            <NText depth="3" class="metric-label">履约率</NText>
            <span class="metric-value metric-value--info">
              {{ teamPreview.baselineRate != null ? `${teamPreview.baselineRate}%` : '—' }}
            </span>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard title="团队负载" :loading="teamLoading" class="dash-cell dash-row-2" @refresh="loadTeamMetrics">
        <NDataTable
          v-if="teamLoad?.members?.length"
          size="small"
          :columns="loadColumns"
          :data="teamLoad.members"
          :row-key="(row) => row.assignee"
          :max-height="200"
          :bordered="true"
        />
        <NEmpty v-else description="暂无数据" size="small" />
      </DashboardCard>

      <DashboardCard title="近 7 天已解决" :loading="teamLoading" class="dash-cell dash-row-2" @refresh="loadTeamMetrics">
        <NSpace v-if="teamResolved?.totals" :size="4" :wrap="false" class="stat-row stat-row--inline" style="margin-bottom: 4px">
          <NStatistic label="需求" :value="teamResolved.totals.requirements" />
          <NStatistic label="任务" :value="teamResolved.totals.tasks" />
          <NStatistic label="BUG" :value="teamResolved.totals.bugs" />
          <NStatistic label="排队" :value="teamResolved.totals.queued" />
        </NSpace>
        <NDataTable
          v-if="teamResolved?.members?.length"
          size="small"
          :columns="resolvedColumns"
          :data="teamResolved.members"
          :row-key="(row) => row.assignee"
          :max-height="200"
          :bordered="true"
        />
        <NEmpty v-else description="暂无数据" size="small" />
      </DashboardCard>

      <DashboardCard title="前端仓库排队" :loading="opsLoading" class="dash-cell dash-row-3" @refresh="loadOpsQueue">
        <div v-if="opsQueue.demands != null" class="ops-panel">
          <div v-if="opsQueue.cutInCandidates?.length" class="ops-cutin">
            <NText depth="3" class="ops-cutin-label">可插队</NText>
            <NSpace :size="6" :wrap="true">
              <NTag
                v-for="item in opsQueue.cutInCandidates.slice(0, 5)"
                :key="item.demandId"
                size="small"
                :type="item.canMergeAll ? 'success' : 'info'"
                :bordered="false"
                style="cursor: pointer"
                @click="selectedOpsDemandId = item.demandId"
              >
                #{{ item.demandId }} · P{{ item.priority }} · {{ item.recommendationLabel }}
              </NTag>
            </NSpace>
          </div>
          <div class="ops-stats">
            <span class="ops-stat"><em>排队</em>{{ opsQueue.demands }}</span>
            <span class="ops-stat"><em>模块</em>{{ opsQueue.modules ?? 0 }}</span>
            <span class="ops-stat"><em>可合并</em>{{ opsQueue.readyToMerge ?? 0 }}</span>
            <NButton size="tiny" type="primary" ghost @click="showOpsQueue = true">全部</NButton>
          </div>
          <NDataTable
            v-if="opsQueue.list?.length"
            size="small"
            :columns="opsDemandColumns"
            :data="opsQueue.list"
            :row-key="(row) => row.demandId"
            :row-props="opsDemandRowProps"
            :max-height="160"
            :bordered="true"
          />
          <div v-if="selectedOpsDemand?.modules?.length" class="ops-modules">
            <NText depth="3" style="font-size: 11px">
              #{{ selectedOpsDemand.demandId }} 模块：
              {{
                selectedOpsDemand.modules
                  .map((m) => `${m.repo}/${m.moduleName}(P${m.sort}${m.canMerge ? '' : '·阻塞'})`)
                  .join(' · ')
              }}
            </NText>
          </div>
        </div>
        <NEmpty v-else-if="opsQueue.demands === 0" description="暂无排队" size="small" />
      </DashboardCard>
    </div>

    <NText v-if="data?.raw" depth="3" class="raw-hint">
      引擎返回了非结构化内容,已回退展示:{{ data.raw.slice(0, 200) }}…
    </NText>

    <TfsOverdueModal v-model:show="showOverdue" />
    <TfsBaselineModal v-model:show="showBaseline" />
    <OpsQueueModal v-model:show="showOpsQueue" />
  </div>
</template>

<style scoped>
.dashboard-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}

.dashboard-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
}

.dashboard-team {
  font-size: 13px;
}

/* 固定三行：1) TFS概览+团队统计  2) 负载+已解决  3) 前端排队通栏 */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: stretch;
}

.dash-cell {
  min-width: 0;
}

.dash-row-3 {
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .dash-row-3 {
    grid-column: auto;
  }

  .stat-row--inline {
    flex-wrap: wrap !important;
  }
}

.card-hint {
  display: block;
  font-size: 11px;
  margin-bottom: 4px;
  line-height: 1.2;
}

.card-hint--tight {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-row :deep(.n-statistic) {
  text-align: center;
}

.stat-row :deep(.n-statistic-label) {
  font-size: 10px;
}

.stat-row :deep(.n-statistic-value) {
  font-size: 16px;
}

.stat-row--inline :deep(.n-statistic-value__content) {
  font-size: 16px;
}

.metric-pair {
  display: flex;
  gap: 6px;
}

.metric-chip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.03);
  min-width: 0;
}

.metric-chip--click {
  cursor: pointer;
}

.metric-chip--click:hover {
  background: rgba(0, 0, 0, 0.06);
}

.metric-label {
  font-size: 14px;
  flex-shrink: 0;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1;
}

.metric-value--danger {
  color: #d03050;
}

.metric-value--info {
  color: #2080f0;
}

.ops-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ops-cutin {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.ops-cutin-label {
  font-size: 11px;
  flex-shrink: 0;
  line-height: 22px;
}

.ops-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ops-stat {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}

.ops-stat em {
  font-style: normal;
  font-size: 10px;
  font-weight: 400;
  color: var(--n-text-color-3);
  margin-right: 3px;
}

.ops-modules {
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.03);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.raw-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
}
</style>
